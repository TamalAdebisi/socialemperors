print(" [+] Loading basics...")
import json
import os
import threading
import time
import urllib.error
import urllib.request
from datetime import timedelta
from functools import wraps

if os.name == 'nt':
    os.system("color")
    os.system("title Social Empires Server")
else:
    import sys
    sys.stdout.write("\x1b]2;Social Empires Server\x07")

import config_env

print(" [+] Loading game config...")
from get_game_config import get_game_config, patch_game_config

print(" [+] Loading players...")
from get_player_info import get_player_info, get_neighbor_info
from sessions import (LOCK, load_saved_villages, start_background_saver, save_info, new_village,
                      fb_friends_str, owner_of, villages_of, share_tutorial, save_session, delete_village,
                      storage, session as village_of)
load_saved_villages()

print(" [+] Loading server...")
from flask import Flask, Response, render_template, send_from_directory, request, redirect, abort, make_response
from flask import session as web_session
from werkzeug.middleware.proxy_fix import ProxyFix
from werkzeug.utils import safe_join

import accounts
import admin
import bank
import comeback_bonus
import csrf
import friends
import gifts
import helps
import radar
import sign_in
from bundle import ASSETS_DIR, STUB_DIR, TEMPLATES_DIR, BASE_DIR
from command import command
from constants import Constant
from engine import timestamp_now
from quests import get_quest_map
import tournaments
from version import version_name
import worlds

app = Flask(__name__, template_folder=TEMPLATES_DIR)
app.secret_key = config_env.SECRET_KEY
app.config.update(
    SESSION_COOKIE_HTTPONLY=True,           # page scripts can't read the login cookie
    SESSION_COOKIE_SAMESITE="Lax",          # other sites can't submit our forms as you
    SESSION_COOKIE_SECURE=config_env.SECURE_COOKIES,  # only sent over HTTPS when hosted
    PERMANENT_SESSION_LIFETIME=timedelta(days=30),
)
if config_env.TRUSTED_PROXIES:
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=config_env.TRUSTED_PROXIES, x_proto=config_env.TRUSTED_PROXIES)
app.jinja_env.globals["csrf_token"] = csrf.token  # every form: <input type="hidden" name="csrf" ...>
app.register_blueprint(admin.admin)  # /admin, for the accounts in SE_ADMINS

print(" [+] Configuring server routes...")


###########
# HELPERS #
###########

def current_user():
    """The logged-in account as {"id", "username"}, or None."""
    return accounts.signed_in(web_session)


def json_response(data, status=200):
    # Turn game state into JSON while we still hold the lock, so another
    # request can't change a village halfway through sending it.
    return Response(json.dumps(data), status=status, mimetype="application/json")


def game_request(view):
    """Guard for endpoints the Flash game calls.

    Requires a valid signed game token (user_key) for the USERID in the
    request, then runs the endpoint while holding the game-state lock."""
    @wraps(view)
    def wrapper(*args, **kwargs):
        USERID = request.values.get("USERID", "")
        if not accounts.check_game_token(USERID, request.values.get("user_key", "")):
            print(f" [!] Rejected game request for USERID={USERID!r}: bad or expired token")
            return ("Invalid session, please reload the game.", 403)
        if village_of(USERID) is None:
            return ("Unknown village.", 404)
        with LOCK:
            return view(USERID, *args, **kwargs)
    return wrapper


class RateLimit:
    """At most `most` of something per visitor (IP address) in `window`
    seconds: wrong passwords, new accounts."""

    def __init__(self, window: int, most: int):
        self.window, self.most = window, most
        self.seen = {}  # ip -> times
        self.lock = threading.Lock()

    def _recent(self, ip, now):
        return [t for t in self.seen.get(ip, []) if now - t < self.window]

    def full(self, ip) -> bool:
        with self.lock:
            return len(self._recent(ip, time.time())) >= self.most

    def add(self, ip):
        now = time.time()
        with self.lock:
            self.seen[ip] = self._recent(ip, now) + [now]
            if len(self.seen) > 10000:  # forget the visitors who stopped
                recent = {ip: self._recent(ip, now) for ip in self.seen}
                self.seen = {ip: times for ip, times in recent.items() if times}


failed_logins = RateLimit(600, 10)  # 10 wrong passwords in 10 minutes, then wait
signups = RateLimit(3600, 5)        # 5 new accounts an hour


def client_ip():
    """The visitor's IP address, as reported by the host's proxy if configured."""
    if config_env.CLIENT_IP_HEADER:
        ip = request.headers.get(config_env.CLIENT_IP_HEADER)
        if ip:
            return ip.strip()
    return request.remote_addr or "?"


