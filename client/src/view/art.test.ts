import assert from "node:assert/strict";
import { test } from "node:test";
import type { Texture } from "pixi.js";
import { ItemArt, packShelves, planCopy, type SheetJson } from "./art.ts";

/** A sheet's animations as the exporter lists them: each label's frames in order, one picture per frame. */
function sheet(labels: [string, number][]): ItemArt {
  const animations = new Map<string, Texture[]>();
  for (const [label, frames] of labels) {
    for (let n = 0; n < frames; n++) {
      animations.set(`${label}/${n}`, [{ name: `${label}/${n}` } as unknown as Texture]);
    }
  }
  return new ItemArt("test", 30, animations, {});
}

const shown = (art: ItemArt, animation: number, way: number) =>
  art.pose(animation, way).map((texture) => (texture as unknown as { name: string }).name);

test("a newer dragon's poses are found by number, whatever their labels", () => {
  // 2228_redDjinnDragonRider, as its Flash file labels it.
  const djinn = sheet([["RESPIRAR", 5], ["ANDAR", 5], ["ATACAR", 5], ["MUERTE", 15],
    ["ESPECIAL1", 5], ["ESPECIAL2", 5], ["ESPECIAL3", 5], ["LIMIT ATTACK", 5]]);
  assert.deepEqual(shown(djinn, 0, 2), ["RESPIRAR/2"], "standing");
  assert.deepEqual(shown(djinn, 1, 4), ["ANDAR/4"], "walking");
  assert.deepEqual(shown(djinn, 2, 0), ["ATACAR/0"], "attacking");
  assert.deepEqual(shown(djinn, 3, 3), ["MUERTE/3"], "dying");
  assert.deepEqual(shown(djinn, 6, 1), ["ESPECIAL1/1"], "its first special move");

  // 2241_savageDragon and 2336_cerberusAncientDragon: other words again.
  const savage = sheet([["quietorl", 5], ["volandorl", 5], ["atacandorl", 5], ["muertorl", 35]]);
  assert.deepEqual(shown(savage, 0, 0), ["quietorl/0"]);
  assert.deepEqual(shown(savage, 1, 0), ["volandorl/0"]);
});

test("an older unit's poses are the ones its labels name", () => {
  const knight = sheet([["QUIETO", 5], ["ANDAR", 5], ["ATAQUE", 5], ["MUERTE", 5], ["PICAR", 10]]);
  assert.deepEqual(shown(knight, 0, 3), ["QUIETO/3"]);
  assert.deepEqual(shown(knight, 2, 1), ["ATAQUE/1"]);
  assert.deepEqual(shown(knight, 4, 2), ["PICAR/2"], "a villager picking at a rock");
  // The Golden Dragon Rider walks under "ANDAR CERCA": by label it couldn't walk.
  const golden = sheet([["QUIETO", 5], ["ANDAR CERCA", 5], ["ATAQUE", 5], ["MUERTE", 15]]);
  assert.deepEqual(shown(golden, 1, 4), ["ANDAR CERCA/4"]);
});

test("a pose the sheet hasn't got stands that way, or shows the first picture", () => {
  const short = sheet([["QUIETO", 5], ["ANDAR", 5], ["ATAQUE", 5], ["MUERTE", 5]]);
  assert.deepEqual(shown(short, 4, 3), ["QUIETO/3"], "no picking: it stands");
  // An egg: two unlabelled frames, nothing for the other ways.
  const egg = sheet([["frame", 2]]);
  assert.deepEqual(shown(egg, 0, 1), ["frame/1"]);
  assert.deepEqual(shown(egg, 1, 3), ["frame/0"]);
  assert.deepEqual(shown(sheet([]), 0, 0), [], "no pictures at all");
});

test("big units' town pictures are packed as the exporter packs them", () => {
  // The answers of tools/art/pack_sheet.py's pack() for the same boxes.
  const three = packShelves([{ w: 10, h: 20 }, { w: 30, h: 5 }, { w: 8, h: 20 }]);
  assert.deepEqual(three.places, [{ page: 0, x: 1, y: 1 }, { page: 0, x: 1, y: 23 }, { page: 0, x: 13, y: 1 }]);
  assert.deepEqual(three.pages, [{ w: 32, h: 29 }]);
  const big = packShelves([{ w: 3000, h: 2000 }, { w: 3000, h: 2000 }, { w: 3000, h: 2000 }]);
  assert.deepEqual(big.places, [{ page: 0, x: 1, y: 1 }, { page: 0, x: 1, y: 2003 }, { page: 1, x: 1, y: 1 }]);
  assert.deepEqual(big.pages, [{ w: 3002, h: 4004 }, { w: 3002, h: 2002 }], "a second page when the first is full");
  assert.throws(() => packShelves([{ w: 4095, h: 10 }]), /bigger than a 4096 x 4096 page/);
});

