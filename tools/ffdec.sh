# Sets FFDEC_CP, the Java classpath of JPEXS Free Flash Decompiler (FFDec),
# downloading and building it first if needed. Sourced by the scripts that
# read the game's Flash files:
#
#   tools/decompile_client.sh   the game's code, to read on your own machine
#   tools/export_art.sh         the pictures, as sprite sheets for the new client
#
# Needs: Java 11 or newer with javac (a JDK), git, curl, tar, sha512sum.
# Tools are downloaded once into .tools/ (ignored by git):
#   - Apache Ant, the build tool FFDec uses (checksum-verified)
#   - FFDec, built from its source at a fixed tag

TOOLS="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/.tools"

ANT_VERSION=1.10.18
ANT_SHA512=c510d744876d8da48dabc9495b023b6ec5284a0f18b40ee50d98ce099e791ca5c73e3cd4c80d3c90d3efc03f9620be43aad0a373ed47198284f7e3373e0db2c3
FFDEC_TAG=version26.3.0

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

FFDEC_CP="$FFDEC/build/classes:$(printf '%s:' "$FFDEC"/lib/*.jar)"
