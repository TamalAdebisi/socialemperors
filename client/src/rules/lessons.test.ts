import assert from "node:assert/strict";
import { test } from "node:test";

import type { ItemInfo } from "./config.ts";
import {
  LAST_LESSON, LAST_STEP, STEPS, lessonsNotStarted, lessonsUnderWay, moves, pageOf, passes, resumeAt, skipLessons, stepReached,
} from "./lessons.ts";

function item(fields: Partial<ItemInfo>): ItemInfo {
  return { id: 1, name: "x", isUnit: false, art: "x", width: 1, height: 1, category: 1, subcategory: 0, flying: false, velocity: 0,
    capacity: 0, activation: 0, collect: 0, collectType: "", collectXp: 0, trains: 0, population: 0, unitsLimit: 0, cashCost: 0,
    cost: 0, costType: "g", facings: 1, production: null, inStore: 0, shopTab: 0, minLevel: 0, storeLevel: 0, displayOrder: 0,
    isNew: false, xp: 0, race: "h", life: 0, attack: 0, defense: 0, attackRange: 0, attackInterval: 0, size: 1, elevation: 1,
    groups: "", upgradesTo: 0, ...fields };
}

const HALL = item({ id: 26, subcategory: 135 });
const VILLAGER = item({ id: 500, isUnit: true, subcategory: 71 });
const TREE = item({ id: 70, subcategory: 125 });
const HOUSE = item({ id: 1, subcategory: 111 });
const KNIGHT = item({ id: 512, isUnit: true, subcategory: 79, attack: 10 });

test("the lessons are offered in the first town until one is reported", () => {
  assert.equal(lessonsNotStarted(0, 0), true);
  assert.equal(lessonsNotStarted("0", 0), true);  // older saves keep it as text
  assert.equal(lessonsNotStarted(undefined, 0), true);
  assert.equal(lessonsNotStarted("3", 0), false);
  assert.equal(lessonsNotStarted(15, 0), false);
  assert.equal(lessonsNotStarted(0, 1), false);  // never in a second town, as in the Flash client
});

test("skipping sends the Flash client's report of the first half; each step is reported", () => {
  assert.deepEqual(skipLessons(), { cmd: "complete_tutorial", args: [LAST_LESSON] });
  assert.deepEqual(stepReached(7), { cmd: "complete_tutorial", args: [7] });
  assert.equal(STEPS.length, LAST_STEP + 1, "steps 0 to 31");
});

test("each step waits for its own doing", () => {
  assert.ok(moves(0, { kind: "next" }));
  assert.ok(!moves(1, { kind: "selected", item: VILLAGER }));
  assert.ok(moves(1, { kind: "selected", item: HALL }));
  assert.ok(moves(2, { kind: "training", unit: VILLAGER }));
  assert.ok(moves(5, { kind: "harvest", resource: TREE }));
  assert.ok(moves(6, { kind: "felled", resource: TREE }));
  assert.ok(passes(7), "the wood is the player's as the tree falls");
  assert.ok(moves(10, { kind: "placed", item: HOUSE, x: 50, y: 50 }), "the house anywhere it fits");
  assert.ok(moves(11, { kind: "selected", item: KNIGHT }));
  assert.ok(moves(13, { kind: "death" }));
  assert.ok(moves(14, { kind: "next" }) && !moves(14, { kind: "death" }));
  assert.ok(!passes(16) && moves(16, { kind: "closed" }) && moves(21, { kind: "closed" }) && moves(29, { kind: "closed" }), "the goals read and closed");
  assert.ok(!passes(LAST_STEP), "the last step counts its trees");
  assert.equal(pageOf(0), "0 of 7");
  assert.equal(pageOf(13), "6 of 7");
  assert.equal(pageOf(20), "");
});

test("after a reload: carry on from the lesson's start; 15 alone is the first half done elsewhere", () => {
  assert.equal(resumeAt(3), 1);
  assert.equal(resumeAt(9), 8);
  assert.equal(resumeAt(13), 11);
  assert.equal(resumeAt(26), 20);
  assert.equal(resumeAt(31), 30);
  assert.equal(lessonsUnderWay(5, 0, null), true);
  assert.equal(lessonsUnderWay(15, 0, null), false);
  assert.equal(lessonsUnderWay(15, 0, 15), true);
  assert.equal(lessonsUnderWay(31, 0, 31), false, "over");
  assert.equal(lessonsUnderWay(5, 1, null), false);
});
