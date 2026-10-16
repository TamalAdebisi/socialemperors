# The team test's art repair

Investigation on 16 October 2026, starting from main `002fcbeb`. This is
the separate failure recorded under HANDOFF.md, task 1, not a regression
from #87 or the tournament work. The original source art, game code and
test assertions stay unchanged.

**The repair required nine targeted exports.** The earlier proposal to
refresh only `2075_elemental_red_god` does not cover the oversized art
loaded by the island before the team picker appears.

The owner subsequently authorized Codex to perform the reserved live
step. [Export run 38885093455](https://github.com/TamalAdebisi/socialemperors/actions/runs/38885093455)
was dispatched on main `2918c71f` at 10:07 UTC on 16 October, using the
nine names below and `redo=false`. All eight jobs finished successfully
at 10:42 UTC. Every requested SWF render and packed sheet has an `ok`
entry in its shard log, and final uploads succeeded. The unrelated empty
`1410_bahamut_heart.swf` still failed, as in the preceding workflow and as
already documented in CLIENT.md.

**The art repair follow-up is closed in #91.** All 20 public images
pass both request modes. The owner confirmed
purging exactly the listed URLs in Cloudflare's dashboard. On 16 October
at **11:24:20–11:24:40 UTC**, each ordinary image URL was compared with
its `?repair=38885093455` version, first without Origin and then with
`Origin: https://socialemperors.me` on both requests. All **40 comparisons
passed**: SHA-256 bytes and actual WebP dimensions agree, dimensions match
the freshly fetched JSON, and all files match the verified published
export. The cold-cache `team` check passed, then the full browser suite
finished **61/65**, including `team`, with the four previously documented
failing test names listed below. No additional export, bucket change or
purge was made. No owner-operated step remains for this repair.

## Publication and CDN verification

All nine public main manifests and their sidecars have the expected
scale, step and page counts. Fetching their images with
`?repair=38885093455` verifies **40 files, 20 pages and 1,035,821,932
decoded RGBA bytes (987.84 MiB)**. Actual WebP dimensions match the new
JSON, all animation references exist, and sequence lengths, bounds,
origins and frame rates match the original exports. The red god is two
pages, 4094 × 4036 and 4093 × 3932, as in the local reproduction.

The ordinary URLs initially failed this check: all 20 images were older cached
files with dimensions different from the new manifests. For example, at
10:38 UTC the red-god manifest was new (Last-Modified 16 October,
10:37:51), while its WebP was a Cloudflare `HIT` from 14 October,
17:32:01, sized 3698 × 3278. A `Cache-Control: no-cache` request still
returned that old image, with an observed age of 11,274 seconds. The
cache-busted request returned the correct 4094 × 4036 image, a `MISS`
with Last-Modified 16 October, 10:37:51. A new export does not invalidate
Cloudflare's cached copy of an existing image URL.

The workflow sets a 24-hour cache lifetime. The owner purged only the
**20 exact URLs in [team-art-cache-purge.txt](team-art-cache-purge.txt)**,
using **socialemperors.me → Caching → Configuration → Custom Purge**.
No bucket objects were deleted. Dashboard URL purges can leave a distinct
cache entry for requests with an Origin header, so a plain request alone
is insufficient to close this repair.

The final read-only audit is
[team-art-cdn-verification-2026-10-16.json](team-art-cdn-verification-2026-10-16.json).
It records each URL, request mode and time, SHA-256, actual dimensions,
JSON dimensions, and **CF-Cache-Status, Age and Last-Modified for every
ordinary and query response** (and the fetched JSON). Null means the
header was absent. All 20 ordinary plain responses were `HIT` with ages
369–400 seconds; all 20 ordinary Origin responses were `MISS`, with Age
absent. Query responses were plain `HIT` and Origin `MISS` too. Every
image's Last-Modified was on 16 October, between 10:11:45 and 10:37:51 UTC.
Both modes returned the correct export. The earlier 11:18 plain-only
check passed too, but did not cover the Origin variant.

Had either mode returned stale bytes, the owner's instruction was to
wait for expiry and recheck the affected URLs after about **10:45 UTC
on 17 October**, with no further purge or workaround. No stale response
remains in this audit, so that deferred check is unnecessary. Existing
browsers may still need a reload that refreshes their own cached images.

To repeat the check, GET each listed URL and the same URL with
`?repair=38885093455`, saving response headers and bodies. Repeat both
GETs with `Origin: https://socialemperors.me`. Fetch the corresponding
`.json` in each mode. Compare SHA-256 hashes, read the WebP's actual
width and height, and compare those with `meta.size`; all checks must
pass. The query identifies this export. If another export has replaced
it, inspect that run and establish its expected files first. Refresh the
local test cache only after both modes pass. A browser pass using
cache-busted bodies does not verify ordinary URLs.

## Browser verification with the fresh published files

The isolated test cache's 146 old or locally substituted files for these
nine items were moved aside before publication checks. There is no local
`art/sheets/` override. After the CDN mismatch was found, the **40 verified
published files** described above were placed in that cache; their image
bodies came from the cache-busted public URLs, not from the local export.

On the unchanged runtime at main `2918c71f`, `team` **passed 1/1 in 41
seconds** (43.6 seconds including startup). Every repaired JSON and WebP
was requested once, and all 40 cached file hashes match the verified
downloads. The picker, selected-team and landed screenshots were inspected;
the landed unit renders with its artwork. The server log contains no
HTTP errors or exceptions. Peak anonymous/shared/kernel memory was
**3.44 GiB**, or **4.84 GiB** including filesystem cache, from a 1.59-GiB
whole-environment baseline. No memory-limit, OOM or OOM-kill events
occurred, and the guard did not fire.

That initial full run was stopped when the owner requested the explicit
Origin check and the order **CDN audit → cache refresh → team → full
suite**. It is a partial run, not a completed suite: 33 tests passed and
`construction` failed its existing nine-second interaction deadline before
the stop. The remaining reported failures were caused by stopping the
browser. It took 36m 30s; peak anonymous/shared/kernel memory was 1.91 GiB
(3.44 GiB including file cache), with no memory events. Its output and
screenshots were preserved separately.

### Final ordinary-URL browser verification

Tested commit: `efcb4d242760d273f20ab0c36d20052cbd17a7f1`, which merges
main `36b2f277` (including #89's tournament slice). The runtime matches
that main; this branch changes documentation only. Environment: 2 CPUs,
8 GiB, Python 3.13.5, Node 24.19.0 and Playwright 1.56.1. An uncommitted
proxy preload routes external asset GETs through this environment's
required outbound proxy while keeping the local game server direct.
It changes neither asset URLs nor test assertions.

After the two-mode audit passed, at **11:25:07 UTC** all 40 active
JSON/WebP cache files for the nine items were moved to an evidence backup.
No matching files remained in `.tools/art-cache/art/`, and there was no
`art/sheets/` override. The normal test helper then fetched all 40 files
from ordinary live URLs, without manually populating the cache.

`team` **passed 1/1 in 48 seconds**, or **53.7 seconds including build
and startup**. Every repaired JSON/WebP was requested once and its
cache SHA-256 matches the audited export. The picker, selected-team and
landed screenshots show the original artwork; the local server log has
no HTTP errors or exceptions. Peak anonymous/shared/kernel memory was
**3.55 GiB**, or **5.75 GiB** including filesystem cache, from a 2.35-GiB
whole-environment baseline. No memory-limit, OOM or OOM-kill events
occurred, and the guard did not fire.

The full suite ran afterwards from **11:26:30 to 12:44:15 UTC**, using
those same ordinary-URL files. It finished **61/65 in 77m 45s**, including
build/startup; `team` passed in **41 seconds**, `market` in 68 seconds,
`survival` in 54 seconds and `tournaments` in 134 seconds. Peak
anonymous/shared/kernel memory was **3.74 GiB** (4,019,245,056 bytes),
or **7.35 GiB** including filesystem cache (7,894,482,944 bytes), from a
2.43-GiB whole-environment baseline. No memory-limit, OOM or OOM-kill
events occurred, and the guard did not fire. Whole-environment file
cache includes earlier downloads, exports and checkout files; it is
reclaimable and is reported separately from anonymous/shared/kernel use.

All **176 screenshots** generated by that full run were inspected,
including the picker, selected team and landed artwork. The local server
log has no HTTP errors or exception/error markers. All 40 repaired cache
files still match the audited hashes after the full run. One early
`menus/shop.png` snapshot has blank shop thumbnails, as in the preserved
previous run; the dedicated `shop` screenshots render those same images.
Those separate `buildingthumbs` images are not the repaired sprite sheets.

The four failures are separate from the art repair. #89 already recorded
these four failing test names and reproduced them on unchanged main
`2918c71f`; no game code, test assertion or time limit was changed here:

| Test | Result in this full run | Relationship to the baseline |
| --- | --- | --- |
| `construction` | 33s; nine-second interaction deadline, line 46 | Same assertion as #89's baseline and this investigation's stopped run on `2918c71f`. |
| `scripted-bosses` | 198s; 30-second fight-completion wait, line 120, called from line 65 | Same wait as #89's baseline, but at an earlier battle; independent baseline reproduction below confirms the later case too. |
| `siege` | 36s; engines targeting a building, line 32 | Same assertion documented and reproduced by #89. |
| `walk` | 42s; saved position at the second destination, line 33 | Same assertion documented and reproduced by #89. |

An independent isolated `scripted-bosses` check on unchanged main
`2918c71f` ran afterwards, **12:44–12:51 UTC**, in a separate checkout.
It reproduced the same 30-second wait at line 120, called from line 88
(the later portal case documented by #89). **0/1 passed**: 404 seconds in
the test, **6m 56s including build/startup**. Peak anonymous/shared/kernel
memory was **2.16 GiB** (6.05 GiB including file cache), with no memory
limit/OOM events. All **706 art requests** excluded the nine repaired
items. A scratch observer captured the original failure without changing
its predicate or timeout: the fight remained active with all 30 enemy
units marked dead. The captured failing page shows loaded artwork; the
local server log has no HTTP errors or exceptions. This confirms a
separate combat-completion failure; this art-only repair does not change
that gameplay or relax the wait. The earlier-stage variation in the full
run is retained in the table, not relabelled as an identical call site.

On the integrated runtime, the server ran **428 tests in 62.5 seconds:
419 passed, 9 existing skips**. Client type checking and **333 unit tests
passed**; the browser runner's client build passed too.

## Findings

At the initial investigation, an ordinary GET of
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

## The targeted repair

AGENTS.md normally reserves the live workflow and bucket for the owner.
The initial investigation and #90 made no live changes. The owner's
subsequent request authorized Codex to run this targeted repair; it does
not change the general rule for future exports. The dispatched inputs
were:

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
   alone does not prove the URLs used by the game have refreshed. Compare
   ordinary/query hashes and actual dimensions both without Origin and
   with `Origin: https://socialemperors.me`, recording cache headers as
   in the audit above.
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

The initial #90 investigation retained the earlier **63/64** result, with
`team` failed. Its local replacement pass did not close the public-art
follow-up. The subsequent authorized export, CDN findings and browser
verification with the fresh published files are recorded above; the
historical failed run is not relabelled as a pass.
