import assert from "node:assert/strict";
import { test } from "node:test";

import table from "./specials-table.json" with { type: "json" };
import { specialAnimations, type SpecialsTable } from "./specials.ts";

const specials = table as unknown as SpecialsTable;

test("a battle knows each unit's special animations from the table, to load with its pictures", () => {
  assert.deepEqual(specialAnimations(specials, 538), [6, 7, 8], "the Stone Golem boss: a move of its own for each turn");
  assert.deepEqual(specialAnimations(specials, 2002), [6, 7, 8], "the Bahamut Paladin: its buttons and LIMIT");
  assert.deepEqual(specialAnimations(specials, 2114), [6, 7], "the Atlas Titan: counted beats");
  assert.deepEqual(specialAnimations(specials, 533), [6], "the Warrior Princess's whirlwind");
  assert.deepEqual(specialAnimations(specials, 510), [], "a swordsman has none");
});
