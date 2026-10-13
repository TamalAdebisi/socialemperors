"""
Server settings, read from environment variables.

Everything that differs between "playing on my own PC" and "hosting for the
public" lives here, so the rest of the code never hard-codes an address,
secret or limit. Defaults are chosen so a plain `python server.py` still works
locally with no setup.

Environment variables
---------------------
SE_PUBLIC_URL        Base URL players' browsers use to reach the server,
                     e.g. https://empires.example.com  (default http://127.0.0.1:5050)
SE_BIND_HOST         Interface the server listens on (default 127.0.0.1;
                     use 0.0.0.0 inside a container)
SE_PORT              Port to listen on (default 5050)
SE_SECRET_KEY        Key used to sign login cookies and game tokens. If unset,
                     one is generated and stored in SE_DATA_DIR/secret_key.
SE_DATA_DIR          Where local data lives (SQLite DB, secret key). Default ./data
SE_STORAGE           "sqlite" (default) or "d1" (Cloudflare D1, see storage.py)
SE_ALLOW_REGISTRATION  "1" (default) to let anyone sign up, "0" to close sign-ups
SE_INVITE_CODE       If set, new accounts must enter this code (closed beta)
SE_MAX_VILLAGES      Max empires per account (default 3)
SE_MAX_NEIGHBORS     Max other players shown as neighbours (default 30)
SE_CDN_FALLBACK      "1" to fetch missing assets from Social Point's old CDN
                     (default 0 - off, because on a public server it lets
                     strangers make your server download files)
SE_TOKEN_MAX_AGE     Seconds a game token stays valid (default 7 days)
SE_TRUSTED_PROXIES   How many proxies sit in front of the server (default 0)
"""

import os
import secrets


def _flag(name: str, default: bool) -> bool:
    value = os.environ.get(name)
    if value is None:
        return default
    return value.strip().lower() in ("1", "true", "yes", "on")


def _int(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name, default))
    except ValueError:
        return default


BIND_HOST = os.environ.get("SE_BIND_HOST", "127.0.0.1")
PORT = _int("SE_PORT", 5050)
PUBLIC_URL = os.environ.get("SE_PUBLIC_URL", f"http://127.0.0.1:{PORT}").rstrip("/")
SECURE_COOKIES = PUBLIC_URL.startswith("https://")

DATA_DIR = os.environ.get("SE_DATA_DIR", os.path.join(".", "data"))
STORAGE = os.environ.get("SE_STORAGE", "sqlite").strip().lower()

ALLOW_REGISTRATION = _flag("SE_ALLOW_REGISTRATION", True)
INVITE_CODE = os.environ.get("SE_INVITE_CODE") or None
MAX_VILLAGES_PER_USER = _int("SE_MAX_VILLAGES", 3)
MAX_NEIGHBORS = _int("SE_MAX_NEIGHBORS", 30)
CDN_FALLBACK = _flag("SE_CDN_FALLBACK", False)
TOKEN_MAX_AGE = _int("SE_TOKEN_MAX_AGE", 7 * 24 * 3600)
# Number of proxies in front of the app (e.g. Cloudflare + Railway = 2).
# Used to read the visitor's real IP for login rate-limiting. 0 = none.
TRUSTED_PROXIES = _int("SE_TRUSTED_PROXIES", 0)

# Game client versions players may pick. Anything else is rejected, so a
# crafted form can't inject text into the game page.
GAME_VERSIONS = {
    "SocialEmpires0926bsec.swf": "0.9.26b (Working)",
    "SocialEmpires1.1.5sec.swf": "1.1.5 (Experimental)",
    "SocialEmpires1.4.07sec.swf": "1.4.07 (Broken)",
}
DEFAULT_GAME_VERSION = "SocialEmpires0926bsec.swf"


def _load_secret_key() -> str:
    key = os.environ.get("SE_SECRET_KEY")
    if key:
        return key
    # No key given: create one once and keep it, so restarting the server
    # doesn't log everybody out.
    os.makedirs(DATA_DIR, exist_ok=True)
    path = os.path.join(DATA_DIR, "secret_key")
    if os.path.exists(path):
        with open(path) as f:
            return f.read().strip()
    key = secrets.token_hex(32)
    with open(path, "w") as f:
        f.write(key)
    try:
        os.chmod(path, 0o600)
    except OSError:
        pass
    return key


SECRET_KEY = _load_secret_key()
