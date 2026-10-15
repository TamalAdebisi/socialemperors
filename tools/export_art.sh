#!/usr/bin/env bash
# Turn the game's buildings and units (Flash files) into sprite sheets: a WebP
# image and a JSON file per item, which any 2D engine can draw. Step 1 of the
# new game client (CLIENT.md).
#
#   tools/export_art.sh [file.swf ...]
#
# Default: every file in assets/buildingsprites/ (buildings and units), the
# effects in assets/fx/ (blasts, beams, spells), and the projectiles: one
# clip of the game's library, 05122012_projectiles.swf#ProyectilMC, whose
# frame n is projectile type n, made into projectile_<n>. Writes art/sheets/<item>.webp
# and <item>.json (big items add <item>-1.webp and so on; art/ is ignored by
# git), and a log, art/export.log. Items that already have a sheet are
# skipped, so a stopped export picks up where it left off; delete art/sheets
# to make everything again.
#
# Settings, in the environment:
#   JOBS=4      how many Java processes draw at once (default: one per core)
#   SHARD=2/4   only every 4th of the items still to make, starting with the
#               2nd: to share the work between machines (.github/workflows/
#               export-art-r2.yml does). Shared out by size, so each machine
#               gets as many big bosses as the others
#   RENDER_THREADS=4  threads drawing one item's frames (default: the cores
#               left over when there are fewer items than JOBS, so the last
#               big bosses don't wait on one core each)
#   TIME_LIMIT=14400  seconds an item may take before it is stopped (4 hours)
#   ART_OUT=/tmp/art  write there instead of art/ (which the game page and
#               the browser tests use instead of the bucket's art when it exists)
#
# Everything takes more than a day on 4 processor cores (about four hours
# on the workflow's 8 machines), almost all of it for the biggest animated
# dragons and bosses, up to two hours each. Check an item by eye:
#   python tools/art/preview.py art/sheets/<item>.json
#
# How it works: tools/art/RenderSwf.java draws every picture of an item with
# FFDec's renderer (the Flash files are read, never their code),
# tools/art/pack_sheet.py trims and packs them into sheets, and the pictures
# are deleted, so the export needs little disk space. Each item gets a Java
# process of its own and up to two hours: the biggest animated bosses take
# up to an hour each, and when five shared one hour, the ones it didn't
# reach were lost.
#
# Needs: what tools/ffdec.sh needs (a Java JDK...), and Python 3 with Pillow
# (pip install Pillow).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${ART_OUT:-$ROOT/art}"
JOBS="${JOBS:-$(nproc 2>/dev/null || echo 4)}"
PYTHON="${PYTHON:-python3}"
SHARD="${SHARD:-1/1}"
TIME_LIMIT="${TIME_LIMIT:-14400}"
PROJECTILES="assets/swf/05122012_projectiles.swf#ProyectilMC"

# The sheet that shows an item is made: <item>.json, or projectile_1.json
# for the projectiles.
sheet_of() {
    case "$1" in
        *"#ProyectilMC") echo "$OUT/sheets/projectile_1.json" ;;
        *) echo "$OUT/sheets/$(basename "$1" .swf).json" ;;
    esac
}

source "$ROOT/tools/ffdec.sh"
"$PYTHON" -c "import PIL" 2>/dev/null || { echo "Needs Pillow: pip install Pillow" >&2; exit 1; }

