"""
The art pipeline (tools/art/): packing the pictures RenderSwf.java draws into
a sprite sheet and its JSON, and playing that back with preview.py. Uses a
small made-up item, so it needs Pillow but not Java or the game's files.

Run from the repository folder:  python -m unittest discover tests
"""

import json
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "tools", "art"))

try:
    from PIL import Image
    import pack_sheet
    import preview
except ImportError:  # Pillow is only needed for the art tools, not the server
    Image = None

CANVAS = (40, 30)
ORIGIN = {"x": 20, "y": 25}  # the item's feet


def make_render(folder, frames, pictures):
    """A folder like the ones RenderSwf.java writes: manifest.json and img_<n>.png.

    pictures: one (x, y, w, h) box per image, painted red on a transparent canvas,
    or None for an empty image."""
    for n, box in enumerate(pictures):
        image = Image.new("RGBA", CANVAS, (0, 0, 0, 0))
        if box:
            x, y, w, h = box
            image.paste((255, 0, 0, 255), (x, y, x + w, y + h))
        image.save(os.path.join(folder, f"img_{n}.png"))
    manifest = {"swf": "99_test_unit.swf", "class": "99_test_unit", "fps": 30.0, "zoom": 1.0,
                "canvas": {"w": CANVAS[0], "h": CANVAS[1]}, "origin": ORIGIN, "capped": False,
                "frames": frames}
    with open(os.path.join(folder, "manifest.json"), "w") as f:
        json.dump(manifest, f)


@unittest.skipIf(Image is None, "needs Pillow")
class PackSheetTest(unittest.TestCase):

    def setUp(self):
        self.folder = tempfile.mkdtemp(prefix="se-art-")
        # Two directions of idle (one picture each), then an attack whose
        # first direction holds picture 2 for two frames, then an empty frame.
        frames = [{"labels": ["QUIETO"], "images": [0]},
                  {"labels": [], "images": [1]},
                  {"labels": ["ATAQUE"], "images": [2, 2, 3]},
                  {"labels": [], "images": [3]},
                  {"labels": ["PICAR"], "images": [4]}]
        make_render(self.folder, frames, [(10, 5, 20, 20), (12, 6, 16, 19), (5, 1, 30, 24), (0, 10, 8, 8), None])
        self.sheet, self.data, self.warnings = pack_sheet.build(self.folder)

    def test_animations_are_named_by_label_and_direction(self):
        self.assertEqual(list(self.data["animations"]),
                         ["QUIETO/0", "QUIETO/1", "ATAQUE/0", "ATAQUE/1", "PICAR/0"])
        self.assertEqual(self.data["animations"]["ATAQUE/0"],
                         ["99_test_unit/2", "99_test_unit/2", "99_test_unit/3"])

    def test_pictures_are_trimmed_and_remember_where_they_were(self):
        frame = self.data["frames"]["99_test_unit/0"]
        self.assertEqual(frame["spriteSourceSize"], {"x": 10, "y": 5, "w": 20, "h": 20})
        self.assertEqual(frame["sourceSize"], {"w": 40, "h": 30})
        self.assertEqual((frame["frame"]["w"], frame["frame"]["h"]), (20, 20))
        self.assertTrue(frame["trimmed"])

    def test_the_anchor_is_the_origin_as_a_fraction_of_the_canvas(self):
        for frame in self.data["frames"].values():
            self.assertEqual(frame["anchor"], {"x": 0.5, "y": round(25 / 30, 6)})
        self.assertEqual(self.data["meta"]["origin"], ORIGIN)

    def test_an_empty_picture_becomes_one_transparent_pixel(self):
        frame = self.data["frames"]["99_test_unit/4"]
        self.assertEqual((frame["frame"]["w"], frame["frame"]["h"]), (1, 1))
        x, y = frame["frame"]["x"], frame["frame"]["y"]
        self.assertEqual(self.sheet.getpixel((x, y))[3], 0)

    def test_the_sheet_holds_each_picture_where_the_json_says(self):
        self.assertEqual(self.sheet.size, (self.data["meta"]["size"]["w"], self.data["meta"]["size"]["h"]))
        boxes = []
        for name, frame in self.data["frames"].items():
            f = frame["frame"]
            if f["w"] > 1:
                # Every pixel of a picture is the red we painted.
                self.assertEqual(self.sheet.crop((f["x"], f["y"], f["x"] + f["w"], f["y"] + f["h"])).getcolors(),
                                 [(f["w"] * f["h"], (255, 0, 0, 255))], name)
            boxes.append((f["x"], f["y"], f["x"] + f["w"], f["y"] + f["h"]))
        for i, a in enumerate(boxes):  # and no two overlap
            for b in boxes[i + 1:]:
                self.assertFalse(a[0] < b[2] and b[0] < a[2] and a[1] < b[3] and b[1] < a[3], (a, b))

    def test_a_picture_at_the_edge_of_its_canvas_is_reported(self):
        self.assertEqual(self.warnings, ["picture 3 touches the edge of its canvas and may be cut off"])

    def test_an_animation_cut_short_is_reported(self):
        folder = tempfile.mkdtemp(prefix="se-art-")
        make_render(folder, [{"labels": [], "images": [0]}], [(10, 5, 20, 20)])
        with open(os.path.join(folder, "manifest.json")) as f:
            manifest = json.load(f)
        manifest["capped"] = True
        with open(os.path.join(folder, "manifest.json"), "w") as f:
            json.dump(manifest, f)
        _, _, warnings = pack_sheet.build(folder)
        self.assertEqual(warnings, ["an animation is longer than RenderSwf's limit and was cut short"])

    def test_too_many_pictures_for_one_sheet_is_an_error(self):
        with self.assertRaises(ValueError):
            pack_sheet.pack([(3000, 3000), (3000, 3000)])

    def test_writes_webp_and_json(self):
        out = tempfile.mkdtemp(prefix="se-art-out-")
        pack_sheet.write(self.sheet, self.data, out)
        self.assertEqual(sorted(os.listdir(out)), ["99_test_unit.json", "99_test_unit.webp"])
        with Image.open(os.path.join(out, "99_test_unit.webp")) as image:
            self.assertEqual(image.size, self.sheet.size)
        with open(os.path.join(out, "99_test_unit.json")) as f:
            self.assertEqual(json.load(f), self.data)


@unittest.skipIf(Image is None, "needs Pillow")
class PreviewTest(unittest.TestCase):

    def test_plays_every_animation_around_one_anchor(self):
        folder = tempfile.mkdtemp(prefix="se-art-")
        make_render(folder, [{"labels": ["QUIETO"], "images": [0]},
                             {"labels": ["ATAQUE"], "images": [1, 0, 1]}],
                    [(10, 5, 20, 20), (12, 6, 16, 19)])
        sheet, data, _ = pack_sheet.build(folder)
        frames, duration = preview.render(data, sheet)
        self.assertEqual(len(frames), 3)  # the longest animation
        self.assertEqual(duration, 33)    # 30 frames a second
        # The idle picture (painted at 10..30 x 5..25, origin 20,25) sits at the
        # same place relative to the cross in every frame.
        pics = preview.pictures(data, sheet)
        self.assertEqual(pics["99_test_unit/0"][1], (10 - 20, 5 - 25))
        self.assertEqual(pics["99_test_unit/1"][1], (12 - 20, 6 - 25))
        self.assertEqual(preview.layout(data), [("QUIETO", ["QUIETO/0"]), ("ATAQUE", ["ATAQUE/0"])])


if __name__ == "__main__":
    unittest.main()
