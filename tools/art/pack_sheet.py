"""
Pack the pictures RenderSwf.java drew for one building or unit into a sprite
sheet: a WebP image plus a JSON file saying where each picture is and which
pictures make up each animation. Step 1 of the new game client (CLIENT.md).

    python tools/art/pack_sheet.py --out <output-folder> <rendered-item-folder>...

writes <output-folder>/<item>.webp and <item>.json for each item. Usually run by
tools/export_art.sh. Needs Pillow (pip install Pillow), which the server
itself doesn't use.

The JSON is in the "JSON hash" layout of TexturePacker, which PixiJS and
Phaser both load:

  frames      one entry per distinct picture, named "<item>/<n>": where it is
              in the sheet ("frame"), where it sat on the full canvas before
              the empty space was trimmed ("spriteSourceSize", "sourceSize"),
              and the "anchor": the point the game positions the item by, as
              a fraction of the canvas
  animations  "<label>/<n>": the pictures to show, one per frame at meta.fps.
              <label> is the animation's name in the game files (QUIETO idle,
              ANDAR walk, ATAQUE attack, MUERTE death, PICAR work, and special
              moves), or "frame" when there are no labels. <n> counts the
              frames from that label: for a unit, the direction (0 to 4: up,
              up-right, right, down-right, down; the game mirrors 1 to 3 for
              the other three), for a building the way it faces
  meta        the image file, its size, the frame rate and where it came from;
              "bounds": each animation's box as Flash measures it, in pixels
              from the anchor, transparent parts of pictures included. The
              game places a building by it: bottom centre on the building's
              point

A picture shown for several frames in a row is listed that many times, so an
animation plays at a steady meta.fps.

Pictures that don't fit in one 4096 x 4096 image (big bosses, the ground)
go on more pages: <item>-1.webp and <item>-1.json (frames only), and so on,
listed in the first JSON's meta.related_multi_packs as TexturePacker does.
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
WEBP_METHOD = 4       # how hard WebP works: 6 makes files 1-2% smaller but takes 8-12 times as long


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
    """Place boxes of the given (w, h) on shelves, tallest first, on as few
    pages of at most max_size x max_size as they need.

    Returns ([(page, x, y)] in the order given, [(width, height)] of each
    page). Raises ValueError for a box bigger than a page."""
    if not sizes:
        return [], [(1, 1)]
    widest = max(w for w, _ in sizes) + PADDING
    tallest = max(h for _, h in sizes) + PADDING
    if widest > max_size or tallest > max_size:
        raise ValueError(f"a picture is {widest - PADDING}x{tallest - PADDING} pixels, "
                         f"more than a {max_size}x{max_size} sheet")
    area = sum((w + PADDING) * (h + PADDING) for w, h in sizes)
    # About square when all fits on one page; pages as wide as allowed when not.
    width = min(max_size, max(widest, math.ceil(math.sqrt(area) * 1.1)))

    order = sorted(range(len(sizes)), key=lambda i: (-sizes[i][1], i))
    positions = [None] * len(sizes)
    pages = []
    page = x = y = shelf = used_width = 0
    for i in order:
        w, h = sizes[i]
        if x + w + PADDING > width:  # the shelf is full: start the next one
            x, y, shelf = 0, y + shelf, 0
        if x == 0 and y + h + PADDING > max_size:  # the page is full: start the next one
            pages.append((used_width, y))
            page, y, used_width = page + 1, 0, 0
        positions[i] = (page, x + PADDING // 2, y + PADDING // 2)
        x += w + PADDING
        shelf = max(shelf, h + PADDING)
        used_width = max(used_width, x)
    pages.append((used_width, y + shelf))
    return positions, pages


def animations(manifest):
    """{"<label>/<n>": [picture numbers]} from the manifest's frames."""
    result = {}
    label, start = "frame", 0
    for f, frame in enumerate(manifest["frames"]):
        if frame["labels"]:
            label, start = frame["labels"][0], f
        result[f"{label}/{f - start}"] = frame["images"]
    return result


