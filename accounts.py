"""
Player accounts and game tokens.

Passwords: we never store a password, only a one-way hash of it (werkzeug's
generate_password_hash, which salts and stretches it). Even someone who copied
the database couldn't read anyone's password.

Game tokens: the Flash game sends `USERID` and `user_key` with every request.
The original server ignored `user_key` (it was always 123456789) and simply
trusted USERID - so anyone could send commands as anyone. Now, when you open
the game page, we put a *signed* token in `user_key` that says "this is
village X". The signature is made with the server's secret key, so it can't be
forged or edited, and every game request must carry a token matching its
USERID.

Stamps: the login cookie and every game token also carry the account's
stamp, a short fingerprint of its password hash (made with the server's
secret key, so it gives nothing away). A new password means a new stamp, so
changing it signs out every browser and stops every game opened with the old
one: if someone else got into your account, changing your password throws
them out.
"""

import hmac
import re
import secrets
import threading

from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from werkzeug.security import check_password_hash, generate_password_hash

import config_env
from sessions import owner_of, storage
from storage import UsernameTaken

USERNAME_RE = re.compile(r"^[A-Za-z0-9_]{3,20}$")
MIN_PASSWORD = 8

_serializer = URLSafeTimedSerializer(config_env.SECRET_KEY, salt="game-token")

# A hash to compare against when the username doesn't exist, so a failed login
# takes the same time either way (otherwise timing reveals which names exist).
_DUMMY_HASH = generate_password_hash("not-a-real-password")


class AccountError(Exception):
    """A problem to show the player, e.g. 'username taken'."""


class WrongPassword(AccountError):
    """Counted like a failed login: guessing is limited the same way."""


def _check_new_password(username: str, password: str):
    if len(password or "") < MIN_PASSWORD:
        raise AccountError(f"Passwords need at least {MIN_PASSWORD} characters.")
    if password.lower() == username.lower():
        raise AccountError("Your password can't be your username.")


def register(username: str, password: str, invite_code: str = "") -> int:
    username = (username or "").strip()
    if not config_env.ALLOW_REGISTRATION:
        raise AccountError("Sign-ups are closed right now.")
    if config_env.INVITE_CODE and invite_code.strip() != config_env.INVITE_CODE:
        raise AccountError("That invite code isn't right.")
    if not USERNAME_RE.match(username):
        raise AccountError("Usernames are 3-20 characters: letters, numbers and _ only.")
    _check_new_password(username, password)
    try:
        return storage().create_user(username, generate_password_hash(password))
    except UsernameTaken:
        raise AccountError("That username is taken.")


def authenticate(username: str, password: str):
    """Return the user dict if the password is right, else None."""
    user = storage().get_user_by_name((username or "").strip())
    if user is None:
        check_password_hash(_DUMMY_HASH, password or "")
        return None
    if check_password_hash(user["password_hash"], password or ""):
        return {"id": user["id"], "username": user["username"]}
    return None


# Stamps

_stamps = {}  # account id -> stamp, so game requests needn't ask the database
_stamps_lock = threading.Lock()  # a password change and a lookup can't cross


def _stamp(password_hash: str) -> str:
    return hmac.new(config_env.SECRET_KEY.encode(), password_hash.encode(), "sha256").hexdigest()[:16]


def stamp_of(user_id) -> str:
    """The account's stamp now ("" if there's no such account)."""
    with _stamps_lock:
        if user_id not in _stamps:
            password_hash = storage().get_password_hash(user_id) if user_id is not None else None
            if password_hash is None:
                return ""
            _stamps[user_id] = _stamp(password_hash)
        return _stamps[user_id]


def _set_password(user_id: int, password: str):
    password_hash = generate_password_hash(password)
    with _stamps_lock:
        storage().set_password(user_id, password_hash)
        _stamps[user_id] = _stamp(password_hash)


def forget(user_id: int):
    """An account deleted: its stamp goes too."""
    with _stamps_lock:
        _stamps.pop(user_id, None)


# Signing in

def sign_in(web_session, user: dict):
    """Sign this browser in to the account (a fresh cookie, so nothing from
    before signing in carries over)."""
    web_session.clear()
    web_session.permanent = True
    web_session.update(user_id=user["id"], username=user["username"], stamp=stamp_of(user["id"]))


def signed_in(web_session) -> dict:
    """The account a browser is signed in to, as {"id", "username"}, or None
    (signed out, the account was deleted, or its password changed since)."""
    user_id = web_session.get("user_id")
    user = storage().get_user(user_id) if user_id is not None else None
    if user is None or not hmac.compare_digest(web_session.get("stamp", ""), stamp_of(user_id)):
        return None
    return {"id": user["id"], "username": user["username"]}


def change_password(user: dict, current: str, new: str):
    """The player's own change, on the account page: the current password
    first, so a browser left signed in can't be used to take the account."""
    if authenticate(user["username"], current) is None:
        raise WrongPassword("Your current password isn't right.")
    _check_new_password(user["username"], new)
    _set_password(user["id"], new)


def is_admin(user) -> bool:
    return user is not None and user["username"].lower() in config_env.ADMINS


def new_password(user_id: int) -> str:
    """A new random password for an account (the admin page's reset), shown
    once to the admin to pass on."""
    password = secrets.token_urlsafe(9)  # 12 characters
    _set_password(user_id, password)
    return password


# Game tokens

def make_game_token(USERID: str) -> str:
    return _serializer.dumps([USERID, stamp_of(owner_of(USERID))])


def game_token_owner(token: str):
    """The empire a game token was made for, or None if it's forged, too old,
    or made before its account's password changed."""
    try:
        USERID, stamp = _serializer.loads(token or "", max_age=config_env.TOKEN_MAX_AGE)
    except (BadSignature, SignatureExpired, TypeError, ValueError):
        return None
    if not isinstance(USERID, str) or not isinstance(stamp, str):
        return None
    return USERID if hmac.compare_digest(stamp, stamp_of(owner_of(USERID))) else None


def check_game_token(USERID: str, token: str) -> bool:
    return game_token_owner(token) == USERID
