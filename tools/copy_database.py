"""
Copy every account, empire, tournament and bug radar count from one database
into another, empty one. Each database is a SQLite file or a Postgres
connection string.

A backup of the Supabase database on your own computer (Supabase's free plan
has no backups to download):

    python tools/copy_database.py "postgresql://postgres.<project>:<password>@<host>:5432/postgres" backup.db

And back, into an empty Postgres schema, e.g. after running on SQLite for a while:

    python tools/copy_database.py data/socialempires.db "postgresql://..." --schema game

The server copies its SQLite players into Postgres by itself, the first time
it starts with SE_DATABASE_URL set (storage.open_storage), so this isn't
needed for the move to Supabase.
"""

import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import storage  # noqa: E402  (after the line above, which lets Python find it)


def open_database(where: str, schema: str) -> storage.BaseStorage:
    if where.startswith(("postgres://", "postgresql://")):
        return storage.PostgresStorage(where, schema)
    return storage.SQLiteStorage(where)


def main():
    parser = argparse.ArgumentParser(description=__doc__.strip().splitlines()[0])
    parser.add_argument("source", help="SQLite file or Postgres connection string to copy from")
    parser.add_argument("target", help="SQLite file or Postgres connection string to copy into (must be empty)")
    parser.add_argument("--schema", default="game", help='the Postgres schema (default "game"; staging is "staging")')
    args = parser.parse_args()
    if not args.source.startswith(("postgres://", "postgresql://")) and not os.path.exists(args.source):
        sys.exit(f"No such file: {args.source}")
    source, target = open_database(args.source, args.schema), open_database(args.target, args.schema)
    try:
        copied = storage.copy_database(source, target)
    except ValueError as e:
        sys.exit(str(e))
    finally:
        source.close()
        target.close()
    print("Copied: " + ", ".join(f"{count} {table}" for table, count in copied.items()))


if __name__ == "__main__":
    main()