def render_home(error=None, tab="login"):
    user = current_user()
    if user is None:
        return render_template("auth.html", error=error, tab=tab, providers=sign_in_buttons(),
                               allow_registration=config_env.ALLOW_REGISTRATION,
                               invite_required=bool(config_env.INVITE_CODE))
    empires = villages_of(user["id"])
    return render_template("home.html", user=user, saves_info=empires, error=error, news=friends_news(user),
                           can_create=len(empires) < config_env.MAX_VILLAGES_PER_USER,
                           max_villages=config_env.MAX_VILLAGES_PER_USER)


def friends_news(user) -> int:
    """What waits on the Friends page: requests to answer, gifts to take, friends asking for help."""
    return (len(storage().friend_requests(user["id"])["to_me"]) + len(storage().waiting_gifts(user["id"]))
            + len(helps.asked_of(user["id"])))


def sign_in_buttons() -> list:
    """The Discord and Google buttons to show, as (provider, name): those switched on in Supabase."""
    return [(provider, sign_in.PROVIDERS[provider]) for provider in sign_in.available()]


##########
# ROUTES #
##########

## ACCOUNTS AND PAGES

@app.route("/", methods=["GET"])
def home():
    return render_home()


@app.route("/register", methods=["POST"])
def register():
    csrf.check()
    ip = client_ip()
    if signups.full(ip):
        return render_home(error="Too many new accounts from here. Try again in an hour.", tab="register"), 429
    username = request.form.get("username", "").strip()
    try:
        user_id = accounts.register(username, request.form.get("password", ""), request.form.get("invite", ""))
    except accounts.AccountError as e:
        return render_home(error=str(e), tab="register"), 400
    signups.add(ip)
    accounts.sign_in(web_session, {"id": user_id, "username": username})
    print(f"[ACCOUNT] Registered {username} (id {user_id})")
    return redirect("/")


@app.route("/login", methods=["POST"])
def login():
    csrf.check()
    ip = client_ip()
    if failed_logins.full(ip):
        return render_home(error="Too many failed attempts. Try again in a few minutes."), 429
    user = accounts.authenticate(request.form.get("username", ""), request.form.get("password", ""))
    if user is None:
        failed_logins.add(ip)
        print(f"[ACCOUNT] Failed login for {request.form.get('username', '')!r} from {ip}")
        return render_home(error="Wrong username or password."), 401
    accounts.sign_in(web_session, user)
    return redirect("/")


@app.route("/logout", methods=["GET", "POST"])
def logout():
    # A button, not a link: another site could send your browser to a link.
    if request.method == "POST":
        csrf.check()
        web_session.clear()
    return redirect("/")


## SIGNING IN WITH DISCORD OR GOOGLE (sign_in.py)

SIGN_IN_TIME = 600  # seconds to get through Discord or Google and back


@app.route("/auth/<provider>", methods=["POST"])
def start_sign_in(provider):
    """The Discord and Google buttons: on the start page to sign in (or up),
    on the Settings page to link one to the account."""
    csrf.check()
    user = current_user()
    linking = request.form.get("link") == "1"
    if provider not in sign_in.available() or (linking and user is None):
        return redirect("/")
    url, verifier = sign_in.start(provider, f"{config_env.PUBLIC_URL}/auth/callback")
    web_session["sign_in"] = {"provider": provider, "verifier": verifier, "started": int(time.time()),
                              "link": user["id"] if linking else None}
    return redirect(url)


@app.route("/auth/callback")
def finish_sign_in():
    """Back from Discord or Google, through Supabase."""
    flow = web_session.pop("sign_in", None)
    if not flow or time.time() - flow.get("started", 0) > SIGN_IN_TIME:
        return render_home(error="That sign-in took too long, or began in another browser. Please try again."), 400
    provider = flow["provider"]
    name = sign_in.PROVIDERS[provider]
    user = current_user()
    if flow["link"] is not None and (user is None or user["id"] != flow["link"]):
        return redirect("/")

    def failed(message):
        return render_settings(user, error=message, status=400) if flow["link"] else (render_home(error=message), 400)

    if request.args.get("error") or not request.args.get("code"):
        return failed(f"Signing in with {name} was cancelled.")
    try:
        who = sign_in.finish(provider, request.args["code"], flow["verifier"])
    except sign_in.SignInFailed as e:
        print(f"[ACCOUNT] Signing in with {name} failed: {e}")
        return failed(f"Signing in with {name} didn't work. Please try again.")

    if flow["link"]:
        try:
            accounts.link(user, provider, who["account"], who["label"])
        except accounts.AccountError as e:
            return failed(str(e))
        print(f"[ACCOUNT] {user['username']} linked {name}")
        return redirect(f"/settings?done=linked-{provider}")

    known = accounts.signed_in_with(provider, who["account"])
    if known is not None:
        accounts.sign_in(web_session, known)
        return redirect("/")
    # New here, or here already without having linked it: the welcome page asks which.
    web_session["new_player"] = dict(who, provider=provider, started=int(time.time()))
    return redirect("/welcome")


