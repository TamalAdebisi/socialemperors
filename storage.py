"""
Persistent storage for accounts and village saves.

Two backends, chosen by the settings (config_env.py):

  * SQLiteStorage   - a local file (data/socialempires.db). Used for local play,
    development and the tests, and by the hosted server until SE_DATABASE_URL
    is set.
  * PostgresStorage - a Postgres database reached over the network: Supabase,
    for the hosted server. Used when SE_DATABASE_URL is set.

Most of the SQL is shared. Where the two differ (Postgres has no
"INSERT OR IGNORE" or "COLLATE NOCASE", and writes its parameters as %s
instead of ?), PostgresStorage says so.

The game code never talks to these classes directly; sessions.py does.

Write-behind: the game sends a command for almost every click. Writing to the
database on every click would be slow over the network, so changed villages
are marked "dirty" and flushed in a batch every few seconds, plus once more
when the server shuts down. At worst a crash loses the last few seconds of play.
"""

import atexit
import json
import os
import re
import sqlite3
import threading
import time

try:
    import psycopg
    from psycopg.conninfo import conninfo_to_dict, make_conninfo
    from psycopg.errors import UniqueViolation
    from psycopg.rows import dict_row
    from psycopg_pool import ConnectionPool
except ImportError:  # only needed with SE_DATABASE_URL (pip install -r requirements.txt)
    psycopg = None

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
    # Signing in with Discord or Google (sign_in.py): which account there is
    # whose here. account is the player's id at the provider, which never
    # changes; label is what the Settings page shows (their name or email
    # there). One of each provider per player.
    """CREATE TABLE IF NOT EXISTS sign_ins (
        provider TEXT NOT NULL,
        account TEXT NOT NULL,
        user_id INTEGER NOT NULL REFERENCES users(id),
        label TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        PRIMARY KEY (provider, account),
        UNIQUE (user_id, provider)
    )""",
    # Friends (friends.py): a request waits until the other player answers
    # it; a friendship is two rows, one each way, so either side finds it.
    """CREATE TABLE IF NOT EXISTS friend_requests (
        from_id INTEGER NOT NULL REFERENCES users(id),
        to_id INTEGER NOT NULL REFERENCES users(id),
        created_at INTEGER NOT NULL,
        PRIMARY KEY (from_id, to_id)
    )""",
    "CREATE INDEX IF NOT EXISTS friend_requests_to ON friend_requests(to_id)",
    """CREATE TABLE IF NOT EXISTS friends (
        user_id INTEGER NOT NULL REFERENCES users(id),
        friend_id INTEGER NOT NULL REFERENCES users(id),
        since INTEGER NOT NULL,
        PRIMARY KEY (user_id, friend_id)
    )""",
    # Gifts between friends (gifts.py): each waits in the receiver's inbox
    # until they take it into one of their empires. free: one of the day's
    # free gifts (1), or an item from the sender's own storage (0). from_id is
    # empty once the sender's account is gone.
    """CREATE TABLE IF NOT EXISTS friend_gifts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        from_id INTEGER REFERENCES users(id),
        to_id INTEGER NOT NULL REFERENCES users(id),
        item INTEGER NOT NULL,
        count INTEGER NOT NULL,
        free INTEGER NOT NULL,
        sent_at INTEGER NOT NULL,
        taken_at INTEGER
    )""",
    "CREATE INDEX IF NOT EXISTS friend_gifts_to ON friend_gifts(to_id, taken_at)",
    "CREATE INDEX IF NOT EXISTS friend_gifts_from ON friend_gifts(from_id, sent_at)",
    # Asking friends for help (helps.py): from an account's empire, about one
    # thing in it (a building, the dragon nest), to a friend's account, until
    # the friend answers (answered_at).
    """CREATE TABLE IF NOT EXISTS help_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        from_id INTEGER NOT NULL REFERENCES users(id),
        empire TEXT NOT NULL,
        to_id INTEGER NOT NULL REFERENCES users(id),
        kind TEXT NOT NULL,
        town INTEGER NOT NULL,
        x INTEGER NOT NULL,
        y INTEGER NOT NULL,
        item INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        answered_at INTEGER
    )""",
    "CREATE INDEX IF NOT EXISTS help_requests_to ON help_requests(to_id, answered_at)",
    "CREATE INDEX IF NOT EXISTS help_requests_empire ON help_requests(empire, created_at)",
]

