import assert from "node:assert/strict";
import { test } from "node:test";

import {
  SAME_PLAYER_WAIT, attackedLately, beatenIslands, islandChoice, islandPicture, moveOffBeaten, pictureOf, prizeFor, statueOf, type Island,
} from "./world.ts";

const NOW = 1_700_000_000;
const island = (posicion: number, user_id: string, level = 5, race = "h"): Island => ({ posicion, nivel: 3, user_id, map: 0, level, race });

test("an island's picture: beaten, a troll town, or a town by its owner's level", () => {
  assert.deepEqual([5, 9, 10, 11, 12, 19, 20, 21, 22, 60].map((level) => islandPicture(island(0, "a", level), false)),
    [1, 1, 2, 2, 3, 6, 7, 7, 8, 8]);
  assert.equal(islandPicture(island(0, "a", 30, "t"), false), 9);
  assert.equal(islandPicture(island(0, "a", 30, "t"), true), 10);
  assert.deepEqual([pictureOf(1), pictureOf(5), statueOf(1), statueOf(20)], [2, 1, 2, 1]);
});

test("the island's menu: yourself, attacked lately, no army, attack, no attacks left", () => {
  const lately = attackedLately([{ time: NOW - 100, victim_id: "b" }, { time: NOW - SAME_PLAYER_WAIT, victim_id: "c" }], NOW);
  assert.deepEqual([...lately], ["b"], "4 hours later, again");
  assert.equal(islandChoice(island(0, "me"), "me", lately, 5, 3), "yourself");
  assert.equal(islandChoice(island(1, "b"), "me", lately, 5, 3), "attacked-lately");
  assert.equal(islandChoice(island(2, "c"), "me", lately, 0, 3), "no-army");
  assert.equal(islandChoice(island(2, "c"), "me", lately, 5, 3), "attack");
  assert.equal(islandChoice(island(2, "c"), "me", lately, 5, 0), "no-attacks");
});

test("the player's own island beaten changes places with the first one not beaten", () => {
  const islands = [island(0, "x"), island(1, "me"), island(2, "y"), island(3, "z")];
  assert.equal(moveOffBeaten(islands, "me", [0]), null, "own island not beaten: nothing");
  assert.deepEqual(moveOffBeaten(islands, "me", beatenIslands(["0", 1])), [1, 2]);
  assert.deepEqual(islands.map((i) => [i.user_id, i.posicion]), [["x", 0], ["me", 2], ["y", 1], ["z", 3]]);
});

test("a continent's prize, from the config's rows", () => {
  const rows = [{ level: 2, cash: "5", units: { 553: 1 } }, { level: 1, cash: 25, units: { 650: 1, 686: 10 } }];
  assert.deepEqual(prizeFor(rows, 1), { cash: 25, units: [[650, 1], [686, 10]] });
  assert.deepEqual(prizeFor(rows, 2), { cash: 5, units: [[553, 1]] });
  assert.equal(prizeFor(rows, 3), null);
});