@app.route("/welcome", methods=["GET", "POST"])
def welcome():
    """Back from Discord or Google the first time: a name for a new account,
    or the username and password of one already here, to link it to."""
    pending = web_session.get("new_player")
    if not pending or time.time() - pending.get("started", 0) > SIGN_IN_TIME:
        web_session.pop("new_player", None)
        return redirect("/")
    provider = pending["provider"]
    name = sign_in.PROVIDERS[provider]

    def page(error=None, status=200, tab="new"):
        return render_template("welcome.html", pending=pending, provider=provider, provider_name=name,
                               error=error, tab=tab, allow_registration=config_env.ALLOW_REGISTRATION,
                               invite_required=bool(config_env.INVITE_CODE)), status

    if request.method == "GET":
        return page()
    csrf.check()
    ip = client_ip()
    if request.form.get("existing") == "1":
        if failed_logins.full(ip):
            return page("Too many failed attempts. Try again in a few minutes.", 429, "existing")
        user = accounts.authenticate(request.form.get("username", ""), request.form.get("password", ""))
        if user is None:
            failed_logins.add(ip)
            return page("Wrong username or password.", 401, "existing")
        try:
            accounts.link(user, provider, pending["account"], pending["label"])
        except accounts.AccountError as e:
            return page(str(e), 400, "existing")
        accounts.sign_in(web_session, user)
        print(f"[ACCOUNT] {user['username']} linked {name}")
        return redirect("/")
    if signups.full(ip):
        return page("Too many new accounts from here. Try again in an hour.", 429)
    username = request.form.get("username", "").strip()
    try:
        user_id = accounts.register_with(provider, pending["account"], pending["label"], username,
                                         request.form.get("invite", ""))
    except accounts.AccountError as e:
        return page(str(e), 400)
    signups.add(ip)
    accounts.sign_in(web_session, {"id": user_id, "username": username})
    print(f"[ACCOUNT] Registered {username} (id {user_id}) with {name}")
    return redirect("/")


## SETTINGS: the player's empires, ways to sign in and password

EMPIRE_NAME_LENGTH = 24

DONE = {"password": "Your password is saved. Any other browser signed in to your account is now signed out.",
        "renamed": "Your empire has its new name.",
        "deleted": "The empire is deleted."}
for _provider, _name in sign_in.PROVIDERS.items():
    DONE[f"linked-{_provider}"] = f"{_name} is linked: you can sign in with it now."
    DONE[f"unlinked-{_provider}"] = f"{_name} is unlinked."


def render_settings(user, error=None, status=200):
    linked = {s["provider"]: s for s in storage().sign_ins_of(user["id"])}
    return render_template("settings.html", user=user, empires=villages_of(user["id"]), linked=linked,
                           providers=sign_in.PROVIDERS, available=sign_in.available(),
                           has_password=accounts.has_password(user["id"]), max_name=EMPIRE_NAME_LENGTH,
                           done=DONE.get(request.args.get("done", "")), error=error), status


def settings_user():
    """The signed-in account, for the Settings forms (which carry a CSRF token)."""
    user = current_user()
    if user is None:
        abort(redirect("/"))
    csrf.check()
    return user


def your_empire(user, USERID):
    if owner_of(USERID) != user["id"]:
        abort(make_response(*render_settings(user, error="That empire isn't yours.", status=403)))


@app.route("/settings")
def settings():
    user = current_user()
    if user is None:
        return redirect("/")
    return render_settings(user)


@app.route("/account")
def old_account_page():
    return redirect("/settings")


@app.route("/settings/password", methods=["POST"])
def change_password():
    user = settings_user()
    ip = client_ip()
    if failed_logins.full(ip):
        return render_settings(user, error="Too many failed attempts. Try again in a few minutes.", status=429)
    new = request.form.get("new_password", "")
    try:
        if new != request.form.get("repeat_password", ""):
            raise accounts.AccountError("The two new passwords aren't the same.")
        accounts.change_password(user, request.form.get("password", ""), new)
    except accounts.AccountError as e:
        if isinstance(e, accounts.WrongPassword):
            failed_logins.add(ip)
        return render_settings(user, error=str(e), status=400)
    accounts.sign_in(web_session, user)  # this browser stays in; every other one is out
    print(f"[ACCOUNT] {user['username']} changed their password")
    return redirect("/settings?done=password")


@app.route("/settings/unlink/<provider>", methods=["POST"])
def unlink(provider):
    user = settings_user()
    if provider not in sign_in.PROVIDERS:
        abort(404)
    try:
        accounts.unlink(user, provider)
    except accounts.AccountError as e:
        return render_settings(user, error=str(e), status=400)
    print(f"[ACCOUNT] {user['username']} unlinked {sign_in.PROVIDERS[provider]}")
    return redirect(f"/settings?done=unlinked-{provider}")