# The same tables in Postgres. Usernames are unique in any case, as with
# SQLite's COLLATE NOCASE, through an index on their lower case. Times are
# BIGINT, so they outlive 2038.
POSTGRES_SCHEMA = [
    """CREATE TABLE IF NOT EXISTS users (
        id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
        username TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        created_at BIGINT NOT NULL
    )""",
    "CREATE UNIQUE INDEX IF NOT EXISTS users_username ON users (lower(username))",
    """CREATE TABLE IF NOT EXISTS villages (
        pid TEXT PRIMARY KEY,
        owner_id INTEGER REFERENCES users(id),
        data TEXT NOT NULL,
        updated_at BIGINT NOT NULL
    )""",
    "CREATE INDEX IF NOT EXISTS villages_owner ON villages(owner_id)",
    """CREATE TABLE IF NOT EXISTS problems (
        kind TEXT NOT NULL,
        name TEXT NOT NULL,
        detail TEXT NOT NULL,
        count BIGINT NOT NULL,
        first_seen BIGINT NOT NULL,
        last_seen BIGINT NOT NULL,
        last_player TEXT,
        example TEXT,
        PRIMARY KEY (kind, name, detail)
    )""",
    """CREATE TABLE IF NOT EXISTS tournaments (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        updated_at BIGINT NOT NULL
    )""",
    """CREATE TABLE IF NOT EXISTS sign_ins (
        provider TEXT NOT NULL,
        account TEXT NOT NULL,
        user_id INTEGER NOT NULL REFERENCES users(id),
        label TEXT NOT NULL,
        created_at BIGINT NOT NULL,
        PRIMARY KEY (provider, account),
        UNIQUE (user_id, provider)
    )""",
    """CREATE TABLE IF NOT EXISTS friend_requests (
        from_id INTEGER NOT NULL REFERENCES users(id),
        to_id INTEGER NOT NULL REFERENCES users(id),
        created_at BIGINT NOT NULL,
        PRIMARY KEY (from_id, to_id)
    )""",
    "CREATE INDEX IF NOT EXISTS friend_requests_to ON friend_requests(to_id)",
    """CREATE TABLE IF NOT EXISTS friends (
        user_id INTEGER NOT NULL REFERENCES users(id),
        friend_id INTEGER NOT NULL REFERENCES users(id),
        since BIGINT NOT NULL,
        PRIMARY KEY (user_id, friend_id)
    )""",
    """CREATE TABLE IF NOT EXISTS friend_gifts (
        id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
        from_id INTEGER REFERENCES users(id),
        to_id INTEGER NOT NULL REFERENCES users(id),
        item INTEGER NOT NULL,
        count INTEGER NOT NULL,
        free INTEGER NOT NULL,
        sent_at BIGINT NOT NULL,
        taken_at BIGINT
    )""",
    "CREATE INDEX IF NOT EXISTS friend_gifts_to ON friend_gifts(to_id, taken_at)",
    "CREATE INDEX IF NOT EXISTS friend_gifts_from ON friend_gifts(from_id, sent_at)",
    """CREATE TABLE IF NOT EXISTS help_requests (
        id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
        from_id INTEGER NOT NULL REFERENCES users(id),
        empire TEXT NOT NULL,
        to_id INTEGER NOT NULL REFERENCES users(id),
        kind TEXT NOT NULL,
        town INTEGER NOT NULL,
        x INTEGER NOT NULL,
        y INTEGER NOT NULL,
        item INTEGER NOT NULL,
        created_at BIGINT NOT NULL,
        answered_at BIGINT
    )""",
    "CREATE INDEX IF NOT EXISTS help_requests_to ON help_requests(to_id, answered_at)",
    "CREATE INDEX IF NOT EXISTS help_requests_empire ON help_requests(empire, created_at)",
]

