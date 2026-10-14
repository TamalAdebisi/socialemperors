import assert from "node:assert/strict";
import { test } from "node:test";

import { duration, short } from "./format.ts";

test("times left read naturally, and never show less than is left", () => {
  assert.equal(duration(44.2), "45 s");
  assert.equal(duration(70), "1 min 10 s");
  assert.equal(duration(300), "5 min");
  assert.equal(duration(3600), "1 h");
  assert.equal(duration(2 * 3600 + 12 * 60 + 5), "2 h 13 min");
  assert.equal(duration(28 * 3600), "1 day 4 h");
  assert.equal(duration(48 * 3600), "2 days");
});

test("short numbers fit a phone's status bar", () => {
  assert.equal(short(940), "940");
  assert.equal(short(12_450), "12.4k");
  assert.equal(short(3_899), "3.8k");
  assert.equal(short(250_000), "250k");
  assert.equal(short(1_260_000), "1.2M");
});
