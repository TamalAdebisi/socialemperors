import assert from "node:assert/strict";
import { test } from "node:test";
import type { Container } from "pixi.js";
import { Camera } from "./camera.ts";

function camera() {
  const world = { scale: { set() {} }, position: { set() {} } } as unknown as Container;
  const c = new Camera(world, { left: -10000, right: 10000, top: -10000, bottom: 10000 }, { x: 0, y: 0 });
  c.resize(1000, 800);
  c.lookAt({ x: 0, y: 0 });
  return c;
}

test("tutorial camera pans through intermediate positions and lands on the requested screen point", () => {
  const c = camera(), screen = { x: 380, y: 424 }, target = { x: 800, y: 600 };
  const start = c.toMap(screen);
  c.panTo(target, screen, 700);
  assert.deepEqual(c.toMap(screen), start, "no jump when the objective changes");
  c.update(350);
  const middle = c.toMap(screen);
  assert.ok(middle.x > start.x && middle.x < target.x);
  assert.ok(middle.y > start.y && middle.y < target.y);
  assert.equal(c.panning, true);
  c.update(350);
  assert.deepEqual(c.toMap(screen), target);
  assert.equal(c.panning, false);
});

test("reduced motion reaches the same destination without animation", () => {
  const c = camera(), screen = { x: 380, y: 424 }, target = { x: 800, y: 600 };
  c.panTo(target, screen, 0);
  assert.deepEqual(c.toMap(screen), target);
  assert.equal(c.panning, false);
});
