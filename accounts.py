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
"""

import re

from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from werkzeug.security import check_password_hash, generate_password_hash

import config_env
from sessions import storage
from storage import UsernameTaken

USERNAME_RE = re.compile(r"^[A-Za-z0-9_]{3,20}$")
MIN_PASSWORD = 8

_serializer = URLSafeTimedSerializer(config_env.SECRET_KEY, salt="game-token")

# A hash to compare against when the username doesn't exist, so a failed login
# takes the same time either way (otherwise timing reveals which names exist).
_DUMMY_HASH = generate_password_hash("not-a-real-password")


class AccountError(Exception):
    """A problem to show the player, e.g. 'username taken'."""


def register(username: str, password: str, invite_code: str = "") -> int:
    username = (username or "").strip()
    if not config_env.ALLOW_REGISTRATION:
        raise AccountError("Sign-ups are closed right now.")
    if config_env.INVITE_CODE and invite_code.strip() != config_env.INVITE_CODE:
        raise AccountError("That invite code isn't right.")
    if not USERNAME_RE.match(username):
        raise AccountError("Usernames are 3-20 characters: letters, numbers and _ only.")
    if len(password or "") < MIN_PASSWORD:
        raise AccountError(f"Passwords need at least {MIN_PASSWORD} characters.")
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


def make_game_token(USERID: str) -> str:
    return _serializer.dumps(USERID)


def game_token_owner(token: str):
    """The empire a game token was made for, or None if it's forged or too old."""
    try:
        return _serializer.loads(token or "", max_age=config_env.TOKEN_MAX_AGE)
    except (BadSignature, SignatureExpired):
        return None


def check_game_token(USERID: str, token: str) -> bool:
    return game_token_owner(token) == USERID
