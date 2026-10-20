"""
The admin page (/admin): the bug radar, finding an account, resetting its
password, deleting it or one of its empires, looking inside an empire, and
giving or taking an empire's cash.

Only the accounts named in SE_ADMINS can open it; for everyone else it doesn't
exist (404). Every form carries a CSRF token (csrf.py), and every action is
written to the server log.

Deleting never holds sessions.LOCK (see sessions.delete_village).
"""

import json
import time

from flask import Blueprint, abort, g, redirect, render_template, request, session, url_for

import accounts
import csrf
import radar
import sessions
import tutorial

admin = Blueprint("admin", __name__, url_prefix="/admin")

RECENT = 20
CASH_LIMIT = 10_000  # the most cash one change gives or takes, so a slip of the keyboard stays small


@admin.before_request
def only_admins():
    g.admin = accounts.signed_in(session)
    if not accounts.is_admin(g.admin):
        abort(404)
    if request.method == "POST":
        csrf.check()


@admin.after_request
def private(response):
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Frame-Options"] = "DENY"
    return response


@admin.app_template_filter("ago")
def ago(timestamp) -> str:
    if not timestamp or int(timestamp) <= 0:  # new empires start at -1: never played
        return "never"
    seconds = max(0, int(time.time()) - int(timestamp))
    for size, unit in ((86400, "day"), (3600, "hour"), (60, "minute")):
        if seconds >= size:
            n = seconds // size
            return f"{n} {unit}{'s' if n > 1 else ''} ago"
    return "just now"


def _log(what: str):
    print(f"[ADMIN] {g.admin['username']} {what}")


def _empire(pid: str) -> dict:
    """What the admin page shows of an empire. Call holding sessions.LOCK."""
    save = sessions.session(pid)
    info = save["playerInfo"]
    home = save["maps"][int(info.get("default_map") or 0)]
    shown = sessions.save_info(pid)  # its name, level and xp, as on the home page
    shown.update(pid=pid, owner=sessions.owner_of(pid), gold=home.get("coins"), cash=info.get("cash"),
                 towns=len(save["maps"]), continent=(home.get("worldMap") or {}).get("nivel"),
                 tutorial=tutorial.step(save), last_seen=max(0, int(info.get("last_logged_in") or 0)))
    return shown


def _usernames(ids) -> dict:
    store = sessions.storage()
    found = {}
    for user_id in set(ids) - {None}:
        user = store.get_user(user_id)
        found[user_id] = user["username"] if user else f"#{user_id} (gone)"
    return found


@admin.route("/")
def home():
    store = sessions.storage()
    radar.flush(store)  # the counts of the last few seconds too
    query = request.args.get("q", "").strip()
    found = []
    if query:
        found = [dict(user, empires=len(sessions.villages_of(user["id"]))) for user in store.find_users(query)]
    with sessions.LOCK:
        empires = [_empire(pid) for pid in sessions.all_saves_userid()]
    now = time.time()
    stats = {
        "accounts": store.count_users(),
        "empires": len(empires),
        "day": sum(1 for e in empires if now - e["last_seen"] < 24 * 3600),
        "hour": sum(1 for e in empires if now - e["last_seen"] < 3600),
    }
    recent = sorted(empires, key=lambda e: -e["last_seen"])[:RECENT]
    return render_template("admin.html", admin=g.admin, problems=store.list_problems(), query=query,
                           found=found, stats=stats, recent=recent,
                           owners=_usernames(e["owner"] for e in recent), done=request.args.get("done"))


@admin.route("/problems/clear", methods=["POST"])
def clear_problems():
    store = sessions.storage()
    radar.flush(store)
    if request.form.get("all") == "1":
        store.clear_problems()
        _log("cleared the bug radar")
    else:
        kind, name, detail = (request.form.get(k, "") for k in ("kind", "name", "detail"))
        store.clear_problem(kind, name, detail)
        _log(f"cleared {kind} {name} {detail} from the bug radar")
    return redirect(url_for("admin.home"))


