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
]

UPSERT_VILLAGE = """INSERT INTO villages (pid, owner_id, data, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(pid) DO UPDATE SET data = excluded.data,
        owner_id = COALESCE(villages.owner_id, excluded.owner_id),
        updated_at = excluded.updated_at"""


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
        rows = self._query("SELECT id, username FROM users WHERE id = ?", (user_id,))
        return rows[0] if rows else None

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


def open_storage() -> BaseStorage:
    if config_env.STORAGE == "d1":
        print(" [+] Storage: Cloudflare D1")
        return D1Storage()
    path = os.path.join(config_env.DATA_DIR, "socialempires.db")
    print(f" [+] Storage: SQLite at {path}")
    return SQLiteStorage(path)
