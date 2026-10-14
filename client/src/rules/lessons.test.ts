import assert from "node:assert/strict";
import { test } from "node:test";

import { LAST_LESSON, lessonsNotStarted, skipLessons } from "./lessons.ts";

test("the lessons are offered in the first town until one is reported", () => {
  assert.equal(lessonsNotStarted(0, 0), true);
  assert.equal(lessonsNotStarted("0", 0), true);  // older saves keep it as text
  assert.equal(lessonsNotStarted(undefined, 0), true);
  assert.equal(lessonsNotStarted("3", 0), false);  // started in the classic game: carry on there
  assert.equal(lessonsNotStarted(15, 0), false);
  assert.equal(lessonsNotStarted(0, 1), false);  // never in a second town, as in the Flash client
});

test("skipping sends the Flash client's report of the last lesson", () => {
  assert.deepEqual(skipLessons(), { cmd: "complete_tutorial", args: [LAST_LESSON] });
  assert.equal(LAST_LESSON, 15);
});