@app.route("/settings/empire/<USERID>/rename", methods=["POST"])
def rename_empire(USERID):
    user = settings_user()
    your_empire(user, USERID)
    name = " ".join(request.form.get("name", "").split())
    if not 1 <= len(name) <= EMPIRE_NAME_LENGTH or not name.isprintable():
        return render_settings(user, error=f"Empire names are 1-{EMPIRE_NAME_LENGTH} characters.", status=400)
    with LOCK:
        info = village_of(USERID)["playerInfo"]
        info["map_names"][int(info.get("default_map") or 0)] = name  # the town the home page shows
        save_session(USERID)
    return redirect("/settings?done=renamed")


@app.route("/settings/empire/<USERID>/delete", methods=["POST"])
def delete_empire(USERID):
    user = settings_user()
    your_empire(user, USERID)
    with LOCK:
        name = save_info(USERID)["name"]
    if request.form.get("confirm", "").strip().lower() != name.lower():
        return render_settings(user, error=f"To delete {name}, type its name in the box first.", status=400)
    delete_village(USERID)  # never holding LOCK (sessions.py)
    if web_session.get("USERID") == USERID:
        web_session.pop("USERID")
    print(f"[ACCOUNT] {user['username']} deleted their empire {name} ({USERID})")
    return redirect("/settings?done=deleted")


## FRIENDS (friends.py): requests by username, accepted or declined

FRIENDS_DONE = {"accepted": "You're friends now: their empires come first among your neighbours.",
                "declined": "Request declined.", "cancelled": "Request taken back.",
                "removed": "You're not friends any more.", "dismissed": "Request dismissed."}


def render_friends(user, error=None, done=None, status=200):
    store = storage()
    mine = store.friends_of(user["id"])
    sent = gifts.sent_today(user["id"])
    for friend in mine:
        friend["empires"] = villages_of(friend["id"])
        friend["sent_today"] = friend["id"] in sent
    level = account_level(user)
    return render_template("friends.html", user=user, friends=mine, requests=store.friend_requests(user["id"]),
                           max_friends=friends.MAX_FRIENDS, waiting=gifts.waiting(user["id"]),
                           helps=helps.asked_of(user["id"]),
                           empires=villages_of(user["id"]), free=gifts.free_list(level),
                           next_free=gifts.next_free(level), error=error,
                           done=done or FRIENDS_DONE.get(request.args.get("done", ""))), status


def friends_user():
    """The signed-in account, for the Friends forms (which carry a CSRF token)."""
    user = current_user()
    if user is None:
        abort(redirect("/"))
    csrf.check()
    return user


def _account_id(value):
    try:
        return int(value)
    except (TypeError, ValueError):
        abort(404)


@app.route("/friends")
def friends_page():
    user = current_user()
    if user is None:
        return redirect("/")
    return render_friends(user)


@app.route("/friends/ask", methods=["POST"])
def ask_friend():
    user = friends_user()
    try:
        done = friends.ask(user, request.form.get("username", ""))
    except friends.FriendError as e:
        return render_friends(user, error=str(e), status=400)
    print(f"[FRIENDS] {user['username']} -> {request.form.get('username', '')!r}: {done}")
    return render_friends(user, done=done)


@app.route("/friends/<action>/<other>", methods=["POST"])
def answer_friend(action, other):
    user = friends_user()
    other = _account_id(other)
    try:
        if action == "accept":
            friends.accept(user, other)
        elif action == "decline":
            friends.decline(user, other)
        elif action == "cancel":
            friends.cancel(user, other)
        elif action == "remove":
            friends.unfriend(user, other)
        else:
            abort(404)
    except friends.FriendError as e:
        return render_friends(user, error=str(e), status=400)
    done = {"accept": "accepted", "decline": "declined", "cancel": "cancelled", "remove": "removed"}[action]
    print(f"[FRIENDS] {user['username']} {done} account {other}")
    return redirect(f"/friends?done={done}")


## GIFTS (gifts.py): a free gift a day for each friend, things from storage, an inbox

def account_level(user) -> int:
    """The level that opens free gifts: the account's highest empire's."""
    return max([e["level"] for e in villages_of(user["id"])] or [1])


def _form_int(name):
    try:
        return int(request.form.get(name, ""))
    except ValueError:
        abort(400, "Please try again.")


@app.route("/gifts/send", methods=["POST"])
def send_free_gift():
    """The Friends page: today's free gift for a friend."""
    user = friends_user()
    try:
        done = gifts.send_free(user, _form_int("friend"), _form_int("item"), account_level(user))
    except gifts.GiftError as e:
        return render_friends(user, error=str(e), status=400)
    print(f"[GIFTS] {user['username']}: {done}")
    return render_friends(user, done=done)


