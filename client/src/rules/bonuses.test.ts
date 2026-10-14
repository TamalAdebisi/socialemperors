import assert from "node:assert/strict";
import { test } from "node:test";

import { collectDaily, collectMonday, collectWelcomeBack, dailyBonusDay, mondayChest, readBonusConfig, welcomeBackDay } from "./bonuses.ts";
import type { Town } from "./town.ts";

const CONFIG = readBonusConfig({
  DAILY_BONUS_CONFIG: [{ qty: 250, type: "g" }, { qty: 1, type: "hero" }, { qty: 2, type: "c" }, { qty: 1, type: "hero" }, { qty: 5, type: "c" }],
  DAILY_BONUS_CONFIG_HEROES: [555, 554, 534],
  MONDAY_BONUS_REWARDS: [{ type: "g", value: 2500 }, { type: "u", value: 0 }, { type: "c", value: 10 }],
  MONDAY_BONUS_UNITS: [784, 699, 761],
  COMEBACK_BONUS_UNITS: [701, 702],
});
const DAY = 86400;

function town(level = 5): Town {
  return { id: 0, name: "", townName: "", level, xp: 0, cash: 0, gold: 0, wood: 0, food: 0, stone: 0,
    race: "h", skin: 0, expansions: new Set([13]), unlocked: new Set(), gifts: new Map(), store: new Map(), items: [], unknown: [] };
}

test("the daily bonus: from the next day (UTC), the day after the last, the first again after a day missed", () => {
  const now = 100 * DAY + 3600;
  assert.equal(dailyBonusDay({}, now), 1, "never collected");
  assert.equal(dailyBonusDay({ bonusNextId: 3, timestampLastBonus: now - 600 }, now), null, "today already");
  assert.equal(dailyBonusDay({ bonusNextId: 3, timestampLastBonus: 99 * DAY + 50000 }, now), 3, "yesterday was day 2");
  assert.equal(dailyBonusDay({ bonusNextId: 6, timestampLastBonus: 99 * DAY }, now), 1, "after day 5, day 1");
  assert.equal(dailyBonusDay({ bonusNextId: 3, timestampLastBonus: 98 * DAY }, now), 1, "a day missed");
});

test("collecting it: gold or cash, or a hero into storage; the Flash client's command", () => {
  const t = town();
  const state = {};
  assert.deepEqual(collectDaily(t, state, CONFIG, 1, 1000).command, { cmd: "win_bonus", args: [250, 0, 0, 1, 0] });
  assert.equal(t.gold, 250);
  const hero = collectDaily(t, state, CONFIG, 2, 1000, () => 0.6);
  assert.equal(hero.hero, 554);
  assert.equal(t.store.get(554), 1);
  assert.deepEqual(collectDaily(t, state, CONFIG, 3, 1000).command.args, [0, 0, 0, 3, 2]);
  assert.equal(t.cash, 2);
  assert.deepEqual(state, { bonusNextId: 4, timestampLastBonus: 1000 });
});

test("Monday's chest: on Mondays, once; previewed on Sundays", () => {
  const monday = new Date(2026, 9, 12, 10).getTime() / 1000;  // a Monday, the player's own clock
  assert.equal(mondayChest({}, monday), "ready");
  assert.equal(mondayChest({ timeStampMondayBonus: monday - 3600 }, monday), "collected");
  assert.equal(mondayChest({}, monday - DAY), "soon");
  assert.equal(mondayChest({}, monday + DAY), null);
  const t = town();
  const opened = collectMonday(t, {}, CONFIG, monday, () => 0.5);  // the unit, then the second of them
  assert.deepEqual(opened.command, { cmd: "weekly_reward", args: ["u", 699] });
  assert.equal(t.store.get(699), 1);
  assert.deepEqual(collectMonday(t, {}, CONFIG, monday, () => 0.9).command.args, ["c", 10]);
});

test("the welcome-back chest: days 1 and 2, from level 4, once each; the day's own unit", () => {
  assert.equal(welcomeBackDay(town(), {}, 1), 1);
  assert.equal(welcomeBackDay(town(), {}, 0), null);
  assert.equal(welcomeBackDay(town(3), {}, 2), null, "below level 4");
  assert.equal(welcomeBackDay(town(), { comebackBonusCollected: [2] }, 2), null);
  const opened = collectWelcomeBack(town(), {}, CONFIG, 2, () => 0.5);
  assert.deepEqual(opened.command, { cmd: "comeback_reward", args: ["u", 702, 2] });
});
