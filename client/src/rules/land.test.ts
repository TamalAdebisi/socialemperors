import assert from "node:assert/strict";
import { test } from "node:test";

import type { Town } from "./town.ts";
import { buyLand, cantBuyLand, landForSale, landPrice, readLandPrices } from "./land.ts";

const PRICES = readLandPrices([
  { coins: 4000, cash: 20, neighbors: 1 }, { coins: 40000, cash: 25, neighbors: 3 }, { coins: "80000", cash: "30", neighbors: "5" },
]);

function town(expansions: number[]): Town {
  return { id: 0, name: "", townName: "", level: 1, xp: 0, cash: 22, gold: 5000, wood: 0, food: 0, stone: 0,
    race: "h", skin: 0, expansions: new Set(expansions), unlocked: new Set(), gifts: new Map(), store: new Map(), items: [], unknown: [] };
}

test("land for sale: the middle blocks beside an open one; not the wild ring, not open land, not across the island", () => {
  const t = town([13]);
  assert.equal(landForSale(t, 30, 50), 12);  // left of the middle
  assert.equal(landForSale(t, 50, 30), 8);   // above it
  assert.equal(landForSale(t, 30, 30), null, "block 7 touches only at a corner");
  assert.equal(landForSale(t, 50, 50), null, "open already");
  assert.equal(landForSale(t, 10, 50), null, "the wild ring");
  assert.equal(landForSale(town([13, 12]), 30, 30), 7, "beside 12 now");
});

test("the next block's price goes by how many are open; gold needs neighbours, cash doesn't", () => {
  const one = town([13]);
  assert.deepEqual(landPrice(one, PRICES), { coins: 4000, cash: 20, neighbors: 1 });
  assert.deepEqual(landPrice(town([13, 12, 14]), PRICES), { coins: 80000, cash: 30, neighbors: 5 });
  assert.equal(landPrice(town([13, 12, 14, 8]), PRICES), null, "no more on the list");
  const price = landPrice(one, PRICES)!;
  assert.match(cantBuyLand(one, price, false, 0)!, /takes 1 neighbour/);
  assert.equal(cantBuyLand(one, price, false, 1), null);
  assert.equal(cantBuyLand(one, price, true, 0), null);
  assert.match(cantBuyLand({ ...one, cash: 5 }, price, true, 0)!, /Not enough cash/);
});

test("buying a block: paid, open, and the Flash client's command", () => {
  const t = town([13]);
  assert.deepEqual(buyLand(t, 12, landPrice(t, PRICES)!, false), { cmd: "expand", args: [12, "gold", 0] });
  assert.equal(t.gold, 1000);
  assert.equal(t.expansions.has(12), true);
  t.cash = 30;
  assert.deepEqual(buyLand(t, 14, landPrice(t, PRICES)!, true).args, [14, "cash", 0]);
  assert.equal(t.cash, 5, "the second block: 25 cash");
});
