import assert from "node:assert/strict";
import { test } from "node:test";

import type { Town } from "./town.ts";
import { TOWN_PRICE, foundTown, showsTowns, townAddress, townRaces } from "./towns.ts";

function town(level: number, more: Partial<Town> = {}): Town {
  return { id: 0, name: "", townName: "", level, xp: 0, cash: 30, gold: 120_000, wood: 0, food: 0, stone: 0,
    race: "h", skin: 0, expansions: new Set([13]), unlocked: new Set(), gifts: new Map(), store: new Map(), items: [], unknown: [], ...more };
}

test("the towns as the save counts them", () => {
  assert.deepEqual(townRaces([{ r: "h" }, { r: "t" }]), ["h", "t"]);
  assert.deepEqual(townRaces(undefined), ["h"]);
  assert.deepEqual(townRaces([]), ["h"]);
});

test("the towns' button: from level 20 in a human town, or with two towns, or in the troll town", () => {
  assert.equal(showsTowns(town(19), 1), false);
  assert.equal(showsTowns(town(20), 1), true);
  assert.equal(showsTowns(town(3), 2), true);
  assert.equal(showsTowns(town(3, { race: "t", id: 1 }), 2), true);
});

test("founding the troll town: 100,000 gold or 22 cash from this town, buy_map as the Flash client sends it", () => {
  const withGold = town(20);
  assert.deepEqual(foundTown(withGold, 1, false), { command: { cmd: "buy_map", args: [1, 0, "t", 0] } });
  assert.equal(withGold.gold, 120_000 - TOWN_PRICE.gold);
  const withCash = town(25);
  assert.deepEqual(foundTown(withCash, 1, true), { command: { cmd: "buy_map", args: [1, 1, "t", 0] } });
  assert.equal(withCash.cash, 30 - TOWN_PRICE.cash);
});

test("refused below level 20, short of the price, or with two towns", () => {
  assert.deepEqual(foundTown(town(19), 1, false), { refused: "level" });
  assert.deepEqual(foundTown(town(20, { gold: 99_999 }), 1, false), { refused: "gold" });
  assert.deepEqual(foundTown(town(20, { cash: 21 }), 1, true), { refused: "cash" });
  assert.deepEqual(foundTown(town(20), 2, true), { refused: "two" });
});

test("the page's address for a town keeps the rest, without a visit or a battle", () => {
  assert.equal(townAddress("?visit=12&lang=en", 1), "?lang=en&town=1");
  assert.equal(townAddress("", 0), "?town=0");
});
