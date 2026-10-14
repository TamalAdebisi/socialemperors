"""
Pack the pictures RenderSwf.java drew for one building or unit into a single
sprite sheet: one WebP image plus a JSON file saying where each picture is and
which pictures make up each animation. Step 1 of the new game client
(CLIENT.md).

    python tools/art/pack_sheet.py --out <output-folder> <rendered-item-folder>...

writes <output-folder>/<item>.webp and <item>.json for each item. Usually run by
tools/export_art.sh. Needs Pillow (pip install Pillow), which the server
itself doesn't use.

The JSON is in the "JSON hash" layout of TexturePacker, which PixiJS and
Phaser both load as it is:

  frames      one entry per distinct picture, named "<item>/<n>": where it is
              in the sheet ("frame"), where it sat on the full canvas before
              the empty space was trimmed ("spriteSourceSize", "sourceSize"),
              and the "anchor": the point the game positions the item by, as
              a fraction of the canvas
  animations  "<label>/<n>": the pictures to show, one per frame at meta.fps.
              <label> is the animation's name in the game files (QUIETO idle,
              ANDAR walk, ATAQUE attack, MUERTE death, PICAR hit, and special
              moves), or "frame" when there are no labels. <n> counts the
              frames from that label: the direction for a unit (0 to 4; the
              game mirrors these for the other three), the way a building faces
  meta        the image file, its size, the frame rate and where it came from

A picture shown for several frames in a row is listed that many times, so an
animation plays at a steady meta.fps.
"""

import argparse
import json
import math
import os
import sys

from PIL import Image

PADDING = 2           # empty pixels around each picture, so neighbours don't bleed in when scaled
MAX_SIZE = 4096       # largest texture phones' graphics chips accept
WEBP_QUALITY = 85     # lossy colour; transparency stays lossless (alpha_quality=100)


def load(render_dir):
    with open(os.path.join(render_dir, "manifest.json"), encoding="utf-8") as f:
        manifest = json.load(f)
    count = 1 + max(n for frame in manifest["frames"] for n in frame["images"])
    images = [Image.open(os.path.join(render_dir, f"img_{n}.png")).convert("RGBA") for n in range(count)]
    return manifest, images


def trim(image):
    """The smallest box holding every visible pixel: (x, y, w, h), or None when empty."""
    box = image.getchannel("A").getbbox()
    if box is None:
        return None
    return box[0], box[1], box[2] - box[0], box[3] - box[1]


