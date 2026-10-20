import assert from "node:assert/strict";
import { test } from "node:test";
import { UnitBook, type UnitCategory } from "./unitBook.ts";
import type { ItemInfo } from "./config.ts";
import type { Town, PlacedItem } from "./town.ts";

const category: UnitCategory = { category_id: 7, category_lang_id: 1, units: [501,502],
  rewards: 600, cost: 3, costs: [2], position: 10 };
const town = () => ({ id: 0, cash: 20, race: "h", items: [], store: new Map(), gifts: new Map() }) as unknown as Town;
const placed = (id: number, race = "h", wild = false) => ({ item: { id, race, isUnit: true } as ItemInfo, wild }) as PlacedItem;

test("unit book sorts configured categories and recognizes acquired units, not enemies or stored gifts", () => {
  const player = town();
  player.items = [placed(501), placed(502, "e"), placed(502, "h", true)];
  player.gifts.set(502, 1);
  const saved = { boughtUnits: [999], unitCollectionsCompleted: [] };
  const book = new UnitBook({ a: category }, saved, player);
  assert.deepEqual([...book.owned], [501]);
  assert.equal(book.canClaim(category), false);
  player.items.push(placed(502));
  assert.deepEqual(book.observe(player), [category]);
  player.items = [];
  assert.deepEqual(book.observe(player), []);
  assert.equal(book.canClaim(category), true, "acquired in this session stays recognized");
});

test("missing unit purchase uses per-unit/fallback prices and the town's storage; each reward pays once", () => {
  const player = town(), saved: Record<string,unknown> = {};
  const book = new UnitBook({ a: category }, saved, player);
  assert.deepEqual(book.buy(player, category, 501), { cmd: "buy_stored_item_cash", args: [0,501,2] });
  assert.equal(book.buy(player, category, 501), null);
  assert.deepEqual(book.buy(player, category, 502), { cmd: "buy_stored_item_cash", args: [0,502,3] });
  assert.equal(player.store.get(501), 1); assert.equal(player.cash, 15);
  assert.deepEqual(book.claim(player, category), { cmd: "unit_collections_completed", args: [7] });
  assert.equal(player.cash, 16); assert.equal(player.gifts.get(600), 1);
  assert.equal(book.claim(player, category), null);
  const loaded = new UnitBook({ a: category }, saved, town());
  assert.deepEqual([...loaded.owned], [501,502]); assert.equal(loaded.canClaim(category), false);
});

test("insufficient cash and foreign unit/category leave the book unchanged", () => {
  const player = town(), book = new UnitBook({ a: category }, {}, player);
  player.cash = 1;
  assert.equal(book.buy(player, category, 501), null);
  assert.equal(book.buy(player, { ...category }, 501), null);
  assert.equal(book.buy(player, category, 999), null);
  assert.equal(book.claim(player, category), null);
  assert.equal(player.cash, 1); assert.equal(book.owned.size, 0);
});

test("a player's look-alike of a book unit counts for it: same name and picture, another id", () => {
  const info = (id: number, name: string, art: string, race = "t") => ({ id, name, art, race, isUnit: true }) as ItemInfo;
  const items = new Map([
    [525, info(525, "Small Troll", "trol1")], [593, info(593, "Small Troll", "trol1")],
    [552, info(552, "War Troll", "trol5", "h")], [529, info(529, "War Troll", "trol5")],
    [594, info(594, "Small Troll", "trol2")],  // the same name, another picture: not the same unit
  ]);
  const trolls: UnitCategory = { ...category, units: [525, 529] };
  const player = { ...town(), race: "t" } as unknown as Town;
  player.items = [{ item: items.get(593)!, wild: false } as PlacedItem, { item: items.get(594)!, wild: false } as PlacedItem];
  const book = new UnitBook({ a: trolls }, {}, player, items);
  assert.deepEqual([...book.owned], [525]);
  const human = town();
  human.items = [{ item: items.get(552)!, wild: false } as PlacedItem];
  assert.deepEqual([...new UnitBook({ a: trolls }, {}, human, items).owned], [529]);
});
