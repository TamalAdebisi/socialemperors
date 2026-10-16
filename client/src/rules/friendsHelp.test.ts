import assert from "node:assert/strict";
import { test } from "node:test";

import { itemInfo, type ConfigItem } from "./config.ts";
import { helpSeconds, readHelpers, useHelp } from "./friendsHelp.ts";
import { readTown, type PlacedItem, type Town } from "./town.ts";

const MILL = itemInfo({
  id: "5", name: "Mill I", type: "b", img_name: "x", width: "3", height: "3", category_id: "1", subcat_functional: "121", race: "h",
} as ConfigItem);

function town(): Town {
  return { id: 1, name: "", townName: "", level: 5, xp: 0, cash: 0, gold: 0, wood: 0, food: 0, stone: 0,
    race: "h", skin: 0, expansions: new Set([13]), unlocked: new Set(), gifts: new Map(), store: new Map(), items: [], unknown: [] };
}

test("the friends waiting: those not used yet, from the save's hc", () => {
  assert.deepEqual(readHelpers({ u12: false, u7: true, u30: false }), ["12", "30"]);
  assert.deepEqual(readHelpers(undefined), []);
  assert.deepEqual(readHelpers([]), []);
});

test("the town reads them for each building", () => {
  const read = readTown({
    result: "ok", timestamp: 0, playerInfo: { name: "", cash: 0 },
    map: { id: 0, expansions: [13], level: 5, xp: 0, coins: 0, wood: 0, food: 0, stone: 0, race: "h", skin: 0,
      items: [[5, 50, 50, 0, 1000, 0, [], { hc: { u12: false, u30: false } }], [5, 54, 50, 0, 1000, 0, [], {}]] },
  }, new Map([[5, MILL]]));
  assert.deepEqual(read.items[0].helpers, ["12", "30"]);
  assert.equal(read.items[1].helpers, undefined);
});

test("a help used: the top friend, an hour off the work, the Flash client's command", () => {
  const mill: PlacedItem = { item: MILL, tx: 50, ty: 52, orientation: 0, unitsInside: 1, units: [500], startedAt: 10_000, workTime: 2, helpers: ["12", "30"] };
  const used = useHelp(town(), mill, helpSeconds({}));
  assert.deepEqual(used, { friend: "30", command: { cmd: "accept_collect_help", args: [50, 52, 1, 5, "30"] } });
  assert.equal(mill.startedAt, 10_000 - 3600);
  assert.deepEqual(mill.helpers, ["12"]);
  useHelp(town(), mill, helpSeconds({ COLLECT_HELP_SECONDS: 1800 }));
  assert.equal(mill.startedAt, 10_000 - 3600 - 1800);
  assert.equal(mill.helpers, undefined, "none left");
  assert.equal(useHelp(town(), mill, 3600), null);
});

test("a building not at work keeps its clock, as the server does", () => {
  const idle: PlacedItem = { item: MILL, tx: 50, ty: 52, orientation: 0, unitsInside: 0, units: [], startedAt: null, workTime: 0, helpers: ["4"] };
  assert.ok(useHelp(town(), idle, 3600));
  assert.equal(idle.startedAt, null);
});
