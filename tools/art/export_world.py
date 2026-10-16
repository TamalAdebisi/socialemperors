"""
The world map's pictures (CLIENT.md, "Attacking players"): the islands of a
continent, its borders, statue, ship and zeppelin, the shapes that colour
the islands beaten, and the map's buttons, from the game's Flash file; and
where each one sits on each of the five continent pictures
(assets/images_new/mapa1-5.jpg, which the client shows as they are).

    python tools/art/export_world.py

draws each picture with tools/art/RenderSymbols.java at twice the game's
size and writes client/src/ui/art/world/<name>.webp, with
client/src/ui/art/world/places.json: for each picture its point (a share of
its size, as the game places it), and for each of the five maps where the
islands and the rest go, in pixels of the map picture (701 x 514), from
tools/art/Placements.java. Needs what tools/ffdec.sh needs (a Java JDK) and
Pillow.
"""

import json
import os
import shutil
import subprocess
import sys
import tempfile

from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import export_ui  # noqa: E402  (its renderer and FFDec's jars)

ROOT = export_ui.ROOT
OUT = os.path.join(ROOT, "client", "src", "ui", "art", "world")
SCALE = 2
WORLD = "ExplorationWorldMC"
FONDO = f"{WORLD}/fondo"
# The continent picture is centred on this point of the map (the game puts it at
# the "image" part's place, which centres what it's given).
PICTURE = (701, 514)
MAPS = 5
STATUES = 20

# Our name: (the picture, its frame).
PICTURES = {
    # An island by its owner: frames 1 to 8 a town by level (below 10, 12, ... 22, and up),
    # 9 a troll town, 10 beaten (a flag on the rubble).
    **{f"island-{n}": (f"{FONDO}/icon1", n - 1) for n in range(1, 11)},
    **{f"statue-{n}": (f"{FONDO}/estatua_mc", n - 1) for n in range(1, STATUES + 1)},
    **{f"lines-{m}": (f"{FONDO}/mcLines{m * 10}", 0) for m in range(1, MAPS + 1)},
    **{f"tint-{m}{i}": (f"{FONDO}/t{m}{i}", 0) for m in range(1, MAPS + 1) for i in range(1, 9)},
    "ship": (f"{FONDO}/barco", 0),
    "zeppelin": (f"{FONDO}/zeppelin", 0),
    # The bar's buttons, and the menu over an island.
    "results": (f"{WORLD}/btnHistory", 0),
    "options": (f"{WORLD}/btnArmy", 0),
    "prev": (f"{WORLD}/prevMapButton", 0),
    "go": (f"{WORLD}/btnGo", 0),
    "my-world": (f"{WORLD}/btnGoHome", 0),
    "relocate": (f"{WORLD}/btnRelocate@1", 0),
    "attack": (f"{WORLD}/menuActions/btnAttack", 0),
    "spy": (f"{WORLD}/menuActions/btnSpy", 0),
    "profile": (f"{WORLD}/menuActions/btnProfile", 0),
}


def placements(path):
    """Tools/art/Placements.java's answer for a picture: its named parts' places, frame by frame."""
    classpath = export_ui.ffdec_classpath()
    folder = tempfile.mkdtemp(prefix="se-place-")
    try:
        sources = [os.path.join(ROOT, "tools", "art", name) for name in ("RenderSwf.java", "RenderSymbols.java", "Placements.java")]
        subprocess.run(["javac", "-nowarn", "-cp", classpath, "-d", folder, *sources], check=True)
        answer = subprocess.run(["java", "-Djava.awt.headless=true", "-cp", f"{classpath}{os.pathsep}{folder}",
                                 "Placements", export_ui.GAME, path], check=True, capture_output=True, text=True).stdout
        return json.loads(answer)
    finally:
        shutil.rmtree(folder, ignore_errors=True)


def main():
    os.makedirs(OUT, exist_ok=True)
    folder = tempfile.mkdtemp(prefix="se-world-")
    anchors = {}
    try:
        export_ui.render(sorted({path for path, _ in PICTURES.values()}), folder, scale=SCALE)
        for name, (path, frame) in PICTURES.items():
            stem = path.replace("/", ".")
            with open(os.path.join(folder, f"{stem}.json")) as f:
                origin = json.load(f)["origin"]
            with Image.open(os.path.join(folder, f"{stem}-{frame}.png")) as image:
                picture = image.convert("RGBA")
            picture.save(os.path.join(OUT, f"{name}.webp"), "WEBP", quality=90, alpha_quality=100, method=6)
            anchors[name] = {"x": round(origin["x"] / picture.width, 4), "y": round(origin["y"] / picture.height, 4),
                             "w": round(picture.width / SCALE, 1), "h": round(picture.height / SCALE, 1)}
            print(f"{name}: {picture.width}x{picture.height}")
    finally:
        shutil.rmtree(folder, ignore_errors=True)

    # Where things go on each map, in pixels of the continent picture (its top left is 0, 0).
    left, top = -PICTURE[0] / 2, 1 - PICTURE[1] / 2
    maps = []
    for m, frame in enumerate(placements(FONDO)[:MAPS], start=1):
        at = lambda name: {"x": round(frame[name]["x"] - left, 1), "y": round(frame[name]["y"] - top, 1)}  # noqa: E731
        maps.append({
            "islands": [at(f"icon{i}") for i in range(1, 9)],
            "tints": [at(f"t{m}{i}") for i in range(1, 9)],
            "lines": at(f"mcLines{m * 10}"),
            "statue": at("estatua_mc"),
            "ship": at("barco"),
            "zeppelin": at("zeppelin"),
        })
    with open(os.path.join(OUT, "places.json"), "w") as f:
        json.dump({"picture": {"w": PICTURE[0], "h": PICTURE[1]}, "anchors": anchors, "maps": maps}, f, indent=1)
        f.write("\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
