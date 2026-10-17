"""Draw the temple's original illustration and offering controls.

    python tools/art/export_temple.py

Reads artwork only; needs the JDK and Pillow, like export_ui.py.
"""

import os
import shutil
import subprocess
import tempfile

from PIL import Image

from export_ui import ROOT, ffdec_classpath, render, trimmed

PICTURES = {
    "selected": ("InvocationStepMC/mcBorder", 300),
    "tick": ("InvocationStepMC/mcTik", 180),
    "button": ("PopupBahamutSupremeInvocationTempleMC/btnAction@1", 500),
}


def main():
    out = os.path.join(ROOT, "client", "src", "ui", "art", "temple")
    os.makedirs(out, exist_ok=True)
    folder = tempfile.mkdtemp(prefix="se-temple-")
    try:
        render([path for path, _ in PICTURES.values()], folder)
        for name, (path, longest) in PICTURES.items():
            with Image.open(os.path.join(folder, f"{path.replace('/', '.')}-0.png")) as source:
                picture = trimmed(source.convert("RGBA"))
                picture.thumbnail((longest, longest), Image.Resampling.LANCZOS)
                picture.save(os.path.join(out, f"{name}.webp"), "WEBP", quality=90, method=6)
        frames = os.path.join(folder, "illustration")
        subprocess.run(["java", "-Djava.awt.headless=true", "-cp", ffdec_classpath(),
                        "com.jpexs.decompiler.flash.gui.Main", "-format", "frame:png", "-zoom", "1",
                        "-export", "frame", frames,
                        os.path.join(ROOT, "assets", "images_new", "BahamutSupremeInvocationTemple.swf")],
                       check=True, capture_output=True)
        with Image.open(os.path.join(frames, "1.png")) as picture:
            picture.convert("RGB").save(os.path.join(out, "illustration.webp"), "WEBP", quality=88, method=6)
    finally:
        shutil.rmtree(folder, ignore_errors=True)


if __name__ == "__main__":
    main()
