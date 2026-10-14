"""
Form tokens, against cross-site request forgery.

A page on another site can make your browser send a form to ours, and the
browser would add our login cookie to it. So every form of ours carries a
random token, kept in the (signed) login cookie too, and a form sent without
the right one is refused: another site can't read our pages, so it can't know
the token. (The cookie's SameSite=Lax setting already blocks most of this in
modern browsers; the token covers the rest.)

    <input type="hidden" name="csrf" value="{{ csrf_token() }}">
"""

import hmac
import secrets

from flask import abort, request, session

FIELD = "csrf"
EXPIRED = "That page was open too long, so nothing was done. Please try again."


def token() -> str:
    if FIELD not in session:
        session[FIELD] = secrets.token_urlsafe(32)
    return session[FIELD]


def valid() -> bool:
    sent = request.form.get(FIELD, "")
    return bool(sent) and hmac.compare_digest(sent, session.get(FIELD, ""))


def check():
    if not valid():
        abort(400, description=EXPIRED)
