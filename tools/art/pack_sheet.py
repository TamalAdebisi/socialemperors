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

A picture bigger than a whole sheet even alone (the biggest gods and
dragons, up to 6,479 pixels wide) can't be stored at the game's size: the
item's pictures are then stored at half size (a quarter if need be) and
meta.scale says so ("0.5"). PixiJS reads it and draws them at full size,
and every number in the JSON but meta.bounds is in the smaller pixels.

An item may take at most MAX_PAGES pages. One that would take more (the
chained water god: 394 pictures of nearly 4,000 x 2,500) is stored smaller
and, if that isn't enough, its animations hold each picture for 2 or 3
frames instead of 1 (meta.step says how many), until it fits.

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
MAX_PAGES = 4         # the most sheet pages an item may take: each is up to 64 MB in a graphics chip
MAX_SIZE = 4096       # largest texture phones' graphics chips accept
WEBP_QUALITY = 85     # lossy colour; transparency stays lossless (alpha_quality=100)
WEBP_METHOD = 4       # how hard WebP works: 6 makes files 1-2% smaller but takes 8-12 times as long


def load(render_dir):
    """The manifest, and the path of each picture: img_0.png, img_1.png...
    Pictures are opened one at a time when needed, never all at once: a big
    boss has hundreds, each the size of its whole canvas, and holding them
    together took more memory than the export machines have."""
    with open(os.path.join(render_dir, "manifest.json"), encoding="utf-8") as f:
        manifest = json.load(f)
    count = 1 + max(n for frame in manifest["frames"] for n in frame["images"])
    return manifest, [os.path.join(render_dir, f"img_{n}.png") for n in range(count)]


def open_rgba(path):
    with Image.open(path) as image:
        return image.convert("RGBA")