@app.route("/gifts/take", methods=["POST"])
def take_gifts():
    """The Friends page: a gift (or all of them) into one of the player's
    empires. The game shows who sent what when that empire next starts."""
    user = friends_user()
    USERID = request.form.get("empire", "")
    if owner_of(USERID) != user["id"]:
        return render_friends(user, error="Pick one of your empires for it.", status=400)
    wanted = request.form.get("gift", "")
    ids = [g["id"] for g in gifts.waiting(user["id"])] if wanted == "all" else [_form_int("gift")]
    taken = []
    with LOCK:
        try:
            for gift_id in ids:
                taken.append(gifts.take(user, gift_id, village_of(USERID), tell_game=True))
        except gifts.GiftError as e:
            if not taken:
                return render_friends(user, error=str(e), status=400)
        finally:
            save_session(USERID)  # whatever went in before a gift already taken elsewhere
    empire = save_info(USERID)["name"]
    print(f"[GIFTS] {user['username']} took into {empire}: {taken}")
    return render_friends(user, done=f"In {empire}'s Gifts and Storage: " + "; ".join(taken) + ".")


@app.route("/gifts/game", methods=["GET", "POST"])
def gifts_window():
    """The game's own Gifts window (templates/_gifts.html), for the empire on
    that page: what waits for it, today's free gifts, its storage to give from."""
    user = current_user()
    USERID = request.args.get("empire", "")  # not the cookie's: another tab may have opened another empire
    if user is None or not USERID or owner_of(USERID) != user["id"]:
        return json_response({"error": "Please sign in again."}, 403)
    reply, status = {}, 200
    with LOCK:
        save = village_of(USERID)
        if save is None:
            return json_response({"error": "This empire is gone."}, 404)
        if request.method == "POST":
            if not csrf.valid():
                return json_response({"error": "This page was open too long. Please reload it."}, 400)
            action = request.form.get("action")
            try:
                if action == "take":
                    wanted = request.form.get("gift", "")
                    ids = [g["id"] for g in gifts.waiting(user["id"])] if wanted == "all" else [_form_int("gift")]
                    done = "; ".join(gifts.take(user, gift_id, save, tell_game=False) for gift_id in ids)
                    reply["ok"] = f"In your Gifts and Storage: {done}." if done else "No gifts waiting."
                elif action == "free":
                    reply["ok"] = gifts.send_free(user, _form_int("friend"), _form_int("item"), account_level(user))
                elif action == "give":
                    town_id = int(save["playerInfo"].get("default_map") or 0)
                    reply["ok"] = gifts.give(user, save, town_id, _form_int("friend"), _form_int("item"),
                                             _form_int("count"))
                else:
                    abort(400, "Please try again.")
                print(f"[GIFTS] {user['username']} -> {USERID}: {reply['ok']}")
            except gifts.GiftError as e:
                reply["error"], status = str(e), 400
            finally:
                save_session(USERID)  # what changed before an error too
        level = account_level(user)
        sent = gifts.sent_today(user["id"])
        reply.update(
            waiting=gifts.waiting(user["id"]),
            friends=[dict(f, sent_today=f["id"] in sent) for f in storage().friends_of(user["id"])],
            free=gifts.free_list(level), next_free=gifts.next_free(level), level=level,
            storage=gifts.storage_list(save, int(save["playerInfo"].get("default_map") or 0)),
            loaded_at=bank.loaded_at.get(USERID, 0), now=time.time())
    return json_response(reply, status)


## ASKING FRIENDS FOR HELP (helps.py): the game's buttons ask, friends answer on the Friends page

def _value_int(name, default=0):
    try:
        return int(request.values.get(name, default))
    except ValueError:
        abort(400, "Please try again.")


@app.route("/help/game", methods=["GET", "POST"])
def help_window():
    """The game's Ask friends windows (templates/_help.html), for the empire
    on that page and the thing asked about: who can be asked, and asking them."""
    user = current_user()
    USERID = request.args.get("empire", "")  # not the cookie's: another tab may have opened another empire
    if user is None or not USERID or owner_of(USERID) != user["id"]:
        return json_response({"error": "Please sign in again."}, 403)
    kind = request.values.get("kind", "")
    if kind not in helps.KINDS:
        return json_response({"error": "Please try again."}, 400)
    town, x, y, item = (_value_int(name) for name in ("town", "x", "y", "item"))
    reply, status = {}, 200
    with LOCK:
        save = village_of(USERID)
        if save is None:
            return json_response({"error": "This empire is gone."}, 404)
        if request.method == "POST":
            if not csrf.valid():
                return json_response({"error": "This page was open too long. Please reload it."}, 400)
            try:
                if request.form.get("seat"):  # the Round Table's window: one neighbour, by their empire
                    reply["ok"] = helps.ask_seat(user, USERID, save, town, x, y, item, request.form["seat"])
                else:
                    friend_ids = [_account_id(f) for f in request.form.getlist("friend")]
                    reply["ok"] = helps.ask(user, USERID, save, kind, town, x, y, item, friend_ids)
                print(f"[HELP] {user['username']} -> {USERID}: {reply['ok']}")
            except helps.HelpError as e:
                reply["error"], status = str(e), 400
        reply.update(helps.window(user, USERID, save, kind, town, x, y, item, bank.loaded_at.get(USERID, 0)))
    return json_response(reply, status)


