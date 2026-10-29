// What a speed-up costs: food, not cash (the owner's rule, 29 October
// 2026). Each keeps the original's price in cash (a nest's 3 or 15, a
// dragon rider's 15, a cash an hour for the Soul Mixer and the Chained, 2
// to finish a building's work) and is paid in food at the game's own
// exchange: the bank gives 2,500 gold for 5 cash, and the market sells food
// at a gold each. The server charges the same (speedups.py). No drawing here.

import type { Town } from "./town.ts";

/** Food in place of each cash. */
export const FOOD_PER_CASH = 500;

/** A speed-up's original price in cash, in food. */
export function inFood(cash: number): number {
  return cash * FOOD_PER_CASH;
}

/** A speed-up's price in food, as written on its button: "7,500". */
export function foodText(cash: number): string {
  return inFood(cash).toLocaleString("en-US");
}

/** Why the town can't pay a speed-up's price (its original cash), or null. */
export function cantPayFood(town: Town, cash: number): string | null {
  return town.food < inFood(cash) ? `Not enough food: it takes ${foodText(cash)}.` : null;
}

/** Pays a speed-up's price (its original cash) in food: false, taking nothing, when the town hasn't that much. */
export function payFood(town: Town, cash: number): boolean {
  if (cantPayFood(town, cash)) {
    return false;
  }
  town.food -= inFood(cash);
  return true;
}
