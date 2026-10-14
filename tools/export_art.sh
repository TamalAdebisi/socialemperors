#!/usr/bin/env bash
# Turn the game's buildings and units (Flash files) into sprite sheets: a WebP
# image and a JSON file per item, which any 2D engine can draw. Step 1 of the
# new game client (CLIENT.md).
#
#   tools/export_art.sh [file.swf ...]
#
# Default: every file in assets/buildingsprites/. Writes art/sheets/<item>.webp
# and <item>.json (art/ is ignored by git), plus art/export.log. The pictures
# drawn on the way are kept in art/render/, so running it again skips them;
# delete that folder to draw everything again. All of it takes a few hours on
# 4 processor cores, most of it for the big animated bosses and buildings.
#
# Check an item by eye:  python tools/art/preview.py art/sheets/<item>.json
#
# How it works: tools/art/RenderSwf.java draws every picture of the item with
# FFDec's renderer (the Flash files are read, never their code), then
# tools/art/pack_sheet.py trims and packs them into the sheet.
#
# Needs: what tools/ffdec.sh needs (a Java JDK...), and Python 3 with Pillow
# (pip install Pillow).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/art"
JOBS="${JOBS:-$(nproc 2>/dev/null || echo 4)}"
PYTHON="${PYTHON:-python3}"

source "$ROOT/tools/ffdec.sh"
"$PYTHON" -c "import PIL" 2>/dev/null || { echo "Needs Pillow: pip install Pillow" >&2; exit 1; }

if [ $# -gt 0 ]; then
    files=("$@")
else
    files=("$ROOT"/assets/buildingsprites/*.swf)
fi

# Compile the renderer once, against FFDec.
CLASSES="$TOOLS/art-classes"
mkdir -p "$CLASSES" "$OUT/render" "$OUT/sheets"
javac -nowarn -cp "$FFDEC_CP" -d "$CLASSES" "$ROOT/tools/art/RenderSwf.java" 2>&1 | grep -v "^Note:" || true

# Draw the files not drawn yet: a few Java processes, 20 files each.
todo=()
for swf in "${files[@]}"; do
    [ -f "$OUT/render/$(basename "$swf" .swf)/manifest.json" ] || todo+=("$swf")
done
echo "Drawing ${#todo[@]} of ${#files[@]} files ($JOBS at a time)..."
: > "$OUT/export.log"
: > "$OUT/errors.log"
if [ ${#todo[@]} -gt 0 ]; then
    printf '%s\0' "${todo[@]}" | xargs -0 -n 20 -P "$JOBS" \
        timeout 3600 java -Djava.awt.headless=true -Xmx3g -cp "$FFDEC_CP:$CLASSES" RenderSwf "$OUT/render" \
        2>> "$OUT/errors.log" >> "$OUT/export.log" || true
fi

# Pack every drawn file into its sheet.
echo "Packing..."
for swf in "${files[@]}"; do
    dir="$OUT/render/$(basename "$swf" .swf)"
    if [ -f "$dir/manifest.json" ]; then
        printf '%s\0' "$dir"
    else
        echo "FAIL $(basename "$swf"): not drawn" >> "$OUT/export.log"
    fi
done | xargs -0 -n 20 -P "$JOBS" "$PYTHON" "$ROOT/tools/art/pack_sheet.py" --out "$OUT/sheets" \
    >> "$OUT/export.log" || true

sheets=$(find "$OUT/sheets" -name '*.webp' | wc -l)
failed=$(grep -c '^FAIL' "$OUT/export.log" || true)
echo "Done: $sheets sheets in $OUT/sheets ($(du -sh "$OUT/sheets" | cut -f1)), $failed failed."
grep -E '^(FAIL|warning)' "$OUT/export.log" | head -20 || true
echo "Full log: $OUT/export.log (and Java's own messages in $OUT/errors.log)"
