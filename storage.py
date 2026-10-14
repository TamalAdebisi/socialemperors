"""
Persistent storage for accounts and village saves.

Two interchangeable backends share the exact same SQL, because Cloudflare D1
*is* SQLite under the hood:

  * SQLiteStorage - a local file (data/socialempires.db). Used for local play
    and development.
  * D1Storage     - Cloudflare D1, reached over Cloudflare's HTTP API. Used when
    the server runs in a Cloudflare Container, whose own disk is wiped on
    every restart, so nothing can be kept on it.

The game code never talks to these classes directly; sessions.py does.

Write-behind: the game sends a command for almost every click. Writing to the
database on every click would be slow over the network (and would hit
Cloudflare API rate limits), so changed villages are marked "dirty" and
flushed in a batch every few seconds, plus once more when the server shuts
down. At worst a crash loses the last few seconds of play.
"""

import json
import os
import sqlite3
import threading
import time
import urllib.request

import config_env

SCHEMA = [
    """CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE COLLATE NOCASE,
        password_hash TEXT NOT NULL,
        created_at INTEGER NOT NULL
    )""",
    """CREATE TABLE IF NOT EXISTS villages (
        pid TEXT PRIMARY KEY,
        owner_id INTEGER REFERENCES users(id),
        data TEXT NOT NULL,
        updated_at INTEGER NOT NULL
    )""",
    "CREATE INDEX IF NOT EXISTS villages_owner ON villages(owner_id)",
    # The bug radar (radar.py): what players' games asked that the server
    # couldn't do, counted.
    """CREATE TABLE IF NOT EXISTS problems (
        kind TEXT NOT NULL,
        name TEXT NOT NULL,
        detail TEXT NOT NULL,
        count INTEGER NOT NULL,
        first_seen INTEGER NOT NULL,
        last_seen INTEGER NOT NULL,
        last_player TEXT,
        example TEXT,
        PRIMARY KEY (kind, name, detail)
    )""",
    # Tournaments (tournaments.py): rooms several players share, so not in a village.
    """CREATE TABLE IF NOT EXISTS tournaments (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        updated_at INTEGER NOT NULL
    )""",
]

UPSERT_VILLAGE = """INSERT INTO villages (pid, owner_id, data, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(pid) DO UPDATE SET data = excluded.data,
        owner_id = COALESCE(villages.owner_id, excluded.owner_id),
        updated_at = excluded.updated_at"""

# The bug radar: a problem seen before counts up; a new one is added while
# there are fewer than MAX_PROBLEMS (players can send made-up commands).
MAX_PROBLEMS = 1000
COUNT_PROBLEM = """UPDATE problems SET count = count + ?, last_seen = ?, last_player = ?, example = ?
    WHERE kind = ? AND name = ? AND detail = ?"""
ADD_PROBLEM = f"""INSERT OR IGNORE INTO problems (kind, name, detail, count, first_seen, last_seen, last_player, example)
    SELECT ?, ?, ?, ?, ?, ?, ?, ? WHERE (SELECT count(*) FROM problems) < {MAX_PROBLEMS}"""


def _problem_statements(row):
    """(sql, params) to save one row of the radar: count it, else add it."""
    kind, name, detail, count, first, last, player, example = row
    return [(COUNT_PROBLEM, (count, last, player, example, kind, name, detail)), (ADD_PROBLEM, tuple(row))]


UPSERT_TOURNAMENT = """INSERT INTO tournaments (id, data, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at"""


def _tournament_statements(records, deleted):
    """(sql, params) to save these tournaments and delete those."""
    now = int(time.time())
    return ([(UPSERT_TOURNAMENT, (record["id"], json.dumps(record), now)) for record in records] +
            [("DELETE FROM tournaments WHERE id = ?", (tournament_id,)) for tournament_id in deleted])


class UsernameTaken(Exception):
    pass