def _account_page(user_id: int, status=200, **shown):
    user = sessions.storage().get_user(user_id)
    if user is None:
        abort(404)
    with sessions.LOCK:
        empires = [_empire(v["userid"]) for v in sessions.villages_of(user_id)]
    return render_template("admin_account.html", admin=g.admin, user=user, empires=empires, **shown), status


@admin.route("/account/<int:user_id>")
def account(user_id):
    return _account_page(user_id)


@admin.route("/account/<int:user_id>/password", methods=["POST"])
def reset_password(user_id):
    user = sessions.storage().get_user(user_id)
    if user is None:
        abort(404)
    password = accounts.new_password(user_id)
    _log(f"reset the password of {user['username']} (id {user_id})")
    return _account_page(user_id, new_password=password)


@admin.route("/account/<int:user_id>/delete", methods=["POST"])
def delete_account(user_id):
    user = sessions.storage().get_user(user_id)
    if user is None:
        abort(404)
    if user_id == g.admin["id"]:
        return _account_page(user_id, 400, error="That's your own account: ask another admin, or use the database.")
    if request.form.get("confirm", "").strip().lower() != user["username"].lower():
        return _account_page(user_id, 400, error=f"Type {user['username']} in the box to delete the account.")
    gone = sessions.delete_account(user_id)
    accounts.forget(user_id)
    _log(f"deleted the account {user['username']} (id {user_id}) and its {gone} empire(s)")
    return redirect(url_for("admin.home", done=f"Deleted {user['username']} and {gone} empire(s)."))


def _empire_page(pid: str, status=200, **shown):
    with sessions.LOCK:
        if sessions.session(pid) is None:
            abort(404)
        empire = _empire(pid)
        raw = json.dumps(sessions.session(pid), indent=1, sort_keys=True)
    owner = sessions.storage().get_user(empire["owner"]) if empire["owner"] is not None else None
    return render_template("admin_empire.html", admin=g.admin, empire=empire, owner=owner, raw=raw,
                           cash_limit=CASH_LIMIT, **shown), status


@admin.route("/empire/<pid>")
def empire(pid):
    return _empire_page(pid, done=request.args.get("done"))


@admin.route("/empire/<pid>/cash", methods=["POST"])
def change_cash(pid):
    """Give an empire cash, or take some back: to make up for a bug or a slip.
    It changes the save the server holds, which the server then writes to the
    database itself. Changing only the database wouldn't do: the server's
    copy would be written over it at the player's next click."""
    way = request.form.get("way")
    try:
        amount = int(request.form.get("amount", ""))
    except ValueError:
        amount = 0
    with sessions.LOCK:
        save = sessions.session(pid)
        if save is None:
            abort(404)
        name = sessions.save_info(pid)["name"]
        before = int(save["playerInfo"].get("cash") or 0)
        if way not in ("give", "take") or not 0 < amount <= CASH_LIMIT:
            error = f"Give or take a whole number of cash, from 1 to {CASH_LIMIT:,}."
        elif way == "take" and amount > before:
            error = f"{name} has only {before:,} cash."
        else:
            error = None
            after = before + amount if way == "give" else before - amount
            save["playerInfo"]["cash"] = after
            sessions.save_session(pid)
    if error:
        return _empire_page(pid, 400, error=error)
    gave = way == "give"
    _log(f"{'gave' if gave else 'took'} {amount} cash {'to' if gave else 'from'} the empire {name} ({pid}): "
         f"{before} before, {after} now")
    done = f"{'Gave' if gave else 'Took'} {amount:,} cash: {before:,} → {after:,}."
    return redirect(url_for("admin.empire", pid=pid, done=done))


@admin.route("/empire/<pid>/delete", methods=["POST"])
def delete_empire(pid):
    with sessions.LOCK:
        if sessions.session(pid) is None:
            abort(404)
        shown = _empire(pid)
    if request.form.get("sure") != "1":
        return redirect(url_for("admin.empire", pid=pid))
    sessions.delete_village(pid)
    _log(f"deleted the empire {shown['name']} ({pid}) of account id {shown['owner']}")
    if shown["owner"] is not None:
        return redirect(url_for("admin.account", user_id=shown["owner"]))
    return redirect(url_for("admin.home", done=f"Deleted the empire {shown['name']}."))
