#!/usr/bin/env bash
# Gets a fresh computer ready to work on the game: the server's Python
# packages, the new client's packages, a browser for the browser tests and,
# when there's a Java JDK, the decompiled Flash client to read.
#
#   tools/setup.sh                  everything
#   tools/setup.sh --no-decompile   all but the decompiled client
#
# Made for a cloud agent's setup step (AGENTS.md) as much as for people.
# Safe to run again: each step skips what is already there. Needs Python
# 3.13, Node 22.18 or newer, and the internet.
#
# Afterwards, the tests (CLAUDE.md, "Testing"):
#
#   .venv/bin/python -m unittest discover tests
#   (cd client && npm run check && npm test)
#   PYTHON=.venv/bin/python node e2e/run.mjs
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export npm_config_update_notifier=false  # no "new npm available" in the log

# Node 22.18 runs the client's TypeScript tests as they are (npm test); older
# versions can't.
node -e '
  const [major, minor] = process.versions.node.split(".").map(Number);
  if (major < 22 || (major === 22 && minor < 18)) {
    console.error(`Needs Node 22.18 or newer, not ${process.version}`);
    process.exit(1);
  }'
python3 -c 'import sys; sys.version_info[:2] == (3, 13) or print(f"Note: the live server runs Python 3.13, this is {sys.version.split()[0]}")'

# 1. The server's packages, in a Python of its own (.venv, ignored by git).
# Apart from the system's: on some computers pip can't replace a package the
# system put there (blinker, on Debian). Pillow is for tools/art/export_ui.py.
echo "1/4 Python packages into .venv"
[ -x .venv/bin/python ] || python3 -m venv .venv
.venv/bin/pip install --quiet --disable-pip-version-check -r requirements.txt Pillow

# 2. The new client's packages, exactly as package-lock.json lists them.
echo "2/4 The new client's packages"
(cd client && npm ci --no-audit --no-fund --loglevel=error)

# 3. Playwright and Chromium, for the browser tests (e2e/run.mjs finds
# Playwright among the packages installed for everyone).
echo "3/4 Playwright and Chromium"
GLOBAL="$(npm root -g)"
[ -d "$GLOBAL/playwright" ] || npm install --global --no-audit --no-fund --loglevel=error playwright@1.56.1
if ! node -e '
  const { chromium } = require(process.argv[1]);
  process.exit(require("fs").existsSync(chromium.executablePath()) ? 0 : 1);' "$GLOBAL/playwright"; then
  # --with-deps adds the system libraries Chromium needs, which takes root.
  if [ "$(id -u)" = 0 ]; then deps=--with-deps; else deps=; fi
  node "$GLOBAL/playwright/cli.js" install $deps chromium
fi

# 4. The Flash client, decompiled into decompiled/ (ignored by git: it is
# Social Point's code, to read on this computer only; CLAUDE.md, "Never").
echo "4/4 The decompiled Flash client"
if [ "${1:-}" = "--no-decompile" ]; then
  echo "    skipped (--no-decompile)"
elif [ -d decompiled/SocialEmpires0926bsec ]; then
  echo "    already there"
elif ! command -v javac >/dev/null; then
  echo "    skipped: needs a Java JDK (javac), 11 or newer. Then run tools/decompile_client.sh"
else
  tools/decompile_client.sh
fi

echo "Ready."
