import assert from "node:assert/strict";
import { test } from "node:test";

import { maskFrom, opaqueIn } from "./onChip.ts";

test("a page let go keeps where it's see-through, at half size, for taps", () => {
  // A 4 x 2 page drawn at half size: 2 x 1 blocks, the first faint (one pixel of four at the old limit), the second empty.
  const half = new Uint8ClampedArray([0, 0, 0, 8, 0, 0, 0, 7]);
  const mask = maskFrom(half, 2, 1);
  assert.equal(opaqueIn(mask, 0, 0), true);
  assert.equal(opaqueIn(mask, 1, 1), true, "every pixel of the block");
  assert.equal(opaqueIn(mask, 2, 0), false, "too faint to count");
  assert.equal(opaqueIn(mask, 4, 0), false, "past the page");
  assert.equal(opaqueIn(mask, -1, 0), false);
});

test("a sheet's mask file is read by its red, white where the picture is, for a page at either size", () => {
  // 2 x 1, at half the page's size: white, then black.
  const file = new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 255]);
  const whole = maskFrom(file, 2, 1, { channel: 0, least: 128, cell: 2 });
  assert.deepEqual([opaqueIn(whole, 1, 1), opaqueIn(whole, 2, 0)], [true, false], "a page at its size: 2 pixels a bit");
  const half = maskFrom(file, 2, 1, { channel: 0, least: 128, cell: 1 });
  assert.deepEqual([opaqueIn(half, 0, 0), opaqueIn(half, 1, 0)], [true, false], "a page at half size: a pixel a bit");
});
