#!/usr/bin/env bash
# Turn the game's buildings and units (Flash files) into sprite sheets: a WebP
# image and a JSON file per item, which any 2D engine can draw. Step 1 of the
# new game client (CLIENT.md).
#
#   tools/export_art.sh [file.swf ...]
#
# Default: every file in assets/buildingsprites/. Writes art/sheets/<item>.webp
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
#
# Everything takes a few hours on 4 processor cores, mostly for the big
# animated bosses and buildings. Check an item by eye:
#   python tools/art/preview.py art/sheets/<item>.json
#
# How it works: tools/art/RenderSwf.java draws every picture of 5 items at a
# time with FFDec's renderer (the Flash files are read, never their code),
# tools/art/pack_sheet.py trims and packs them into sheets, and the pictures
# are deleted, so the export needs little disk space.
#
# Needs: what tools/ffdec.sh needs (a Java JDK...), and Python 3 with Pillow
# (pip install Pillow).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/art"
JOBS="${JOBS:-$(nproc 2>/dev/null || echo 4)}"
PYTHON="${PYTHON:-python3}"
SHARD="${SHARD:-1/1}"

source "$ROOT/tools/ffdec.sh"
"$PYTHON" -c "import PIL" 2>/dev/null || { echo "Needs Pillow: pip install Pillow" >&2; exit 1; }

if [ $# -gt 0 ]; then
    files=("$@")
else
    files=("$ROOT"/assets/buildingsprites/*.swf)
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
    [ -f "$OUT/sheets/$(basename "$swf" .swf).json" ] || missing+=("$swf")
done
if [ ${#missing[@]} -gt 0 ]; then
    mapfile -t missing < <(for swf in "${missing[@]}"; do printf '%s\t%s\n' "$(wc -c < "$swf")" "$swf"; done \
        | sort -t $'\t' -k1,1n -k2 | cut -f2-)
fi
# This machine's share: every n-th of that list, so the big ones are shared out too.
todo=()
for i in "${!missing[@]}"; do
    if [ $((i % shards)) -eq $((shard - 1)) ]; then
        todo+=("${missing[$i]}")
    fi
done
echo "Making ${#todo[@]} of the ${#missing[@]} sheets still missing ($JOBS at a time)..."
: > "$OUT/export.log"
: > "$OUT/errors.log"

# One batch: draw the items into a folder of their own, pack them, delete the pictures.
batch() {
    local pictures
    pictures="$(mktemp -d "$OUT/render.XXXXXX")"
    timeout 3600 java -Djava.awt.headless=true -Xmx3g -cp "$FFDEC_CP:$CLASSES" RenderSwf "$pictures" "$@" \
        2>> "$OUT/errors.log" || true
    local drawn=("$pictures"/*/manifest.json)
    if [ -f "${drawn[0]}" ]; then
        "$PYTHON" "$ROOT/tools/art/pack_sheet.py" --out "$OUT/sheets" "${drawn[@]%/manifest.json}" || true
    fi
    rm -rf "$pictures"
}
export -f batch
export FFDEC_CP CLASSES OUT PYTHON ROOT
if [ ${#todo[@]} -gt 0 ]; then
    # Each item's line shows here as it is done, and goes in the log.
    printf '%s\0' "${todo[@]}" | xargs -0 -n 5 -P "$JOBS" bash -c 'batch "$@"' _ | tee -a "$OUT/export.log" || true
fi

failed=()
for swf in "${todo[@]}"; do
    [ -f "$OUT/sheets/$(basename "$swf" .swf).json" ] || failed+=("$(basename "$swf")")
done
echo "Done: made $((${#todo[@]} - ${#failed[@]})) of ${#todo[@]} sheets ($(du -sh "$OUT/sheets" | cut -f1) in $OUT/sheets)."
if [ ${#failed[@]} -gt 0 ]; then
    echo "No sheet for ${#failed[@]}: ${failed[*]:0:20}"
fi
grep -E '^(FAIL|warning)' "$OUT/export.log" | head -20 || true
echo "Full log: $OUT/export.log (and Java's own messages in $OUT/errors.log)"