class Sheet:
    """One page of a sprite sheet, drawn only when it is written (image()),
    so a many-page item never has more than one page in memory."""

    def __init__(self, size, shrink=1):
        self.size = size
        self.shrink = shrink  # 2: pictures are stored at half size
        self.pictures = []  # (path, trimmed box on its canvas, place on the page)

    def image(self):
        sheet = Image.new("RGBA", self.size, (0, 0, 0, 0))
        for path, (bx, by, w, h), place in self.pictures:
            picture = open_rgba(path).crop((bx, by, bx + w, by + h))
            if self.shrink > 1:
                picture = picture.resize((w // self.shrink, h // self.shrink), Image.Resampling.LANCZOS)
            sheet.paste(picture, place)
        return sheet


def shrink_for(boxes, max_size=MAX_SIZE):
    """1 when every picture fits on a sheet at the game's size; else 2, 4...:
    how many times smaller they must be stored."""
    biggest = max((max(w, h) for _, _, w, h in boxes), default=0)
    shrink = 1
    while biggest / shrink + PADDING > max_size:
        shrink *= 2
    return shrink


# What to try, in order, for an item over MAX_PAGES: (how many times smaller,
# how many frames each picture is held). Smaller first, then choppier.
PLANS = [(1, 1), (2, 1), (2, 2), (2, 3), (4, 2), (4, 3), (4, 4), (4, 6), (8, 6), (8, 12)]


def decimate(frames, step):
    """Each animation shows only every step-th picture, each held step frames."""
    if step == 1:
        return frames
    return [{**frame, "images": [images[i - i % step] for i in range(len(images))]}
            for frame in frames for images in [frame["images"]]]


def plan(frames, boxes, max_size=MAX_SIZE, max_pages=MAX_PAGES):
    """(shrink, step) for an item: the first of PLANS whose pictures fit in
    max_pages pages, guessing a tenth more than their area for the gaps."""
    biggest = shrink_for(boxes, max_size)
    for shrink, step in PLANS:
        if shrink < biggest:
            continue
        used = {n for frame in decimate(frames, step) for n in frame["images"]}
        area = sum((boxes[n][2] // shrink + PADDING) * (boxes[n][3] // shrink + PADDING) for n in used)
        if area * 1.1 <= max_pages * max_size * max_size:
            return shrink, step
    return PLANS[-1]


def widen(box, shrink, canvas_w, canvas_h):
    """A trimmed box grown to whole multiples of `shrink`, so its place and
    size are exact once shrunk (the canvas is padded, so there's room)."""
    bx, by, w, h = box
    x0, y0 = bx - bx % shrink, by - by % shrink
    x1 = min(canvas_w - canvas_w % shrink, -(-(bx + w) // shrink) * shrink)
    y1 = min(canvas_h - canvas_h % shrink, -(-(by + h) // shrink) * shrink)
    return x0, y0, max(shrink, x1 - x0), max(shrink, y1 - y0)


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


def split_frames(render_dir, prefix):
    """A library clip whose frames are different things (the projectiles:
    frame n is projectile type n) as one item per frame, "<prefix>_<n>"
    counting from 1, so a battle loads only the projectiles it shows.
    Yields (manifest, picture paths) for each, to give build()."""
    manifest, paths = load(render_dir)
    for f, frame in enumerate(manifest["frames"]):
        used = sorted(set(frame["images"]))
        renumber = {n: i for i, n in enumerate(used)}
        yield ({**manifest, "name": f"{prefix}_{f + 1}",
                "frames": [{**frame, "labels": [], "images": [renumber[n] for n in frame["images"]]}]},
               [paths[n] for n in used])


def build(render_dir, max_size=MAX_SIZE, loaded=None, max_pages=MAX_PAGES):
    """The sheets (Sheet: call image() for the picture) and their JSON data,
    one per page, from RenderSwf's output (or `loaded`: a manifest and its
    pictures from split_frames), and any warnings."""
    manifest, paths = loaded or load(render_dir)
    # The item's name: the file's, or the class drawn from a library file.
    item = manifest.get("name") or manifest["swf"][:-len(".swf")]
    canvas_w, canvas_h = manifest["canvas"]["w"], manifest["canvas"]["h"]
    origin = manifest["origin"]

    boxes = []
    warnings = []
    if manifest.get("capped"):
        warnings.append("an animation is longer than RenderSwf's limit and was cut short")
    for n, path in enumerate(paths):
        box = trim(open_rgba(path))
        if box is None:
            box = (0, 0, 1, 1)  # an empty picture: one transparent pixel from the canvas's padding
        elif box[0] == 0 or box[1] == 0 or box[0] + box[2] == canvas_w or box[1] + box[3] == canvas_h:
            warnings.append(f"picture {n} touches the edge of its canvas and may be cut off")
        boxes.append(box)

    shrink, step = plan(manifest["frames"], boxes, max_size, max_pages)
    if shrink > 1:
        boxes = [widen(box, shrink, canvas_w, canvas_h) for box in boxes]
        warnings.append(f"pictures too big for {max_pages} sheets, stored at 1/{shrink} size (meta.scale)")
    if step > 1:
        manifest = {**manifest, "frames": decimate(manifest["frames"], step)}
        warnings.append(f"too many pictures for {max_pages} sheets: each held {step} frames (meta.step)")
    # Only the pictures the animations still show are packed; each keeps its number.
    used = sorted({n for frame in manifest["frames"] for n in frame["images"]})
    # The canvas in stored pixels, and the anchor as a fraction of it, which
    # PixiJS turns back into the origin exactly.
    source_w, source_h = canvas_w // shrink, canvas_h // shrink
    anchor = {"x": round(origin["x"] / shrink / source_w, 6), "y": round(origin["y"] / shrink / source_h, 6)}

    positions, sizes = pack([(boxes[n][2] // shrink, boxes[n][3] // shrink) for n in used], max_size)
    sheets = [Sheet(size, shrink) for size in sizes]
    pages = [{"frames": {}, "meta": {}} for _ in sizes]
    for n, (page, x, y) in zip(used, positions):
        path, (bx, by, w, h) = paths[n], boxes[n]
        sheets[page].pictures.append((path, (bx, by, w, h), (x, y)))
        pages[page]["frames"][f"{item}/{n}"] = {
            "frame": {"x": x, "y": y, "w": w // shrink, "h": h // shrink},
            "rotated": False,
            "trimmed": True,
            "spriteSourceSize": {"x": bx // shrink, "y": by // shrink, "w": w // shrink, "h": h // shrink},
            "sourceSize": {"w": source_w, "h": source_h},
            "anchor": anchor,
        }
    for page, (data, (w, h)) in enumerate(zip(pages, sizes)):
        data["meta"] = {
            "app": "socialemperors tools/art",
            "version": "1",
            "image": f"{page_name(item, page)}.webp",
            "format": "RGBA8888",
            "size": {"w": w, "h": h},
            "scale": str(1 / shrink) if shrink > 1 else "1",
        }

    first = pages[0]
    first["animations"] = {name: [f"{item}/{n}" for n in numbers]
                           for name, numbers in animations(manifest).items()}
    first["meta"].update({
        "fps": manifest["fps"],
        "step": step,
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
        image = sheet.image()
        image.save(path + ".tmp", "WEBP", quality=quality, alpha_quality=100, method=WEBP_METHOD)
        del image  # one page in memory at a time
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
    parser.add_argument("--split-frames", metavar="PREFIX",
                        help="make one item of each frame, <PREFIX>_1, _2... (a library clip like the projectiles)")
    args = parser.parse_args(argv)
    failed = 0
    jobs = []
    for render_dir in args.render_dirs:
        if args.split_frames:
            jobs += [(render_dir, loaded) for loaded in split_frames(render_dir, args.split_frames)]
        else:
            jobs.append((render_dir, None))
    for render_dir, loaded in jobs:
        try:
            sheets, pages, warnings = build(render_dir, loaded=loaded)
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
