import assert from "node:assert/strict";
import { test } from "node:test";

import { denseScreen, drawingResolution, fastDrawing, setFastDrawing } from "./drawing.ts";

const globals = globalThis as unknown as { window: { devicePixelRatio?: number }; localStorage: Pick<Storage, "getItem" | "setItem"> };

function browser(devicePixelRatio: number | undefined, storage: Map<string, string> | null): void {
  globals.window = { devicePixelRatio };
  // A computer: a mouse, which hovers (a touch screen draws fast unless told: drawingDefaults.test.ts).
  (globalThis as unknown as { matchMedia: (query: string) => { matches: boolean } }).matchMedia =
    (query) => ({ matches: query === "(hover: hover)" });
  globals.localStorage = storage === null
    ? { getItem: () => { throw new Error("refused"); }, setItem: () => { throw new Error("refused"); } }
    : { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => void storage.set(key, value) };
}

test("sharp unless fast drawing is chosen: the screen's own pixels, up to 2", () => {
  browser(3, new Map());
  assert.equal(fastDrawing(), false);
  assert.equal(drawingResolution(), 2);
  browser(1.5, new Map());
  assert.equal(drawingResolution(), 1.5);
  browser(undefined, new Map());
  assert.equal(drawingResolution(), 1);
  assert.equal(denseScreen(), false);
});

test("fast drawing: one for one, remembered in the browser", () => {
  const storage = new Map<string, string>();
  browser(2, storage);
  assert.equal(denseScreen(), true);
  setFastDrawing(true);
  assert.equal(storage.get("se-fast-drawing"), "on");
  assert.equal(drawingResolution(), 1);
  setFastDrawing(false);
  assert.equal(drawingResolution(), 2);
});

test("storage refused (a private window): sharp, and a switch holds for the page", () => {
  browser(2, null);
  assert.equal(fastDrawing(), false);  // the choice above, off
  setFastDrawing(true);
  assert.equal(drawingResolution(), 1);
});
