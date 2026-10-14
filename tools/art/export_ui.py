"""
The new client's interface art: the game's own icons and buttons, from its
Flash file, for the windows and bars in HTML (CLIENT.md, "The look").

    python tools/art/export_ui.py

draws each picture listed below with tools/art/RenderSymbols.java at three
times its size in the game (sharp on phones), trims the empty space around
it and writes client/src/ui/art/<name>.webp, where the client's build finds
it. Run it again after changing the list. Needs what tools/ffdec.sh needs (a
Java JDK) and Pillow.

One picture isn't the game's: food is a carrot of our own (food.svg, drawn
in the game's style) instead of the game's steak.
"""

import os
import shutil
import subprocess
import sys
import tempfile

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
GAME = os.path.join(ROOT, "assets", "flash", "SocialEmpires0926bsec.swf")
OUT = os.path.join(ROOT, "client", "src", "ui", "art")
SCALE = 3
# Shown at most about 56 px wide, on screens with up to three pixels to the point.
LONGEST = 160

# Our name: (the picture in the game's file, which frame). A picture is a
# class, or a part of one by the names the game's code gives it.
PICTURES = {
    # The resource icons: one picture, a frame for each resource.
    "cash": ("IconResourcesMC", 0),
    "gold": ("IconResourcesMC", 1),
    "wood": ("IconResourcesMC", 3),
    "stone": ("IconResourcesMC", 4),
    "population": ("IconResourcesMC", 5),
    "xp": ("IconResourcesMC", 7),
    "asleep": ("IconResourcesMC", 17),  # "zZ": workers waiting for a working time
    # The game bar's buttons, bottom right.
    "build": ("GuiMC/bgBar/storeButton", 0),
    "storage": ("GuiMC/bgBar/giftButton", 0),
    "remove": ("GuiMC/bgBar/bulldozer", 0),
    "fast-collect": ("GuiMC/bgBar/recolectaRapido", 0),
    "pointer": ("GuiMC/bgBar/normalMouse", 0),
    "my-town": ("GuiMC/bgBar/returnHome", 0),
    "my-world": ("GuiMC/bgBar/returnHome", 2),
    "quests": ("GuiMC/bgBar/iconMenuWorld/questButton", 0),
    "pvp": ("GuiMC/bgBar/iconMenuWorld/pvpButton", 0),
    "survival": ("GuiMC/bgBar/iconMenuWorld/survivalButton", 0),
    "tournament": ("GuiMC/bgBar/iconMenuWorld/tournamentButton", 0),
    "units": ("GuiMC/bgBar/iconMenuGift/unitsButton", 0),
    "news": ("GuiMC/bgBar/iconMenuGift/newsButton", 0),
    "collections": ("GuiMC/bgBar/iconMenuGift/colButton", 0),
    "gifts": ("GuiMC/bgBar/iconMenuGift/giftButton", 0),
    # The info panel's buttons for the thing selected.
    "move": ("BotonMove_MC", 0),
    "turn": ("BotonFlip_MC", 0),
    "store": ("BotonPutInStorage_MC", 0),
    "close": ("CloseButt", 0),
    # The top bar.
    "add-cash": ("AddCashButton", 0),
    "daily-bonus": ("DailyButtonMC", 0),
}


def ffdec_classpath():
    """FFDec's jars, built by tools/ffdec.sh."""
    script = os.path.join(ROOT, "tools", "ffdec.sh")
    return subprocess.run(["bash", "-c", f'source "{script}" >/dev/null && printf %s "$FFDEC_CP"'],
                          check=True, capture_output=True, text=True).stdout


def render(paths, folder):
    classpath = ffdec_classpath()
    classes = os.path.join(folder, "classes")
    sources = [os.path.join(ROOT, "tools", "art", name) for name in ("RenderSwf.java", "RenderSymbols.java")]
    subprocess.run(["javac", "-nowarn", "-cp", classpath, "-d", classes, *sources], check=True)
    subprocess.run(["java", "-Djava.awt.headless=true", "-cp", f"{classpath}{os.pathsep}{classes}",
                    "RenderSymbols", folder, str(SCALE), GAME, *paths], check=True)


def trimmed(image):
    """The picture without the empty space around it."""
    box = image.getchannel("A").getbbox()
    return image.crop(box) if box else image


def main():
    os.makedirs(OUT, exist_ok=True)
    folder = tempfile.mkdtemp(prefix="se-ui-")
    try:
        render(sorted({path for path, _ in PICTURES.values()}), folder)
        for name, (path, frame) in PICTURES.items():
            drawn = os.path.join(folder, f"{path.replace('/', '.')}-{frame}.png")
            with Image.open(drawn) as image:
                picture = trimmed(image.convert("RGBA"))
            picture.thumbnail((LONGEST, LONGEST), Image.LANCZOS)
            picture.save(os.path.join(OUT, f"{name}.webp"), "WEBP", quality=90, alpha_quality=100, method=6)
            print(f"{name}: {picture.width}x{picture.height}")
    finally:
        shutil.rmtree(folder, ignore_errors=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
