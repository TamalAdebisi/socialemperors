#!/usr/bin/env bash
# Builds our own loader. No original game source is compiled or copied.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
source "$ROOT/tools/ffdec.sh"
mkdir -p "$ROOT/work/minigame-bridge" "$ROOT/client/src/ui/art/riders"
javac -cp "$FFDEC_CP" -d "$ROOT/work/minigame-bridge" "$ROOT/tools/art/BuildMinigameBridge.java"
java -Djava.awt.headless=true -cp "$FFDEC_CP:$ROOT/work/minigame-bridge" BuildMinigameBridge \
  "$ROOT/tools/art/RiderAdventureBridge.as" "$ROOT/client/src/ui/art/riders/adventure.swf" \
  "$FFDEC/resources/flashlib/playerglobal32_0.swc"
