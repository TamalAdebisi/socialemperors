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
# Tools are downloaded once into .tools/ (also ignored by git):
#   - Apache Ant, the build tool FFDec uses (checksum-verified)
#   - JPEXS Free Flash Decompiler (FFDec), built from its source at a fixed tag
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SWF="${1:-$ROOT/assets/flash/SocialEmpires0926bsec.swf}"
OUT="${2:-$ROOT/decompiled/$(basename "$SWF" .swf)}"
TOOLS="$ROOT/.tools"

ANT_VERSION=1.10.18
ANT_SHA512=c510d744876d8da48dabc9495b023b6ec5284a0f18b40ee50d98ce099e791ca5c73e3cd4c80d3c90d3efc03f9620be43aad0a373ed47198284f7e3373e0db2c3
FFDEC_TAG=version26.3.0

[ -f "$SWF" ] || { echo "No such file: $SWF" >&2; exit 1; }
command -v javac >/dev/null || { echo "Needs a Java JDK (javac not found)" >&2; exit 1; }
mkdir -p "$TOOLS"

# 1. Apache Ant
ANT="$TOOLS/apache-ant-$ANT_VERSION/bin/ant"
if [ ! -x "$ANT" ]; then
    echo "Downloading Apache Ant $ANT_VERSION..."
    tarball="$TOOLS/apache-ant-$ANT_VERSION-bin.tar.gz"
    curl -fsSL -o "$tarball" \
        "https://archive.apache.org/dist/ant/binaries/apache-ant-$ANT_VERSION-bin.tar.gz"
    echo "$ANT_SHA512  $tarball" | sha512sum -c --quiet -
    tar -xzf "$tarball" -C "$TOOLS"
    rm "$tarball"
fi

# 2. FFDec, built from source
FFDEC="$TOOLS/jpexs-decompiler"
if [ ! -d "$FFDEC/build/classes" ]; then
    echo "Building FFDec $FFDEC_TAG (about a minute)..."
    rm -rf "$FFDEC"
    git -c advice.detachedHead=false clone --quiet --depth 1 --branch "$FFDEC_TAG" \
        https://github.com/jindrapetrik/jpexs-decompiler "$FFDEC"
    (cd "$FFDEC" && "$ANT" -quiet compile)
fi

# 3. Export every ActionScript class
echo "Decompiling $(basename "$SWF") into $OUT ..."
mkdir -p "$OUT"
CP="$FFDEC/build/classes:$(printf '%s:' "$FFDEC"/lib/*.jar)"
java -Djava.awt.headless=true -Xmx4g -cp "$CP" com.jpexs.decompiler.flash.gui.Main \
    -export script "$OUT" "$SWF"

echo
echo "Done: $(find "$OUT" -name '*.as' | wc -l) classes in $OUT"
echo "Reminder: this output is copyrighted. Read it locally; never commit or share it."
