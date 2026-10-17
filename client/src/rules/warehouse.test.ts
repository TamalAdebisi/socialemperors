import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { cleanUp } from "./cleanup.ts";
import { itemsById, type GameConfig, type ItemInfo } from "./config.ts";
import { readTown, type PlacedItem, type PlayerInfo, type Town } from "./town.ts";
import { population } from "./training.ts";
import { canGoInside, goInside } from "./work.ts";
import { UNIT_WAREHOUSE, WAREHOUSE_PAGE, buyWarehouseCapacity, cantDeployWarehouse, deployWarehouse,
  resetWarehouse, warehouseCards, warehouseCount, warehouseRules } from "./warehouse.ts";

const root = new URL("../../../", import.meta.url);
const config = JSON.parse(readFileSync(new URL("config/game_config_20120826.json", root), "utf8")) as GameConfig;
const items = itemsById(config);
const rules = warehouseRules(config);
const knight = items.get(512)!;
const building = items.get(UNIT_WAREHOUSE)!;
const hall = items.get(26)!;

function placed(item: ItemInfo, tx = 55, ty = 55, more: Partial<PlacedItem> = {}): PlacedItem {
  return { item, tx, ty, orientation: 0, unitsInside: 0, units: [], startedAt: null, workTime: 0, ...more };
}

function town(): Town {
  const info: PlayerInfo = { result: "OK", timestamp: 1,
    playerInfo: { name: "", cash: 10 },
    map: { id: 0, expansions: [13], level: 18, xp: 0, coins: 0, wood: 0, food: 0, stone: 0,
      race: "h", skin: 0, items: [[26, 48, 48, 0]], warehousedUnits: { 512: 2 }, warehouseAditionalCapacitySingle: 51 } };
  return readTown(info, items);
}

test("reads the warehouse's saved counts and total room separately from occupants and population", () => {
  const t = town();
  assert.deepEqual([...t.warehouse!], [[512, 2]]);
  assert.equal(t.warehouseCapacity, 51);
  assert.equal(warehouseCount(t), 2);
  assert.equal(population(t, items).current, 0);
  assert.deepEqual(warehouseCards(t, items), [knight, knight]);
  assert.equal(WAREHOUSE_PAGE, 18);
  assert.deepEqual(rules, { start: 50, maximum: 1000, price: 2 });
});

test("any owned unit kind can enter a completed live warehouse until its separate box is full", () => {
  const t = town();
  const warehouse = placed(building);
  for (const id of [500, 512, 530, 503, 754]) assert.equal(canGoInside(t, items.get(id)!, warehouse), true, String(id));
  t.warehouseCapacity = 2;
  assert.equal(canGoInside(t, knight, warehouse), false);
  t.warehouseCapacity = 3;
  assert.equal(canGoInside(t, knight, { ...warehouse, ruined: true }), false);
  assert.equal(canGoInside(t, knight, { ...warehouse, builtAt: Date.now() + 60_000 }), false);
  assert.equal(canGoInside(t, knight, { ...warehouse, item: { ...building, race: "t" } }), false);
});

test("walking in frees population and names the last saved tile; ordinary building occupants stay empty", () => {
  const t = town();
  const warehouse = placed(building);
  const unit = placed(knight, 60, 55);
  t.items.push(warehouse, unit);
  assert.equal(population(t, items).current, knight.population);
  assert.deepEqual(goInside(t, unit, warehouse, { x: 62, y: 53 }, 100), {
    cmd: "add_unit_warehouse", args: [62, 53, 0, 512],
  });
  assert.equal(warehouseCount(t), 3);
  assert.equal(t.items.includes(unit), false);
  assert.deepEqual([warehouse.unitsInside, warehouse.units, warehouse.startedAt], [0, [], null]);
  assert.equal(population(t, items).current, 0);
});

