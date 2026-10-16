import assert from "node:assert/strict";
import { test } from "node:test";

import { itemInfo, type ConfigItem } from "./config.ts";
import { lotOf, marketRules, priceOf, readMarket, trade, tradesLeft, type MarketState } from "./market.ts";
import type { Town } from "./town.ts";

// The config's globals for the market, as in config/game_config_20120826.json.
const RULES = marketRules({
  MARKET_BASE_COSTS: { w: 100, s: 150, f: 100 }, MARKET_INCREMENT: 0.02, MARKET_SELL_PERCENTAGE: 0.75,
  MARKET_MAX_INCREMENTS: 200, MARKET_MAX_DECREMENTS: 25, MARKET_PERIOD_HOURS: 20,
});
const NOW = 1_800_000_000;

function town(gold = 1000, more: Partial<Town> = {}): Town {
  return { id: 0, name: "", townName: "", level: 5, xp: 0, cash: 0, gold, wood: 0, food: 0, stone: 0,
    race: "h", skin: 0, expansions: new Set([13]), unlocked: new Set(), gifts: new Map(), store: new Map(), items: [], unknown: [], ...more };
}

const fresh = (): MarketState => ({ traded: {}, tradesDone: 0, lastTrade: 0 });

const market = (id: number) => itemInfo({
  id: String(id), name: "Market", type: "b", img_name: "x", width: "4", height: "4", category_id: "1", subcat_functional: "132", race: "h",
} as ConfigItem);

test("the config's numbers, and the Flash client's own", () => {
  assert.deepEqual(RULES.baseCosts, { w: 100, s: 150, f: 100 });
  assert.equal(RULES.period, 20 * 3600);
  assert.equal(RULES.mostTrades, 20);
  assert.deepEqual(marketRules({}), RULES, "without the config, the same");
});

test("each market's lot: 100, 200, 300; the trolls' the same; not the allies' market", () => {
  assert.equal(lotOf(market(23), RULES), 100);
  assert.equal(lotOf(market(188), RULES), 200);
  assert.equal(lotOf(market(189), RULES), 300);
  assert.equal(lotOf(market(335), RULES), 100);
  assert.equal(lotOf(market(346), RULES), 300);
  assert.equal(lotOf(market(266), RULES), null, "the allies' market has its own window");
});

test("prices: the base per 100, 2% more for each purchase so far, a sale three quarters (the server's sums)", () => {
  const state = fresh();
  assert.equal(priceOf(RULES, state, "w", 100, false), 100);
  assert.equal(priceOf(RULES, state, "s", 200, false), 300);
  assert.equal(priceOf(RULES, state, "f", 300, true), 225);
  assert.equal(priceOf(RULES, state, "s", 100, true), 113, "112.5 rounds up, as in Flash");
  state.traded = { w: 3, s: -25, f: 200 };
  assert.equal(priceOf(RULES, state, "w", 100, false), 106);
  assert.equal(priceOf(RULES, state, "w", 100, true), 80);
  assert.equal(priceOf(RULES, state, "s", 200, false), 150);
  assert.equal(priceOf(RULES, state, "f", 300, false), 1500);
  assert.equal(priceOf(RULES, state, "s", 100, true), 56);
});

test("buying: gold for goods, the count up, the Flash client's command", () => {
  const home = town(1000);
  const state = fresh();
  const done = trade(home, state, RULES, "s", 200, false, NOW);
  assert.deepEqual(done, { price: 300, command: { cmd: "trade_resource_b", args: [0, "s", 0, 200] } });
  assert.equal(home.gold, 700);
  assert.equal(home.stone, 200);
  assert.equal(state.traded.s, 1);
  assert.equal(state.tradesDone, 1);
  assert.equal(state.lastTrade, NOW);
  assert.equal(priceOf(RULES, state, "s", 200, false), 306, "the next is dearer");
});

test("selling: goods for gold, the count down", () => {
  const home = town(0, { wood: 150, id: 1 });
  const state = fresh();
  const done = trade(home, state, RULES, "w", 100, true, NOW);
  assert.deepEqual(done, { price: 75, command: { cmd: "trade_resource_b", args: [1, "w", 1, 100] } });
  assert.equal(home.gold, 75);
  assert.equal(home.wood, 50);
  assert.equal(state.traded.w, -1);
});

test("refused: buying without the gold, selling without the goods; nothing changes", () => {
  const home = town(99, { food: 99 });
  const state = fresh();
  assert.deepEqual(trade(home, state, RULES, "w", 100, false, NOW), { refused: "no-gold" });
  assert.deepEqual(trade(home, state, RULES, "f", 100, true, NOW), { refused: "no-goods" });
  assert.equal(home.gold, 99);
  assert.equal(home.food, 99);
  assert.equal(state.tradesDone, 0);
});

test("20 trades, then none until 20 hours after the last", () => {
  const home = town(1_000_000);
  const state = fresh();
  for (let i = 0; i < 20; i++) {
    assert.ok("command" in trade(home, state, RULES, "w", 100, false, NOW + i));
  }
  assert.equal(tradesLeft(RULES, state), 0);
  assert.deepEqual(trade(home, state, RULES, "w", 100, false, NOW + 60), { refused: "no-trades" });
  assert.ok("command" in trade(home, state, RULES, "w", 100, false, NOW + 19 + 20 * 3600 + 1), "a fresh day");
  assert.equal(tradesLeft(RULES, state), 19);
});

test("the count stays between 25 sales and 200 purchases", () => {
  const state: MarketState = { traded: { w: 200, f: -25 }, tradesDone: 0, lastTrade: 0 };
  trade(town(1_000_000), state, RULES, "w", 100, false, NOW);
  trade(town(0, { food: 100 }), state, RULES, "f", 100, true, NOW);
  assert.deepEqual(state.traded, { w: 200, f: -25 });
});

test("the save's numbers as the town loads; the count of trades starts again after 20 hours", () => {
  const saved = { resourcesTraded: { w: 4, s: "-2", x: 9 }, numTradesDone: 12, timestampLastTrade: NOW - 3600 };
  assert.deepEqual(readMarket(saved, RULES, NOW), { traded: { w: 4, s: -2 }, tradesDone: 12, lastTrade: NOW - 3600 });
  const old = readMarket({ ...saved, timestampLastTrade: NOW - 21 * 3600 }, RULES, NOW);
  assert.equal(old.tradesDone, 0);
  assert.deepEqual(old.traded, { w: 4, s: -2 }, "the prices remember");
  assert.deepEqual(readMarket({}, RULES, NOW), { traded: {}, tradesDone: 0, lastTrade: 0 }, "a town that never traded");
});
