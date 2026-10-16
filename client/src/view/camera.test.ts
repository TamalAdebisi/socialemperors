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

function pointer(c: Camera) {
  const listeners = new Map<string, (e: PointerEvent) => void>();
  const canvas = { style: {}, setPointerCapture() {},
    addEventListener(type: string, listen: (e: PointerEvent) => void) { listeners.set(type, listen); },
  } as unknown as HTMLCanvasElement;
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", { value: new EventTarget(), configurable: true });
  try {
    c.attach(canvas);
  } finally {
    if (previous) Object.defineProperty(globalThis, "window", previous);
    else Reflect.deleteProperty(globalThis, "window");
  }
  return (type: string, timeStamp: number) => listeners.get(type)!({
    type, timeStamp, pointerId: 1, pointerType: "mouse", offsetX: 500, offsetY: 400,
  } as PointerEvent);
}

test("a short click survives a long delay in processing its release", (t) => {
  let now = 1000;
  t.mock.method(performance, "now", () => now);
  const c = camera(), send = pointer(c);
  const taps: number[] = [];
  c.onTap = (_at, _touch, time) => taps.push(time!);
  send("pointerdown", 1000);
  now = 3000;
  send("pointerup", 1122);
  assert.deepEqual(taps, [1122], "preserve the actual input time for double-click selection too");
});

test("a genuinely long press stays a long press even when its handlers run together", (t) => {
  t.mock.method(performance, "now", () => 3000);
  const c = camera(), send = pointer(c);
  let taps = 0;
  c.onTap = () => taps++;
  send("pointerdown", 1000);
  send("pointerup", 1700);
  assert.equal(taps, 0);
});

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
