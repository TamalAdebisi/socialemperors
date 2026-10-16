// The market (CLIENT.md, "The market"), as the Flash client runs it (our
// notes, our words: docs/original/rules/progress.md, "The market"): wood,
// stone and food bought or sold for gold, in lots of 100, 200 or 300 by the
// market's level. Each purchase of a resource makes the next dearer, each
// sale makes it cheaper; a sale pays three quarters. 20 trades, counted
// again from 0 once 20 hours have passed since the last. Each trade sends
// `trade_resource_b`, which the server's market.py checks with the same
// sums. No drawing here.

import type { Command } from "../net/commands.ts";
import type { ItemInfo } from "./config.ts";
import type { Resource } from "./production.ts";
import type { Town } from "./town.ts";

/** What the market trades, by the save's letter, in the window's order. */
export const MARKET_GOODS = ["w", "s", "f"] as const;
export type Good = (typeof MARKET_GOODS)[number];
export const GOOD_NAMES: Record<Good, Resource> = { w: "wood", s: "stone", f: "food" };

/** The lot each market trades in: the first market and the trolls' first, the second, the third. */
const LOTS = new Map<number, number>([[23, 0], [335, 0], [188, 1], [345, 1], [189, 2], [346, 2]]);

/** The market's numbers: the config's globals, and the Flash client's own for the rest. */
export interface MarketRules {
  /** Gold for 100 of each. */
  baseCosts: Record<Good, number>;
  /** Each purchase so far adds this share of the price (each sale takes it off). */
  increment: number;
  sellShare: number;
  mostPurchases: number;
  mostSales: number;
  /** Seconds after the last trade when the count of trades starts again. */
  period: number;
  mostTrades: number;
  /** The lot of the first, second and third market. */
  lots: number[];
}

export function marketRules(globals: Record<string, unknown>): MarketRules {
  const costs = (globals.MARKET_BASE_COSTS ?? {}) as Partial<Record<Good, number>>;
  const number = (key: string, fallback: number) => Number(globals[key] ?? fallback);
  return {
    baseCosts: { w: Number(costs.w ?? 100), s: Number(costs.s ?? 150), f: Number(costs.f ?? 100) },
    increment: number("MARKET_INCREMENT", 0.02),
    sellShare: number("MARKET_SELL_PERCENTAGE", 0.75),
    mostPurchases: number("MARKET_MAX_INCREMENTS", 200),
    mostSales: number("MARKET_MAX_DECREMENTS", 25),
    period: number("MARKET_PERIOD_HOURS", 20) * 3600,
    // Not in the config: written into the Flash client.
    mostTrades: 20,
    lots: [100, 200, 300],
  };
}

/** The town's trading so far, as the save keeps it. */
export interface MarketState {
  /** Purchases minus sales, by good. */
  traded: Partial<Record<Good, number>>;
  tradesDone: number;
  /** When the last trade was (seconds, the server's clock). */
  lastTrade: number;
}

/** The save's market numbers; the trades start again from 0 when the last was long enough ago, as the town loads. */
export function readMarket(map: { resourcesTraded?: unknown; numTradesDone?: unknown; timestampLastTrade?: unknown },
  rules: MarketRules, now: number): MarketState {
  const traded: Partial<Record<Good, number>> = {};
  const saved = map.resourcesTraded && typeof map.resourcesTraded === "object" ? map.resourcesTraded as Record<string, unknown> : {};
  for (const good of MARKET_GOODS) {
    if (Number.isFinite(Number(saved[good]))) {
      traded[good] = Number(saved[good]);
    }
  }
  const state = { traded, tradesDone: Number(map.numTradesDone) || 0, lastTrade: Number(map.timestampLastTrade) || 0 };
  freshDay(state, rules, now);
  return state;
}

function freshDay(state: MarketState, rules: MarketRules, now: number): void {
  if (now - state.lastTrade > rules.period) {
    state.tradesDone = 0;
  }
}

/** The lot a market building trades in (100, 200 or 300); null for anything else (the allies' markets too). */
export function lotOf(item: ItemInfo, rules: MarketRules): number | null {
  const level = LOTS.get(item.id);
  return level === undefined ? null : rules.lots[level];
}

/** The gold a lot costs, or pays when sold: as the window's buttons show it. */
export function priceOf(rules: MarketRules, state: MarketState, good: Good, lot: number, sell: boolean): number {
  const base = rules.baseCosts[good] * (lot / 100);
  const price = Math.round(base + base * (state.traded[good] ?? 0) * rules.increment);
  return sell ? Math.round(price * rules.sellShare) : price;
}

export function tradesLeft(rules: MarketRules, state: MarketState): number {
  return Math.max(0, rules.mostTrades - state.tradesDone);
}

/** Why a trade didn't happen: no trades left today, not the gold to buy, not the goods to sell. */
export type Refusal = "no-trades" | "no-gold" | "no-goods";

/**
 * Buy or sell a lot: the town's gold and goods change, the count goes on,
 * and the command to send. Refused as in the Flash client: with no trades
 * left, buying without the gold, selling without the goods.
 */
export function trade(town: Town, state: MarketState, rules: MarketRules, good: Good, lot: number, sell: boolean, now: number):
  { refused: Refusal } | { price: number; command: Command } {
  freshDay(state, rules, now);  // the server counts from 0 again too, if the window stayed open that long
  if (tradesLeft(rules, state) <= 0) {
    return { refused: "no-trades" };
  }
  const price = priceOf(rules, state, good, lot, sell);
  const name = GOOD_NAMES[good] as "wood" | "stone" | "food";
  if (!sell && town.gold < price) {
    return { refused: "no-gold" };
  }
  if (sell && town[name] < lot) {
    return { refused: "no-goods" };
  }
  town.gold += sell ? price : -price;
  town[name] += sell ? -lot : lot;
  const count = (state.traded[good] ?? 0) + (sell ? -1 : 1);
  state.traded[good] = Math.min(Math.max(count, -rules.mostSales), rules.mostPurchases);
  state.tradesDone += 1;
  state.lastTrade = now;
  return { price, command: { cmd: "trade_resource_b", args: [town.id, good, sell ? 1 : 0, lot] } };
}
