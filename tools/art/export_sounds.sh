#!/usr/bin/env bash
# The new client's sound effects: the game's own, from its Flash library
# assets/swf/120608_dynamic.swf, where the Flash client finds them too.
#
#   tools/art/export_sounds.sh
#
# FFDec takes every sound out of the library as MP3; the ones the town
# builder plays (listed below) are copied to client/src/sound/<name>.mp3,
# where the client's build finds them. Run it again after changing the list.
# Needs what tools/ffdec.sh needs (a Java JDK).
#
# The music isn't here: it's in assets/music/ already, and the client plays
# it from the assets bucket, as the Flash client did.

set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "$ROOT/tools/ffdec.sh"

OUT="$ROOT/client/src/sound"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

java -Djava.awt.headless=true -cp "$FFDEC_CP" com.jpexs.decompiler.flash.gui.Main \
    -format sound:mp3_wav -export sound "$WORK" "$ROOT/assets/swf/120608_dynamic.swf" >/dev/null

# Our name, then the sound's name in the game's library.
SOUNDS="
click ButtonClickSound
place RollOverSound
collect Collection2Sound
ready FarmSound
level-up LevelUpSound
lumber Lumber3Sound
stone Rock6Sound
"

mkdir -p "$OUT"
echo "$SOUNDS" | while read -r name class; do
    [ -n "$name" ] || continue
    # FFDec names each file <its number>_<class>.mp3.
    found="$(find "$WORK" -name "*_$class.mp3" | head -n 1)"
    [ -n "$found" ] || { echo "Not in the library: $class" >&2; exit 1; }
    cp "$found" "$OUT/$name.mp3"
    echo "$name: $(stat -c %s "$OUT/$name.mp3") bytes"
done
