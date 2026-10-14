# New game client: scope

Phase 4 of the [roadmap](ROADMAP.md): replacing the Flash client with a
modern one that draws the same art and talks to the same server. This is a
first pass at what that involves, measured on the client we run today
(0.9.26b) in October 2026. Nothing here is built yet, and the work starts
after Phase 2, Cash and Phase 3.

## In short

- **The Flash client is the whole game, not just its pictures.** The server
  only records what the client says happened. A new client means writing the
  game again: about 184,000 lines of decompiled ActionScript, roughly 25 times
  the size of our whole server.
- **The art can be reused.** Most buildings are a single picture. Units are
  pre-drawn pictures with labelled animations. A test conversion was
  pixel-perfect and, as WebP, smaller than the original Flash file.
- **It can be built a piece at a time.** The new client can talk to the server
  exactly as the Flash client does, so both can run side by side on the same
  saves, and players move over when the new one does what they need.
- **Recommendation:** TypeScript, PixiJS 8 to draw the map, windows in HTML
  and CSS, and the game rules kept apart from the drawing code.
- It is the biggest project on the roadmap, bigger than Phase 2. Its first
  step, turning the Flash art into ordinary image files, is Phase 3's asset
  pipeline.

## Why replace it

What the Flash client costs us today:

- It runs inside Ruffle, an emulator. When Ruffle gets something wrong, we
  can't fix it (WebGPU crashed the game, for example).
- The game is laid out for 760 × 600 and scaled to fit the window: its
  pictures go soft on a big screen, everything is tiny on a phone, and it is
  made for a mouse, not fingers.
- We can't change it. The welcome-back bonus is switched off inside the
  client and stays off. New units and buildings need new Flash files.
