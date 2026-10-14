"""
Postgres (storage.PostgresStorage, Supabase in production): where its SQL
differs from SQLite's, and copying every player from one database to the other.

The Postgres tests need a database to make throwaway schemas in, e.g. a
local one:

    SE_TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:5432/postgres \\
        python -m unittest tests.test_postgres

Without it they are skipped. (The whole suite can run on Postgres too: set
SE_DATABASE_URL and SE_DATABASE_SCHEMA instead.)
"""

import os
import tempfile
import time
import unittest
from unittest import mock

import storage

URL = os.environ.get("SE_TEST_DATABASE_URL")


def sqlite_store(test, data_dir=None):
    store = storage.SQLiteStorage(os.path.join(data_dir or tempfile.mkdtemp(prefix="se-test-"), "socialempires.db"))
    test.addCleanup(store.close)
    return store


def some_players(store):
    """Two accounts (the first deleted, so numbers have a gap), an empire
    each, one without an owner, a tournament and a radar count."""
    gone = store.create_user("Gone", "hash-0")
    alice = store.create_user("Alice", "hash-1")
    bob = store.create_user("Bob", "hash-2")
    store.delete_user(gone)
    store.save_villages([("pid-a", alice, {"name": "A"}), ("pid-b", bob, {"name": "B"}), ("pid-old", None, {})])
    store.save_tournaments([{"id": "t1", "players": ["pid-a"]}])
    store.save_problems([("unhandled", "cmd", "", 3, 10, 20, "pid-a", "{}")])
    store.add_sign_in(bob, "discord", "1234567890", "Bob on Discord")
    return alice, bob


class CopyingTest(unittest.TestCase):
    """SQLite to SQLite: runs everywhere."""

    def test_everything_is_copied_with_its_numbers(self):
        source, target = sqlite_store(self), sqlite_store(self)
        alice, bob = some_players(source)
        copied = storage.copy_database(source, target)
        self.assertEqual(copied, {"users": 2, "villages": 3, "problems": 1, "tournaments": 1, "sign_ins": 1})
        self.assertEqual(target.get_user_by_name("alice")["id"], alice)
        self.assertEqual(target.get_password_hash(bob), "hash-2")
        self.assertEqual(sorted((pid, owner) for pid, owner, _ in target.load_all_villages()),
                         [("pid-a", alice), ("pid-b", bob), ("pid-old", None)])
        self.assertGreater(target.create_user("Carol", "hash-3"), bob)
        self.assertEqual(target.find_sign_in("discord", "1234567890"), bob)  # Bob's Discord still finds him

    def test_only_into_an_empty_database(self):
        source, target = sqlite_store(self), sqlite_store(self)
        some_players(source)
        target.create_user("Someone", "hash")
        with self.assertRaises(ValueError):
            storage.copy_database(source, target)


@unittest.skipUnless(URL, "set SE_TEST_DATABASE_URL to a Postgres database to run these")
class PostgresTest(unittest.TestCase):

    def setUp(self):
        self.schema = f"test_{time.time_ns()}"
        self.store = storage.PostgresStorage(URL, self.schema)
        self.addCleanup(self.drop_schema)

    def drop_schema(self):
        self.store._query(f'DROP SCHEMA "{self.schema}" CASCADE')
        self.store.close()

    # Accounts

    def test_usernames_in_any_case(self):
        user_id = self.store.create_user("MixedCase", "hash")
        self.assertEqual(self.store.get_user_by_name("mixedcase")["id"], user_id)
        self.assertEqual([u["id"] for u in self.store.find_users("XEDc")], [user_id])
        with self.assertRaises(storage.UsernameTaken):
            self.store.create_user("MIXEDCASE", "hash")
        # Two sign-ups at the same moment: the database refuses the second too.
        with mock.patch.object(self.store, "get_user_by_name", return_value=None):
            with self.assertRaises(storage.UsernameTaken):
                self.store.create_user("mixedCASE", "hash")

    # Empires

    def test_saving_an_empire_again_keeps_its_owner(self):
        owner = self.store.create_user("Owner", "hash")
        self.store.save_villages([("pid", owner, {"v": 1})])
        self.store.save_villages([("pid", None, {"v": 2})])
        self.assertEqual(self.store.load_all_villages(), [("pid", owner, {"v": 2})])
        self.store.delete_user(owner)
        self.assertEqual(self.store.load_all_villages(), [])

    # The bug radar and tournaments

    def test_the_radar_counts_up_and_keeps_a_thousand_at_most(self):
        rows = [("unhandled", f"c{n}", "", 1, 0, 0, None, "") for n in range(storage.MAX_PROBLEMS + 5)]
        self.store.save_problems(rows)
        self.store.save_problems(rows[:1])
        kept = self.store.list_problems(10**4)
        self.assertEqual(len(kept), storage.MAX_PROBLEMS)
        self.assertEqual((kept[0]["name"], kept[0]["count"]), ("c0", 2))

    def test_tournaments(self):
        self.store.save_tournaments([{"id": "a", "n": 1}, {"id": "b", "n": 1}])
        self.store.save_tournaments([{"id": "a", "n": 2}], deleted=["b"])
        self.assertEqual(self.store.load_all_tournaments(), [{"id": "a", "n": 2}])

    # Copying, both ways

    def test_from_sqlite_and_back(self):
        source = sqlite_store(self)
        alice, bob = some_players(source)
        storage.copy_database(source, self.store)
        self.assertEqual(self.store.get_user_by_name("BOB")["id"], bob)
        self.assertEqual(self.store.list_problems()[0]["count"], 3)
        self.assertGreater(self.store.create_user("Carol", "hash-3"), bob)  # numbering carries on

        backup = sqlite_store(self)
        storage.copy_database(self.store, backup)
        self.assertEqual(sorted(backup.read_table("villages")), sorted(source.read_table("villages")))
        self.assertEqual(backup.get_user_by_name("carol")["username"], "Carol")

    def test_the_first_start_copies_the_sqlite_players_once(self):
        data_dir = tempfile.mkdtemp(prefix="se-test-")
        old = sqlite_store(self, data_dir)
        alice, _ = some_players(old)
        settings = {"DATA_DIR": data_dir, "DATABASE_URL": URL, "DATABASE_SCHEMA": self.schema}
        with mock.patch.multiple("config_env", **settings):
            store = storage.open_storage()
            self.addCleanup(store.close)
            self.assertEqual(store.get_user_by_name("alice")["id"], alice)
            # An account made since, on Postgres; the next start leaves it all alone.
            old.create_user("OnlyInSQLite", "hash")
            again = storage.open_storage()
            self.addCleanup(again.close)
        self.assertIsNone(again.get_user_by_name("OnlyInSQLite"))
        self.assertEqual(len(again.load_all_villages()), 3)

    # Safety

    def test_no_table_is_open_to_supabases_data_api(self):
        rows = self.store._query("SELECT c.relname, c.relrowsecurity FROM pg_class c "
                                 "JOIN pg_namespace n ON n.oid = c.relnamespace "
                                 "WHERE n.nspname = ? AND c.relkind = 'r'", (self.schema,))
        self.assertEqual({r["relname"]: r["relrowsecurity"] for r in rows}, {t: True for t in storage.TABLES})

    def test_settings_it_refuses(self):
        with self.assertRaises(ValueError):  # a transaction pooler: our search_path wouldn't stick
            storage.PostgresStorage("postgresql://u:p@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres")
        with self.assertRaises(ValueError):
            storage.PostgresStorage(URL, 'game"; DROP TABLE users; --')


if __name__ == "__main__":
    unittest.main()
