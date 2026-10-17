import assert from "node:assert/strict";
import { test } from "node:test";
import type { Texture } from "pixi.js";
import type { ItemInfo } from "../rules/config.ts";
import type { ArtLibrary } from "./art.ts";
import { unitPreview } from "./unitPreview.ts";

test("a preview draws an earlier first RAF timestamp, advances and cancels when stopped", async (t) => {
  const callbacks = new Map<number, FrameRequestCallback>();
  const cancelled: number[] = [];
  const restoreGlobals: (() => void)[] = [];
  let stop = () => {};
  t.after(() => {
    try { stop(); }
    finally { for (const restore of restoreGlobals) restore(); }
  });
  let nextFrame = 0;
  const globals = {
    devicePixelRatio: 1,
    requestAnimationFrame(callback: FrameRequestCallback) {
      callbacks.set(++nextFrame, callback);
      return nextFrame;
    },
    cancelAnimationFrame(frame: number) {
      cancelled.push(frame);
      callbacks.delete(frame);
    },
  };
  for (const [name, value] of Object.entries(globals)) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
    restoreGlobals.push(() => {
      if (previous) Object.defineProperty(globalThis, name, previous);
      else Reflect.deleteProperty(globalThis, name);
    });
  }
  t.mock.method(performance, "now", () => 1000);

  const walking = [{ name: "walking first" }, { name: "walking second" }];
  const attacking = [{ name: "attacking first" }, { name: "attacking second" }];
  const special = [{ name: "special first" }, { name: "special second" }];
  const texture = (resource: object) => ({
    orig: { width: 20, height: 10 }, frame: { x: 0, y: 0, width: 20, height: 10 },
    source: { resource, resolution: 1 },
  } as unknown as Texture);
  const runs = new Map([[1, walking.map(texture)], [2, attacking.map(texture)], [6, special.map(texture)]]);
  const sheet = { fps: 2, numbered: (number: number) => runs.get(number) };
  const art = { get: async () => sheet } as unknown as ArtLibrary;
  const drawn: object[] = [];
  const context = { clearRect() {}, drawImage(source: object) { drawn.push(source); } };
  const canvas = {
    clientWidth: 140, clientHeight: 100, isConnected: true, getContext: () => context,
  } as unknown as HTMLCanvasElement;
  stop = unitPreview(art, { art: "preview-test" } as ItemInfo, canvas, () => true);
  await Promise.resolve();

  const draw = (timestamp: number) => {
    assert.equal(callbacks.size, 1, "only the next preview frame is pending");
    const [id, callback] = callbacks.entries().next().value!;
    callbacks.delete(id);
    callback(timestamp);
  };
  // RAF's frame timestamp can precede performance.now() at setup.
  draw(999);
  assert.deepEqual(drawn, [walking[0]], "the earlier frame draws the first walking pose");
  draw(1500);
  assert.deepEqual(drawn, [walking[0], walking[1]], "the preview advances within the walking animation");
  draw(4000);
  assert.deepEqual(drawn, [walking[0], walking[1], attacking[0]], "the preview reaches its next animation");

  const [pending, callback] = callbacks.entries().next().value!;
  stop();
  assert.deepEqual(cancelled, [pending]);
  assert.equal(callbacks.size, 0, "stopping cancels the pending frame");
  callback(4500);
  assert.equal(drawn.length, 3, "a stopped callback cannot draw or reschedule");
  assert.equal(callbacks.size, 0);
});