- It decides what happened, and the server believes it. That is the cheating
  gap in the [Cash](ROADMAP.md#cash) section.

What a new client gives:

- Sharp at any size, real full screen, phones and tablets.
- New content as ordinary image files and game config.
- Client code that is ours, so we can change how the game behaves.
- The option to let the server check results (see
  [Who decides what happened](#who-decides-what-happened)).

## What the Flash client does today

### It is the whole game

1. On start, the client asks for the game config (`get_game_config.php`), a
   2 MB JSON file with every item, level, mission and piece of text, and for
   the player's save (`get_player_info.php`).
2. From then on it plays the game by itself: timers, building, battles. As
   the player plays, it sends the server batches of what happened (`command.php`),
   for example "bought item 26 and placed it at 52, 52". The server replays
   the batch onto its copy of the save and answers "success".
3. A few more calls cover the world map, player profiles and error reports.

So the rules of the game live in the client. The server's 105 commands copy
their effects onto the save; they don't decide them.

### How big it is

Decompiled locally with `tools/decompile_client.sh` (the output is never
committed). These are lines of decompiled code, which is wordier than code a
person writes, so a rewrite will be smaller. The order of size still holds.

| Part | Lines | What it covers |
| --- | ---: | --- |
| Windows and menus | 41,300 | About 100 kinds of window (shop, quests, temple, dragons, market...) and the toolbar |
| Item behaviours | 36,700 | 350 small pieces of code for buildings and units that do something special |
| Quests | 20,000 | The islands and survival mode |
| Special units | 18,700 | 115 units with code of their own: dragons, colossi, heroes, bosses |
| Map engine | 15,400 | The isometric map, and what every building and unit can do: be placed, move, fight, be clicked |
| Battles | 10,400 | Unit behaviour in battle, projectiles, attacks on other empires, spells |
| Everything else | 41,200 | Loading, talking to the server, the tutorial, particles, settings |
| **Game code in total** | **184,000** | About 25 times our whole server (7,500 lines of Python) |

Not to rewrite: 11,700 lines of libraries (animation, JSON, encryption) and
12,500 lines of small classes that Flash generates for pieces of art.

The long tails stand out: 115 special units, 350 special items and about 100
windows, each to be looked at one by one.

### The art

Measured by reading the frames, pictures and animation labels in every Flash
file, and by exporting one unit with FFDec (the decompiler that
`tools/decompile_client.sh` builds).

| What | Files | How it's made | Converting it |
| --- | ---: | --- | --- |
| Buildings | 900 | 571 are a single picture; the rest have a few | Easy: take the pictures out |
| Units | 669 | Pre-drawn pictures (69 per unit, typically) on a timeline, in 5 directions; the other 3 are mirrored. Animations are labelled in Spanish: idle `QUIETO`, walk `ANDAR`, attack `ATAQUE`, death `MUERTE`, hit `PICAR` | Mostly automatic: 347 have only those animations and 220 add a special move. 102 (bosses and the like) are laid out their own way and need a look by hand |
| Effects | 244 | Particles, projectiles and spells, mostly vector drawings; also 35 of the game's sounds | Render to frames, or redo with the engine's particle effects |
| Windows and buttons | (the client) | Inside the client file: 1,347 vector shapes and 365 pictures | Rebuild in HTML and CSS, reusing the pictures |
| Music, thumbnails, backgrounds | 2,557 | Already MP3, JPG and PNG | Nothing to do |

**Test:** the Advanced Catapult (`767_lanzapiedras.swf`, 0.94 MB) exported in
7 seconds: 59 pictures, five directions and every animation, identical to
what the game shows. As PNG the pictures take 3.1 MB; as WebP at quality 85,
0.73 MB. So the converted art doesn't need to be bigger than today's 1.3 GB.

The asset pipeline in Phase 3 is therefore the first step of the new client:
one script that turns the Flash files into sprite sheets (WebP) plus a small
JSON file per item naming its animations, uploaded to R2 like the assets are
now.

## Choices

### Engine

| Option | What it is | For | Against |
| --- | --- | --- | --- |
| Stay on Ruffle | Keep the Flash client | No work | Every limit above stays |
| **PixiJS 8** (recommended) | A fast 2D drawing library (WebGL and WebGPU) | Mature, light, made for many sprites on screen; we keep full control | We put the rest together ourselves: camera, sound, animation timing |
| Phaser 4 | A full game framework with its own renderer | Scenes, loading, input, sound and animation included | Bigger; version 4 is new (2026); its extras, like physics, aren't needed here |
| Godot or Unity, exported to the web | Full game engines | Strong editors | Large downloads and a slow start in a browser; harder to mix with HTML windows |

Neither PixiJS nor Phaser draws isometric maps for us, so the map is our code
either way. The choice matters less than it looks, as long as the game rules
are kept out of the drawing code. Step 2 below (drawing a real town) is where
we confirm it: if PixiJS struggles there, switching is still cheap.

### Windows in HTML, not drawn by the engine

The game has about 100 kinds of window. Built as HTML and CSS on top of the
map, they are sharp at any size, easy to fit on a phone and easy to
translate, and the extracted pictures can still be their backgrounds and
icons. The engine draws only the map, the units and the effects.

### Who decides what happened

Today the client decides and the server believes it. There are two ways
forward:

1. **Keep it that way at first** (recommended). The new client sends the same
   commands as the Flash client. No server changes, the same saves, and both
   clients side by side.
2. **Let the server decide.** The server checks timers, costs and battle
   results. That closes the cheating gap, but the battle rules then have to
   run on the server too.

To keep the second way open, battles are written to be repeatable: a seeded
random number generator and a fixed time step, so the same battle with the
same armies always ends the same way. Later the server, or a small
TypeScript service next to it, can replay a battle and check what the client
reported.

## How we'd build it

**Side by side.** The new client is a second game page on the same server and
the same saves. Players can try it and go back to the Flash client at any
time. The Flash client stays until the new one does everything players
actually use; the bug radar on the admin page shows what that is.

| Step | What it delivers | Size |
| --- | --- | --- |
| 1. Art pipeline (Phase 3) | A script that turns the Flash files into sprite sheets and animation files on R2 | Small |
| 2. Look at your town | Load the config and the save; draw the map, buildings and idle units; scroll, zoom, full screen, touch. Read-only. Confirms the engine | Medium |
| 3. Run your town | Collect, build, move, store, sell, the shop, levels, sending the same commands as the Flash client. The server's tests show what each command looks like | Large |
| 4. Battles | Island quests, unit behaviour, projectiles, spells, attacking other empires | Largest |
| 5. Everything else | The world map, temple, collections, market, dragons, survival, darts, the time machine, the tutorial, sound; the special units and items | Large, long tail |
| 6. Switch over | The new client becomes the default; the Flash one stays as "classic" for a while | Small |

After step 3 the new client is already a working town builder for players
who aren't fighting, which is a good moment to open it as a beta.

**In the repository:** a `client/` folder (TypeScript, built with Vite), with
the game rules (`rules/`, no drawing, unit-tested), the drawing (`view/`,
PixiJS), the windows (`ui/`) and the server calls (`net/`) kept apart. A
GitHub Action builds it and uploads it to R2, as it does for the assets.

## Risks

| Risk | What we do about it |
| --- | --- |
| Size: the long tails of special units, items and windows | Side by side, so the new client is useful before it's complete; do what players use first |
| Battles feel different (timing, damage, unit behaviour) | Numbers come from the game config; compare with the Flash client on staging; tests that pin the numbers |
| Copyright: the new client copying Social Point's code | Read the decompiled client to learn how the game behaves, write notes in our own words, then write our own code. Never paste or machine-translate ActionScript into the new client. The art is used as it is today |
| A save the Flash client can't read while both run | Only the existing commands; the server tests; every step tried on staging first |
| Download size and phones | WebP, each item's art loaded only when needed (as now), and testing on a mid-range phone from step 2 |

## Decisions to make

- [ ] Engine: PixiJS 8 (recommended) or Phaser 4, confirmed at step 2
- [ ] Windows in HTML and CSS (recommended)
- [ ] The new client sends the existing commands at first (recommended), with
      repeatable battles so the server can check them later
- [ ] The beta page's name and how players find it
