"""
The new client's interface art: the game's own icons and buttons, from its
Flash file, for the windows and bars in HTML (CLIENT.md, "The look").

    python tools/art/export_ui.py

draws each picture listed below with tools/art/RenderSymbols.java at three
times its size in the game (sharp on phones), trims the empty space around
it and writes client/src/ui/art/<name>.webp (the mouse pointers as small
PNGs), where the client's build finds it. Run it again after changing the list. Needs what tools/ffdec.sh needs (a
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

# Our name: (the picture in the game's file, which frame[, its longest side
# if not LONGEST[, "top": only what's above its first empty row]]). A
# picture is a class, or a part of one by the names the game's code gives
# it, or "<class>@n" for its n-th layer alone.
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
    "pointer-cancel": ("GuiMC/bgBar/normalMouse", 1),  # a tool on: back to the pointer
    # The square tool, for selecting units with a box; with the mouse over it, it names its key.
    "square-tool": ("GuiMC/bgBar/herramientaCuadrado", 0),
    "square-tool-space": ("GuiMC/bgBar/herramientaCuadrado", 1),
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
    "welcome-back": ("IconComeBack2nd3rdMC", 0),
    # The quest window's difficulty stars: won (or chosen) and not.
    "star-on": ("PopupLoadingQuestMC/star1", 1),
    "star-off": ("PopupLoadingQuestMC/star1", 0),
    # The island map's buttons: the padlock, the way in, and the stars won (none to three).
    "island-lock": ("NewQuestIslandButtonMC/lock", 0),
    "island-ribbon": ("NewQuestIslandButtonMC@1", 0, 456),
    "island-enter": ("NewQuestIslandButtonMC/enterQuestButton", 0),
    "island-stars-0": ("NewQuestIslandButtonMC/stars", 0),
    "island-stars-1": ("NewQuestIslandButtonMC/stars", 1),
    "island-stars-2": ("NewQuestIslandButtonMC/stars", 2),
    "island-stars-3": ("NewQuestIslandButtonMC/stars", 3),
    "map-next": ("PopupQuestsManagerMC/btnNext", 0),
    "map-prev": ("PopupQuestsManagerMC/btnPrev", 0),
    # Spells: the book that opens them in battle, mana, and the marker that
    # follows the mouse while aiming (its last frame, grown).
    "spell-book": ("PopupMagicMC/book@1", 0),
    "mana": ("IconResourcesMC", 16),
    # The graveyard's potions (what brings a fallen unit back).
    "potion": ("PopupGraveyardMC/iconPotions", 0),
    # The cards' buttons for a building's window.
    "open-graveyard": ("EP_Graveyard_MC/btnAbrir", 0),
    "open-harbour": ("EP_Harbour_MC/btnAbrir", 0),
    "open-zeppelin": ("EP_Zeppelin_MC/btnAbrir", 0),
    # Arthur's lessons: Arthur, his arrow, his speech bubble and its Next, the marker over a tree to cut.
    "tutor-arthur": ("GameShowHostMC", 0, 600),
    "tutor-arrow": ("ArrowMC@3", 0, 240),
    "tutor-bubble": ("TutorialPopupMC@1", 0, 900),
    "tutor-next": ("TutorialPopupMC/noBtn", 0, 300),
    "tutor-marker": ("IconTutorialMC", 0, 120),
    # The free draggy at the lessons' end: its window, title band and frames; the nest's reminder's OK; the nest's Enter.
    "draggy-window": ("SelectYourDragonPopUpMC@1", 0, 1200),
    "draggy-title": ("SelectYourDragonPopUpMC@2", 0, 900),
    "draggy-frame": ("SelectYourDragonPopUpMC@8", 0, 300, "top"),  # without the placeholder name below it
    "reminder-ok": ("SelectYourDragonReminderNestPopupMC@5", 0, 300),
    "open-nest": ("EP_DragonNest_MC/btnAbrir", 0),
    # The level-up window: its parchment in a wooden frame, and its title band.
    "level-window": ("PopupLevelMC@1", 0, 1200),
    "level-band": ("PopupLevelMC@2", 0, 900),
    # The window that names the empire: its parchment with the name's field, its band, Save and Cancel.
    "name-window": ("PopUpNameTownMC@1", 0, 1200),
    "name-band": ("PopUpNameTownMC@2", 0, 800),
    "name-save": ("PopUpNameTownMC/saveButt", 0, 300),
    "name-cancel": ("PopUpNameTownMC/cancelButt", 0, 300),
    # The wall gate's card: open it (units pass), close it.
    "open-gate": ("EP_Wall_MC/btnAbrir", 0),
    "close-gate": ("EP_Wall_MC/btnAbrir", 1),
    # The nests' window (its parchment and title band are the draggy window's): the parts
    # without their words, which the client writes. The arrows between the six dragons are one picture.
    "nest-button": ("PopupDragonsMC/actionButton@1", 0, 480),
    "nest-marker": ("PopupDragonsMC/indicatorDragon@1", 0),
    "nest-speed-up": ("PopupDragonsMC/temporizador/getnowButton@1", 0, 420),
    "nest-timer": ("PopupDragonsMC/temporizador@1", 0, 480),
    "nest-hire": ("PopupDragonsMC/mcHire/hireButton@1", 0, 420),
    "nest-hire-box": ("PopupDragonsMC/mcHire@1", 0, 480),
    "nest-bar": ("PopupDragonsMC/progressbar@1", 0, 900),
    "nest-bar-fill": ("PopupDragonsMC/progressbar/statusbar", 0, 900),
    "nest-lock": ("PopupDragonsMC/lock0", 0),
    "nest-frame": ("PopupDragonsMC/marcoThumb", 0, 240),
    "nest-help": ("PopupDragonsMC/help", 0),
    "nest-arrows": ("PopupDragonsMC@18", 0, 1240),
    "nest-pay": ("PopupInactiveNestMC/btnPayGold/mcColor", 0, 420),
    # Pausing: the options panel's pause button, the words GAME PAUSED (the picture's second layer) and RESUME.
    "pause": ("GuiMC/options_panel/bp", 0),
    "game-paused": ("GamePausedMC@1", 0, 1040),
    "resume": ("GamePausedMC/bpo", 0, 480),
    "spell-area": ("AOEMC", 4, 480),
    # The options panel: music and sound, on and off.
    "music-on": ("GuiMC/options_panel/bm", 0),
    "music-off": ("GuiMC/options_panel/bmo", 0),
    "sound-on": ("GuiMC/options_panel/bs", 0),
    "sound-off": ("GuiMC/options_panel/bso", 0),
    # Visiting a neighbour: one of the rays that count the helps left.
    "help-ray": ("GuiMC/parteArribaGui/rayoNeighbour_01", 0),
    # The pointers' pictures (CURSORS below), full size: on phones, which have
    # no pointer, they show briefly over what a unit was sent to work.
    "axe": ("CursorMC", 11),
    "pick": ("CursorMC", 4),
    "inside": ("CursorMC", 10),
    # Over a wild animal just caught, for a few seconds.
    "caught": ("IconoCapturadoMC", 0),
    # On each block of land for sale; the game writes "FOR SALE" and "Click to Buy" on it.
    "for-sale": ("btnBuyExpandTileMC", 0, 240),
}

# The mouse pointers a selected unit shows over what it can work or go into
# (the game's CursorMC, one frame each). Pointers must be small pictures, so
# these are PNGs at most 32 px across: client/src/ui/art/<name>.png.
CURSORS = {
    "cursor-axe": ("CursorMC", 11),     # a tree to chop
    "cursor-pick": ("CursorMC", 4),     # a rock or gold to mine
    "cursor-inside": ("CursorMC", 10),  # a building to go into
    "cursor-repair": ("CursorMC", 5),   # a burning building to repair (villagers)
    "cursor-square": ("CursorMC", 13),  # the square tool on: the next drag draws a box
    "cursor-remove": ("CursorMC", 8),   # the bulldozer on
    "cursor-collect": ("CursorMC", 6),  # the glove on
}
CURSOR_SIZE = 32


# Pictures drawn on the map rather than in windows: kept whole (not trimmed),
# with the point the game places them by, in client/src/view/art/ and its
# anchors.json. Our name: (the picture, which frame).
MAP_PICTURES = {
    # A building's fire as it loses life: below 100%, 67%, 34%, and burnt out.
    "fire-1": ("FireMC", 0),
    "fire-2": ("FireMC", 1),
    "fire-3": ("FireMC", 2),
    "fire-4": ("FireMC", 3),
    # Under what's selected, as in the Flash client: a golden ring under a unit (the same
    # whichever way it faces), the outline of a building's ground (a picture for each size).
    "selected-unit": ("PeanaMC", 0),
    **{f"selected-{n}x{n}": (f"PeanaBuilding{n}x{n}MC", 0) for n in range(1, 7)},
    # And over it, its life bar: the back (red, edged in black), and the green on it.
    "life-bar": ("BarraVidaMC@0", 0),
    "life-bar-green": ("BarraVidaMC@1", 0),
    # The bar under something being built: its back (white, edged in green), and the yellow
    # that fills it from the left.
    "progress-back": ("FauxBarMC@1", 0),
    "progress-fill": ("FauxBarMC@3", 0),
}
MAP_OUT = os.path.join(ROOT, "client", "src", "view", "art")

# The scaffolding something stands in for its first 10 seconds, from the
# game's library (where the Flash client finds it too), as small sprite
# sheets: the farm's field being dug, the ranch's fence going up, and for
# the rest one for each width, workers at work. Our name: (the picture, how
# many frames it plays before it stops, how many frames its workers take to
# go round: they keep at it after). Each plays once, then its last
# moments go round.
LIBRARY = os.path.join(ROOT, "assets", "swf", "120608_dynamic.swf")
SCAFFOLDS = {
    "scaffold-1x1": ("Construction1x1", 137, 1),
    "scaffold-2x2": ("Construction2x2", 140, 8),
    "scaffold-3x3": ("Construction3x3", 128, 8),
    "scaffold-4x4": ("Construction4x4", 136, 8),
    "scaffold-farm": ("ConstructionGranja", 127, 1),
    "scaffold-ranch": ("ConstructionRancho", 181, 1),
}
# Drawn at the game's size, like the buildings' sheets; every other frame of the game's 30
# a second, which keeps the files small.
SCAFFOLD_STEP = 2
SCAFFOLD_FPS = 30 / SCAFFOLD_STEP


def ffdec_classpath():
    """FFDec's jars, built by tools/ffdec.sh."""
    script = os.path.join(ROOT, "tools", "ffdec.sh")
    return subprocess.run(["bash", "-c", f'source "{script}" >/dev/null && printf %s "$FFDEC_CP"'],
                          check=True, capture_output=True, text=True).stdout