/** A big unit's sheet: `moves` animations of 5 ways, a picture each, `perPage` pictures a page. */
function bigSheet(moves: number, perPage: number): SheetJson[] {
  const pictures = Array.from({ length: moves * 5 }, (_, i) => `big/${i}`);
  const pages: SheetJson[] = [];
  for (let start = 0; start < pictures.length; start += perPage) {
    const frames = Object.fromEntries(pictures.slice(start, start + perPage).map((name, i) => [name,
      { frame: { x: 10 * i, y: 0, w: 9, h: 7 }, sourceSize: { w: 20, h: 20 }, spriteSourceSize: { x: 1, y: 2, w: 9, h: 7 } }]));
    pages.push({ frames, meta: { image: `big-${pages.length}.webp`, scale: "1", size: { w: 100, h: 7 } } } as SheetJson);
  }
  pages[0].animations = Object.fromEntries(pictures.map((name, i) => [`RUN${Math.floor(i / 5)}/${i % 5}`, [name]]));
  return pages;
}

test("a big unit's copy keeps the moves asked for, every run in its place", () => {
  // 8 animations (40 pictures), 10 a page: page 0 is standing and walking, page 1 attacking and dying...
  const pages = bigSheet(8, 10);
  const town = planCopy(pages, [0, 1], 1);
  assert.equal(town.runs.length, 40, "every run, so the moves keep their numbers");
  assert.deepEqual(town.runs[7], ["RUN1/2", ["big/7"]]);
  assert.deepEqual(town.runs[10], ["RUN2/0", []], "attacking left out");
  assert.deepEqual(town.whole, [0], "a page of nothing but standing and walking is used as it is");
  assert.deepEqual(town.cut, []);

  const fight = planCopy(pages, [0, 1, 2, 3, 6], 1);
  assert.deepEqual(fight.whole, [0, 1]);
  assert.deepEqual(fight.cut.map(({ page, frame }) => `${page} ${frame}`), ["3 big/30", "3 big/31", "3 big/32", "3 big/33", "3 big/34"],
    "the special move is cut out of its page, which holds another");
  assert.deepEqual(fight.runs[35], ["RUN7/0", []], "the other move on that page left out");

  // Nearly all of a sheet: its pages as they are, every run they hold kept.
  const most = planCopy(pages, [0, 1, 2, 3, 4, 5, 6], 1);
  assert.deepEqual(most.whole, [0, 1, 2, 3]);
  assert.deepEqual(most.cut, []);
  assert.deepEqual(most.runs[35], ["RUN7/0", ["big/35"]], "a move not asked for, on a page used as it is");
});

test("at half size, every picture asked for is cut out, half as big", () => {
  const pages = bigSheet(4, 10);
  const half = planCopy(pages, [0, 1], 2);
  assert.deepEqual(half.whole, []);
  assert.equal(half.cut.length, 10);
  assert.deepEqual(half.packed.places.slice(0, 2), [{ page: 0, x: 1, y: 1 }, { page: 0, x: 8, y: 1 }], "5 x 4 pictures for 9 x 7");
  assert.throws(() => planCopy(pages.slice(0, 1), [0, 1, 2], 1), /missing/, "a page the sheet has lost");
});

test("a sheet's pages in the graphics chip's format are used as they are, even at half size", () => {
  const pages = bigSheet(4, 10);
  // Page 0 (standing and walking) has a KTX2 file: its half-size copy serves light art.
  const half = planCopy(pages, [0, 1], 2, (n) => n === 0);
  assert.deepEqual(half.whole, [0]);
  assert.deepEqual(half.cut, []);
  // Every move (a whole sheet of several pages): every page, as it is.
  const whole = planCopy(pages, null, 1);
  assert.deepEqual(whole.whole, [0, 1]);
  assert.equal(whole.runs.every(([, frames]) => frames.length === 1), true);
});
