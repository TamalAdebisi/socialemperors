# The team test's art repair

Investigation on 16 October 2026, starting from main `002fcbeb`. This is
the separate failure recorded under HANDOFF.md, task 1, not a regression
from #87 or the tournament work. The original source art, game code and
test assertions stay unchanged.

**Status update, 16 October at 12:07 UTC:** the owner-operated
[Export art to R2 run](https://github.com/TamalAdebisi/socialemperors/actions/runs/38885093455)
completed successfully at 10:41 UTC. Ordinary public GETs now show all
nine main manifests at the expected two or three pages, 20 in total.
The main bundle's new SHA-256 is
`c458f0dfdf33870dbf49f04f33891024e1fab14c061bf57c9dda8ae799fad28c`,
with scale 0.25 and step 2. This checkout still has the old 76-page main
manifest cached; the other eight cached manifests match the public ones.
The cache was left unchanged during #87's integrated run. Its result is
recorded in [the delivery report](verification-87.md).

**The separate follow-up remains open:** verify consistent new images,
refresh these cached bundles and run `team` plus the full suite. A pass
with the old cached main bundle does not verify the public repair. #87
verification did not operate the workflow or bucket. The investigation
and exact post-export checks below remain applicable.

**The repair covers nine targeted exports.** The earlier proposal to
refresh only `2075_elemental_red_god` does not cover the oversized art
loaded by the island before the team picker appears.

## Findings

An ordinary GET of
`https://assets.socialemperors.me/art/2075_elemental_red_god.json` still
returned the old export: 76 pages, `meta.scale: "1"`, no `meta.step`,
1,340 distinct pictures and 55 animation sequences. Reading all 76 JSON
files gives **4,074,714,156 bytes (3.79 GiB)** of decoded RGBA pixels.
Mipmaps bring that to about **5.06 GiB**, before decoded image copies,
other art and the browser itself. Compressed download size is not the
memory needed to draw the sheets.

The main manifest's ETag was `1199a227d935d7b9b7f2ddfb22cb2e5f`, its
SHA-256 was
`3ab6d6c20d4123adc94ca47def1e20b8d7c664c69af23c4f10e3a87df3893ab2`,
and its Last-Modified was 14 October 2026, 17:34:20 UTC. That predates
`9c797f7b`, which added the current packing budget on 15 October.

The current packer already uses `MAX_PAGES = 4`. Replaying its planning
and packing functions against the served picture geometry produces
**two pages**, `scale: "0.25"`, `step: 2`, with 681 distinct pictures.
Their sizes are 4094 × 4036 and 4093 × 3932: **130,468,240 bytes
(124.42 MiB)** decoded, about **165.90 MiB** with mipmaps. The budget is
an area estimate rather than a final page-count check; this item really
does fit within it. A full local export of the original SWF confirmed
these exact sizes and preserved all animation lengths, bounds, origin
and frame rate.

### The one-item repair is insufficient

A guarded browser run with that fresh local bundle reached the machine's
memory limit before the team picker (`team.mjs:18`), without requesting
the selected god's art. The guard stopped the run; there was no OOM kill.
The island was loading eight other old bundles. Ordinary public GETs of
their main manifests matched the newly fetched test-cache copies; all
were last modified on 14 October, before the packing-budget change.
Their 71 pages require another **3.88 GiB** of decoded RGBA pixels.

Full local exports of the original SWFs with the unchanged tools produced
the following results. The actual images and all animation references,
lengths, bounds, origins and frame rates were checked:

| Item | Old pages | Old decoded MiB | Fresh pages | Fresh decoded MiB | Scale / step |
| --- | ---: | ---: | ---: | ---: | --- |
| `2042_vulcano_golem` | 7 | 378.45 | 2 | 95.89 | 0.5 / 1 |
| `2055_soul_eater` | 11 | 635.45 | 3 | 159.70 | 0.5 / 1 |
| `2060_slasher_orc` | 5 | 275.86 | 2 | 71.36 | 0.5 / 1 |
| `2072_evil_demon` | 6 | 355.97 | 2 | 88.70 | 0.5 / 1 |
| `758_infernaldragon` | 6 | 342.77 | 2 | 85.49 | 0.5 / 1 |
| `785_bull_png` | 9 | 483.31 | 2 | 121.61 | 0.5 / 1 |
| `845_necro_dragon_jinete` | 20 | 1093.88 | 3 | 140.52 | 0.5 / 2 |
| `847_vulcano_dragon` | 7 | 403.70 | 2 | 100.17 | 0.5 / 1 |
| `2075_elemental_red_god` | 76 | 3885.95 | 2 | 124.42 | 0.25 / 2 |

Together, these nine old bundles have **147 pages and 7.67 GiB** of
decoded pixels before mipmaps or other graphics copies. Today's packer
reduces them to **20 pages and about 988 MiB**. Other ordinary art used
by the test still adds to that. The four-page target is met for each of
these items; an exporter or loader code change is not needed to shrink
them.

The loader (`client/src/view/art.ts`) memoizes each item's load and uses
Pixi's image cache. The battle also deduplicates item names before loading
them. It loads the pages named by the manifest; no duplicate-load defect
was found to explain this failure. Pixi reads `meta.scale` to retain the
original drawing size and anchors.

The browser test helper (`e2e/lib.mjs`) retains fetched art on disk with
no expiry. A new browser alone therefore does not refresh an old manifest.
This can keep the known failure around after a successful owner export.
The public manifest itself was still oversized, so the test cache was not
the cause of the stale public art.

## The owner-operated repair

AGENTS.md reserves the live workflow and bucket for the owner. No live
workflow was started and no bucket file was changed during this work.

1. In GitHub Actions, open **Export art to R2** on **main**.
2. Set **Make these again** to this space-separated list (all nine names):

   ```text
   2075_elemental_red_god 2042_vulcano_golem 2055_soul_eater 2060_slasher_orc 2072_evil_demon 758_infernaldragon 785_bull_png 845_necro_dragon_jinete 847_vulcano_dragon
   ```
3. Leave **Make every sheet again** off and run the workflow.
4. Check the shard logs for successful exports of all nine items and the final
   upload. Do not rely on the workflow being green alone: the export script
   reports individual failures without necessarily failing the whole job.

The workflow first fetches existing JSON files, removes these items' local
JSON markers on every shard, and regenerates each on its assigned shard.
Thus the normal "already exported" shortcut will not skip them. The final
upload explicitly includes the named items. Surplus old pages may remain
in the bucket; the new manifests do not reference them, so
deleting live objects is unnecessary. The workflow can also fill any
other missing items; its input is a targeted redo, not an exclusive filter.

## Verification after the export

1. For each of the nine items, read its public main manifest and every
   page it references, plus the corresponding WebP images. Expect the
   scale and step in the table. Parallel
   rendering can change picture numbering and packing order. Verify the
   actual page count and dimensions: at most four pages of at most
   4096 × 4096, or 256 MiB decoded in total. Confirm the images' actual
   dimensions match the JSON, every animation frame exists, and each
   item's sequences retain their lengths, bounds, origin and frame rate. If the
   export tools changed since this investigation, inspect any difference
   before proceeding.
2. Wait until the ordinary public URLs serve a consistent new bundle.
   The workflow sets `Cache-Control: public, max-age=86400`; browsers or
   intervening caches can retain old files for a day. A cache-busting URL
   alone does not prove the URLs used by the game have refreshed.
3. In each test checkout, move only these items' old disk-cache files out
   of the active cache (keep them as evidence):

   ```sh
   mkdir -p work
   art_backup="$(mktemp -d "$PWD/work/stale-team-art.XXXXXX")"
   for item in 2075_elemental_red_god 2042_vulcano_golem 2055_soul_eater \
     2060_slasher_orc 2072_evil_demon 758_infernaldragon 785_bull_png \
     845_necro_dragon_jinete 847_vulcano_dragon; do
     for file in ".tools/art-cache/art/$item.json" ".tools/art-cache/art/$item.webp" \
       ".tools/art-cache/art/$item"-*.json ".tools/art-cache/art/$item"-*.webp; do
       if [ -f "$file" ]; then mv "$file" "$art_backup/"; fi
     done
   done
   ```

   Also check for a local `art/sheets/` directory: the runner prefers local
   sheets when it exists. Use a fresh checkout without that override when
   verifying the public repair. Remove any temporary local replacement
   used during this investigation; otherwise it would mask the public
   files being checked.
4. Run `PYTHON=.venv/bin/python node e2e/run.mjs team` with memory
   monitoring. Count anonymous/shared/kernel memory separately from
   reclaimable filesystem cache left by an export. Keep every existing
   assertion. Inspect the picker, selected
   team and landed screenshots and `e2e/out/server.log`; passing with an
   outline in place of the unit is not a verified art repair.
5. Run `PYTHON=.venv/bin/python node e2e/run.mjs` on the current integrated
   main, one browser runner per 8-GiB machine. Record commit, duration,
   count, peak memory and screenshot review in HANDOFF.md. Allow over an
   hour on the documented 2-CPU machine. Only then close the public-art
   follow-up. The earlier 63/64 run remains a failure, not a pass.

## Reproduce locally without writing to R2

With the normal project dependencies and JDK installed, use a fresh output
directory, since the exporter skips an existing main JSON:

```sh
for item in 2075_elemental_red_god 2042_vulcano_golem 2055_soul_eater \
  2060_slasher_orc 2072_evil_demon 758_infernaldragon 785_bull_png \
  845_necro_dragon_jinete 847_vulcano_dragon; do
  JOBS=1 RENDER_THREADS=1 PYTHON=.venv/bin/python \
    ART_OUT="$PWD/work/team-art" tools/export_art.sh \
    "assets/buildingsprites/$item.swf"
done
```

This renders the original SWFs and uses the unchanged current packer. It
does not upload anything. Keeping one renderer limits memory use. For a
local browser check, copy the resulting items' JSON and WebP files into
`.tools/art-cache/art/` in an isolated checkout without `art/sheets/`;
the test helper then serves those files while fetching other art normally.
Label such a result as a local replacement test, not a public-bucket pass.

## Local verification on 16 October

Tested runtime code: main `002fcbeb` (the subsequent repository changes in
this PR are documentation only). Environment: 2 CPUs, 8 GiB, Python
3.13.5, Node 24.19.0, Playwright 1.56.1, Java 21.0.12.1 and Pillow 12.3.0.

- The original god export used one renderer thread and took 19 minutes
  47 seconds including first-time tooling setup and packing; rendering
  itself took 959.3 seconds. Maximum child-process RSS was 842.6 MiB.
- The other eight exports ran sequentially with two renderer threads per
  item and took 14 minutes 12 seconds including packing. They stayed
  within the memory guard. All nine bundles verified: 20 pages,
  1,035,838,940 RGBA bytes (987.85 MiB), all images at most 4096 pixels
  each way, all referenced frames present, and animation lengths, bounds,
  origins and frame rates preserved. Source files were unchanged.
- The unchanged `team` test **passed 1/1 in 36 seconds** (38.1 seconds
  including runner startup) with all nine locally generated bundles in
  the isolated test cache. Every JSON and WebP for these items was
  requested once: 40 requests, no duplicate loads. The picker, selected
  team and landed screenshots and the server log were inspected. The
  selected unit renders with its artwork; team selection, saved team and
  leaving checks all pass. The server log has no HTTP errors or exceptions.
- Memory was sampled every 0.5 seconds. Peak anonymous/shared/kernel
  memory was **3.49 GiB**; the whole environment peaked at **4.70 GiB**
  including filesystem cache (baseline 1.37 GiB). No new cgroup memory
  limit, OOM or OOM-kill events occurred, and the guard did not stop the
  passing run.
- Server: **427 run, 418 passed, 9 existing skips**. Client type check,
  build and **all 324 unit tests passed**.

Earlier attempts are not passes: one stopped before player creation due
to this environment's outbound proxy being applied to localhost; a
scratch launcher then applied that proxy only to external art GETs.
The first one-item trial was stopped by a guard that included reclaimable
file cache. With corrected accounting, the one-item trial reached the
memory limit before the picker while loading the eight other old bundles;
the guard stopped it with no OOM kill. No further identical failing runs
were made. The test, assertions and game code were never edited.

The previously recorded full-suite result remains **63/64**, with `team`
failed. The runtime code at `002fcbeb` is unchanged from that #86 baseline;
this documentation-only change does not repeat that known failing public
art run. A full run on integrated main with the repaired **public** art
is still required after the owner's workflow. The local replacement pass
does not close that outstanding verification.