def render(paths, folder, scale=SCALE, swf=GAME):
    classpath = ffdec_classpath()
    classes = os.path.join(folder, "classes")
    sources = [os.path.join(ROOT, "tools", "art", name) for name in ("RenderSwf.java", "RenderSymbols.java")]
    subprocess.run(["javac", "-nowarn", "-cp", classpath, "-d", classes, *sources], check=True)
    subprocess.run(["java", "-Djava.awt.headless=true", "-cp", f"{classpath}{os.pathsep}{classes}",
                    "RenderSymbols", folder, str(scale), swf, *paths], check=True)


def top_part(image):
    """The picture down to its first empty row (a frame without the placeholder text under it)."""
    alpha = image.getchannel("A")
    for y in range(image.height):
        if alpha.crop((0, y, image.width, y + 1)).getbbox() is None:
            return image.crop((0, 0, image.width, y))
    return image


def trimmed(image):
    """The picture without the empty space around it."""
    box = image.getchannel("A").getbbox()
    return image.crop(box) if box else image


def main():
    os.makedirs(OUT, exist_ok=True)
    folder = tempfile.mkdtemp(prefix="se-ui-")
    try:
        render(sorted({path for path, *_ in [*PICTURES.values(), *CURSORS.values()]}), folder)
        for name, (path, frame, *size) in PICTURES.items():
            drawn = os.path.join(folder, f"{path.replace('/', '.')}-{frame}.png")
            with Image.open(drawn) as image:
                picture = trimmed(image.convert("RGBA"))
            if size[1:] == ["top"]:
                picture = top_part(picture)
            longest = size[0] if size else LONGEST
            picture.thumbnail((longest, longest), Image.LANCZOS)
            picture.save(os.path.join(OUT, f"{name}.webp"), "WEBP", quality=90, alpha_quality=100, method=6)
            print(f"{name}: {picture.width}x{picture.height}")
        for name, (path, frame) in CURSORS.items():
            drawn = os.path.join(folder, f"{path.replace('/', '.')}-{frame}.png")
            with Image.open(drawn) as image:
                picture = trimmed(image.convert("RGBA"))
            picture.thumbnail((CURSOR_SIZE, CURSOR_SIZE), Image.LANCZOS)
            picture.save(os.path.join(OUT, f"{name}.png"), optimize=True)
            print(f"{name}: {picture.width}x{picture.height}")
        export_map_pictures(folder)
        export_scaffolds(folder)
    finally:
        shutil.rmtree(folder, ignore_errors=True)
    return 0


