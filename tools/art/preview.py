"""
Play a sprite sheet's animations into an animated WebP, to check an export by
eye against the game. It reads only the sheet and its JSON, as a game client
would, so it also checks that the JSON is enough to draw the item.

    python tools/art/preview.py <item>.json [preview.webp]

One row per animation label (QUIETO, ANDAR, ATAQUE...), one column per frame
from that label (a unit's directions). Each picture is drawn at its anchor,
marked by a small cross: the point the game positions the item by. An item
that jumps around the cross from one frame to the next is exported wrong.
"""

import json
import os
import sys

from PIL import Image, ImageDraw

BACKGROUND = (92, 128, 72, 255)  # about the grass of the game's map
CROSS = (255, 255, 255, 255)
LABEL = (255, 255, 255, 255)
MARGIN = 16
LABEL_HEIGHT = 14


def pictures(pages, sheets):
    """Each frame name -> (picture, its offset from the anchor), from every page."""
    result = {}
    for data, sheet in zip(pages, sheets):
        result.update(page_pictures(data, sheet))
    return result


def page_pictures(data, sheet):
    result = {}
    for name, frame in data["frames"].items():
        f, trimmed, source = frame["frame"], frame["spriteSourceSize"], frame["sourceSize"]
        anchor_x = frame["anchor"]["x"] * source["w"]
        anchor_y = frame["anchor"]["y"] * source["h"]
        picture = sheet.crop((f["x"], f["y"], f["x"] + f["w"], f["y"] + f["h"]))
        result[name] = (picture, (round(trimmed["x"] - anchor_x), round(trimmed["y"] - anchor_y)))
    return result


def layout(data):
    """Rows of (label, [animation names]), in the order of the JSON."""
    rows = []
    for name in data["animations"]:
        label = name.rsplit("/", 1)[0]
        if not rows or rows[-1][0] != label:
            rows.append((label, []))
        rows[-1][1].append(name)
    return rows


def render(pages, sheets):
    """The preview's frames (Pillow images) and how long each is shown, in ms."""
    data = pages[0]
    pics = pictures(pages, sheets)
    rows = layout(data)
    # One cell fits every picture of the item around a shared anchor.
    left = min(dx for _, (dx, _) in pics.values())
    top = min(dy for _, (_, dy) in pics.values())
    right = max(dx + p.width for p, (dx, _) in pics.values())
    bottom = max(dy + p.height for p, (_, dy) in pics.values())
    cell_w, cell_h = right - left + MARGIN, bottom - top + MARGIN + LABEL_HEIGHT
    columns = max(len(names) for _, names in rows)
    length = max(len(frames) for frames in data["animations"].values())

    frames = []
    for t in range(length):
        canvas = Image.new("RGBA", (columns * cell_w, len(rows) * cell_h), BACKGROUND)
        draw = ImageDraw.Draw(canvas)
        for r, (label, names) in enumerate(rows):
            for c, name in enumerate(names):
                sequence = data["animations"][name]
                picture, (dx, dy) = pics[sequence[t % len(sequence)]]
                x0, y0 = c * cell_w, r * cell_h
                ax, ay = x0 + MARGIN // 2 - left, y0 + LABEL_HEIGHT + MARGIN // 2 - top
                canvas.alpha_composite(picture, (ax + dx, ay + dy))
                draw.line((ax - 4, ay, ax + 4, ay), fill=CROSS)
                draw.line((ax, ay - 4, ax, ay + 4), fill=CROSS)
                draw.text((x0 + 4, y0 + 2), name, fill=LABEL)
        frames.append(canvas)
    return frames, round(1000 / data["meta"]["fps"])


def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    if not argv:
        print(__doc__.strip())
        return 2
    json_path = argv[0]
    out_path = argv[1] if len(argv) > 1 else os.path.splitext(json_path)[0] + ".preview.webp"
    folder = os.path.dirname(json_path)
    with open(json_path, encoding="utf-8") as f:
        pages = [json.load(f)]
    for other in pages[0]["meta"].get("related_multi_packs", []):
        with open(os.path.join(folder, other), encoding="utf-8") as f:
            pages.append(json.load(f))
    sheets = [Image.open(os.path.join(folder, page["meta"]["image"])).convert("RGBA") for page in pages]
    frames, duration = render(pages, sheets)
    frames[0].save(out_path, "WEBP", save_all=True, append_images=frames[1:], duration=duration,
                   loop=0, quality=80)
    print(f"ok {out_path}: {len(frames)} frames")
    return 0


if __name__ == "__main__":
    sys.exit(main())