@app.route("/help/answer", methods=["POST"])
def answer_help():
    """The Friends page: help a friend (or every friend asking)."""
    user = friends_user()
    wanted = request.form.get("help", "")
    ids = [r["id"] for r in helps.asked_of(user["id"])] if wanted == "all" else [_form_int("help")]
    done, refused = [], []
    for request_id in ids:
        try:
            done.append(helps.answer(user, request_id))
        except helps.HelpError as e:
            refused.append(str(e))
    print(f"[HELP] {user['username']} helped: {done} {refused}")
    if not done:
        return render_friends(user, error=" ".join(refused) or "Nobody is asking for help right now.", status=400)
    return render_friends(user, done=" ".join(done), error=" ".join(refused) or None)


@app.route("/help/dismiss", methods=["POST"])
def dismiss_help():
    user = friends_user()
    helps.decline(user, _form_int("help"))
    return redirect("/friends?done=dismissed")


@app.route("/play", methods=["POST"])
def choose_village():
    csrf.check()
    user = current_user()
    if user is None:
        return redirect("/")
    USERID = request.form.get("USERID", "")
    if owner_of(USERID) != user["id"]:
        return render_home(error="That empire isn't yours."), 403
    share_tutorial(USERID)  # so the page knows, too
    web_session["USERID"] = USERID
    return redirect(game_page_for(request.form.get("PLAYER")))


@app.route("/new", methods=["POST"])
def new():
    csrf.check()
    user = current_user()
    if user is None:
        return redirect("/")
    if len(villages_of(user["id"])) >= config_env.MAX_VILLAGES_PER_USER:
        return render_home(error=f"You can have at most {config_env.MAX_VILLAGES_PER_USER} empires."), 400
    web_session["USERID"] = new_village(user["id"])
    return redirect(game_page_for(request.form.get("PLAYER")))


def game_page_for(player):
    """The page for the player picked on the home page: Ruffle, the new
    client, or else the Flash plugin."""
    return {"ruffle": "/ruffle.html", "client": "/client.html"}.get(player, "/play.html")


def _game_page(template):
    user = current_user()
    USERID = web_session.get("USERID")
    if user is None or not USERID or owner_of(USERID) != user["id"]:
        return redirect("/")
    print(f"[PLAY] {user['username']} -> {USERID} ({template})")
    return render_template(template, save_info=save_info(USERID), serverTime=timestamp_now(),
                           friendsInfo=fb_friends_str(USERID), version=version_name,
                           GAME_CLIENT=config_env.GAME_CLIENT, PUBLIC_URL=config_env.PUBLIC_URL,
                           ASSETS_URL=config_env.ASSETS_URL, DAYS=comeback_bonus.page_days(village_of(USERID)),
                           DYNAMIC=DYNAMIC, ART_URL=art_url(), GIFTS_WAITING=bool(gifts.waiting(user["id"])),
                           USER_KEY=accounts.make_game_token(USERID), user=user)


@app.route("/play.html")
def play():
    return _game_page("play.html")


@app.route("/ruffle.html")
def ruffle():
    return _game_page("ruffle.html")


## THE NEW CLIENT (CLIENT.md): TypeScript and PixiJS, side by side with Flash

CLIENT_DIR = os.path.join(BASE_DIR, "client", "dist")  # built by npm run build in client/
ART_DIR = os.path.join(BASE_DIR, "art", "sheets")      # made by tools/export_art.sh


@app.route("/client.html")
def new_client():
    """The new game client. It shows the town; the Flash client still plays it."""
    if not os.path.isfile(os.path.join(CLIENT_DIR, "client.js")):
        return ("The new client isn't built on this server: run npm ci and npm run build "
                "in client/ (CLIENT.md).", 503)
    return _game_page("client.html")


def art_url():
    """Where the new client finds its sprite sheets: this server's, when it
    has made them, or else next to the other assets (R2 on hosted servers)."""
    return "/art" if os.path.isdir(ART_DIR) else f"{config_env.ASSETS_URL}/art"


@app.route("/client/<path:path>")
def client_files(path):
    # client.js and client.css keep their names, so browsers check for a
    # newer copy each time; the rest are named by their contents and kept.
    if path.startswith("chunks/"):
        return send_from_directory(CLIENT_DIR, path, max_age=31536000)
    response = send_from_directory(CLIENT_DIR, path)
    response.cache_control.no_cache = True
    return response


@app.route("/art/<path:path>")
def art_files(path):
    response = send_from_directory(ART_DIR, path)
    response.cache_control.no_cache = True  # a new export changes them
    return response


