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
import unittest.mock

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
        frames = [{"labels": ["QUIETO"], "images": [0], "bounds": {"x": -20, "y": -25, "w": 40, "h": 30}},
                  {"labels": [], "images": [1]},
                  {"labels": ["ATAQUE"], "images": [2, 2, 3]},
                  {"labels": [], "images": [3]},
                  {"labels": ["PICAR"], "images": [4]}]
        make_render(self.folder, frames, [(10, 5, 20, 20), (12, 6, 16, 19), (5, 1, 30, 24), (0, 10, 8, 8), None])
        sheets, pages, self.warnings = pack_sheet.build(self.folder)
        self.assertEqual(len(pages), 1)
        self.sheet, self.data = sheets[0], pages[0]
        self.image = self.sheet.image()

    def test_animations_are_named_by_label_and_direction(self):
        self.assertEqual(list(self.data["animations"]),
                         ["QUIETO/0", "QUIETO/1", "ATAQUE/0", "ATAQUE/1", "PICAR/0"])
        self.assertEqual(self.data["animations"]["ATAQUE/0"],
                         ["99_test_unit/2", "99_test_unit/2", "99_test_unit/3"])

    def test_a_label_used_twice_keeps_both_animations_and_their_bounds(self):
        # 2023_frostfire_bahamut labels frame 10 ATAQUE and frame 30 ATAQUE
        # again; the second wrote over the first, and every box after it
        # went to the wrong frame.
        box = lambda n: {"x": n, "y": 0, "w": 1, "h": 1}
        frames = [{"labels": ["QUIETO"], "images": [0], "bounds": box(0)},
                  {"labels": ["ATAQUE"], "images": [1], "bounds": box(1)},
                  {"labels": ["ATAQUE"], "images": [2], "bounds": box(2)},
                  {"labels": [], "images": [3], "bounds": box(3)},
                  {"labels": ["RAY"], "images": [4], "bounds": box(4)}]
        folder = tempfile.mkdtemp(prefix="se-art-")
        make_render(folder, frames, [(0, 0, 4, 4)] * 5)
        data = pack_sheet.build(folder)[1][0]
        self.assertEqual(list(data["animations"]), ["QUIETO/0", "ATAQUE/0", "ATAQUE@2/0", "ATAQUE@2/1", "RAY/0"])
        self.assertEqual([frames[0] for frames in data["animations"].values()],
                         [f"99_test_unit/{n}" for n in range(5)], "every frame, in order")
        self.assertEqual(data["meta"]["bounds"], dict(zip(data["animations"], map(box, range(5)))))

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

    def test_flash_bounds_are_kept_per_animation(self):
        # Only the first frame has them here (manifests from before bounds have none).
        self.assertEqual(self.data["meta"]["bounds"], {"QUIETO/0": {"x": -20, "y": -25, "w": 40, "h": 30}})

    def test_an_empty_picture_becomes_one_transparent_pixel(self):
        frame = self.data["frames"]["99_test_unit/4"]
        self.assertEqual((frame["frame"]["w"], frame["frame"]["h"]), (1, 1))
        x, y = frame["frame"]["x"], frame["frame"]["y"]
        self.assertEqual(self.image.getpixel((x, y))[3], 0)

    def test_the_sheet_holds_each_picture_where_the_json_says(self):
        self.assertEqual(self.sheet.size, (self.data["meta"]["size"]["w"], self.data["meta"]["size"]["h"]))
        boxes = []
        for name, frame in self.data["frames"].items():
            f = frame["frame"]
            if f["w"] > 1:
                # Every pixel of a picture is the red we painted.
                self.assertEqual(self.image.crop((f["x"], f["y"], f["x"] + f["w"], f["y"] + f["h"])).getcolors(),
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

    def test_a_picture_bigger_than_a_sheet_is_an_error(self):
        with self.assertRaises(ValueError):
            pack_sheet.pack([(5000, 10)])

    def test_an_item_too_big_for_a_sheet_is_stored_at_half_size(self):
        # Picture 2 is 30 pixels wide: too wide for a 24-pixel sheet.
        sheets, pages, warnings = pack_sheet.build(self.folder, max_size=24)
        self.assertIn(f"pictures too big for {pack_sheet.UNIT_PAGES} sheets, stored at 1/2 size (meta.scale)", warnings)
        meta = pages[0]["meta"]
        self.assertEqual(meta["scale"], "0.5")
        self.assertEqual(meta["unit_pages"], pack_sheet.UNIT_PAGES, "a unit says under which budget it was stored smaller")
        frames = {name: frame for page in pages for name, frame in page["frames"].items()}
        attack = frames["99_test_unit/2"]  # drawn at (5, 1), 30 x 24: widened to (4, 0), 32 x 26
        self.assertEqual(attack["spriteSourceSize"], {"x": 2, "y": 0, "w": 16, "h": 13})
        self.assertEqual(attack["frame"]["w"], 16)
        self.assertEqual(attack["sourceSize"], {"w": 20, "h": 15})
        # PixiJS sizes the canvas as sourceSize / scale: the anchor lands on the origin.
        self.assertAlmostEqual(attack["anchor"]["x"] * 20 / 0.5, ORIGIN["x"], places=3)
        self.assertAlmostEqual(attack["anchor"]["y"] * 15 / 0.5, ORIGIN["y"], places=3)
        self.assertEqual(meta["bounds"]["QUIETO/0"], {"x": -20, "y": -25, "w": 40, "h": 30})  # the game's pixels
        # The picture itself is half size, still red.
        sheet = sheets[[n for n, page in enumerate(pages) if "99_test_unit/2" in page["frames"]][0]].image()
        f = attack["frame"]
        self.assertEqual(sheet.getpixel((f["x"] + 8, f["y"] + 6)), (255, 0, 0, 255))

    def test_an_item_over_its_pages_is_stored_smaller_then_choppier(self):
        # Room for very little: one 20 x 20 page.
        self.assertEqual(pack_sheet.plan([{"images": [0, 1, 2, 3]}], [(0, 0, 8, 8)] * 4, max_size=20, max_pages=1), (2, 1))
        self.assertEqual(pack_sheet.plan([{"images": [0, 1, 2, 3]}], [(0, 0, 16, 16)] * 4, max_size=20, max_pages=1), (2, 2))
        # Held 2 frames each: pictures 1, 2, 3, 4 become 1, 1, 3, 3.
        self.assertEqual(pack_sheet.decimate([{"images": [1, 2, 3, 4]}], 2), [{"images": [1, 1, 3, 3]}])
        sheets, pages, warnings = pack_sheet.build(self.folder, max_size=24, unit_pages=1)
        meta = pages[0]["meta"]
        self.assertGreater(meta["step"], 1)
        self.assertEqual(len(pages), 1)
        self.assertEqual(len(pages[0]["animations"]["ATAQUE/0"]), 3, "the animation keeps its length")
        names = {name for page in pages for name in page["frames"]}
        self.assertTrue(all(f in names for frames in pages[0]["animations"].values() for f in frames))

    def test_pages_can_be_short(self):
        # Three 10 x 10 pictures (with their gaps) fit on one 20 x 20 page, not one of 20 x 15.
        frames, boxes = [{"images": [0, 1, 2]}], [(0, 0, 8, 8)] * 3
        self.assertEqual(pack_sheet.plan(frames, boxes, max_size=20, max_pages=1), (1, 1))
        self.assertEqual(pack_sheet.plan(frames, boxes, max_size=20, max_pages=1, page_area=20 * 15), (2, 1))

    def test_pictures_that_dont_fit_go_on_more_pages(self):
        # Two 3000 x 3000 pictures can't share a 4096 x 4096 sheet.
        positions, pages = pack_sheet.pack([(3000, 3000), (3000, 3000), (10, 10)])
        self.assertEqual([page for page, _, _ in positions], [0, 1, 1])
        self.assertEqual(len(pages), 2)
        for w, h in pages:
            self.assertLessEqual(max(w, h), 4096)

    def test_a_multi_page_item_lists_its_pages_and_keeps_animations_on_the_first(self):
        sheets, pages, _ = pack_sheet.build(self.folder, max_size=34)  # room for about one picture a page
        self.assertGreater(len(pages), 1)
        self.assertEqual(pages[0]["meta"]["related_multi_packs"],
                         [f"99_test_unit-{n}.json" for n in range(1, len(pages))])
        self.assertEqual(pages[1]["meta"]["image"], "99_test_unit-1.m2.webp")
        self.assertNotIn("animations", pages[1])
        # Every picture is on exactly one page, and every animation's pictures exist.
        names = [name for page in pages for name in page["frames"]]
        self.assertEqual(sorted(names), sorted(f"99_test_unit/{n}" for n in range(5)))
        for sequence in pages[0]["animations"].values():
            self.assertTrue(set(sequence) <= set(names))
        for sheet, page in zip(sheets, pages):
            self.assertEqual(sheet.size, (page["meta"]["size"]["w"], page["meta"]["size"]["h"]))

    def test_a_multi_page_item_writes_its_first_json_last_and_leaves_no_half_files(self):
        sheets, pages, _ = pack_sheet.build(self.folder, max_size=34)
        out = tempfile.mkdtemp(prefix="se-art-out-")
        finished = []  # each file, as it gets its real name
        real_replace = os.replace
        def replace(source, target):
            finished.append(os.path.basename(target))
            real_replace(source, target)
        with unittest.mock.patch.object(pack_sheet.os, "replace", replace):
            pack_sheet.write(sheets, pages, out)
        files = os.listdir(out)
        self.assertFalse([f for f in files if f.endswith(".tmp")])
        self.assertEqual(sorted(finished), sorted(files))
        self.assertEqual(len([f for f in files if f.endswith(".webp")]), len(pages))
        self.assertEqual(len([f for f in files if f.endswith("-mask.png")]), len(pages), "each page's mask")
        self.assertFalse([f for f in files if f.endswith(".ktx2")], "KTX2 only when asked")
        # The first page's JSON is finished after everything else.
        self.assertEqual(finished[-1], "99_test_unit.json")

    def test_a_multi_page_item_names_its_files_by_what_they_show(self):
        sheets, pages, _ = pack_sheet.build(self.folder, max_size=34)
        out = tempfile.mkdtemp(prefix="se-art-names-")
        pack_sheet.write(sheets, pages, out)
        with open(os.path.join(out, "99_test_unit.json")) as f:
            first = json.load(f)
        self.assertRegex(first["meta"]["image"], r"^99_test_unit\.m2\.[0-9a-f]{12}\.webp$")
        self.assertTrue(pack_sheet.packed_now(first["meta"]["image"]))
        others = first["meta"]["related_multi_packs"]
        self.assertEqual(len(others), len(pages) - 1)
        for n, name in enumerate(others, 1):
            self.assertRegex(name, rf"^99_test_unit-{n}\.[0-9a-f]{{12}}\.json$")
            with open(os.path.join(out, name)) as f:
                page = json.load(f)
            self.assertRegex(page["meta"]["image"], rf"^99_test_unit-{n}\.m2\.[0-9a-f]{{12}}\.webp$")
            self.assertEqual(page["meta"]["mask"], page["meta"]["image"].replace(".webp", "-mask.png"))
            self.assertTrue(os.path.exists(os.path.join(out, page["meta"]["image"])))
        # Made again the same: the same names. Made again otherwise (here at half size): none of them.
        again = tempfile.mkdtemp(prefix="se-art-names-")
        pack_sheet.write(*pack_sheet.build(self.folder, max_size=34)[:2], again)
        self.assertEqual(sorted(os.listdir(again)), sorted(os.listdir(out)))
        smaller = tempfile.mkdtemp(prefix="se-art-names-")
        pack_sheet.write(*pack_sheet.build(self.folder, max_size=24)[:2], smaller)
        self.assertEqual(set(os.listdir(smaller)) & set(os.listdir(out)), {"99_test_unit.json"},
                         "only the first JSON keeps its name: no file the old one names is overwritten")

    def test_a_library_clip_is_split_into_one_item_per_frame(self):
        # The test item's five frames, as if each were a projectile.
        items = list(pack_sheet.split_frames(self.folder, "projectile"))
        self.assertEqual([manifest["name"] for manifest, _ in items],
                         ["projectile_1", "projectile_2", "projectile_3", "projectile_4", "projectile_5"])
        # The third frame showed pictures 2, 2, 3: now its own 0, 0, 1.
        manifest, paths = items[2]
        self.assertEqual(manifest["frames"][0]["images"], [0, 0, 1])
        self.assertEqual([os.path.basename(p) for p in paths], ["img_2.png", "img_3.png"])
        _, pages, _ = pack_sheet.build(self.folder, loaded=items[2])
        self.assertEqual(pages[0]["animations"], {"frame/0": ["projectile_3/0", "projectile_3/0", "projectile_3/1"]})
        self.assertEqual(pages[0]["meta"]["image"], "projectile_3.webp")

    def test_writes_webp_and_json(self):
        # One page: no mask, the names as before.
        self.assertNotIn("mask", self.data["meta"])
        self.assertEqual(self.data["meta"]["image"], "99_test_unit.webp")
        out = tempfile.mkdtemp(prefix="se-art-out-")
        pack_sheet.write([self.sheet], [self.data], out)
        self.assertEqual(sorted(os.listdir(out)), ["99_test_unit.json", "99_test_unit.webp"])
        with Image.open(os.path.join(out, "99_test_unit.webp")) as image:
            self.assertEqual(image.size, self.sheet.size)
        with open(os.path.join(out, "99_test_unit.json")) as f:
            self.assertEqual(json.load(f), self.data)


@unittest.skipIf(Image is None, "needs Pillow")
class MovesTest(unittest.TestCase):
    """A big unit, packed move by move: what the town shows first, then a fight, then each other move."""

    def setUp(self):
        self.folder = tempfile.mkdtemp(prefix="se-art-moves-")
        # Moves 0 to 6, 5 ways each, a picture a frame: picture 5m + way. Move 0's
        # first way also shows in the attack (move 2): it stays with the town's.
        labels = ["QUIETO", "ANDAR", "ATAQUE", "MUERTE", "PICAR", "MUERTE2", "SP1"]
        frames = []
        for move, label in enumerate(labels):
            for way in range(5):
                frames.append({"labels": [label] if way == 0 else [], "images": [5 * move + way]})
        frames[10]["images"] = [0, 10]
        make_render(self.folder, frames, [(1 + n % 7, 1, 30, 20) for n in range(35)])

    def test_a_big_unit_is_packed_move_by_move(self):
        # Pages of 64 x 48: four 30 x 20 pictures a page, so 10 pages; room for 20.
        sheets, pages, _ = pack_sheet.build(self.folder, max_size=64, unit_pages=20)
        page_of = {name: n for n, page in enumerate(pages) for name in page["frames"]}
        town = [page_of[f"99_test_unit/{n}"] for n in range(10)]
        fight = [page_of[f"99_test_unit/{n}"] for n in range(10, 20)]
        others = [[page_of[f"99_test_unit/{n}"] for n in range(5 * move, 5 * move + 5)] for move in (4, 5, 6)]
        self.assertLess(max(town), min(fight), "the town's pages first")
        self.assertLess(max(fight), min(others[0]), "then a fight's")
        self.assertLess(max(others[0]), min(others[1]), "then each other move, on pages of its own")
        self.assertLess(max(others[1]), min(others[2]))
        self.assertEqual(len(set(town)), 3, "four pictures a page")
        self.assertEqual(pages[0]["meta"]["scale"], "1", "more pages than other items may take, at the game's size")
        for sheet, page in zip(sheets, pages):
            w, h = sheet.size
            self.assertLessEqual(h, 48, "short pages: 3/4 as tall as wide")
            self.assertEqual(page["meta"]["image"].endswith(".m2.webp"), True)

    def test_an_item_that_isnt_a_unit_keeps_to_fewer_pages(self):
        # The same pictures without the game's labels (a building's): stored smaller to fit 4 pages.
        with open(os.path.join(self.folder, "manifest.json")) as f:
            manifest = json.load(f)
        for frame in manifest["frames"]:
            frame["labels"] = []
        with open(os.path.join(self.folder, "manifest.json"), "w") as f:
            json.dump(manifest, f)
        _, pages, warnings = pack_sheet.build(self.folder, max_size=64, unit_pages=20)
        self.assertEqual(pages[0]["meta"]["scale"], "0.5")
        self.assertNotIn("unit_pages", pages[0]["meta"])
        self.assertIn("pictures too big for 4 sheets, stored at 1/2 size (meta.scale)", warnings)

    def test_pages_are_whole_multiples_of_64(self):
        positions, pages = pack_sheet.pack_moves([(100, 50), (100, 50), (30, 30)], [0, 0, 1])
        self.assertEqual(pages, [(128, 128), (64, 64)], "102 x 104 and 32 x 32, rounded up")
        self.assertEqual([page for page, _, _ in positions], [0, 0, 1])

    def test_a_mask_says_where_a_page_is_see_through_at_half_size(self):
        image = Image.new("RGBA", (8, 4), (0, 0, 0, 0))
        image.putpixel((0, 0), (255, 0, 0, 32))  # one pixel of a 2 x 2 block at the client's limit: the block counts
        image.putpixel((4, 0), (255, 0, 0, 20))  # fainter: it doesn't
        mask = pack_sheet.mask(image)
        self.assertEqual((mask.mode, mask.size), ("1", (4, 2)))
        self.assertEqual([mask.getpixel((x, 0)) for x in range(4)], [255, 0, 0, 0])

    def test_colours_are_premultiplied_for_the_graphics_chip(self):
        image = Image.new("RGBA", (1, 1), (200, 100, 50, 128))
        self.assertEqual(pack_sheet.premultiplied(image).getpixel((0, 0)), (100, 50, 25, 128))

    @unittest.skipIf(not os.path.isdir(os.path.join(os.path.dirname(pack_sheet.KTX2), "node_modules", "ktx2-encoder")),
                     "needs the art tools' packages: npm ci --prefix tools/art")
    def test_ktx2_pages_made_side_by_side_are_the_same_files(self):
        written = []
        for jobs in (1, 3):
            sheets, pages, _ = pack_sheet.build(self.folder, max_size=64, unit_pages=20)
            out = tempfile.mkdtemp(prefix=f"se-art-jobs{jobs}-")
            with unittest.mock.patch.object(pack_sheet, "KTX2_JOBS", jobs), \
                 unittest.mock.patch.object(pack_sheet.Encodings.__init__, "__defaults__", (jobs,)):
                pack_sheet.write(sheets, pages, out, with_ktx2=True)
            files = {}
            for name in sorted(os.listdir(out)):
                with open(os.path.join(out, name), "rb") as f:
                    files[name] = f.read()
            written.append(files)
        self.assertEqual(written[0], written[1])
        self.assertEqual(len([name for name in written[0] if name.endswith(".ktx2")]), 2 * len(pages), "a full and a half KTX2 for each page")
        self.assertFalse([name for name in written[0] if name.endswith(".tmp")])

    @unittest.skipIf(not os.path.isdir(os.path.join(os.path.dirname(pack_sheet.KTX2), "node_modules", "ktx2-encoder")),
                     "needs the art tools' packages: npm ci --prefix tools/art")
    def test_a_big_unit_is_written_as_ktx2_too(self):
        sheets, pages, _ = pack_sheet.build(self.folder, max_size=64, unit_pages=20)
        out = tempfile.mkdtemp(prefix="se-art-ktx2-")
        pack_sheet.write(sheets, pages, out, with_ktx2=True)
        with open(os.path.join(out, "99_test_unit.json")) as f:
            first = json.load(f)
        page = first["meta"]["image"][:-len(".webp")]  # 99_test_unit.m2.<digest>
        self.assertEqual(first["meta"]["ktx2"], f"{page}.ktx2")
        self.assertEqual(first["meta"]["ktx2_half"], f"{page}.half.ktx2")
        self.assertEqual(first["meta"]["mask"], f"{page}-mask.png")
        w, h = first["meta"]["size"]["w"], first["meta"]["size"]["h"]
        # A KTX2 file: its 12-byte mark, then its format, its type's size, and its width and height.
        for name, size in [(f"{page}.ktx2", (w, h)), (f"{page}.half.ktx2", (w // 2, h // 2))]:
            with open(os.path.join(out, name), "rb") as f:
                head = f.read(28)
            self.assertEqual(head[:12], bytes([0xAB, 0x4B, 0x54, 0x58, 0x20, 0x32, 0x30, 0xBB, 0x0D, 0x0A, 0x1A, 0x0A]))
            self.assertEqual((int.from_bytes(head[20:24], "little"), int.from_bytes(head[24:28], "little")), size, name)


@unittest.skipIf(Image is None, "needs Pillow")
class OutdatedTest(unittest.TestCase):
    """Which sheets the art workflow's "Make big units again" makes again (pack_sheet.outdated)."""

    def first(self, image, scale="1", animations=("QUIETO/0",), pages=1, **meta):
        data = {"frames": {}, "animations": {name: [] for name in animations},
                "meta": {"image": image, "scale": scale, **meta}}
        if pages > 1:
            data["meta"]["related_multi_packs"] = [f"{image.split('.')[0]}-{n}.json" for n in range(1, pages)]
        return data

    def test_items_of_several_pages_packed_before(self):
        self.assertTrue(pack_sheet.outdated(self.first("x.webp", pages=3)))
        self.assertTrue(pack_sheet.outdated(self.first("x.moves.webp", pages=3)))
        self.assertFalse(pack_sheet.outdated(self.first(f"x.{pack_sheet.PAGES_MARK}.webp", pages=3)))

    def test_units_stored_smaller_under_a_smaller_budget(self):
        m2 = f"x.{pack_sheet.PAGES_MARK}.webp"
        self.assertTrue(pack_sheet.outdated(self.first(m2, "0.5", pages=11)), "before the budget was recorded")
        self.assertTrue(pack_sheet.outdated(self.first(m2, "0.5", pages=11, unit_pages=24)))
        self.assertFalse(pack_sheet.outdated(self.first(m2, "0.5", pages=11, unit_pages=pack_sheet.UNIT_PAGES)),
                         "stored smaller under today's budget: it would come out the same")
        self.assertTrue(pack_sheet.outdated(self.first("x.webp", "0.5")), "a unit of one page, stored smaller")
        self.assertFalse(pack_sheet.outdated(self.first("x.webp")))

    def test_other_items_stored_smaller_stay(self):
        # A building or a decoration (its pictures' names aren't the game's labels) keeps its 4 pages.
        self.assertFalse(pack_sheet.outdated(self.first(f"x.{pack_sheet.PAGES_MARK}.webp", "0.5", ["frame/0"], pages=4)))
        self.assertFalse(pack_sheet.outdated(self.first("x.webp", "0.25", ["frame/0", "steps/0"])))

    def test_a_folder_lists_its_items_to_make_again(self):
        folder = tempfile.mkdtemp(prefix="se-art-outdated-")
        m2 = pack_sheet.PAGES_MARK
        page = lambda image, scale="1": {"frames": {}, "meta": {"image": image, "scale": scale}}
        sheets = {"old.json": self.first("old.webp", pages=2), "old-1.json": page("old-1.webp"),
                  "new.json": self.first(f"new.{m2}.webp", pages=2), "new-1.json": page(f"new-1.{m2}.webp"),
                  # Its second page's JSON is still the old packing's (an upload by size kept it): made again.
                  "mixed.json": self.first(f"mixed.{m2}.webp", pages=2), "mixed-1.json": page("mixed-1.moves.webp", "0.5"),
                  "lost.json": self.first(f"lost.{m2}.webp", pages=2),  # its second page's JSON is missing
                  "small.json": self.first("small.webp", "0.5"), "deco.json": self.first("deco.webp", "0.5", ["frame/0"])}
        for name, data in sheets.items():
            with open(os.path.join(folder, name), "w") as f:
                json.dump(data, f)
        with open(os.path.join(folder, "broken.json"), "w") as f:
            f.write('{"frames":')  # half a file: made again
        with open(os.path.join(folder, "old.webp"), "wb") as f:
            f.write(b"RIFF")
        self.assertEqual(list(pack_sheet.outdated_items(folder)), ["broken", "lost", "mixed", "old", "small"])
        with unittest.mock.patch("sys.stdout") as out:
            self.assertEqual(pack_sheet.main(["--outdated", folder]), 0)
        self.assertEqual("".join(call.args[0] for call in out.write.call_args_list), "broken\nlost\nmixed\nold\nsmall\n")


@unittest.skipIf(Image is None, "needs Pillow")
class PreviewTest(unittest.TestCase):

    def test_plays_every_animation_around_one_anchor(self):
        folder = tempfile.mkdtemp(prefix="se-art-")
        make_render(folder, [{"labels": ["QUIETO"], "images": [0]},
                             {"labels": ["ATAQUE"], "images": [1, 0, 1]}],
                    [(10, 5, 20, 20), (12, 6, 16, 19)])
        sheets, pages, _ = pack_sheet.build(folder)
        sheets = [sheet.image() for sheet in sheets]
        frames, duration = preview.render(pages, sheets)
        self.assertEqual(len(frames), 3)  # the longest animation
        self.assertEqual(duration, 33)    # 30 frames a second
        # The idle picture (painted at 10..30 x 5..25, origin 20,25) sits at the
        # same place relative to the cross in every frame.
        pics = preview.pictures(pages, sheets)
        self.assertEqual(pics["99_test_unit/0"][1], (10 - 20, 5 - 25))
        self.assertEqual(pics["99_test_unit/1"][1], (12 - 20, 6 - 25))
        self.assertEqual(preview.layout(pages[0]), [("QUIETO", ["QUIETO/0"]), ("ATAQUE", ["ATAQUE/0"])])


if __name__ == "__main__":
    unittest.main()
