#!/usr/bin/env bash
# Decompile the Social Empires game client (a Flash .swf) into readable
# ActionScript, so we can see what the client sends and expects when we write
# the server side of a missing feature.
#
#   tools/decompile_client.sh [game.swf] [output-folder]
#
# Defaults: assets/flash/SocialEmpires0926bsec.swf -> decompiled/<swf name>/
#
# IMPORTANT: the decompiled code is Social Point's copyrighted work. It is for
# reading only, on your own machine. Never commit it, paste it into issues or
# share it. decompiled/ is in .gitignore and .dockerignore for that reason.
# What we publish is our own server code and our own notes about behaviour.
#
# Needs: Java 11 or newer with javac (a JDK), git, curl, tar, sha512sum.
# FFDec is downloaded and built once into .tools/ by tools/ffdec.sh.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SWF="${1:-$ROOT/assets/flash/SocialEmpires0926bsec.swf}"
OUT="${2:-$ROOT/decompiled/$(basename "$SWF" .swf)}"

[ -f "$SWF" ] || { echo "No such file: $SWF" >&2; exit 1; }
source "$ROOT/tools/ffdec.sh"

# Export every ActionScript class
echo "Decompiling $(basename "$SWF") into $OUT ..."
mkdir -p "$OUT"
java -Djava.awt.headless=true -Xmx4g -cp "$FFDEC_CP" com.jpexs.decompiler.flash.gui.Main \
    -export script "$OUT" "$SWF"

echo
echo "Done: $(find "$OUT" -name '*.as' | wc -l) classes in $OUT"
echo "Reminder: this output is copyrighted. Read it locally; never commit or share it."