test("deployment checks the kind's limit first, counting occupants; even Mummy has no warehouse exception", () => {
  const t = town();
  const limited = { ...knight, unitsLimit: 1 };
  t.items = [placed(hall, 48, 48, { units: [limited.id], unitsInside: 1 })];
  assert.match(cantDeployWarehouse(t, limited, items)!, /as many/);
  t.items = [];
  assert.match(cantDeployWarehouse(t, limited, items)!, /No room/);
  const mummy = { ...items.get(615)!, unitsLimit: 1 };
  t.items = [placed(mummy)];
  assert.match(cantDeployWarehouse(t, mummy, items)!, /as many/);
  t.items = [placed({ ...hall, race: "t" }, 48, 48, { units: [limited.id], unitsInside: 1 }), placed(hall, 44, 44)];
  assert.equal(cantDeployWarehouse(t, limited, items), null, "enemy occupants do not use this town's kind limit");
});

test("deployment puts only one unit beside its warehouse, with no cost or experience", () => {
  const t = town();
  const warehouse = placed(building);
  t.items.push(warehouse);
  const done = deployWarehouse(t, knight, warehouse, items);
  assert.notEqual(typeof done, "string");
  if (typeof done === "string") return;
  assert.deepEqual([done.unit.tx, done.unit.ty], [56, 56]);
  assert.deepEqual(done.command, { cmd: "place_warehoused_item", args: [512, 56, 56, 0, 0] });
  assert.equal(t.warehouse!.get(512), 1);
  assert.deepEqual([t.cash, t.xp, population(t, items).current], [10, 0, knight.population]);
  deployWarehouse(t, knight, warehouse, items);
  assert.equal(t.warehouse!.has(512), false);
  assert.match(String(deployWarehouse(t, knight, warehouse, items)), /none left/);
});

test("a blocked four-ring exit and a missing building consume nothing", () => {
  const t = town();
  const warehouse = placed(building);
  t.items.push(warehouse);
  const blocker = { ...hall, width: 1, height: 1 };
  for (let x = 51; x <= 59; x++) for (let y = 51; y <= 59; y++) t.items.push(placed(blocker, x, y));
  assert.match(String(deployWarehouse(t, knight, warehouse, items)), /no room around/);
  assert.equal(warehouseCount(t), 2);
  t.items.splice(t.items.indexOf(warehouse), 1);
  assert.match(String(deployWarehouse(t, knight, warehouse, items)), /no longer here/);
  assert.equal(warehouseCount(t), 2);
});

test("a slot costs the configured cash, adds exactly one, stops at the maximum and survives reset", () => {
  const t = town();
  assert.deepEqual(buyWarehouseCapacity(t, rules), { cmd: "buy_warehouse_capacity_single", args: [0] });
  assert.deepEqual([t.cash, t.warehouseCapacity], [8, 52]);
  t.cash = 1;
  assert.match(String(buyWarehouseCapacity(t, rules)), /Not enough cash/);
  assert.equal(t.warehouseCapacity, 52);
  t.cash = 10; t.warehouseCapacity = 1000;
  assert.match(String(buyWarehouseCapacity(t, rules)), /cannot grow/);
  assert.equal(t.cash, 10);
  t.store.set(512, 3);
  assert.deepEqual(resetWarehouse(t), { cmd: "reset_warehouse", args: [0] });
  assert.equal(t.store.get(512), 5);
  assert.equal(t.warehouseCapacity, 1000);
  assert.equal(warehouseCount(t), 0);
});

test("opening-town collision storage also empties the warehouse, without losing its bought room", () => {
  const t = town();
  t.items = [placed(hall, 48, 48), placed(building, 48, 48)];
  const cleaned = cleanUp(t);
  assert.deepEqual(cleaned.commands.map((c) => c.cmd), ["store_item_frombug", "reset_warehouse"]);
  assert.equal(warehouseCount(t), 0);
  assert.equal(t.store.get(512), 2);
  assert.equal(t.store.get(UNIT_WAREHOUSE), 1);
  assert.equal(t.warehouseCapacity, 51);
});
