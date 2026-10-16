# Structure idle animation pass — 16 October 2026

The reported Lumber Mill I flicker is reproducible on the previous build:
its finished picture alternates with scaffolding at the sheet's 24 fps.
Hover also snapshots one of those pictures, leaving a scaffold-shaped
yellow silhouette behind the mill. These are shared rendering problems,
not a Safari-only failure.

## Inventory and coverage

The patched config contains **1,010 building entries, using 969 art names**.
This includes scenery, terrain, defenses and offers as well as ordinary
town buildings. All names were checked against both the source art and
the ordinary public sheet URLs, using read-only requests.

| Result | Unique art files |
| --- | ---: |
| Readable source and available public sheet | 900 |
| First child has multiple states in at least one facing | 86 |
| Remaining files with changing pictures | 261 |
| Remaining files with one picture per facing | 553 |
| Source unavailable and public sheet returns HTTP 404 | 69 |

The 900 available files cover **941 configured entries**. The 86 stateful
files cover 91 entries. Their 900 main manifests and 1,263 additional
pages contain **no unresolved animation texture references**.

Every available sheet's trimmed frame sizes were checked for completely
empty pictures and large changes. The empty pictures belong to seven
erroneous loop endings, three trees' existing skin choices, and five
terrain variants' existing empty blocks. Tree and terrain choices are
retained. Large bounding-box changes in moving chained offers are not
grounds to freeze their animation; their child timelines remain intact.

The browser regression renders all **86 stateful files, seven repaired
blank-ending loops, and four genuine-motion controls**, in every facing.
It traverses every resulting frame, checks allowed state samples and
matching hover textures, and captures each structure. Its test pages
reload every six art files to release large decoded atlases. This is
separate from the source/manifest pass over all 900 files: the record does
not claim a manual browser playthrough of unavailable art.

## Rendering decisions

Research used `IsoElement`'s animation controller locally, with notes in
our own words. No decompiled source is included. Ordinary idle buildings
hold the first child on its first state; animation inside that state can
continue. Oil/water towers use the next state while they have a target.
Working farms, animal counts, tree skins and explicit quest states take
precedence over the ordinary idle choice.

Our exporter held the root facing but advanced every child together. Its
textures therefore interleave state selectors with real motion. Generated
`view/buildingStates.ts` records the first display child's frame count for
each facing. `buildingStateFrames` keeps samples belonging to the chosen
state and holds each until its next sample. The loop retains its original
duration, including a final partial interval. This cannot recover motion
frames that were never exported; it retains the available samples at the
correct timing. No public art upload is needed for this repair.

The distinction between the first display child and the first movie clip
matters: a building with a static shape first can have later animated
layers. The generator includes shapes when determining the first child,
so the Coliseum Stands' later animation is not incorrectly frozen.

The Training Stables have six animal-count states interleaved with a
318-frame nested loop. Each count now stays in its own state. The occupied
Sacrifice Altar retains its existing active sequence; this idle repair
does not redesign its working animation. Farms keep their existing
male/female working and ready-crop selectors. Explicit chest steps and
quest states remain higher priority than idle selection.

Hover outlines use the picture's current texture, anchor, scale and
position immediately before rendering. Eight fixed copies share that
frame; they do not run independent animation clocks or retain snapshots.

Seven loops end in a fully transparent picture of the entire structure:
`retretetrol` (frame 382) and `1448_chained_chest`, `1449_chained_chest`,
`1467_chained_dark`, `3006_chained_monster_chest`, `3032_chained_creatures`,
`3074_chained_chest` (frame 210, counted from 1). Omit that final frame,
retaining all preceding motion. The correction is limited to these names
and lengths, so an already corrected future export is left alone.

## Reproduce the visual metadata

Use the normal local Python/Java setup. This reads visual timeline data
from the original art and never decompiles scripts:

```bash
mkdir -p work/idle/classes
.venv/bin/python - <<'PY'
import contextlib, io
from pathlib import Path
with contextlib.redirect_stdout(io.StringIO()):
    from get_game_config import game_config
names = sorted({i['img_name'] for i in game_config()['items'] if i['type'] == 'b'})
Path('work/idle/art-names.txt').write_text('\n'.join(names))
PY
source tools/ffdec.sh
javac -cp "$FFDEC_CP" -d work/idle/classes tools/art/RenderSwf.java tools/art/BuildingStates.java
java -Xmx1g -cp "work/idle/classes:$FFDEC_CP" BuildingStates work/idle/art-names.txt > work/idle/buildingStates.ts
diff -u client/src/view/buildingStates.ts work/idle/buildingStates.ts
```