def pack(sizes, max_size=MAX_SIZE):
    """Place boxes of the given (w, h) on shelves, tallest first.

    Returns ([(x, y)] in the order given, (width, height)) and raises
    ValueError when they don't fit in max_size x max_size."""
    if not sizes:
        return [], (1, 1)
    widest = max(w for w, _ in sizes) + PADDING
    area = sum((w + PADDING) * (h + PADDING) for w, h in sizes)
    width = min(max_size, max(widest, math.ceil(math.sqrt(area) * 1.1)))
    if widest > max_size:
        raise ValueError(f"a picture is {widest - PADDING} pixels wide, more than {max_size}")

    order = sorted(range(len(sizes)), key=lambda i: (-sizes[i][1], i))
    positions = [None] * len(sizes)
    x = y = shelf = 0
    used_width = 0
    for i in order:
        w, h = sizes[i]
        if x + w + PADDING > width:
            x, y, shelf = 0, y + shelf, 0
        positions[i] = (x + PADDING // 2, y + PADDING // 2)
        x += w + PADDING
        shelf = max(shelf, h + PADDING)
        used_width = max(used_width, x)
    height = y + shelf
    if height > max_size:
        raise ValueError(f"the pictures need a {width}x{height} sheet, more than {max_size}x{max_size}")
    return positions, (used_width, height)


def animations(manifest):
    """{"<label>/<n>": [picture numbers]} from the manifest's frames."""
    result = {}
    label, start = "frame", 0
    for f, frame in enumerate(manifest["frames"]):
        if frame["labels"]:
            label, start = frame["labels"][0], f
        result[f"{label}/{f - start}"] = frame["images"]
    return result


def build(render_dir):
    """The sheet (a Pillow image) and its JSON data, from RenderSwf's output."""
    manifest, images = load(render_dir)
    item = manifest["swf"][:-len(".swf")]
    canvas_w, canvas_h = manifest["canvas"]["w"], manifest["canvas"]["h"]
    origin = manifest["origin"]

    boxes = []
    warnings = []
    if manifest.get("capped"):
        warnings.append("an animation is longer than RenderSwf's limit and was cut short")
    for n, image in enumerate(images):
        box = trim(image)
        if box is None:
            box = (0, 0, 1, 1)  # an empty picture: one transparent pixel from the canvas's padding
        elif box[0] == 0 or box[1] == 0 or box[0] + box[2] == canvas_w or box[1] + box[3] == canvas_h:
            warnings.append(f"picture {n} touches the edge of its canvas and may be cut off")
        boxes.append(box)

    positions, (sheet_w, sheet_h) = pack([(w, h) for _, _, w, h in boxes])
    sheet = Image.new("RGBA", (sheet_w, sheet_h), (0, 0, 0, 0))
    frames = {}
    for n, (image, (bx, by, w, h), (x, y)) in enumerate(zip(images, boxes, positions)):
        sheet.paste(image.crop((bx, by, bx + w, by + h)), (x, y))
        frames[f"{item}/{n}"] = {
            "frame": {"x": x, "y": y, "w": w, "h": h},
            "rotated": False,
            "trimmed": True,
            "spriteSourceSize": {"x": bx, "y": by, "w": w, "h": h},
            "sourceSize": {"w": canvas_w, "h": canvas_h},
            "anchor": {"x": round(origin["x"] / canvas_w, 6), "y": round(origin["y"] / canvas_h, 6)},
        }

    data = {
        "frames": frames,
        "animations": {name: [f"{item}/{n}" for n in numbers]
                       for name, numbers in animations(manifest).items()},
        "meta": {
            "app": "socialemperors tools/art",
            "version": "1",
            "image": f"{item}.webp",
            "format": "RGBA8888",
            "size": {"w": sheet_w, "h": sheet_h},
            "scale": "1",
            "fps": manifest["fps"],
            "origin": origin,
            "source": manifest["swf"],
        },
    }
    return sheet, data, warnings


def write(sheet, data, out_dir, quality=WEBP_QUALITY):
    os.makedirs(out_dir, exist_ok=True)
    item = data["meta"]["image"][:-len(".webp")]
    sheet.save(os.path.join(out_dir, f"{item}.webp"), "WEBP", quality=quality, alpha_quality=100, method=6)
    with open(os.path.join(out_dir, f"{item}.json"), "w", encoding="utf-8") as f:
        json.dump(data, f, separators=(",", ":"))


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.strip().splitlines()[0])
    parser.add_argument("render_dirs", nargs="+", metavar="render_dir",
                        help="a folder RenderSwf.java wrote (manifest.json, img_<n>.png)")
    parser.add_argument("--out", required=True, help="where to write <item>.webp and <item>.json")
    parser.add_argument("--quality", type=int, default=WEBP_QUALITY, help="WebP quality, 0 to 100")
    args = parser.parse_args(argv)
    failed = 0
    for render_dir in args.render_dirs:
        try:
            sheet, data, warnings = build(render_dir)
        except (ValueError, OSError) as e:
            print(f"FAIL {os.path.basename(os.path.normpath(render_dir))}: {e}")
            failed += 1
            continue
        write(sheet, data, args.out, args.quality)
        for warning in warnings:
            print(f"warning {data['meta']['source']}: {warning}")
        size = data["meta"]["size"]
        print(f"ok {data['meta']['image']}: {len(data['frames'])} pictures, {size['w']}x{size['h']}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
