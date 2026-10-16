import assert from "node:assert/strict";
import { test } from "node:test";

import type { ItemInfo } from "./config.ts";
import {
  LAST_STEP, STEPS, tutorialStart, moves, pageOf, passes, resumeAt, stepReached,
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

test("fresh, partially completed and old skipped tutorials must finish", () => {
  for (const progress of [0, "0", undefined, 3, 15, 31]) assert.notEqual(tutorialStart(progress, 0, {}, false, false), null);
  assert.equal(tutorialStart(0, 1, {}, false, false), null);
  assert.equal(tutorialStart(31, 0, {}, true, true), null);
  assert.equal(tutorialStart(31, 0, {}, true, false), 32);
  assert.equal(tutorialStart(33, 0, {}, false, false), null);
  assert.equal(tutorialStart(31, 0, { tutorial: { step: 31, trees: 2 } }, true, true), 31);
  assert.equal(tutorialStart(33, 0, { tutorial: { step: 33, trees: 3 } }, true, true), null);
});

test("checkpoints save the objective and tree count, including reward pending", () => {
  assert.deepEqual(stepReached(31, 2), { cmd: "complete_tutorial", args: [31, { trees: 2 }] });
  assert.deepEqual(stepReached(32, 3), { cmd: "complete_tutorial", args: [32, { trees: 3 }] });
  assert.equal(STEPS.length, LAST_STEP + 1);
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
  assert.ok(moves(13, { kind: "death", enemy: true }));
  assert.ok(moves(14, { kind: "next" }) && !moves(14, { kind: "death", enemy: true }));
  assert.ok(!passes(16) && moves(16, { kind: "closed" }), "the goals read and closed");
  assert.ok(!passes(LAST_STEP), "the last step counts its trees");
  assert.ok(!moves(11, { kind: "selected", item: item({ ...VILLAGER, attack: 5 }) }));
  assert.ok(!moves(13, { kind: "death", enemy: false }));
  assert.equal(pageOf(0), "1 of 8");
  assert.equal(pageOf(13), "4 of 8");
  assert.equal(pageOf(31), "8 of 8");
});

test("reload resumes the saved objective, including the reward choice", () => {
  for (const step of [0, 3, 9, 13, 15, 26, 31, 32]) assert.equal(resumeAt(step), step);
  assert.equal(tutorialStart(31, 0, { tutorial: { step: 32, trees: 3 } }, false, false), 32);
});
