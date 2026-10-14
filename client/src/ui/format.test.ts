import assert from "node:assert/strict";
import { test } from "node:test";

import { duration } from "./format.ts";

test("times left read naturally, and never show less than is left", () => {
  assert.equal(duration(44.2), "45 s");
  assert.equal(duration(70), "1 min 10 s");
  assert.equal(duration(300), "5 min");
  assert.equal(duration(3600), "1 h");
  assert.equal(duration(2 * 3600 + 12 * 60 + 5), "2 h 13 min");
  assert.equal(duration(28 * 3600), "1 day 4 h");
  assert.equal(duration(48 * 3600), "2 days");
});