class BaseStorage:
    """Shared logic. Subclasses only implement _query()."""

    def _query(self, sql: str, params: tuple = ()) -> list:
        """Run one statement and return rows as a list of dicts."""
        raise NotImplementedError

    def init_schema(self):
        for statement in SCHEMA:
            self._query(statement)

    # Accounts
    def create_user(self, username: str, password_hash: str) -> int:
        if self.get_user_by_name(username):
            raise UsernameTaken(username)
        try:
            self._query("INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)",
                        (username, password_hash, int(time.time())))
        except Exception as e:
            if "UNIQUE" in str(e).upper():
                raise UsernameTaken(username)
            raise
        return self.get_user_by_name(username)["id"]

    def get_user_by_name(self, username: str):
        rows = self._query("SELECT id, username, password_hash FROM users WHERE username = ?", (username,))
        return rows[0] if rows else None

    def get_user(self, user_id: int):
        rows = self._query("SELECT id, username, created_at FROM users WHERE id = ?", (user_id,))
        return rows[0] if rows else None

    def find_users(self, text: str, limit: int = 50) -> list:
        """Accounts whose name contains text (any case), for the admin page."""
        return self._query("SELECT id, username, created_at FROM users WHERE instr(lower(username), lower(?)) > 0 "
                           "ORDER BY username LIMIT ?", (text, limit))

    def count_users(self) -> int:
        return self._query("SELECT count(*) AS n FROM users")[0]["n"]

    def get_password_hash(self, user_id: int):
        rows = self._query("SELECT password_hash FROM users WHERE id = ?", (user_id,))
        return rows[0]["password_hash"] if rows else None

    def set_password(self, user_id: int, password_hash: str):
        self._query("UPDATE users SET password_hash = ? WHERE id = ?", (password_hash, user_id))

    def delete_user(self, user_id: int):
        """The account and every village it owns."""
        self._query("DELETE FROM villages WHERE owner_id = ?", (user_id,))
        self._query("DELETE FROM users WHERE id = ?", (user_id,))

    # Villages
    def load_all_villages(self) -> list:
        """Every save, as (pid, owner_id, village_dict). Read once at startup."""
        rows = self._query("SELECT pid, owner_id, data FROM villages")
        return [(r["pid"], r["owner_id"], json.loads(r["data"])) for r in rows]

    def save_villages(self, items: list):
        """items: list of (pid, owner_id, village_dict)."""
        now = int(time.time())
        for pid, owner_id, village in items:
            self._query(UPSERT_VILLAGE, (pid, owner_id, json.dumps(village), now))

    def delete_village(self, pid: str):
        self._query("DELETE FROM villages WHERE pid = ?", (pid,))

    # The bug radar
    def save_problems(self, rows: list):
        """rows: (kind, name, detail, count, first_seen, last_seen, last_player, example);
        counts are added to those already saved."""
        for row in rows:
            for sql, params in _problem_statements(row):
                self._query(sql, params)

    def list_problems(self, limit: int = 200) -> list:
        return self._query("SELECT * FROM problems ORDER BY count DESC, last_seen DESC LIMIT ?", (limit,))

    def clear_problem(self, kind: str, name: str, detail: str):
        self._query("DELETE FROM problems WHERE kind = ? AND name = ? AND detail = ?", (kind, name, detail))

    def clear_problems(self):
        self._query("DELETE FROM problems")

    # Tournaments
    def load_all_tournaments(self) -> list:
        return [json.loads(r["data"]) for r in self._query("SELECT data FROM tournaments")]

    def save_tournaments(self, records: list, deleted: list = ()):
        """records: tournament dicts (each with its "id"); deleted: ids."""
        for sql, params in _tournament_statements(records, deleted):
            self._query(sql, params)


class SQLiteStorage(BaseStorage):
    def __init__(self, path: str):
        os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
        self.path = path
        self._local = threading.local()  # one connection per thread
        conn = self._conn()
        conn.execute("PRAGMA journal_mode=WAL")  # safe concurrent reads while writing
        self.init_schema()

    def _conn(self) -> sqlite3.Connection:
        conn = getattr(self._local, "conn", None)
        if conn is None:
            conn = sqlite3.connect(self.path, timeout=30)
            conn.row_factory = sqlite3.Row
            self._local.conn = conn
        return conn

    def _query(self, sql, params=()):
        conn = self._conn()
        try:
            cur = conn.execute(sql, params)
            rows = [dict(r) for r in cur.fetchall()]
            conn.commit()
            return rows
        except sqlite3.IntegrityError as e:
            conn.rollback()
            raise Exception(f"UNIQUE constraint: {e}")

    def save_villages(self, items):
        # One transaction for the whole batch: much faster, and all-or-nothing.
        conn = self._conn()
        now = int(time.time())
        with conn:
            conn.executemany(UPSERT_VILLAGE, [(p, o, json.dumps(v), now) for p, o, v in items])

    def save_problems(self, rows):
        with self._conn() as conn:  # one transaction
            for row in rows:
                for sql, params in _problem_statements(row):
                    conn.execute(sql, params)

    def save_tournaments(self, records, deleted=()):
        with self._conn() as conn:  # one transaction
            for sql, params in _tournament_statements(records, deleted):
                conn.execute(sql, params)


class D1Storage(BaseStorage):
    """Cloudflare D1 over the REST API.

    Needs CF_ACCOUNT_ID, CF_D1_DATABASE_ID and CF_API_TOKEN (a token with
    D1 edit permission) in the environment.
    """

    def __init__(self):
        account = os.environ["CF_ACCOUNT_ID"]
        database = os.environ["CF_D1_DATABASE_ID"]
        self.token = os.environ["CF_API_TOKEN"]
        self.url = f"https://api.cloudflare.com/client/v4/accounts/{account}/d1/database/{database}/query"
        self.init_schema()

    def _post(self, body):
        req = urllib.request.Request(
            self.url, data=json.dumps(body).encode(), method="POST",
            headers={"Authorization": f"Bearer {self.token}", "Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            payload = json.loads(resp.read())
        if not payload.get("success"):
            raise Exception(f"D1 error: {payload.get('errors')}")
        return payload["result"]

    def _query(self, sql, params=()):
        result = self._post({"sql": sql, "params": list(params)})
        return result[0].get("results", []) if result else []

    def save_villages(self, items):
        if not items:
            return
        # D1 accepts several statements in one request; send the batch together.
        now = int(time.time())
        batch = [{"sql": UPSERT_VILLAGE, "params": [p, o, json.dumps(v), now]} for p, o, v in items]
        self._post({"batch": batch})

    def save_problems(self, rows):
        if rows:
            self._post({"batch": [{"sql": sql, "params": list(params)}
                                  for row in rows for sql, params in _problem_statements(row)]})

    def save_tournaments(self, records, deleted=()):
        statements = _tournament_statements(records, deleted)
        if statements:
            self._post({"batch": [{"sql": sql, "params": list(params)} for sql, params in statements]})


def open_storage() -> BaseStorage:
    if config_env.STORAGE == "d1":
        print(" [+] Storage: Cloudflare D1")
        return D1Storage()
    path = os.path.join(config_env.DATA_DIR, "socialempires.db")
    print(f" [+] Storage: SQLite at {path}")
    return SQLiteStorage(path)