The generator reports each unavailable source on stderr and the totals:
900 readable, 86 stateful, 69 unavailable. Of the unavailable sources,
68 files are absent and `1410_bahamut_heart.swf` has a truncated header.
All 69 corresponding public manifests also return 404. This is an
existing art inventory limit, not a new failure caused by this change;
there is no source here from which to repair those 69 sheets. The existing
missing-art fallback remains. Verification results are recorded alongside
the delivery notes after the complete suites finish.

## Unavailable inventory

All rows returned HTTP 404 for the public manifest. The corresponding
source is absent except for `1410_bahamut_heart`, whose file is truncated.
No live operation or owner account was used to check them.

| Config id | Art name |
| --- | --- |
| 91 | `trophytotem` |
| 184 | `islarock` |
| 1210 | `1210_miniportal` |
| 1246 | `1246_barracafantasma` |
| 1302 | `1302_barrack_pyros` |
| 1315 | `1315_necro_deco_4` |
| 1324 | `1324_necro_gollum_barracks` |
| 1327 | `1327_necro_executioner_barracks` |
| 1328 | `1328_necro_shark_barracks` |
| 1330 | `1330_necro_gryphon_barracks` |
| 1331 | `1331_necro_abomination_barracks` |
| 1332 | `1332_necro_worm_barracks` |
| 1410 | `1410_bahamut_heart` |
| 1427 | `upgrade1` |
| 1428 | `upgrade2` |
| 1429 | `upgrade3` |
| 1430 | `upgrade4` |
| 1432 | `1432_chained_jade_dragon` |
| 1434 | `1434_barracks_archer_orc` |
| 1440 | `1440_deco3` |
| 1458 | `1458_banyan_tree` |
| 1472 | `1472_chained_soul_eater` |
| 1523 | `1523_dwarfAxe_barrack` |
| 1524 | `1524_dwarfPriest_barrack` |
| 1525 | `1525_dwarvenCatapult_barrack` |
| 3042 | `3042_chained_reptile_warrior` |
| 3058 | `3058_chained_supreme` |
| 3088 | `3088_chained_genesisWindColossus` |
| 3089 | `3089_chained_tinyLightGod` |
| 49987 | `murallaiphone1` |
| 49988 | `murallaiphone2` |
| 49989 | `murallaiphone3` |
| 49990 | `murallaiphone4` |
| 49991 | `murallaiphone5` |
| 49992 | `50002_heroes_hall` |
| 49993 | `49993_winged_knight_barracks` |
| 49994 | `49994_troll_barracks` |
| 49995 | `49995_ninja_barracks` |
| 49996 | `49996_elephant_barracks` |
| 49997 | `49997_ranch` |
| 49998 | `49998_ranch` |
| 49999 | `49999_ranch` |
| 50001 | `50001_townhall1` |
| 50003 | `50003_embassy1` |
| 50004 | `50004_stone_mine` |
| 50005 | `50005_forest_harbour` |
| 50006 | `50006_blacksmith1` |
| 50007 | `50007_townhall2` |
| 50008 | `50008_university1` |
| 50009 | `50009_embassy2` |
| 50010 | `50010_oracle` |
| 50011 | `50011_snow_harbour` |
| 50012 | `50012_blacksmith2` |
| 50014 | `50014_university2` |
| 50015 | `50015_townhall3` |
| 50016 | `50016_embassy3` |
| 50018 | `50018_townhall4` |
| 50019 | `50019_townhall5` |
| 50020 | `50020_embassy4` |
| 50021 | `50021_embassy5` |
| 50022 | `50022_japan_harbour` |
| 50023 | `50023_mineral_harbour` |
| 50024 | `50024_mountain_harbour` |
| 50025 | `50025_blacksmith3` |
| 50026 | `50026_blacksmith4` |
| 50027 | `50027_blacksmith5` |
| 50028 | `50028_university3` |
| 50029 | `50029_university4` |
| 50030 | `50030_university5` |
