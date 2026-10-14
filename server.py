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
                      fb_friends_str, owner_of, villages_of, share_tutorial, session as village_of)
load_saved_villages()

print(" [+] Loading server...")
from flask import Flask, Response, render_template, send_from_directory, request, redirect, abort
from flask import session as web_session
from werkzeug.middleware.proxy_fix import ProxyFix
from werkzeug.utils import safe_join

import accounts
import admin
import csrf
import radar
from bundle import ASSETS_DIR, STUB_DIR, TEMPLATES_DIR, BASE_DIR
from command import command
from constants import Constant
from engine import timestamp_now
from quests import get_quest_map
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


# Simple login rate limit: max 10 failed attempts per IP per 10 minutes.
_failed_logins = {}
_failed_lock = threading.Lock()
LOGIN_WINDOW, LOGIN_MAX_FAILS = 600, 10


def client_ip():
    """The visitor's IP address, as reported by the host's proxy if configured."""
    if config_env.CLIENT_IP_HEADER:
        ip = request.headers.get(config_env.CLIENT_IP_HEADER)
        if ip:
            return ip.strip()
    return request.remote_addr or "?"


def _too_many_failures(ip):
    now = time.time()
    with _failed_lock:
        attempts = [t for t in _failed_logins.get(ip, []) if now - t < LOGIN_WINDOW]
        _failed_logins[ip] = attempts
        return len(attempts) >= LOGIN_MAX_FAILS


def _record_failure(ip):
    with _failed_lock:
        _failed_logins.setdefault(ip, []).append(time.time())


def render_home(error=None, tab="login"):
    user = current_user()
    if user is None:
        return render_template("auth.html", error=error, tab=tab, version=version_name,
                               allow_registration=config_env.ALLOW_REGISTRATION,
                               invite_required=bool(config_env.INVITE_CODE))
    return render_template("login.html", user=user, saves_info=villages_of(user["id"]),
                           version=version_name, error=error,
                           can_create=len(villages_of(user["id"])) < config_env.MAX_VILLAGES_PER_USER,
                           max_villages=config_env.MAX_VILLAGES_PER_USER)


##########
# ROUTES #
##########

## ACCOUNTS AND PAGES

@app.route("/", methods=["GET"])
def home():
    return render_home()


@app.route("/register", methods=["POST"])
def register():
    try:
        user_id = accounts.register(request.form.get("username", ""), request.form.get("password", ""),
                                    request.form.get("invite", ""))
    except accounts.AccountError as e:
        return render_home(error=str(e), tab="register"), 400
    web_session.clear()
    web_session.permanent = True
    web_session["user_id"] = user_id
    web_session["username"] = request.form["username"].strip()
    print(f"[ACCOUNT] Registered {web_session['username']} (id {user_id})")
    return redirect("/")


@app.route("/login", methods=["POST"])
def login():
    ip = client_ip()
    if _too_many_failures(ip):
        return render_home(error="Too many failed attempts. Try again in a few minutes."), 429
    user = accounts.authenticate(request.form.get("username", ""), request.form.get("password", ""))
    if user is None:
        _record_failure(ip)
        print(f"[ACCOUNT] Failed login for {request.form.get('username', '')!r} from {ip}")
        return render_home(error="Wrong username or password."), 401
    web_session.clear()
    web_session.permanent = True
    web_session["user_id"] = user["id"]
    web_session["username"] = user["username"]
    return redirect("/")


@app.route("/logout")
def logout():
    web_session.clear()
    return redirect("/")


@app.route("/play", methods=["POST"])
def choose_village():
    user = current_user()
    if user is None:
        return redirect("/")
    USERID = request.form.get("USERID", "")
    if owner_of(USERID) != user["id"]:
        return render_home(error="That empire isn't yours."), 403
    share_tutorial(USERID)  # so the page knows, too
    web_session["USERID"] = USERID
    player = "ruffle" if request.form.get("PLAYER") == "ruffle" else "play"
    return redirect(f"/{player}.html")


@app.route("/new", methods=["POST"])
def new():
    user = current_user()
    if user is None:
        return redirect("/")
    if len(villages_of(user["id"])) >= config_env.MAX_VILLAGES_PER_USER:
        return render_home(error=f"You can have at most {config_env.MAX_VILLAGES_PER_USER} empires."), 400
    web_session["USERID"] = new_village(user["id"])
    player = "ruffle" if request.form.get("PLAYER") == "ruffle" else "play"
    return redirect(f"/{player}.html")


def _game_page(template):
    user = current_user()
    USERID = web_session.get("USERID")
    if user is None or not USERID or owner_of(USERID) != user["id"]:
        return redirect("/")
    print(f"[PLAY] {user['username']} -> {USERID} ({template})")
    return render_template(template, save_info=save_info(USERID), serverTime=timestamp_now(),
                           friendsInfo=fb_friends_str(USERID), version=version_name,
                           GAME_CLIENT=config_env.GAME_CLIENT, PUBLIC_URL=config_env.PUBLIC_URL,
                           ASSETS_URL=config_env.ASSETS_URL,
                           USER_KEY=accounts.make_game_token(USERID), user=user)


@app.route("/play.html")
def play():
    return _game_page("play.html")


@app.route("/ruffle.html")
def ruffle():
    return _game_page("ruffle.html")


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
        return json_response(get_player_info(USERID, map_number))
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
