"""
Signing in with Discord or Google, through Supabase Auth.

Supabase does the talking to Discord and Google, so this server never sees
anyone's Discord or Google password. The steps (OAuth with PKCE):

1. The player clicks "Discord". start() makes a random secret, the
   "verifier", which the server keeps in the player's login cookie, and sends
   their browser to Supabase with a fingerprint of it (the "challenge").
2. Supabase sends them on to Discord, Discord asks whether they allow it, and
   Supabase sends them back to /auth/callback with a code, good for one use.
3. finish() gives Supabase the code and the secret. Only the browser that
   started has the secret, so a code stolen or planted on the way is useless.
   Supabase answers with who the player is at Discord.
4. From there on it is our own accounts (accounts.py): that Discord account
   is linked to one of ours, or the player picks a name for a new one.

No Supabase session is kept: once we know who it is, the player gets our own
login cookie, the same as after typing a password.

Needs SE_SUPABASE_URL and SE_SUPABASE_KEY (config_env.py), and Discord and
Google switched on in Supabase (DEPLOY.md). Without them there are no
Discord or Google buttons, and usernames and passwords work as before.
"""

import base64
import hashlib
import json
import re
import secrets
import threading
import time
import urllib.error
import urllib.parse
import urllib.request

import config_env

PROVIDERS = {"discord": "Discord", "google": "Google"}  # in the order the buttons show

CHECK_EVERY = 300  # seconds between asking Supabase which ways in are switched on


class SignInFailed(Exception):
    """Supabase said no, or couldn't be reached. For the logs; the player sees a short message."""


def _call(method: str, path: str, body: dict = None, timeout: float = 10) -> dict:
    request = urllib.request.Request(
        config_env.SUPABASE_URL + "/auth/v1" + path, method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={"apikey": config_env.SUPABASE_KEY, "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return json.loads(response.read())
    except urllib.error.HTTPError as e:
        try:
            answer = json.loads(e.read())
            detail = answer.get("msg") or answer.get("error_description") or answer.get("error_code")
        except ValueError:
            detail = None
        raise SignInFailed(f"Supabase answered {e.code}: {detail or e.reason}")
    except (urllib.error.URLError, TimeoutError, ValueError) as e:
        raise SignInFailed(f"Supabase couldn't be reached: {e}")


_switched_on = {"checked": 0.0, "providers": []}
_switched_on_lock = threading.Lock()


def available() -> list:
    """The ways in switched on in Supabase, of PROVIDERS. Asked every few
    minutes, so one switched on in Supabase's dashboard shows up by itself."""
    if not config_env.SUPABASE_URL or not config_env.SUPABASE_KEY:
        return []
    with _switched_on_lock:
        if time.time() - _switched_on["checked"] < CHECK_EVERY:
            return _switched_on["providers"]
        try:
            # Asked while the start page waits: not long, then the last answer.
            external = _call("GET", "/settings", timeout=4).get("external") or {}
            _switched_on["providers"] = [p for p in PROVIDERS if external.get(p) is True]
        except SignInFailed as e:
            print(f" [!] Sign-in: {e}")  # keep the last answer, and ask again in a minute
            _switched_on["checked"] = time.time() - CHECK_EVERY + 60
            return _switched_on["providers"]
        _switched_on["checked"] = time.time()
        return _switched_on["providers"]


def start(provider: str, come_back_to: str):
    """Where to send the player's browser, and the verifier to keep for finish()."""
    verifier = secrets.token_urlsafe(48)  # 64 characters (PKCE allows 43 to 128)
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
    query = urllib.parse.urlencode({"provider": provider, "redirect_to": come_back_to,
                                    "code_challenge": challenge, "code_challenge_method": "s256"})
    return f"{config_env.SUPABASE_URL}/auth/v1/authorize?{query}", verifier


def finish(provider: str, code: str, verifier: str) -> dict:
    """Who came back from Discord or Google: {"account": their id there, which
    never changes, "label": their name (Discord) or email (Google) there, for
    the Settings page, "suggestion": a username for a new player}."""
    answer = _call("POST", "/token?grant_type=pkce", {"auth_code": code, "code_verifier": verifier})
    # A Supabase user can have several ways in (Supabase joins up a Discord
    # and a Google account with the same email): take the one just used.
    for identity in (answer.get("user") or {}).get("identities") or []:
        if identity.get("provider") != provider:
            continue
        data = identity.get("identity_data") or {}
        account = str(data.get("provider_id") or data.get("sub") or identity.get("id") or "")
        if account:
            return {"account": account, "label": _label(provider, data), "suggestion": _suggestion(data)}
    raise SignInFailed(f"Supabase didn't say who this is at {PROVIDERS[provider]}")


def _label(provider: str, data: dict) -> str:
    if provider == "google":
        label = data.get("email") or data.get("name")
    else:
        label = (data.get("custom_claims") or {}).get("global_name") or data.get("full_name") or data.get("name")
    return str(label or PROVIDERS[provider])[:100]


def _suggestion(data: dict) -> str:
    """A username from their name there, if one can be made (3-20 letters, numbers or _)."""
    for name in ((data.get("custom_claims") or {}).get("global_name"), data.get("name"), data.get("full_name")):
        name = re.sub(r"#\d+$", "", str(name or ""))  # Discord's old "name#1234"
        name = re.sub(r"[^A-Za-z0-9_]", "", name.replace(" ", "_"))[:20]
        if len(name) >= 3:
            return name
    return ""
