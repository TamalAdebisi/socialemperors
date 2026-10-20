import assert from "node:assert/strict";
import { test } from "node:test";
import { itemInfo, type ItemInfo } from "./config.ts";
import { isChained, release, secondsLeft, speedUp, speedUpCash } from "./chained.ts";
import type { PlacedItem, Town } from "./town.ts";

const god = itemInfo({ id: "2075", name: "Elemental Fire God", type: "u", img_name: "", width: "1", height: "1", category_id: "7", subcat_functional: "95", race: "h", population: "5" });
const colossus = itemInfo({ id: "2077", name: "Elemental Fire Colossus", type: "u", img_name: "", width: "1", height: "1", category_id: "7", subcat_functional: "95", race: "h", population: "5" });
const house = itemInfo({ id: "1", name: "House", type: "b", img_name: "", width: "2", height: "2", category_id: "1", subcat_functional: "111", race: "h", population: "10" });
const chain = itemInfo({ id: "3094", name: "Chained Fire God + Colossus", type: "b", img_name: "", width: "4", height: "4", category_id: "12", subcat_functional: "411", race: "h",
  chained_units: "2075,2077", chain_hours: "102" });
const items = new Map<number, ItemInfo>([god, colossus, chain, house].map((item) => [item.id, item]));
const HOUR = 3600, PLACED = 1_000_000;

function fixture() {
  const building: PlacedItem = { item: chain, tx: 50, ty: 50, orientation: 0, unitsInside: 0, units: [], startedAt: PLACED, workTime: 0 };
  const home: PlacedItem = { item: house, tx: 40, ty: 40, orientation: 0, unitsInside: 0, units: [], startedAt: 0, workTime: 0 };
  const town = { id: 0, level: 30, cash: 200, race: "h", expansions: new Set([13]), unlocked: new Set(), gifts: new Map(), store: new Map(), items: [building, home], unknown: [] } as unknown as Town;
  return { town, building };
}

test("a Chained building knows its units and its wait", () => {
  assert.ok(isChained(chain));
  assert.ok(!isChained(god));
  assert.deepEqual(chain.chainedUnits, [2075, 2077]);
  const { building } = fixture();
  assert.equal(secondsLeft(building, PLACED), 102 * HOUR);
  assert.equal(speedUpCash(building, PLACED + HOUR + 1), 101, "a started hour counts whole");
  assert.equal(secondsLeft(building, PLACED + 102 * HOUR), 0);
});

test("freeing waits for the chains, then puts both units beside it and the building goes", () => {
  const { town, building } = fixture();
  assert.match(String(release(town, building, items, PLACED + HOUR)), /aren't broken/);
  assert.equal(town.items.length, 2);
  const freed = release(town, building, items, PLACED + 102 * HOUR);
  assert.ok(typeof freed !== "string");
  assert.deepEqual(freed.units.map((u) => u.item.id), [2075, 2077]);
  assert.ok(!town.items.includes(building));
  const [a, b] = freed.units;
  assert.notDeepEqual([a.tx, a.ty], [b.tx, b.ty], "each on its own tile");
  assert.deepEqual(freed.commands, [{ cmd: "release_chained", args: [50, 50, 0, [[a.tx, a.ty], [b.tx, b.ty]]] }]);
});

test("speeding up costs a cash an hour left, and not without the cash", () => {
  const { town, building } = fixture();
  town.cash = 5;
  assert.match(String(speedUp(town, building, PLACED)), /Not enough cash: it takes 102/);
  assert.equal(town.cash, 5);
  town.cash = 200;
  assert.deepEqual(speedUp(town, building, PLACED + 2 * HOUR), { cmd: "speed_up_chained", args: [50, 50, 0] });
  assert.equal(town.cash, 100);
  assert.equal(secondsLeft(building, PLACED + 2 * HOUR), 0);
  assert.match(String(speedUp(town, building, PLACED + 2 * HOUR)), /already broken/);
});

test("freeing needs room for them all", () => {
  const { town, building } = fixture();
  town.items = town.items.filter((p) => p.item.id !== 1);  // no house
  assert.match(String(release(town, building, items, PLACED + 102 * HOUR)), /No room for more people/);
  assert.ok(town.items.includes(building), "nothing changes");
});