# Every table and its columns, in an order where an empire's owner is always
# copied before the empire (copy_database).
TABLES = {
    "users": ("id", "username", "password_hash", "created_at"),
    "villages": ("pid", "owner_id", "data", "updated_at"),
    "problems": ("kind", "name", "detail", "count", "first_seen", "last_seen", "last_player", "example"),
    "tournaments": ("id", "data", "updated_at"),
    "sign_ins": ("provider", "account", "user_id", "label", "created_at"),
    "friend_requests": ("from_id", "to_id", "created_at"),
    "friends": ("user_id", "friend_id", "since"),
    "friend_gifts": ("id", "from_id", "to_id", "item", "count", "free", "sent_at", "taken_at"),
    "help_requests": ("id", "from_id", "empire", "to_id", "kind", "town", "x", "y", "item", "created_at", "answered_at"),
}

# Tables whose numbers Postgres hands out (copy_database carries on after the highest).
NUMBERED = ("users", "friend_gifts", "help_requests")

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
POSTGRES_ADD_PROBLEM = ADD_PROBLEM.replace("INSERT OR IGNORE", "INSERT") + " ON CONFLICT DO NOTHING"


def _problem_statements(row, add=ADD_PROBLEM):
    """(sql, params) to save one row of the radar: count it, else add it."""
    kind, name, detail, count, first, last, player, example = row
    return [(COUNT_PROBLEM, (count, last, player, example, kind, name, detail)), (add, tuple(row))]


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
    """Shared logic. Subclasses implement _query(), and write_tables() for copy_database."""

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

    def community(self, user_id: int) -> list:
        """Public account names for Everybody, including accounts without an empire."""
        return self._query("SELECT id, username FROM users WHERE id != ? ORDER BY lower(username), id", (user_id,))

    def get_password_hash(self, user_id: int):
        rows = self._query("SELECT password_hash FROM users WHERE id = ?", (user_id,))
        return rows[0]["password_hash"] if rows else None

    def set_password(self, user_id: int, password_hash: str):
        self._query("UPDATE users SET password_hash = ? WHERE id = ?", (password_hash, user_id))

    def delete_user(self, user_id: int):
        """The account, every village it owns, its ways to sign in, its
        friends, the gifts waiting for it and the help asked of it or by it.
        Gifts it sent stay, from nobody."""
        self._query("DELETE FROM help_requests WHERE from_id = ? OR to_id = ?", (user_id, user_id))
        self._query("DELETE FROM villages WHERE owner_id = ?", (user_id,))
        self._query("DELETE FROM sign_ins WHERE user_id = ?", (user_id,))
        self._query("DELETE FROM friend_requests WHERE from_id = ? OR to_id = ?", (user_id, user_id))
        self._query("DELETE FROM friends WHERE user_id = ? OR friend_id = ?", (user_id, user_id))
        self._query("DELETE FROM friend_gifts WHERE to_id = ?", (user_id,))
        self._query("UPDATE friend_gifts SET from_id = NULL WHERE from_id = ?", (user_id,))
        self._query("DELETE FROM users WHERE id = ?", (user_id,))

    # Friends (friends.py)
    def load_friendships(self) -> list:
        """Every friendship, as (user_id, friend_id) both ways. Read once at startup."""
        return [(r["user_id"], r["friend_id"]) for r in self._query("SELECT user_id, friend_id FROM friends")]

    def add_friendship(self, a: int, b: int):
        """a and b are friends now: the request between them goes."""
        now = int(time.time())
        self._query("DELETE FROM friend_requests WHERE (from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?)",
                    (a, b, b, a))
        self._query("INSERT INTO friends (user_id, friend_id, since) VALUES (?, ?, ?)", (a, b, now))
        self._query("INSERT INTO friends (user_id, friend_id, since) VALUES (?, ?, ?)", (b, a, now))

    def remove_friendship(self, a: int, b: int):
        self._query("DELETE FROM friends WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)",
                    (a, b, b, a))

    def friends_of(self, user_id: int) -> list:
        """Their friends, as {"id", "username", "since"}, by name."""
        return self._query("SELECT u.id, u.username, f.since FROM friends f JOIN users u ON u.id = f.friend_id "
                           "WHERE f.user_id = ? ORDER BY lower(u.username)", (user_id,))

    def add_friend_request(self, from_id: int, to_id: int):
        self._query("INSERT INTO friend_requests (from_id, to_id, created_at) VALUES (?, ?, ?)",
                    (from_id, to_id, int(time.time())))

    def remove_friend_request(self, from_id: int, to_id: int) -> bool:
        """False if there was no such request. One statement, so of two
        answers at the same moment only one finds it."""
        return bool(self._query("DELETE FROM friend_requests WHERE from_id = ? AND to_id = ? RETURNING from_id",
                                (from_id, to_id)))

    def friend_requests(self, user_id: int) -> dict:
        """{"to_me": [...], "from_me": [...]}: the requests waiting, each
        {"id", "username", "created_at"} of the other player, newest first."""
        to_me = self._query("SELECT u.id, u.username, r.created_at FROM friend_requests r JOIN users u ON u.id = r.from_id "
                            "WHERE r.to_id = ? ORDER BY r.created_at DESC", (user_id,))
        from_me = self._query("SELECT u.id, u.username, r.created_at FROM friend_requests r JOIN users u ON u.id = r.to_id "
                              "WHERE r.from_id = ? ORDER BY r.created_at DESC", (user_id,))
        return {"to_me": to_me, "from_me": from_me}

    # Gifts between friends (gifts.py)
    def add_friend_gift(self, from_id: int, to_id: int, item: int, count: int, free: bool):
        self._query("INSERT INTO friend_gifts (from_id, to_id, item, count, free, sent_at) VALUES (?, ?, ?, ?, ?, ?)",
                    (from_id, to_id, item, count, 1 if free else 0, int(time.time())))

    def waiting_gifts(self, user_id: int) -> list:
        """The gifts in their inbox, oldest first: {"id", "item", "count", "free", "sent_at", "sender"}
        (sender: the username, or None once that account is gone)."""
        return self._query("SELECT g.id, g.item, g.count, g.free, g.sent_at, u.username AS sender FROM friend_gifts g "
                           "LEFT JOIN users u ON u.id = g.from_id WHERE g.to_id = ? AND g.taken_at IS NULL "
                           "ORDER BY g.sent_at, g.id", (user_id,))

    def take_friend_gift(self, user_id: int, gift_id: int):
        """The gift, marked taken, or None if it isn't waiting for them (any
        more). One statement, so a gift taken twice at once is taken once."""
        rows = self._query("UPDATE friend_gifts SET taken_at = ? WHERE id = ? AND to_id = ? AND taken_at IS NULL "
                           "RETURNING id, item, count, free, from_id", (int(time.time()), gift_id, user_id))
        return rows[0] if rows else None

    def free_gifts_sent(self, from_id: int, since: int) -> list:
        """Who they have sent a free gift to since then (account ids)."""
        return [r["to_id"] for r in self._query("SELECT to_id FROM friend_gifts WHERE from_id = ? AND free = 1 AND sent_at >= ?",
                                                (from_id, since))]

    # Asking friends for help (helps.py)
    def add_help_request(self, from_id: int, empire: str, to_id: int, kind: str, town: int, x: int, y: int, item: int):
        self._query("INSERT INTO help_requests (from_id, empire, to_id, kind, town, x, y, item, created_at) "
                    "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", (from_id, empire, to_id, kind, town, x, y, item, int(time.time())))

    def help_asked_of(self, to_id: int, since: int) -> list:
        """The requests waiting for their answer, asked since then, oldest first,
        each with "asker", the asking account's username."""
        return self._query("SELECT h.id, h.from_id, h.empire, h.kind, h.town, h.x, h.y, h.item, h.created_at, "
                           "u.username AS asker FROM help_requests h JOIN users u ON u.id = h.from_id "
                           "WHERE h.to_id = ? AND h.answered_at IS NULL AND h.created_at >= ? "
                           "ORDER BY h.created_at, h.id", (to_id, since))

    def help_asked_by(self, empire: str, since: int) -> list:
        """Every request from this empire since then, answered or not, each
        with "helper", the friend's username."""
        return self._query("SELECT h.id, h.to_id, h.kind, h.town, h.x, h.y, h.item, h.created_at, h.answered_at, "
                           "u.username AS helper FROM help_requests h JOIN users u ON u.id = h.to_id "
                           "WHERE h.empire = ? AND h.created_at >= ? ORDER BY h.created_at, h.id", (empire, since))

    def count_help_waiting(self, from_id: int, since: int) -> int:
        return self._query("SELECT count(*) AS n FROM help_requests WHERE from_id = ? AND answered_at IS NULL "
                           "AND created_at >= ?", (from_id, since))[0]["n"]

    def answer_help_request(self, to_id: int, request_id: int):
        """The request, marked answered, or None if it isn't waiting for them
        (any more). One statement, so a request answered twice at once is answered once."""
        rows = self._query("UPDATE help_requests SET answered_at = ? WHERE id = ? AND to_id = ? AND answered_at IS NULL "
                           "RETURNING id, from_id, empire, kind, town, x, y, item, created_at",
                           (int(time.time()), request_id, to_id))
        return rows[0] if rows else None

    def remove_help_request(self, to_id: int, request_id: int) -> bool:
        return bool(self._query("DELETE FROM help_requests WHERE id = ? AND to_id = ? RETURNING id", (request_id, to_id)))

    def forget_help_requests(self, before: int):
        """Requests asked before then, answered or not, gone."""
        self._query("DELETE FROM help_requests WHERE created_at < ?", (before,))

    # Signing in with Discord or Google
    def find_sign_in(self, provider: str, account: str):
        """The account id this Discord or Google account signs in to, or None."""
        rows = self._query("SELECT user_id FROM sign_ins WHERE provider = ? AND account = ?", (provider, account))
        return rows[0]["user_id"] if rows else None

    def sign_ins_of(self, user_id: int) -> list:
        return self._query("SELECT provider, label, created_at FROM sign_ins WHERE user_id = ? ORDER BY provider",
                           (user_id,))

    def add_sign_in(self, user_id: int, provider: str, account: str, label: str):
        self._query("INSERT INTO sign_ins (provider, account, user_id, label, created_at) VALUES (?, ?, ?, ?, ?)",
                    (provider, account, user_id, label, int(time.time())))

    def remove_sign_in(self, user_id: int, provider: str):
        self._query("DELETE FROM sign_ins WHERE user_id = ? AND provider = ?", (user_id, provider))

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
        self._query("DELETE FROM help_requests WHERE empire = ?", (pid,))
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

    # Copying everything (copy_database)
    def is_empty(self) -> bool:
        """No accounts and no empires."""
        return not self._query("SELECT 1 FROM users LIMIT 1") and not self._query("SELECT 1 FROM villages LIMIT 1")

    def read_table(self, table: str) -> list:
        """Every row of one of TABLES, as tuples in its columns' order."""
        columns = TABLES[table]
        return [tuple(row[c] for c in columns) for row in self._query(f"SELECT {', '.join(columns)} FROM {table}")]

    def write_tables(self, tables: dict):
        """Add these rows ({table: rows from read_table}), all or none."""
        raise NotImplementedError