def export_map_pictures(folder):
    """The map's pictures, whole, and where each one's point is (a share of its size)."""
    import json
    os.makedirs(MAP_OUT, exist_ok=True)
    render(sorted({path for path, _ in MAP_PICTURES.values()}), folder)
    anchors = {}
    for name, (path, frame) in MAP_PICTURES.items():
        stem = path.replace("/", ".")
        with open(os.path.join(folder, f"{stem}.json")) as f:
            origin = json.load(f)["origin"]
        with Image.open(os.path.join(folder, f"{stem}-{frame}.png")) as image:
            picture = image.convert("RGBA")
        picture.save(os.path.join(MAP_OUT, f"{name}.webp"), "WEBP", quality=90, alpha_quality=100, method=6)
        anchors[name] = {"x": round(origin["x"] / picture.width, 4), "y": round(origin["y"] / picture.height, 4), "scale": SCALE}
        print(f"{name}: {picture.width}x{picture.height}")
    with open(os.path.join(MAP_OUT, "anchors.json"), "w") as f:
        json.dump(anchors, f, indent=1)
        f.write("\n")


def export_scaffolds(folder):
    """Each scaffold as a sprite sheet (tools/art/pack_sheet.py's kind, which the
    client reads like a building's): "build/0" plays once, "hold/0" goes round
    after, and meta.bounds["build/0"] is its box as Flash measures it when it
    appears, which the game places it by (bottom centre on the building's point)."""
    import hashlib
    import json
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import pack_sheet
    drawn = os.path.join(folder, "scaffolds")
    os.makedirs(drawn, exist_ok=True)
    render([f"{path}*{frames}" for path, frames, _ in SCAFFOLDS.values()], drawn, scale=1, swf=LIBRARY)
    for name, (path, frames, round_) in SCAFFOLDS.items():
        stem = f"{path}*{frames}"
        with open(os.path.join(drawn, f"{stem}.json")) as f:
            made = json.load(f)
        build = list(range(0, frames, SCAFFOLD_STEP))
        hold = list(range(frames - round_, frames, SCAFFOLD_STEP)) if round_ > 1 else [frames - 1]
        # The same picture twice is stored once.
        pictures, numbers, seen = [], {}, {}
        for frame in sorted(set(build + hold)):
            picture = os.path.join(drawn, f"{stem}-{frame}.png")
            with open(picture, "rb") as f:
                digest = hashlib.sha1(f.read()).hexdigest()
            if digest not in seen:
                seen[digest] = len(pictures)
                pictures.append(picture)
            numbers[frame] = seen[digest]
        with Image.open(pictures[0]) as first:
            canvas = {"w": first.width, "h": first.height}
        manifest = {
            "name": name,
            "swf": os.path.basename(LIBRARY),
            "fps": SCAFFOLD_FPS,
            "canvas": canvas,
            "origin": made["origin"],
            "frames": [
                {"labels": ["build"], "images": [numbers[f] for f in build], "bounds": made["bounds"][0]},
                {"labels": ["hold"], "images": [numbers[f] for f in hold]},
            ],
        }
        sheets, pages, warnings = pack_sheet.build(None, loaded=(manifest, pictures))
        for warning in warnings:
            print(f"{name}: {warning}")
        pack_sheet.write(sheets, pages, MAP_OUT)
        size = os.path.getsize(os.path.join(MAP_OUT, f"{name}.webp"))
        print(f"{name}: {len(pictures)} pictures, {pages[0]['meta']['size']['w']}x{pages[0]['meta']['size']['h']}, {size // 1024} KB")


if __name__ == "__main__":
    sys.exit(main())
