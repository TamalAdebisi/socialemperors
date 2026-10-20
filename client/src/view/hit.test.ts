import assert from "node:assert/strict";
import { test } from "node:test";
import { Container, Graphics, Rectangle, Sprite, Texture, TextureSource } from "pixi.js";

import { CULL_MARGIN, layerBox, nearBox, overlaps, seenOnLayer, sheetPixel, unitHitDistance, visualScreenBox } from "./hit.ts";

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

test("a picture's box on the map's layer, by sums, is where Pixi finds it on the screen", () => {
  // The camera (zoomed out, moved), the map's layer, a slot moved (a building being moved), the picture walked and mirrored.
  const world = new Container();
  world.position.set(-1234.5, 321);
  world.scale.set(0.37);
  const layer = world.addChild(new Container());
  const slot = layer.addChild(new Container());
  slot.position.set(54, -27);
  const picture = slot.addChild(bullSprite());
  for (const [x, y, mirrored] of [[100, 200, false], [-640.25, 77.5, true], [3000, 1500, false]] as const) {
    picture.position.set(x, y);
    picture.scale.x = mirrored ? -1 : 1;
    const box = layerBox(slot, picture);
    // From the layer to the screen: the camera's zoom and move.
    const onScreen = { x: box.x * 0.37 - 1234.5, y: box.y * 0.37 + 321, width: box.width * 0.37, height: box.height * 0.37 };
    const pixi = picture.getBounds();
    for (const [mine, theirs] of [[onScreen.x, pixi.x], [onScreen.y, pixi.y], [onScreen.width, pixi.width], [onScreen.height, pixi.height]]) {
      assert.ok(Math.abs(mine - theirs) < 1e-6, `${mine} vs ${theirs}`);
    }
  }
  // An item without art is drawn as an outline (a Graphics): its box too.
  const outline = slot.addChild(new Graphics().rect(-50, -30, 100, 60).fill(0xffffff));
  outline.position.set(10, 20);
  assert.deepEqual(layerBox(slot, outline), { x: 14, y: -37, width: 100, height: 60 });
});

test("near a box: inside it, or within the margin round it", () => {
  const box = { x: 10, y: 20, width: 30, height: 40 };
  assert.ok(nearBox(box, { x: 10, y: 60 }, 0));
  assert.ok(!nearBox(box, { x: 9, y: 30 }, 0));
  assert.ok(nearBox(box, { x: 9, y: 30 }, 1));
  assert.ok(!nearBox(box, { x: 25, y: 62.5 }, 2));
});

test("boxes overlap when they share some area, not when they only touch", () => {
  const box = { x: 0, y: 0, width: 10, height: 10 };
  assert.ok(overlaps(box, { x: 9, y: 9, width: 5, height: 5 }));
  assert.ok(overlaps(box, { x: -5, y: -5, width: 30, height: 30 }), "one inside the other");
  assert.ok(!overlaps(box, { x: 10, y: 0, width: 5, height: 5 }));
  assert.ok(!overlaps(box, { x: 0, y: -6, width: 5, height: 5 }));
});

test("a turned picture's box holds all four of its corners", () => {
  const slot = new Container();
  const picture = slot.addChild(bullSprite());
  picture.rotation = Math.PI / 6;
  picture.position.set(40, -20);
  const box = layerBox(slot, picture);
  const pixi = picture.getBounds();
  for (const [mine, theirs] of [[box.x, pixi.x], [box.y, pixi.y], [box.width, pixi.width], [box.height, pixi.height]]) {
    assert.ok(Math.abs(mine - theirs) < 1e-6, `${mine} vs ${theirs}`);
  }
});

test("the screen on a layer of the map, with room round it, follows the camera's zoom and move", () => {
  const world = new Container();
  world.scale.set(0.5);
  world.position.set(-300, 40);
  const layer = world.addChild(new Container());
  // Screen pixels to the layer: (x + 300) / 0.5, (y - 40) / 0.5; the margin is in screen pixels.
  assert.deepEqual(seenOnLayer(layer, { width: 1280, height: 800 }),
    { x: (-CULL_MARGIN + 300) / 0.5, y: (-CULL_MARGIN - 40) / 0.5, width: (1280 + 2 * CULL_MARGIN) / 0.5, height: (800 + 2 * CULL_MARGIN) / 0.5 });
});
