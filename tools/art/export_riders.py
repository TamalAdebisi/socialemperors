"""Export rider window pieces and the original labelled training illustrations."""
import os
import subprocess
import tempfile
from PIL import Image
from export_ui import ROOT, render, trimmed, ffdec_classpath

PICTURES = {
    "button": ("PopupDragonRiderTrainingMC/btnAction@1", 400),
    "bar": ("PopupDragonRiderTrainingMC/progressbar@1", 600),
    "bar-fill": ("PopupDragonRiderTrainingMC/progressbar/statusbar", 600),
    "rider-empty": ("PopupDragonTamingMC/siluetaheroe", 300),
    "dragon-empty": ("PopupDragonTamingMC/siluetadragon", 400),
    "result-empty": ("PopupDragonTamingMC/siluetadragonwithrider", 400),
    "open-training": ("EP_DragonRiderTraining_MC/btnOpen", 160),
    "open-taming": ("EP_DragonTaming_MC/btnOpen", 160),
}

def main():
    out = os.path.join(ROOT, "client", "src", "ui", "art", "riders")
    os.makedirs(out, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="se-riders-") as folder:
        render([path for path, size in PICTURES.values()], folder)
        for name, (path, size) in PICTURES.items():
            with Image.open(os.path.join(folder, path.replace("/", ".") + "-0.png")) as source:
                image = trimmed(source.convert("RGBA"))
            image.thumbnail((size, size), Image.Resampling.LANCZOS)
            image.save(os.path.join(out, name + ".webp"), "WEBP", quality=90, alpha_quality=100)
        cp = ffdec_classpath()
        classes = os.path.join(folder, "classes")
        subprocess.run(["javac", "-cp", cp, "-d", classes,
                        os.path.join(ROOT, "tools", "art", "RenderSwf.java"),
                        os.path.join(ROOT, "tools", "art", "RenderRiderProgress.java")], check=True)
        for rider in range(1, 4):
            frames = os.path.join(folder, str(rider))
            subprocess.run(["java", "-Djava.awt.headless=true", "-cp", cp + os.pathsep + classes, "RenderRiderProgress",
                            os.path.join(ROOT, "assets", "images_new", f"dragonRiderProgress{rider}.swf"), frames], check=True)
            for name in os.listdir(frames):
                with Image.open(os.path.join(frames, name)) as source:
                    image = source.convert("RGBA")
                image.save(os.path.join(out, f"rider{rider}-{name[:-4]}.webp"), "WEBP", quality=85, alpha_quality=100)

if __name__ == "__main__":
    main()