if [ $# -gt 0 ]; then
    files=("$@")
else
    files=("$ROOT"/assets/buildingsprites/*.swf "$ROOT"/assets/fx/*.swf "$ROOT/$PROJECTILES")
fi
shard="${SHARD%/*}"
shards="${SHARD#*/}"

# Compile the renderer once, against FFDec.
CLASSES="$TOOLS/art-classes"
mkdir -p "$CLASSES" "$OUT/sheets"
javac -nowarn -cp "$FFDEC_CP" -d "$CLASSES" "$ROOT/tools/art/RenderSwf.java" 2>&1 | grep -v "^Note:" || true
rm -rf "$OUT"/render.* "$OUT"/sheets/*.tmp  # left by an export that was stopped

# What's still to make, smallest file first (then by name, so every machine
# lists it the same way): most items take a second, so most sheets are ready
# early, and the big animated bosses (minutes each) come last.
missing=()
for swf in "${files[@]}"; do
    [ -f "$(sheet_of "$swf")" ] || missing+=("$swf")
done
if [ ${#missing[@]} -gt 0 ]; then
    mapfile -t missing < <(for swf in "${missing[@]}"; do printf '%s\t%s\n' "$(wc -c < "${swf%#*}")" "$swf"; done \
        | sort -t $'\t' -k1,1n -k2 | cut -f2-)
fi
# This machine's share: every n-th of that list, so the big ones are shared out too.
todo=()
for i in "${!missing[@]}"; do
    if [ $((i % shards)) -eq $((shard - 1)) ]; then
        todo+=("${missing[$i]}")
    fi
done
# Cores left over when there are fewer items than JOBS go to drawing each
# item's frames side by side, with memory to match (a frame of the biggest
# gods is 200 MB as it is drawn).
if [ -z "${RENDER_THREADS:-}" ]; then
    RENDER_THREADS=1
    if [ ${#todo[@]} -gt 0 ] && [ ${#todo[@]} -lt "$JOBS" ]; then
        RENDER_THREADS=$((JOBS / ${#todo[@]}))
    fi
fi
HEAP="$((1 + 2 * RENDER_THREADS))g"
echo "Making ${#todo[@]} of the ${#missing[@]} sheets still missing ($JOBS at a time, $RENDER_THREADS threads each)..."
: > "$OUT/export.log"
: > "$OUT/errors.log"

# One item: draw it into a folder of its own, pack it, delete the pictures.
batch() {
    local pictures status=0
    pictures="$(mktemp -d "$OUT/render.XXXXXX")"
    timeout "$TIME_LIMIT" java -Djava.awt.headless=true -Xmx"$HEAP" -cp "$FFDEC_CP:$CLASSES" RenderSwf "$pictures" "$@" \
        2>> "$OUT/errors.log" || status=$?
    if [ "$status" -eq 124 ]; then
        echo "FAIL $(basename "$1"): still drawing after $((TIME_LIMIT / 60)) minutes, stopped"
    fi
    local drawn=("$pictures"/*/manifest.json)
    if [ -f "${drawn[0]}" ]; then
        local split=()
        case "$1" in *"#ProyectilMC") split=(--split-frames projectile) ;; esac
        "$PYTHON" "$ROOT/tools/art/pack_sheet.py" "${split[@]}" --out "$OUT/sheets" "${drawn[@]%/manifest.json}" || true
    fi
    rm -rf "$pictures"
}
export -f batch
export FFDEC_CP CLASSES OUT PYTHON ROOT TIME_LIMIT HEAP RENDER_THREADS
if [ ${#todo[@]} -gt 0 ]; then
    # Each item's line shows here as it is done, and goes in the log.
    printf '%s\0' "${todo[@]}" | xargs -0 -n 1 -P "$JOBS" bash -c 'batch "$@"' _ | tee -a "$OUT/export.log" || true
fi

failed=()
for swf in "${todo[@]}"; do
    [ -f "$(sheet_of "$swf")" ] || failed+=("$(basename "$swf")")
done
echo "Done: made $((${#todo[@]} - ${#failed[@]})) of ${#todo[@]} sheets ($(du -sh "$OUT/sheets" | cut -f1) in $OUT/sheets)."
if [ ${#failed[@]} -gt 0 ]; then
    echo "No sheet for ${#failed[@]}: ${failed[*]:0:20}"
fi
grep -E '^(FAIL|warning)' "$OUT/export.log" | head -20 || true
echo "Full log: $OUT/export.log (and Java's own messages in $OUT/errors.log)"
