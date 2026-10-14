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
#   SHARD=2/4   only every 4th file, starting with the 2nd: to share the work
#               between machines (.github/workflows/export-art-r2.yml does)
#
# Everything takes a few hours on 4 processor cores, mostly for the big
# animated bosses and buildings. Check an item by eye:
#   python tools/art/preview.py art/sheets/<item>.json
#
# How it works: tools/art/RenderSwf.java draws every picture of 20 items at a
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
mine=()
for i in "${!files[@]}"; do
    if [ $((i % shards)) -eq $((shard - 1)) ]; then
        mine+=("${files[$i]}")
    fi
done

# Compile the renderer once, against FFDec.
CLASSES="$TOOLS/art-classes"
mkdir -p "$CLASSES" "$OUT/sheets"
javac -nowarn -cp "$FFDEC_CP" -d "$CLASSES" "$ROOT/tools/art/RenderSwf.java" 2>&1 | grep -v "^Note:" || true
rm -rf "$OUT"/render.*  # pictures left by an export that was stopped

todo=()
for swf in "${mine[@]}"; do
    [ -f "$OUT/sheets/$(basename "$swf" .swf).json" ] || todo+=("$swf")
done
echo "Making ${#todo[@]} of ${#mine[@]} sheets ($JOBS at a time)..."
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
    printf '%s\0' "${todo[@]}" | xargs -0 -n 20 -P "$JOBS" bash -c 'batch "$@"' _ >> "$OUT/export.log" || true
fi

missing=()
for swf in "${mine[@]}"; do
    [ -f "$OUT/sheets/$(basename "$swf" .swf).json" ] || missing+=("$(basename "$swf")")
done
echo "Done: $((${#mine[@]} - ${#missing[@]})) of ${#mine[@]} items have sheets in $OUT/sheets ($(du -sh "$OUT/sheets" | cut -f1) in all)."
if [ ${#missing[@]} -gt 0 ]; then
    echo "No sheet for ${#missing[@]}: ${missing[*]:0:20}"
fi
grep -E '^(FAIL|warning)' "$OUT/export.log" | head -20 || true
echo "Full log: $OUT/export.log (and Java's own messages in $OUT/errors.log)"