@app.route("/bank", methods=["GET", "POST"])
def bank_window():
    """The bank's exchange window on the game page (templates/_bank.html):
    what it offers the empire on that page, and its trades."""
    user = current_user()
    USERID = request.args.get("empire", "")  # not the cookie's: another tab may have opened another empire
    if user is None or not USERID or owner_of(USERID) != user["id"]:
        return json_response({"error": "Please sign in again."}, 403)
    with LOCK:
        save = village_of(USERID)
        if save is None:
            return json_response({"error": "This empire is gone."}, 404)
        done, status = None, 200
        if request.method == "POST":
            if not csrf.valid():
                return json_response({"error": "This page was open too long. Please reload it."}, 400)
            try:
                done = bank.buy_cash(save, request.form.get("resource", ""), request.form.get("cash"))
                save_session(USERID)
                print(f"[BANK] {user['username']} -> {USERID}: {done}")
            except bank.BankError as e:
                done, status = str(e), 400
        reply = dict(bank.state(save), loaded_at=bank.loaded_at.get(USERID, 0), now=time.time())
        if done:
            reply["ok" if status == 200 else "error"] = done
        return json_response(reply, status)


@app.errorhandler(400)
def bad_request(e):
    # Most often a form from a page left open too long (csrf.py): show the
    # start page again, with fresh forms.
    return render_home(error=e.description), 400


@app.route("/healthz")
def healthz():
    # Hosts ping this to check the server is alive.
    return ("ok", 200)


@app.route("/crossdomain.xml")
def crossdomain():
    return send_from_directory(STUB_DIR, "crossdomain.xml")


@app.route("/img/<path:path>")
def images(path):
    return send_from_directory(TEMPLATES_DIR + "/img", path)


@app.route("/css/<path:path>")
def css(path):
    return send_from_directory(TEMPLATES_DIR + "/css", path)


## GAME STATIC

@app.route("/default01.static.socialpointgames.com/static/socialempires/swf/05122012_projectiles.swf")
def similar_05122012_projectiles():
    return send_from_directory(ASSETS_DIR + "/swf", "20130417_projectiles.swf")


@app.route("/default01.static.socialpointgames.com/static/socialempires/swf/05122012_magicParticles.swf")
def similar_05122012_magicParticles():
    return send_from_directory(ASSETS_DIR + "/swf", "20131010_magicParticles.swf")


@app.route("/default01.static.socialpointgames.com/static/socialempires/swf/05122012_dynamic.swf")
def similar_05122012_dynamic():
    return send_from_directory(ASSETS_DIR + "/swf", "120608_dynamic.swf")


DOWNLOAD_DIR = os.path.join(BASE_DIR, "download_assets", "assets")


@app.route("/default01.static.socialpointgames.com/static/socialempires/<path:path>")
def static_assets_loader(path):
    # safe_join returns None for paths that try to escape the folder ("../").
    local = safe_join(ASSETS_DIR, path)
    if local and os.path.isfile(local):
        return send_from_directory(ASSETS_DIR, path)

    downloaded = safe_join(DOWNLOAD_DIR, path)
    if downloaded and os.path.isfile(downloaded):
        return send_from_directory(DOWNLOAD_DIR, path)

    if config_env.EXTERNAL_ASSETS and local:
        # Hosted servers don't ship assets/; they live at SE_ASSETS_URL (R2).
        return redirect(f"{config_env.ASSETS_URL}/{path}")

    if not config_env.CDN_FALLBACK or downloaded is None:
        return ("", 404)

    # Optional: fetch the missing file from Social Point's old CDN, if it's still up.
    os.makedirs(os.path.dirname(downloaded), exist_ok=True)
    url = f"https://static.socialpointgames.com/static/socialempires/assets/{path}"
    try:
        urllib.request.urlretrieve(url, downloaded)
    except (urllib.error.URLError, OSError):
        return ("", 404)
    print(f"====== DOWNLOADED ASSET: {url}")
    return send_from_directory(DOWNLOAD_DIR, path)


## GAME DYNAMIC

DYNAMIC = "/dynamic.flash1.dev.socialpoint.es/appsfb/socialempiresdev/srvempires"


@app.route(f"{DYNAMIC}/track_game_status.php", methods=['POST'])
def track_game_status_response():
    # Analytics ping from the game; nothing to store.
    print(f"track_game_status: status={request.values.get('status')}, user_id={request.values.get('user_id')}")
    return ("", 200)


@app.route(f"{DYNAMIC}/get_game_config.php", methods=['GET', 'POST'])
@game_request
def get_game_config_response(USERID):
    return get_game_config()


@app.route(f"{DYNAMIC}/get_player_info.php", methods=['POST'])
@game_request
def get_player_info_response(USERID):
    user = request.values.get('user')
    map_number = int(request.values['map']) if request.values.get('map', '').isdigit() else None

    if user is None or user == USERID:  # the player's own village (travelling between towns names it)
        bank.town_loaded(USERID)
        return json_response(get_player_info(USERID, map_number))
    if user == tournaments.ARENA:  # where tournament matches are fought
        return json_response(tournaments.arena())
    if user.startswith("100000") and user not in (Constant.NEIGHBOUR_ARTHUR_GUINEVERE_1,
                                                  Constant.NEIGHBOUR_ARTHUR_GUINEVERE_2,
                                                  Constant.NEIGHBOUR_ARTHUR_GUINEVERE_3):
        return get_quest_map(user)
    info = get_neighbor_info(user, map_number)  # visiting a neighbour (read-only)
    if info is None:
        return ("", 404)
    return json_response(info)


