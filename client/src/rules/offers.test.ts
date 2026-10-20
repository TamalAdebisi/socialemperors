import assert from "node:assert/strict";
import { test } from "node:test";
import { buyOffer, contents, offers, rollMystery, rollSuper, superPrices, type Offer } from "./offers.ts";
import type { GameConfig } from "./config.ts";
import type { Town } from "./town.ts";

const config = {
  globals: { SUPER_PACK_PRICES: { default: [29, 40, 60], "19": [19, 29, 40] } },
  offer_packs: [
    { id: 1, position: 22, cost_cash: 17, gold: 5000, stone: 5000, food: 5000, wood: 5000, xp: 500, mana: 0, items: [27, 550, 555], enabled: 1, pack_type: 0 },
    { id: 11, position: 3, cost_cash: 29, gold: 0, stone: 0, food: 0, wood: 0, xp: 100, mana: 0, items: [[60, 35], [662, 70], [660, 90], [651, 100]], enabled: 1, pack_type: 1 },
    { id: 65, position: 1, cost_cash: 0, gold: 0, stone: 0, food: 0, wood: 0, xp: 300, mana: 5, items: [[2016, 2017, 2018], [2042, 2043], [2044]], enabled: 1, pack_type: 2 },
    { id: 40, position: 9, cost_cash: 0, gold: 0, stone: 0, food: 0, wood: 0, xp: 0, mana: 0, items: [[1], [2], [3]], enabled: 0, pack_type: 2 },
    { id: 99, position: 9, cost_cash: 5, items: [], enabled: 1, pack_type: 0 },
  ],
} as unknown as GameConfig;
const town = () => ({ id: 0, cash: 200, gold: 0, wood: 0, food: 0, stone: 0, xp: 0, store: new Map() }) as unknown as Town;
const fixed = (...rolls: number[]) => { let n = 0; return () => rolls[n++ % rolls.length]!; };

test("the offers: every kind, the original's switched-on ones first, empty packs left out", () => {
  const list = offers(config);
  assert.deepEqual(list.map((o) => [o.id, o.kind]), [[1, "pack"], [11, "mystery"], [65, "super"], [40, "super"]]);
  assert.deepEqual(contents(list[0]!), [27, 550, 555]);
  assert.deepEqual(superPrices(config, list[2]!), [29, 40, 60]);
});

test("a mystery box's roll: under 35 the first prize, the last only from 90", () => {
  const box = offers(config).find((o) => o.id === 11)!;
  assert.equal(rollMystery(box, () => 0), 60);
  assert.equal(rollMystery(box, () => 0.5), 662);
  assert.equal(rollMystery(box, () => 0.8), 660);
  assert.equal(rollMystery(box, () => 0.95), 651);
});

test("a super box's choices give one, two or four prizes; only the third surely has a rare one", () => {
  const box = offers(config).find((o) => o.id === 65)!;
  assert.deepEqual(rollSuper(box, 0, () => 0), [2042], "the first choice never draws the rarest row");
  assert.deepEqual(rollSuper(box, 1, () => 0), [2016, 2042]);
  assert.deepEqual(rollSuper(box, 2, fixed(0.99, 0.99, 0, 0.5)), [2018, 2044, 2042, 2043]);
});

test("buying: the cash, the resources and the items into storage, and the command the server takes", () => {
  const [pack, box, superBox] = offers(config) as Offer[];
  const player = town();
  assert.deepEqual(buyOffer(player, pack!, 0, config), { cash: 17, items: [27, 550, 555], commands: [{ cmd: "buy_offer_pack", args: [0, 1] }] });
  assert.equal(player.cash, 183);
  assert.equal(player.gold, 5000);
  assert.equal(player.xp, 500);
  assert.equal(player.store.get(550), 1);
  const won = buyOffer(player, box!, 0, config, () => 0.95);
  assert.ok(typeof won !== "string");
  assert.deepEqual(won.commands, [{ cmd: "buy_offer_pack", args: [0, 11, 651] }]);
  const four = buyOffer(player, superBox!, 2, config, fixed(0, 0, 0, 0));
  assert.ok(typeof four !== "string");
  assert.equal(four.cash, 60);
  assert.deepEqual(four.commands, [{ cmd: "buy_super_offer_pack", args: [0, 65, "2016,2042,2042,2042", 60] }]);
  assert.equal(player.xp, 600, "a super box's xp isn't given, as in the original");
  player.cash = 10;
  assert.match(String(buyOffer(player, pack!, 0, config)), /Not enough cash: it takes 17/);
  assert.equal(player.cash, 10);
});
