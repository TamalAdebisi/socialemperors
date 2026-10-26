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
  animations  "<label>/<n>": the pictures to show, one per frame at meta.fps;
              "steps/0" for a chest that fills up as its camp goes (one
              picture per step shown, from none).
              <label> is the animation's name in the game files (QUIETO idle,
              ANDAR walk, ATAQUE attack, MUERTE death, PICAR work, and special
              moves), or "frame" when there are no labels; a label used
              again is "<label>@<frame>" there. <n> counts the
              frames from that label: for a unit, the direction (0 to 4: up,
              up-right, right, down-right, down; the game mirrors 1 to 3 for
              the other three), for a building the way it faces. Every
              frame has one, in order: the client finds a unit's animation
              by its place (frame 5a + direction), as the game does, since
              the newer units label theirs in other words (RESPIRAR...)
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
frames instead of 1 (meta.step says how many), until it fits. A unit may
take UNIT_PAGES, as the game loads only the pages of the moves it shows:
enough for the biggest dragons at the game's size.

Pictures that don't fit in one 4096 x 4096 image (big bosses, the ground)
go on more pages: <item>-1.json (frames only), and so on, listed in the
first JSON's meta.related_multi_packs as TexturePacker does. Such an item
is packed move by move, so the game loads only the pages of what it shows
(CLIENT.md, "Light art"): a unit's standing and walking first (the town's),
then attacking and dying (a fight's), then each of its other moves on
pages of its own. Its pages are at most 4096 x 3072, in whole multiples of
64 pixels, named <item>.m2.webp, <item>-1.m2.webp... (PAGES_MARK: new names
whenever this packing changes, so no cache serves old pictures with a new
JSON), and each comes with:

  <page>.m2-mask.png  where the page is see-through, at half size, one bit
              a pixel (meta.mask): the game answers taps with it
  <page>.m2.ktx2      with --ktx2: the page as the graphics chip keeps it
              (Basis UASTC, four times smaller there; meta.ktx2), made by
              tools/art/ktx2.mjs from the page with its colours
              premultiplied by alpha
  <page>.m2.half.ktx2 the same at half size (meta.ktx2_half), for phones
              and light art: a quarter of the download
"""

import argparse
import json
import math
import os
import subprocess
import sys

from PIL import Image, ImageChops

PADDING = 2           # empty pixels around each picture, so neighbours don't bleed in when scaled
MAX_PAGES = 4         # the most sheet pages an item may take: each is up to 64 MB in a graphics chip
UNIT_PAGES = 24       # ...a unit, packed move by move: only the pages of the moves shown are loaded
PAGES_MARK = "m2"     # in the names of the pages of an item packed move by move: changed with the packing
MAX_SIZE = 4096       # largest texture phones' graphics chips accept
WEBP_QUALITY = 85     # lossy colour; transparency stays lossless (alpha_quality=100)
WEBP_METHOD = 4       # how hard WebP works: 6 makes files 1-2% smaller but takes 8-12 times as long
SHORT_PAGE = 3072     # a big item's pages are at most 4096 x 3072: the KTX2 encoder takes 12 Mpix
PAGE_STEP = 64        # ...in whole multiples of 64, so their smaller copies stay whole blocks of 4
MASK_ALPHA = 8        # a 2 x 2 block's average alpha from which it counts as the picture (the client's)
KTX2 = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ktx2.mjs")


def load(render_dir):
    """The manifest, and the path of each picture: img_0.png, img_1.png...
    Pictures are opened one at a time when needed, never all at once: a big
    boss has hundreds, each the size of its whole canvas, and holding them
    together took more memory than the export machines have."""
    with open(os.path.join(render_dir, "manifest.json"), encoding="utf-8") as f:
        manifest = json.load(f)
    count = 1 + max(n for images in [*(frame["images"] for frame in manifest["frames"]), manifest.get("steps", [])] for n in images)
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


def plan(frames, boxes, max_size=MAX_SIZE, max_pages=MAX_PAGES, page_area=None):
    """(shrink, step) for an item: the first of PLANS whose pictures fit in
    max_pages pages (of `page_area` pixels: max_size squared), guessing a
    tenth more than their area for the gaps."""
    page_area = page_area or max_size * max_size
    biggest = shrink_for(boxes, max_size)
    for shrink, step in PLANS:
        if shrink < biggest:
            continue
        used = {n for frame in decimate(frames, step) for n in frame["images"]}
        area = sum((boxes[n][2] // shrink + PADDING) * (boxes[n][3] // shrink + PADDING) for n in used)
        if area * 1.1 <= max_pages * page_area:
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


def pack(sizes, max_size=MAX_SIZE, max_height=None):
    """Place boxes of the given (w, h) on shelves, tallest first, on as few
    pages of at most max_size x max_height (max_size) as they need.

    Returns ([(page, x, y)] in the order given, [(width, height)] of each
    page). Raises ValueError for a box bigger than a page."""
    if not sizes:
        return [], [(1, 1)]
    max_height = max_height or max_size
    widest = max(w for w, _ in sizes) + PADDING
    tallest = max(h for _, h in sizes) + PADDING
    if widest > max_size or tallest > max_height:
        raise ValueError(f"a picture is {widest - PADDING}x{tallest - PADDING} pixels, "
                         f"more than a {max_size}x{max_height} sheet")
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
        if x == 0 and y + h + PADDING > max_height:  # the page is full: start the next one
            pages.append((used_width, y))
            page, y, used_width = page + 1, 0, 0
        positions[i] = (page, x + PADDING // 2, y + PADDING // 2)
        x += w + PADDING
        shelf = max(shelf, h + PADDING)
        used_width = max(used_width, x)
    pages.append((used_width, y + shelf))
    return positions, pages


def animations(manifest):
    """{"<label>/<n>": [picture numbers]} from the manifest's frames: one
    entry per frame, in order, as the client counts a unit's animations by
    their place (the game does too). A label used a second time (the
    frostfire bahamuts' ATAQUE, at frame 10 and at 30) is "<label>@<frame>"
    from there, so it doesn't write over the first."""
    result = {}
    label, start = "frame", 0
    for f, frame in enumerate(manifest["frames"]):
        if frame["labels"]:
            label, start = frame["labels"][0], f
            if f"{label}/0" in result:
                label = f"{label}@{f}"
        result[f"{label}/{f - start}"] = frame["images"]
    if manifest.get("steps"):
        # A chest that fills up as its camp goes: its first frame with no step, then one more each.
        result["steps/0"] = manifest["steps"]
    return result


def labelled(manifest):
    """A unit (animations named in the game's words), not a building, the ground or an effect."""
    return any(not name.startswith(("frame/", "steps/")) for name in animations(manifest))


def move_groups(manifest, used):
    """For a unit, which pictures go on pages together: {picture: group},
    by the first move that shows each (a move is 5 runs of animations(), one
    per way, as the client counts them): 0 standing and walking (the town),
    1 attacking and dying (a fight), then each other move on its own
    (working, the longer deaths, each special move), so the game loads a
    page only when all of it is wanted. An item with no labels (a
    building, the ground) is one group."""
    runs = list(animations(manifest).values())
    group = {}
    if labelled(manifest):
        for i, images in enumerate(runs):
            move = i // 5
            here = 0 if move < 2 else 1 if move < 4 else move - 2
            for n in images:
                group[n] = min(group.get(n, here), here)
    return {n: group.get(n, 0) for n in used}


def pack_moves(sizes, groups, max_size=MAX_SIZE, max_height=None):
    """pack() each group of boxes on pages of its own, in the groups' order,
    each page rounded up to whole multiples of PAGE_STEP (within max_size and
    max_height). Returns as pack() does."""
    max_height = max_height or max_size
    positions = [None] * len(sizes)
    pages = []
    for group in sorted(set(groups)):
        members = [i for i, g in enumerate(groups) if g == group]
        places, group_pages = pack([sizes[i] for i in members], max_size, max_height)
        for i, (page, x, y) in zip(members, places):
            positions[i] = (len(pages) + page, x, y)
        pages += [(min(max_size, -(-w // PAGE_STEP) * PAGE_STEP), min(max_height, -(-h // PAGE_STEP) * PAGE_STEP))
                  for w, h in group_pages]
    return positions, pages


def bounds(manifest):
    """{"<label>/<n>": {x, y, w, h}} for the frames whose bounds RenderSwf recorded."""
    names = list(animations(manifest))
    return {name: frame["bounds"] for name, frame in zip(names, manifest["frames"]) if frame.get("bounds")}


def page_name(item, page):
    return item if page == 0 else f"{item}-{page}"


def image_name(item, page, pages):
    """A page's picture: <page>.webp, or <page>.m2.webp for an item of several pages, packed move by move."""
    return page_name(item, page) + (f".{PAGES_MARK}" if pages > 1 else "")


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


def build(render_dir, max_size=MAX_SIZE, loaded=None, max_pages=MAX_PAGES, unit_pages=UNIT_PAGES):
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

    if labelled(manifest):
        # A unit: more pages, short enough for the graphics chip's format (several pages are packed so).
        allowed = unit_pages
        shrink, step = plan(manifest["frames"], boxes, max_size, unit_pages, max_size * (max_size * SHORT_PAGE // MAX_SIZE))
    else:
        allowed = max_pages
        shrink, step = plan(manifest["frames"], boxes, max_size, max_pages)
    if shrink > 1:
        boxes = [widen(box, shrink, canvas_w, canvas_h) for box in boxes]
        warnings.append(f"pictures too big for {allowed} sheets, stored at 1/{shrink} size (meta.scale)")
    if step > 1:
        manifest = {**manifest, "frames": decimate(manifest["frames"], step)}
        warnings.append(f"too many pictures for {allowed} sheets: each held {step} frames (meta.step)")
    # Only the pictures the animations still show are packed; each keeps its number.
    used = sorted({n for frame in manifest["frames"] for n in frame["images"]} | set(manifest.get("steps", [])))
    # The canvas in stored pixels, and the anchor as a fraction of it, which
    # PixiJS turns back into the origin exactly.
    source_w, source_h = canvas_w // shrink, canvas_h // shrink
    anchor = {"x": round(origin["x"] / shrink / source_w, 6), "y": round(origin["y"] / shrink / source_h, 6)}

    boxes_used = [(boxes[n][2] // shrink, boxes[n][3] // shrink) for n in used]
    positions, sizes = pack(boxes_used, max_size)
    if len(sizes) > 1:
        # Several pages: packed move by move, on pages the graphics chip's format takes (SHORT_PAGE),
        # unless a picture is taller (its pages then stay WebP only).
        tallest = max(h for _, h in boxes_used) + PADDING
        short = min(max_size, max(max_size * SHORT_PAGE // MAX_SIZE, tallest))
        groups = move_groups(manifest, used)
        positions, sizes = pack_moves(boxes_used, [groups[n] for n in used], max_size, short)
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
            "image": f"{image_name(item, page, len(pages))}.webp",
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


def mask(image):
    """Where a page is see-through, at half size: a 1-bit picture, white
    where a 2 x 2 block's average alpha reaches MASK_ALPHA."""
    alpha = image.getchannel("A")
    half = alpha.reduce(2) if alpha.width > 1 and alpha.height > 1 else alpha
    return half.point(lambda a: 255 if a >= MASK_ALPHA else 0).convert("1", dither=Image.Dither.NONE)


def premultiplied(image):
    """The page with each colour multiplied by its alpha, as the graphics chip draws it."""
    r, g, b, a = image.split()
    return Image.merge("RGBA", [ImageChops.multiply(c, a) for c in (r, g, b)] + [a])


def ktx2(page, path):
    """A page (its colours premultiplied) as a KTX2 file (tools/art/ktx2.mjs,
    Node), or False when it can't be made (too big for the encoder, not in
    whole blocks, Node missing)."""
    if page.width * page.height > MAX_SIZE * SHORT_PAGE or page.width % 4 or page.height % 4:
        return False
    raw = path + ".rgba.tmp"
    with open(raw, "wb") as f:
        f.write(page.tobytes())
    try:
        done = subprocess.run(["node", KTX2, raw, str(page.width), str(page.height), path + ".tmp"],
                              capture_output=True, text=True)
    except OSError:
        return False
    finally:
        os.remove(raw)
    if done.returncode != 0:
        print(f"ktx2 {os.path.basename(path)}: {done.stderr.strip()[-300:]}", file=sys.stderr)
        return False
    os.replace(path + ".tmp", path)
    return True


def write(sheets, pages, out_dir, quality=WEBP_QUALITY, with_ktx2=False):
    """Write the images, then the JSON files, the first page's last: once
    <item>.json is there, the whole item is. Each file is written under
    another name and renamed when complete, so nothing (an upload running
    alongside, a game loading it) ever sees half a file. An item of several
    pages gets each page's mask too, and with `with_ktx2` its KTX2 files, at
    its size and at half (each halved 2 x 2 pixels as one)."""
    os.makedirs(out_dir, exist_ok=True)
    names = [data["meta"]["image"][:-len(".webp")] for data in pages]
    for sheet, name, data in zip(sheets, names, pages):
        path = os.path.join(out_dir, f"{name}.webp")
        image = sheet.image()
        image.save(path + ".tmp", "WEBP", quality=quality, alpha_quality=100, method=WEBP_METHOD)
        os.replace(path + ".tmp", path)
        if len(pages) > 1:
            mask_path = os.path.join(out_dir, f"{name}-mask.png")
            mask(image).save(mask_path + ".tmp", "PNG", optimize=True)
            os.replace(mask_path + ".tmp", mask_path)
            data["meta"]["mask"] = f"{name}-mask.png"
            if with_ktx2:
                page = premultiplied(image)
                if ktx2(page, os.path.join(out_dir, f"{name}.ktx2")):
                    data["meta"]["ktx2"] = f"{name}.ktx2"
                    half = page.resize((page.width // 2, page.height // 2), Image.Resampling.BOX)
                    if ktx2(half, os.path.join(out_dir, f"{name}.half.ktx2")):
                        data["meta"]["ktx2_half"] = f"{name}.half.ktx2"
        del image  # one page in memory at a time
    for data, name in reversed(list(zip(pages, names))):
        json_name = name.removesuffix(f".{PAGES_MARK}")
        path = os.path.join(out_dir, f"{json_name}.json")
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
    parser.add_argument("--ktx2", action="store_true",
                        help="also write each page of a big item as KTX2 (tools/art/ktx2.mjs: Node and its packages)")
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
        write(sheets, pages, args.out, args.quality, args.ktx2)
        meta = pages[0]["meta"]
        for warning in warnings:
            print(f"warning {meta['source']}: {warning}")
        sizes = ", ".join(f"{p['meta']['size']['w']}x{p['meta']['size']['h']}" for p in pages)
        pictures = sum(len(p["frames"]) for p in pages)
        print(f"ok {meta['image']}: {pictures} pictures, {len(pages)} page(s) {sizes}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
