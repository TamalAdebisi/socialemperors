"""
The pictures of the dragon and monster nests' window (CLIENT.md, "The
nests"): for each dragon or monster, its eleven pictures from egg to grown
(steps 0 to 10), from the game's Flash files in assets/images_new/
(popupDragonProgress1-6.swf, popupMonsterProgress1-4.swf).

    python tools/art/export_progress.py

draws every frame of each file with FFDec, keeps the picture's 500 x 280
(the rest of the Flash stage is empty) and puts the eleven side by side in
one strip, client/src/ui/art/nest/<file>.webp: the window shows step n by
moving the strip. Needs what tools/ffdec.sh needs (a Java JDK) and Pillow.
"""

import os
import shutil
import subprocess
import sys
import tempfile

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SOURCE = os.path.join(ROOT, "assets", "images_new")
OUT = os.path.join(ROOT, "client", "src", "ui", "art", "nest")
FILES = [f"popupDragonProgress{n}" for n in range(1, 7)] + [f"popupMonsterProgress{n}" for n in range(1, 5)]
STEPS = 11
PICTURE = (500, 280)


def ffdec_classpath():
    script = os.path.join(ROOT, "tools", "ffdec.sh")
    return subprocess.run(["bash", "-c", f'source "{script}" >/dev/null && printf %s "$FFDEC_CP"'],
                          check=True, capture_output=True, text=True).stdout


def main():
    os.makedirs(OUT, exist_ok=True)
    classpath = ffdec_classpath()
    folder = tempfile.mkdtemp(prefix="se-nest-")
    try:
        for name in FILES:
            frames = os.path.join(folder, name)
            subprocess.run(["java", "-Djava.awt.headless=true", "-cp", classpath, "com.jpexs.decompiler.flash.gui.Main",
                            "-format", "frame:png", "-zoom", "1", "-export", "frame", frames,
                            os.path.join(SOURCE, f"{name}.swf")], check=True, capture_output=True)
            strip = Image.new("RGB", (PICTURE[0] * STEPS, PICTURE[1]))
            for step in range(STEPS):
                with Image.open(os.path.join(frames, f"{step + 1}.png")) as frame:
                    strip.paste(frame.convert("RGB").crop((0, 0, *PICTURE)), (PICTURE[0] * step, 0))
            strip.save(os.path.join(OUT, f"{name}.webp"), "WEBP", quality=82, method=6)
            print(f"{name}: {os.path.getsize(os.path.join(OUT, name + '.webp')) // 1024} KB")
    finally:
        shutil.rmtree(folder, ignore_errors=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
