import assert from "node:assert/strict";
import { test } from "node:test";

import { itemInfo, type ConfigItem } from "./config.ts";
import { freeHelpers } from "./social.ts";
import type { PlacedItem, Town } from "./town.ts";

const social = (id: number, places: number, cost: number) => ({
  ...itemInfo({ id: String(id), name: `Social ${id}`, type: "b", img_name: "x", width: "3", height: "3", category_id: "1", subcat_functional: "411" } as ConfigItem),
  social: true, staffPlaces: places, workerCost: cost,
});
const at = (item: ReturnType<typeof social>, staff: number | undefined, tx = 50): PlacedItem =>
  ({ item, tx, ty: 50, orientation: 0, unitsInside: 0, startedAt: null, workTime: 0, ...(staff === undefined ? {} : { staff }) });

function town(items: PlacedItem[]): Town {
  return { id: 0, name: "", townName: "", level: 1, xp: 0, cash: 0, gold: 0, wood: 0, food: 0, stone: 0,
    race: "h", skin: 0, expansions: new Set([13]), unlocked: new Set(), gifts: new Map(), store: new Map(), items, unknown: [] };
}

test("a free helper as the town opens: an empty list with 3 places or more, or one helper with 7 or more", () => {
  const summit = at(social(234, 9, 3), 0, 40);
  const small = at(social(16, 2, 2), 0, 42);
  const market = at(social(266, 8, 2), 1, 44);
  const unpaid = at(social(389, 8, 0), 0, 46);
  const noList = at(social(352, 8, 2), undefined, 48);
  const half = at(social(23, 3, 2), 1, 50);
  const t = town([summit, small, market, unpaid, noList, half]);
  const sent = freeHelpers(t);
  assert.deepEqual(sent, [
    { cmd: "buy_si_help", args: [40, 50, 0, 234, 1] },
    { cmd: "buy_si_help", args: [44, 50, 0, 266, 1] },
  ]);
  assert.deepEqual([summit.staff, market.staff], [1, 2]);
  // The next load: the Summit's second (it has 9 places), the market's list now too full for another.
  assert.deepEqual(freeHelpers(t).map((c) => c.args[3]), [234]);
  assert.deepEqual(freeHelpers(t), []);
});
