import assert from "node:assert/strict";
import { test } from "node:test";

import { MOST_FRAMES, fastDrawing, lightArt, setFastDrawing, setLightArt, touchScreen } from "./drawing.ts";

// A file of its own: drawing.ts remembers this page's choices, and these tests start with none.
const globals = globalThis as unknown as {
  window: { devicePixelRatio?: number };
  localStorage: Pick<Storage, "getItem" | "setItem">;
  matchMedia: (query: string) => { matches: boolean };
};

function device(kind: "phone" | "laptop", memory?: number): Map<string, string> {
  const storage = new Map<string, string>();
  globals.window = { devicePixelRatio: kind === "phone" ? 3 : 2 };
  globals.localStorage = { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => void storage.set(key, value) };
  globals.matchMedia = (query) => ({ matches: kind === "phone" ? query === "(pointer: coarse)" : query === "(hover: hover)" });
  Object.defineProperty(globalThis, "navigator", { value: { deviceMemory: memory }, configurable: true });
  return storage;
}

test("a phone draws fast and keeps big units light, unless told otherwise", () => {
  device("phone");
  assert.equal(touchScreen(), true);
  assert.equal(fastDrawing(), true);
  assert.equal(lightArt(), true);
});

test("a laptop draws sharp; light art is for the budget to decide, or a small memory", () => {
  device("laptop", 8);
  assert.equal(touchScreen(), false);
  assert.equal(fastDrawing(), false);
  assert.equal(lightArt(), null);
  device("laptop", 4);
  assert.equal(lightArt(), true, "4 GB or less");
});

test("the Menu's choices hold over the defaults, and are remembered", () => {
  const storage = device("phone");
  setFastDrawing(false);
  setLightArt(false);
  assert.equal(fastDrawing(), false);
  assert.equal(lightArt(), false);
  assert.deepEqual([storage.get("se-fast-drawing"), storage.get("se-light-art")], ["off", "off"]);
  setLightArt(true);
  device("laptop", 16);
  assert.equal(lightArt(), true, "chosen on this page");
});

test("at most 60 drawings a second, a little over so a 60 Hz screen keeps every frame", () => {
  // PixiJS skips a frame when the gap, rounded down to whole milliseconds, is under 1000 / maxFPS.
  const gap = Math.floor(1000 / 60);
  assert.ok(gap >= 1000 / MOST_FRAMES, "a 60 Hz frame is drawn");
  assert.ok(Math.floor(1000 / 120) < 1000 / MOST_FRAMES, "a 120 Hz screen's every other frame is skipped");
});
