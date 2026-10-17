import assert from "node:assert/strict";
import { test } from "node:test";
import { Container, Rectangle, Sprite, Texture, TextureSource } from "pixi.js";

import { sheetPixel, unitHitDistance, visualScreenBox } from "./hit.ts";

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

function bullSprite(): Sprite {
  // The original Bull Gladiator sheet's first idle frame. Its common
  // canvas also fits the wide attack effects, far beyond this idle body.
  return new Sprite(new Texture({
    source: new TextureSource({ width: 4096, height: 4096 }),
    orig: new Rectangle(0, 0, 1060, 745),
    frame: new Rectangle(2434, 2938, 252, 460),
    trim: new Rectangle(403, 82, 252, 460),
    defaultAnchor: { x: 0.5, y: 505 / 745 },
  }));
}

test("Bull Gladiator's transparent export padding cannot catch clicks meant for the map", () => {
  const picture = bullSprite();
  picture.position.set(600, 550);
  const box = visualScreenBox(picture);
  assert.deepEqual(box, { x: 473, y: 127, width: 252, height: 460 });
  assert.equal(picture.getBounds().width, 1060, "the artwork keeps its original canvas");
  const ground = { x: 150, y: 400 };
  assert.ok(Number.isFinite(unitHitDistance(picture.getBounds(), ground)), "reproduce the old oversized target");
  assert.equal(unitHitDistance(box, ground), Infinity);
  assert.ok(Number.isFinite(unitHitDistance(box, { x: box.x - 7, y: box.y + box.height / 2 })),
    "the usual eight-pixel margin stays beside the visible picture");
  assert.equal(unitHitDistance(box, { x: box.x - 9, y: box.y + box.height / 2 }), Infinity);
});

test("trimmed hit boxes follow parent zoom, mirror, position and current animation frame", () => {
  const root = new Container();
  root.position.set(800, 300);
  root.scale.set(0.5);
  const picture = root.addChild(bullSprite());
  picture.position.set(100, 200);
  picture.scale.x = -1;
  assert.deepEqual(visualScreenBox(picture), { x: 787.5, y: 188.5, width: 126, height: 230 });
  picture.texture = new Texture({
    source: picture.texture.source,
    orig: picture.texture.orig,
    frame: new Rectangle(1139, 2938, 251, 463),
    trim: new Rectangle(404, 79, 251, 463),
  });
  assert.deepEqual(visualScreenBox(picture), { x: 787.5, y: 187, width: 125.5, height: 231.5 });
  root.position.x += 30;
  assert.equal(visualScreenBox(picture).x, 817.5, "moving the camera cannot leave a stale hit box");
});

test("trimmed hit boxes account for rotation and keep tiny units accessible at low zoom", () => {
  const picture = bullSprite();
  picture.rotation = Math.PI / 2;
  const rotated = visualScreenBox(picture);
  assert.ok(Math.abs(rotated.x + 37) < 1e-9);
  assert.ok(Math.abs(rotated.y + 127) < 1e-9);
  assert.ok(Math.abs(rotated.width - 460) < 1e-9);
  assert.ok(Math.abs(rotated.height - 252) < 1e-9);
  picture.rotation = 0;
  picture.scale.set(0.02);
  const small = visualScreenBox(picture);
  const centre = { x: small.x + small.width / 2, y: small.y + small.height / 2 };
  assert.ok(Number.isFinite(unitHitDistance(small, { x: centre.x - 21, y: centre.y })));
  assert.equal(unitHitDistance(small, { x: centre.x - 23, y: centre.y }), Infinity);
});

test("untrimmed pictures and missing-art outlines keep their normal bounds", () => {
  const picture = new Sprite(new Texture({
    source: new TextureSource({ width: 40, height: 30 }),
    defaultAnchor: { x: 0.5, y: 1 },
  }));
  picture.position.set(100, 200);
  const expected = { x: 80, y: 170, width: 40, height: 30 };
  assert.deepEqual(visualScreenBox(picture), expected);
  const outline = new Container();
  outline.addChild(picture);
  const box = visualScreenBox(outline);
  assert.deepEqual({ x: box.x, y: box.y, width: box.width, height: box.height }, expected);
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