@app.route(f"{DYNAMIC}/sync_error_track.php", methods=['POST'])
def sync_error_track_response():
    print(f"sync_error_track: USERID={request.values.get('USERID')} error={request.values.get('error')} "
          f"tries={request.values.get('tries')}")
    USERID = request.values.get("USERID", "")
    if accounts.check_game_token(USERID, request.values.get("user_key", "")):  # from a real game
        radar.note(radar.CLIENT, "sync_error", request.values.get("error", ""),
                   f"{request.values.get('description', '')} tries={request.values.get('tries')} "
                   f"mode={request.values.get('game_mode')}", USERID)
    return ("", 200)


@app.route("/null")
def flash_sync_error_response():
    reasons = {"flash_sync_error": "reload On Sync Error",
               "flash_reload_quest": "reload On End Quest",
               "flash_reload_attack": "reload On End Attack"}
    reason = reasons.get(request.values.get('sp_ref_cat'), "?")
    print("flash_sync_error", reason)
    if request.values.get('sp_ref_cat') == "flash_sync_error" and web_session.get("USERID"):
        radar.note(radar.CLIENT, "reload", reason, player=web_session["USERID"])  # the others are routine
    return redirect(request.referrer if request.referrer and request.referrer.endswith("ruffle.html")
                    else "/play.html")


@app.route(f"{DYNAMIC}/command.php", methods=['POST'])
@game_request
def command_response(USERID):
    data_str = request.values.get('data', '')
    # Format: 64-character hash, ';', then the JSON payload. The hash was
    # Social Point's anti-cheat check; we don't verify it.
    if len(data_str) < 66 or data_str[64] != ';':
        return ("Malformed command.", 400)
    try:
        data = json.loads(data_str[65:])
    except json.JSONDecodeError:
        return ("Malformed command.", 400)
    try:
        command(USERID, data)
    except Exception as e:
        # One bad command shouldn't crash the request or leave the lock held.
        print(f" [!] Command failed for {USERID}: {e!r}")
        radar.failure("command.php", e, data_str[65:], USERID)
        return json_response({"result": "error"}, 500)
    return json_response({"result": "success"})


@app.route(f"{DYNAMIC}/tournaments/<name>.php", methods=['POST'])
@game_request
def tournament_response(USERID, name):
    # Tournaments (tournaments.py). The same envelope as command.php, though
    # some clients leave the hash out; the reply goes under "data".
    data_str = request.values.get("data", "")
    payload = data_str[65:] if len(data_str) > 64 and data_str[64] == ';' else data_str
    try:
        params = json.loads(payload or "{}")
    except json.JSONDecodeError:
        return ("Malformed request.", 400)
    try:
        reply = tournaments.service(USERID, name, params)
    except Exception as e:
        print(f" [!] Tournament {name} failed for {USERID}: {e!r}")
        radar.failure(f"tournaments/{name}", e, payload, USERID)
        return json_response({"result": "error"}, 500)
    if reply is None:
        radar.note(radar.UNHANDLED, f"tournaments/{name}.php", example=payload, player=USERID)
        return ("", 404)
    return json_response({"data": reply})


def _number(name):
    value = request.values.get(name, "")
    return int(value) if value.isdigit() else None


@app.route(f"{DYNAMIC}/get_continent_ranking.php")
@game_request
def get_continent_ranking_response(USERID):
    # The world map (worlds.py): the town's continent, or another one to look at.
    return json_response(worlds.ranking(USERID, _number("map"), _number("level_id"),
                                        relocate=request.values.get("relocate") == "1",
                                        move_on=request.values.get("worldChange") == "1"))


@app.route(f"{DYNAMIC}/get_public_player_info.php")
def get_public_player_info_response():
    # The Profile button on the world map. USERID is the player looked at; the
    # key is the viewer's own, so any player in a game may look.
    viewer = accounts.game_token_owner(request.values.get("user_key", ""))
    if viewer is None or village_of(viewer) is None:
        return ("Invalid session, please reload the game.", 403)
    with LOCK:
        shown = worlds.profile(request.values.get("USERID", ""))
        return json_response(shown) if shown is not None else ("", 404)


# Start the background saver whenever the app is loaded (python or gunicorn).
start_background_saver(handle_sigterm=(__name__ == '__main__'))

########
# MAIN #
########

if __name__ == '__main__':
    print(f" [+] Running server on {config_env.BIND_HOST}:{config_env.PORT} "
          f"(players use {config_env.PUBLIC_URL})")
    app.run(host=config_env.BIND_HOST, port=config_env.PORT, debug=False, threaded=True)
