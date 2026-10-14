import os

# The server's folders, relative to where it runs from: the repository's
# folder on your computer, /app in the container (Dockerfile).

BASE_DIR = "."

ASSETS_DIR = os.path.join(BASE_DIR, "assets")
STUB_DIR = os.path.join(BASE_DIR, "stub")
TEMPLATES_DIR = os.path.join(BASE_DIR, "templates")
VILLAGES_DIR = os.path.join(BASE_DIR, "villages")
QUESTS_DIR = os.path.join(VILLAGES_DIR, "quests")
CONFIG_DIR = os.path.join(BASE_DIR, "config")
CONFIG_PATCH_DIR = os.path.join(CONFIG_DIR, "patch")
MODS_DIR = os.path.join(BASE_DIR, "mods")
SAVES_DIR = os.path.join(BASE_DIR, "saves")
