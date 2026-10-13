# Running Social Empires as a public server

This fork turns the single-player preservation server into one that many
people can play on at once, safely.

## What changed

| Before (single player) | Now (public) |
| --- | --- |
| No accounts: the start page listed every save and anyone could pick any | Username + password accounts; you only see and play your own empires |
| The game's `user_key` was always `123456789` and the server trusted whatever `USERID` a request claimed | Each game page gets a **signed token**; every game request must carry a token matching its `USERID` |
| Session secret was the literal string `SECRET_KEY` | Random secret, generated once and kept (or set `SE_SECRET_KEY`) |
| Address hard-coded to `http://127.0.0.1:5050` | Set `SE_PUBLIC_URL` to your domain |
| Each village a JSON file; all reloaded on every visit to the start page | SQLite database (or Cloudflare D1), loaded once, changes saved in batches every 5 s and on shutdown |
| Flask's development server | gunicorn (`gunicorn server:app`, settings in `gunicorn.conf.py`) |
| Every save on the machine shown as a neighbour | Built-in neighbours + the 30 most recently active players |

Also fixed: path traversal in asset and quest loading, missing-asset fallback
(now off by default), neighbour listing writing junk into other players'
saves, and creating empires without logging in.

## Settings

All settings are environment variables. See the top of `config_env.py` for
the full list. The important ones:

```
SE_PUBLIC_URL=https://your-domain.example   # what players' browsers use
SE_ASSETS_URL=https://assets.your-domain.example  # optional; assets/ on R2
SE_DATA_DIR=/data                            # must be on a persistent disk
SE_SECRET_KEY=<long random string>           # optional; generated if unset
SE_CLIENT_IP_HEADER=X-Real-IP                # header with the visitor's IP (Railway)
SE_INVITE_CODE=letmein                       # optional closed beta
```

**Hosting it:** see [DEPLOY.md](DEPLOY.md) for a step-by-step guide (Railway
for the server, Cloudflare R2 for the 1.3 GB `assets/` folder).

**What's next:** see [ROADMAP.md](ROADMAP.md) for the plan and how changes
reach the live game.

## Run it

```
pip install -r requirements.txt
python server.py              # local, http://127.0.0.1:5050
gunicorn server:app           # production
```

**Run exactly one server process.** Villages live in that process's memory
(see `sessions.py`). gunicorn is configured with 1 worker and several threads.

## Old saves

Saves from the single-player version (`saves/*.save.json`) are imported into
the database automatically on startup, with no owner. They can be attached
to an account later.
