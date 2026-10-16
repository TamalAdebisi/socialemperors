![Social Empires](templates/img/logo.png "Social Empires logo")

**Social Empires**, Social Point's strategy game from Facebook, playable
again at **[socialemperors.me](https://socialemperors.me)**: free, online,
your empire saved on the server, with neighbours to visit and the original
art, music and quests.

This is a non-commercial fan project. Nothing is for sale, and the game's
art and music still belong to their owners ([Copyright](ROADMAP.md#copyright)).

## Play

Make an account at [socialemperors.me](https://socialemperors.me), choose
an empire and press **Play**. The new client runs on phones and computers.
Arthur's tutorial starts automatically, saves your progress and ends with
your first draggy. **Menu** opens Friends, Empires and Log out.

Town building, battles and quests are playable; development continues on
the remaining features. [CLIENT.md](CLIENT.md) describes what is built,
and [ROADMAP.md](ROADMAP.md) tracks what remains. The classic clients'
launch choices are hidden; their routes and shared saves are retained.

## What's in here

| Folder | What |
| --- | --- |
| *(the top folder)* | The game server, in Python with Flask: `server.py`, and a module for each part of the game (`shop.py`, `quests.py`, `pvp.py`, ...). Accounts and empires in SQLite, or Postgres on Supabase |
| `templates/` | The website: signing in, choosing an empire, settings, the game pages |
| `client/` | The new game client, in TypeScript with PixiJS, built with Vite |
| `config/` | The game's own settings (every unit, building and level), and our fixes to them in `config/patch/` |
| `villages/` | The starting town, the built-in neighbours, and the quest maps |
| `assets/` | The game's files: its Flash movies, pictures and music. Players get them from Cloudflare R2 |
| `tools/` | Turning the game's art into sprite sheets for the new client, and reading the Flash client for research |
| `tests/`, `e2e/` | The server's tests, and browser tests that play the new client |

## Run it on your computer

You need Python 3.13 (what the live server runs) and, for the new client, Node 22.
`tools/setup.sh` does all of the setting up below in one go, plus a browser
for the browser tests and the decompiled Flash client.

```
python -m venv .venv
. .venv/bin/activate                 # on Windows: .venv\Scripts\activate
pip install -r requirements.txt
(cd client && npm ci && npm run build)
python server.py                     # then open http://127.0.0.1:5050
```

Tests:

```
python -m unittest discover tests    # the server
(cd client && npm test)              # the new client's rules
node e2e/run.mjs                     # the new client in a real browser (e2e/run.mjs says what it needs)
```

## Read more

| | |
| --- | --- |
| [ROADMAP.md](ROADMAP.md) | Where the project is going, how changes reach players, and the decisions so far |
| [CLIENT.md](CLIENT.md) | The new game client: why, how it's built, and how the game works underneath |
| [DECISIONS.md](DECISIONS.md) | Smaller calls made along the way, so any of them can be found and undone |
| [docs/original/](docs/original/README.md) | The map of the original: every class of the Flash client, rule books for running a town, and the rules with no button, in our own words |
| [PARITY.md](PARITY.md) | What the new client still lacks or does differently from the Flash game, for running a town |
| [DEPLOY.md](DEPLOY.md) | Putting the game online, step by step: Railway, Cloudflare R2, Supabase |
| [MULTIPLAYER.md](MULTIPLAYER.md) | The server's settings |
| [FLASH.md](FLASH.md) | Playing with real Flash |
| [CLAUDE.md](CLAUDE.md) | The ground rules for Claude, which does much of the work on this project |
| [AGENTS.md](AGENTS.md) | The same rules for other coding agents (Codex), and how they set up, test and deliver |
| [HANDOFF.md](HANDOFF.md) | Where the work stands and what comes next, for whichever agent starts next |

## Credits

This started as a fork of the
[Social Empires preservation project](https://github.com/AcidCaos/socialemperors)
by AcidCaos, Nerroth and the Social Emperors team, who wrote the first server
that brought the game back. Social Empires itself is by Social Point.

Some places that keep games like this one alive:

- [The 2018 DMCA exemption](https://www.federalregister.gov/documents/2018/10/26/2018-23241/exemption-to-prohibition-on-circumvention-of-copyright-protection-systems-for-access-control), the US rule that lets libraries and archives preserve games whose servers have shut down.
- [The Internet Archive](https://archive.org/), a digital library of the web and other cultural artifacts.
- [BlueMaxima's Flashpoint](https://bluemaxima.org/flashpoint/), the web game preservation project.
- [EFGAMP](https://efgamp.eu/), the European Federation of Video Game Archives, Museums and Preservation projects.
- [UNESCO PERSIST](https://unescopersist.org/), on keeping digital information accessible in the future.

## License

GNU General Public License, version 3 ([LICENSE](LICENSE)).

```
Social Empires preservation project.
Copyright (C) 2022  The Social Emperors team
Changed since 2026 for socialemperors.me.
See the GNU General Public License <https://www.gnu.org/licenses/>.
```
