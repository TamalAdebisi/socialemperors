import assert from "node:assert/strict";
import { test } from "node:test";

import { itemInfo, type ConfigItem } from "./config.ts";
import { canHurry, chooseWorkTime, collect, harvest, hurry, productionOf, workState } from "./production.ts";
import type { PlacedItem, Town } from "./town.ts";

// Items as the game config has them (numbers are strings there).
const config = (fields: Partial<ConfigItem>): ConfigItem => ({
  id: "1", name: "Thing", type: "b", img_name: "x", width: "2", height: "2", category_id: "1",
  subcat_functional: "111", unit_capacity: "0", activation: "0", collect: "0", collect_type: "g", collect_xp: "0",
  ...fields,
});
const GOLD_MINE = config({ id: "13", name: "Gold Mine I", subcat_functional: "124", unit_capacity: "2",
  activation: "21600", collect: "200", collect_type: "g", collect_xp: "7" });
const RANCH = config({ id: "11", name: "Sheep Ranch I", subcat_functional: "123", unit_capacity: "6",
  activation: "90", collect: "100", collect_type: "f", collect_xp: "4" });
const FARM = config({ id: "10", name: "Farm Land", subcat_functional: "122", unit_capacity: "1",
  activation: "32.4", collect: "15", collect_type: "f", collect_xp: "1" });
const WONDER = config({ id: "52", name: "Chichen Itza", subcat_functional: "511",
  activation: "21600", collect: "600", collect_type: "g", collect_xp: "20" });
const CHOSEN = new Set([13]);  // the config's COLLECT_VARIABLE_IDS, in short

function placed(item: ConfigItem, more: Partial<PlacedItem> = {}): PlacedItem {
  return { item: itemInfo(item, CHOSEN), tx: 50, ty: 50, orientation: 0, unitsInside: 1, startedAt: 1000, workTime: 0, ...more };
}

function town(): Town {
  return { id: 0, name: "", townName: "", level: 1, xp: 0, cash: 0, gold: 0, wood: 100, food: 0, stone: 0,
    race: "h", skin: 0, expansions: new Set([13]), unlocked: new Set(), gifts: new Map(), store: new Map(), items: [], unknown: [] };
}

test("what produces, and how", () => {
  assert.equal(productionOf(GOLD_MINE, CHOSEN)?.kind, "chosen");
  assert.equal(productionOf(RANCH, CHOSEN)?.kind, "workers");
  assert.equal(productionOf(WONDER, CHOSEN)?.kind, "always");
  assert.equal(productionOf(config({ subcat_functional: "111" }), CHOSEN), null);  // a house
  // A tree produces, but a villager works it: not a building's production.
  assert.equal(productionOf(config({ subcat_functional: "125", unit_capacity: "4", activation: "3.24", collect: "20", collect_type: "w" }), CHOSEN), null);
  // The nursery "produces" units (collect_type h): not a resource.
  assert.equal(productionOf(config({ subcat_functional: "123", unit_capacity: "2", activation: "32400", collect: "1", collect_type: "h" }), CHOSEN), null);
});

test("a building with workers works from the save's start time", () => {
  const ranch = placed(RANCH);
  assert.deepEqual(workState(ranch, 1045), { status: "working", secondsLeft: 45, done: 0.5 });
  assert.deepEqual(workState(ranch, 1090), { status: "ready" });
  assert.deepEqual(workState({ ...ranch, unitsInside: 0 }, 5000), { status: "idle" });
});

test("a mill or mine needs a working time chosen; each gives a share of the harvest", () => {
  const mine = placed(GOLD_MINE);
  assert.deepEqual(workState(mine, 99999), { status: "asleep" });
  assert.deepEqual([1, 2, 3, 4].map((choice) => harvest(mine, choice)), [100, 200, 400, 600]);
  const t = town();
  assert.deepEqual(chooseWorkTime(t, mine, 2, 2000), { cmd: "activate", args: [50, 50, 0, 13, 2] });
  assert.equal(workState(mine, 2000 + 3599)?.status, "working");
  assert.equal(workState(mine, 2000 + 3600)?.status, "ready");
});

test("each worker after the first adds a fifth", () => {
  assert.equal(harvest(placed(RANCH, { unitsInside: 1 })), 100);
  assert.equal(harvest(placed(RANCH, { unitsInside: 6 })), 200);
  assert.equal(harvest(placed(GOLD_MINE, { unitsInside: 2 }), 4), 720);  // (200 + 40) x 3
});

test("collecting pays the harvest and the experience, and sends what the Flash client sends", () => {
  const t = town();
  const mine = placed(GOLD_MINE, { unitsInside: 2, workTime: 2 });
  assert.equal(typeof collect(t, mine, 2000), "string");  // not ready: started at 1000, needs an hour
  const done = collect(t, mine, 1000 + 3600);
  assert.notEqual(typeof done, "string");
  assert.deepEqual(done, {
    commands: [
      { cmd: "collect_new", args: [50, 50, 0, 13, 2, 1, 0] },
      { cmd: "activate", args: [50, 50, 0, 13, 0] },  // asleep again until a new time is chosen
    ],
    resource: "gold", amount: 240, xp: 7, wood: 0,
  });
  assert.deepEqual([t.gold, t.xp, mine.startedAt, mine.workTime], [240, 7, 4600, 0]);
});

test("farms use up a third of their harvest in wood, and need it", () => {
  const t = town();
  const farm = placed(FARM);
  const done = collect(t, farm, 1033);
  assert.notEqual(typeof done, "string");
  assert.deepEqual([t.food, t.wood, t.xp], [15, 95, 1]);
  t.wood = 4;
  assert.equal(typeof collect(t, farm, 1033 + 33), "string");
  assert.deepEqual([t.food, t.wood], [15, 4]);  // nothing changed
});

test("a wonder works on its own", () => {
  const t = town();
  const wonder = placed(WONDER, { unitsInside: 0 });
  assert.equal(workState(wonder, 1000 + 21600)?.status, "ready");
  const done = collect(t, wonder, 1000 + 21600);
  assert.notEqual(typeof done, "string");
  if (typeof done !== "string") {
    assert.deepEqual(done.commands, [{ cmd: "collect_new", args: [50, 50, 0, 52, 0, 1, 0] }]);
  }
  assert.equal(t.gold, 600);
});

test("hurrying: 2 cash finishes a working mill, mine or wonder and collects it; not farms or ranches", () => {
  const t = { ...town(), cash: 5 };
  const wonder = placed(WONDER, { unitsInside: 0, startedAt: 1000 });
  assert.equal(canHurry(wonder, 2000), true);
  const done = hurry(t, wonder, 2000);
  assert.ok(typeof done !== "string");
  assert.equal(t.cash, 3);
  assert.equal(t.gold, 600);
  assert.deepEqual(done.commands[0].args, [50, 50, 0, 52, 0, 1, 2], "the cash goes in the command");
  assert.equal(wonder.startedAt, 2000, "it starts over");
  assert.equal(canHurry(placed(FARM), 1010), false);
  assert.equal(canHurry(placed(WONDER, { startedAt: 1000 }), 1000 + 21600), false, "ready already: just collect");
  assert.match(hurry({ ...town(), cash: 1 }, placed(WONDER), 2000) as string, /Not enough cash/);
});