def bounds(manifest):
    """{"<label>/<n>": {x, y, w, h}} for the frames whose bounds RenderSwf recorded."""
    names = list(animations(manifest))
    return {name: frame["bounds"] for name, frame in zip(names, manifest["frames"]) if frame.get("bounds")}


def page_name(item, page):
    return item if page == 0 else f"{item}-{page}"


def build(render_dir, max_size=MAX_SIZE):
    """The sheets (Pillow images) and their JSON data, one per page, from
    RenderSwf's output, and any warnings."""
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

    positions, sizes = pack([(w, h) for _, _, w, h in boxes], max_size)
    sheets = [Image.new("RGBA", size, (0, 0, 0, 0)) for size in sizes]
    pages = [{"frames": {}, "meta": {}} for _ in sizes]
    for n, (image, (bx, by, w, h), (page, x, y)) in enumerate(zip(images, boxes, positions)):
        sheets[page].paste(image.crop((bx, by, bx + w, by + h)), (x, y))
        pages[page]["frames"][f"{item}/{n}"] = {
            "frame": {"x": x, "y": y, "w": w, "h": h},
            "rotated": False,
            "trimmed": True,
            "spriteSourceSize": {"x": bx, "y": by, "w": w, "h": h},
            "sourceSize": {"w": canvas_w, "h": canvas_h},
            "anchor": {"x": round(origin["x"] / canvas_w, 6), "y": round(origin["y"] / canvas_h, 6)},
        }
    for page, (data, (w, h)) in enumerate(zip(pages, sizes)):
        data["meta"] = {
            "app": "socialemperors tools/art",
            "version": "1",
            "image": f"{page_name(item, page)}.webp",
            "format": "RGBA8888",
            "size": {"w": w, "h": h},
            "scale": "1",
        }

    first = pages[0]
    first["animations"] = {name: [f"{item}/{n}" for n in numbers]
                           for name, numbers in animations(manifest).items()}
    first["meta"].update({
        "fps": manifest["fps"],
        "origin": origin,
        "bounds": bounds(manifest),
        "source": manifest["swf"],
    })
    if len(pages) > 1:
        first["meta"]["related_multi_packs"] = [f"{page_name(item, page)}.json" for page in range(1, len(pages))]
    return sheets, pages, warnings


def write(sheets, pages, out_dir, quality=WEBP_QUALITY):
    """Write the images, then the JSON files, the first page's last: once
    <item>.json is there, the whole item is. Each file is written under
    another name and renamed when complete, so nothing (an upload running
    alongside, a game loading it) ever sees half a file."""
    os.makedirs(out_dir, exist_ok=True)
    names = [data["meta"]["image"][:-len(".webp")] for data in pages]
    for sheet, name in zip(sheets, names):
        path = os.path.join(out_dir, f"{name}.webp")
        sheet.save(path + ".tmp", "WEBP", quality=quality, alpha_quality=100, method=WEBP_METHOD)
        os.replace(path + ".tmp", path)
    for data, name in reversed(list(zip(pages, names))):
        path = os.path.join(out_dir, f"{name}.json")
        with open(path + ".tmp", "w", encoding="utf-8") as f:
            json.dump(data, f, separators=(",", ":"))
        os.replace(path + ".tmp", path)


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
            sheets, pages, warnings = build(render_dir)
        except (ValueError, OSError) as e:
            print(f"FAIL {os.path.basename(os.path.normpath(render_dir))}: {e}")
            failed += 1
            continue
        write(sheets, pages, args.out, args.quality)
        meta = pages[0]["meta"]
        for warning in warnings:
            print(f"warning {meta['source']}: {warning}")
        sizes = ", ".join(f"{p['meta']['size']['w']}x{p['meta']['size']['h']}" for p in pages)
        pictures = sum(len(p["frames"]) for p in pages)
        print(f"ok {meta['image']}: {pictures} pictures, {len(pages)} page(s) {sizes}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