def _insert_sql(table: str) -> str:
    columns = TABLES[table]
    return f"INSERT INTO {table} ({', '.join(columns)}) VALUES ({', '.join('?' for _ in columns)})"


class SQLiteStorage(BaseStorage):
    def __init__(self, path: str):
        os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
        self.path = path
        self._local = threading.local()  # one connection per thread
        conn = self._conn()
        conn.execute("PRAGMA journal_mode=WAL")  # safe concurrent reads while writing
        self.init_schema()

    def close(self):
        """This thread's connection (the only one, outside the server)."""
        conn = getattr(self._local, "conn", None)
        if conn is not None:
            conn.close()
            self._local.conn = None

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

    def write_tables(self, tables):
        with self._conn() as conn:  # one transaction
            for table, rows in tables.items():
                conn.executemany(_insert_sql(table), rows)


class PostgresStorage(BaseStorage):
    """A Postgres database, e.g. Supabase.

    url: a connection string, postgresql://user:password@host:port/database.
    On Supabase, use the "Session pooler" one (port 5432): it works from
    Railway, which can't reach Supabase's IPv6-only direct address, and keeps
    one database session per connection. The "Transaction pooler" (port 6543)
    hands each statement to whichever session is free, so the SET search_path
    below wouldn't stick; it is refused.

    schema: the Postgres schema the tables live in. Not "public": Supabase
    publishes the tables in "public" on its Data API, where anyone holding the
    project's public key could read them (password hashes included). A schema
    of our own isn't published. Production and staging share one database,
    each in its own schema ("game" and "staging").
    """

    POOL_SIZE = 5  # connections kept open; plenty for one process with a few threads

    def __init__(self, url: str, schema: str = "game"):
        if psycopg is None:
            raise RuntimeError("SE_DATABASE_URL needs psycopg: pip install -r requirements.txt")
        if not re.fullmatch(r"[a-z_][a-z0-9_]*", schema):
            raise ValueError(f"Not a schema name: {schema!r}")
        params = conninfo_to_dict(url)
        if str(params.get("port")) == "6543":
            raise ValueError("SE_DATABASE_URL is a transaction pooler (port 6543): use the session pooler "
                             "(port 5432) instead. See DEPLOY.md.")
        if "sslmode" not in params and params.get("host") not in (None, "localhost", "127.0.0.1", "::1"):
            url = make_conninfo(url, sslmode="require")  # never unencrypted over the internet
        self.schema = schema
        # One connection first, so a wrong password or address stops the
        # server at once with Postgres's own words (the pool would only say,
        # after a while, that it got no connection).
        psycopg.connect(url, connect_timeout=10).close()
        # prepare_threshold=None: no server-side prepared statements, which
        # poolers in front of Postgres don't always keep.
        self.pool = ConnectionPool(url, min_size=1, max_size=self.POOL_SIZE, open=True, timeout=30,
                                   kwargs={"row_factory": dict_row, "prepare_threshold": None,
                                           "connect_timeout": 10},
                                   configure=self._configure, check=ConnectionPool.check_connection)
        atexit.register(self.pool.close)  # after the last flush: atexit runs the newest first
        self.init_schema()

    def close(self):
        self.pool.close()

    def _configure(self, conn):
        """Every new connection: our schema, and only ours, for unqualified table names."""
        conn.execute(f'SET search_path TO "{self.schema}"')
        conn.commit()

    @staticmethod
    def _run(conn, sql, params=()):
        try:
            cur = conn.execute(sql.replace("?", "%s"), params)
        except UniqueViolation as e:
            raise Exception(f"UNIQUE constraint: {e}")
        return cur.fetchall() if cur.description else []

    def _query(self, sql, params=()):
        # The connection commits when the block ends, or rolls back on an error.
        with self.pool.connection() as conn:
            return self._run(conn, sql, params)

    def _transaction(self, statements):
        """Several (sql, params), all or none."""
        with self.pool.connection() as conn:
            for sql, params in statements:
                self._run(conn, sql, params)

    def init_schema(self):
        statements = []
        # Checked first: CREATE SCHEMA IF NOT EXISTS needs the right to make
        # schemas even when this one is there, and staging's login hasn't it.
        if not self._query("SELECT 1 FROM pg_namespace WHERE nspname = ?", (self.schema,)):
            statements.append((f'CREATE SCHEMA "{self.schema}"', ()))
        statements += [(sql, ()) for sql in POSTGRES_SCHEMA]
        # Row level security on, with no rules: if the schema were ever put on
        # Supabase's Data API, its anonymous visitors would still see nothing.
        # The server's own login owns the tables, so it isn't affected.
        statements += [(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY", ()) for table in TABLES]
        self._transaction(statements)

    # Where Postgres's SQL differs from SQLite's

    def get_user_by_name(self, username):
        rows = self._query("SELECT id, username, password_hash FROM users WHERE lower(username) = lower(?)",
                           (username,))
        return rows[0] if rows else None

    def find_users(self, text, limit=50):
        return self._query("SELECT id, username, created_at FROM users WHERE strpos(lower(username), lower(?)) > 0 "
                           "ORDER BY username LIMIT ?", (text, limit))

    # Batches, each in one transaction

    def save_villages(self, items):
        if not items:
            return
        now = int(time.time())
        with self.pool.connection() as conn, conn.cursor() as cur:
            cur.executemany(UPSERT_VILLAGE.replace("?", "%s"), [(p, o, json.dumps(v), now) for p, o, v in items])

    def save_problems(self, rows):
        self._transaction([s for row in rows for s in _problem_statements(row, POSTGRES_ADD_PROBLEM)])

    def save_tournaments(self, records, deleted=()):
        self._transaction(_tournament_statements(records, deleted))

    def write_tables(self, tables):
        with self.pool.connection() as conn, conn.cursor() as cur:
            for table, rows in tables.items():
                if rows:
                    cur.executemany(_insert_sql(table).replace("?", "%s"), rows)
            # Accounts and gifts were copied with their numbers: new ones carry on after the highest.
            for table in NUMBERED:
                cur.execute(f"SELECT setval(pg_get_serial_sequence('{table}', 'id'), "
                            f"GREATEST((SELECT max(id) FROM {table}), 1), (SELECT count(*) > 0 FROM {table}))")


def copy_database(source: BaseStorage, target: BaseStorage):
    """Copy every account, empire, tournament and bug radar count from one
    database to another, which must be empty. Accounts keep their numbers,
    so every empire keeps its owner."""
    if not target.is_empty():
        raise ValueError("The database to copy into already has accounts or empires.")
    tables = {table: source.read_table(table) for table in TABLES}
    target.write_tables(tables)
    return {table: len(rows) for table, rows in tables.items()}


def open_storage() -> BaseStorage:
    import config_env
    sqlite_path = os.path.join(config_env.DATA_DIR, "socialempires.db")
    if not config_env.DATABASE_URL:
        print(f" [+] Storage: SQLite at {sqlite_path}")
        return SQLiteStorage(sqlite_path)
    store = PostgresStorage(config_env.DATABASE_URL, config_env.DATABASE_SCHEMA)
    print(f" [+] Storage: Postgres, schema {store.schema}")
    # The first start on Postgres: bring over the players kept in SQLite until
    # now, unless told to start afresh (SE_COPY_SQLITE=0). Either way the
    # SQLite file stays as it was, as a backup.
    if os.path.exists(sqlite_path) and store.is_empty():
        if not config_env.COPY_SQLITE:
            print(" [+] Postgres starts empty (SE_COPY_SQLITE=0): nothing copied from SQLite")
            return store
        old = SQLiteStorage(sqlite_path)
        copied = copy_database(old, store)
        old.close()
        print(f" [+] Copied from SQLite into Postgres: {copied}")
    return store
