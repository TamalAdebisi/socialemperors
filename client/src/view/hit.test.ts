import assert from "node:assert/strict";
import { test } from "node:test";

import { sheetPixel, unitHitDistance } from "./hit.ts";

test("a small unit keeps a 44px target, with gaps and near misses selectable", () => {
  const tiny = { x: 100, y: 100, width: 10, height: 16 };
  assert.ok(Number.isFinite(unitHitDistance(tiny, { x: 84, y: 108 })));
  assert.equal(unitHitDistance(tiny, { x: 82, y: 108 }), Infinity);
  assert.equal(unitHitDistance(tiny, { x: 105, y: 108 }), 0);
  const big = { x: 100, y: 100, width: 60, height: 80 };
  assert.ok(Number.isFinite(unitHitDistance(big, { x: 167, y: 140 })));
  assert.equal(unitHitDistance(big, { x: 169, y: 140 }), Infinity);
  assert.equal(unitHitDistance({ ...tiny, width: 0 }, { x: 100, y: 100 }), Infinity);
});

// A 100 x 80 picture, anchored at its bottom middle, packed with its
// see-through border trimmed: only the 40 x 30 part at (20, 45) is kept,
// and it's at (300, 200) in the sheet.
const anchor = { x: 0.5, y: 1 };
const orig = { x: 0, y: 0, width: 100, height: 80 };
const trim = { x: 20, y: 45, width: 40, height: 30 };
const frame = { x: 300, y: 200, width: 40, height: 30 };

test("a point of the picture finds its pixel in the sheet", () => {
  // The anchor is (50, 80) of the picture; 10 left and 20 up is (40, 60),
  // which is (20, 15) of the kept part.
  assert.deepEqual(sheetPixel({ x: -10, y: -20 }, anchor, orig, trim, frame), { x: 320, y: 215 });
  // The kept part's first pixel.
  assert.deepEqual(sheetPixel({ x: -30, y: -35 }, anchor, orig, trim, frame), { x: 300, y: 200 });
});

test("points in the trimmed border are see-through", () => {
  assert.equal(sheetPixel({ x: -40, y: -20 }, anchor, orig, trim, frame), null);  // left of the kept part
  assert.equal(sheetPixel({ x: 0, y: -2 }, anchor, orig, trim, frame), null);     // below it
  assert.equal(sheetPixel({ x: 10, y: -20 }, anchor, orig, trim, frame), null);   // just past its right edge
});

test("an untrimmed picture is its frame", () => {
  const whole = { x: 0, y: 0, width: 40, height: 30 };
  assert.deepEqual(sheetPixel({ x: 0, y: 0 }, { x: 0, y: 0 }, whole, null, { ...whole, x: 8, y: 8 }), { x: 8, y: 8 });
});

test("a sheet stored at half size finds its pixel at half the place", () => {
  // The same picture, its numbers in the game's pixels as PixiJS gives them;
  // the sheet holds it at half size, so (320, 215) is (160, 107) there.
  assert.deepEqual(sheetPixel({ x: -10, y: -20 }, anchor, orig, trim, frame, 0.5), { x: 160, y: 107 });
});
