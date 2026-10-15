// Training units and the town's population, as the Flash client runs them
// (our notes, our words; CLIENT.md, "Training and population"). No drawing here.

import type { Command } from "../net/commands.ts";
import type { ItemInfo } from "./config.ts";
import { isTheirs } from "./editing.ts";
import { RESOURCES, type Resource } from "./production.ts";
import type { PlacedItem, Town } from "./town.ts";
import { freeTileNear } from "./work.ts";

/** One unit at a time per building, each taking 3 seconds. */
export const TRAINING_MS = 3000;
/** The most room the town's buildings give; wonders add theirs on top. */
export const MOST_POPULATION = 175;
/** Training costs food too: twice the price (but villagers need none). */
const FOOD_PER_PRICE = 2;
/** A blacksmith takes a tenth off soldiers (footmen, horsemen, archers), a university off siege engines. */
const DISCOUNT = 0.9;
const SUBCAT = {
  villager: 71, footman: 78, mounted: 79, archer: 80, siege: 81,
  blacksmith: 131, university: 134,
};
const WONDERS = 5;
/** The Great Church: each step of its staff adds room (the config's POPULATION_INCREASE). */
const GREAT_CHURCH = 470;

export interface Population {
  current: number;
  max: number;
}

/**
 * Room for people: the population of the player's buildings, up to 175,
 * then the wonders' on top (they count in both, as in the Flash client),
 * and the Great Church's steps. Taken: the population of the player's units
 * on the map and inside their buildings.
 */
export function population(town: Town, items: Map<number, ItemInfo>, increasePerStep = 10): Population {
  let granted = 0;
  let extra = 0;
  let current = 0;
  for (const placed of town.items) {
    const { item } = placed;
    if (!isTheirs(town, item)) {
      continue;
    }
    if (item.isUnit) {
      current += item.population;
      continue;
    }
    if (item.population > 0 || item.capacity > 0) {
      granted += item.population;
      if (item.id === GREAT_CHURCH) {
        // The Great Church's extra is its steps instead of a second count of its own room.
        extra += (town.increasedPopulation ?? 0) * increasePerStep;
      } else if (item.category === WONDERS) {
        extra += item.population;
      }
      for (const id of placed.units ?? []) {
        current += items.get(id)?.population ?? 0;
      }
    }
  }
  return { current, max: Math.min(granted, MOST_POPULATION) + extra };
}

export interface Price {
  resource: Resource;
  amount: number;
  food: number;
  /** What the server is told the price was multiplied by (the discounts). */
  multiplier: number;
}

/** What training a unit costs: its price (less a tenth with a blacksmith or university), and twice that in food. */
export function trainingPrice(town: Town, unit: ItemInfo): Price {
  let multiplier = 1;
  if ([SUBCAT.footman, SUBCAT.mounted, SUBCAT.archer].includes(unit.subcategory) && has(town, SUBCAT.blacksmith)) {
    multiplier = DISCOUNT;
  } else if (unit.subcategory === SUBCAT.siege && has(town, SUBCAT.university)) {
    multiplier = DISCOUNT;
  }
  const amount = Math.ceil(unit.cost * multiplier);
  const food = unit.subcategory === SUBCAT.villager ? 0 : Math.ceil(amount * FOOD_PER_PRICE);
  return { resource: RESOURCES[unit.costType] ?? "gold", amount, food, multiplier };
}

function has(town: Town, subcategory: number): boolean {
  return town.items.some((placed) => placed.item.subcategory === subcategory && isTheirs(town, placed.item));
}

/** How many of an item the town has: on the map and inside its buildings. */
export function countOf(town: Town, id: number): number {
  let n = 0;
  for (const placed of town.items) {
    n += placed.item.id === id ? 1 : 0;
    n += (placed.units ?? []).filter((unit) => unit === id).length;
  }
  return n;
}

/** Why a unit can't be trained now, or null: no room for it, as many as allowed, or not enough to pay. */
export function cantTrain(town: Town, unit: ItemInfo, items: Map<number, ItemInfo>, withCash: boolean): string | null {
  const people = population(town, items);
  if (people.current + unit.population > people.max) {
    return people.current >= MOST_POPULATION ? "Your town can't grow any bigger." : "No room for more people: build houses.";
  }
  if (unit.unitsLimit > 0 && countOf(town, unit.id) >= unit.unitsLimit) {
    return `That's as many ${unit.name} as a town can have.`;
  }
  if (withCash) {
    return town.cash < unit.cashCost ? `Not enough cash: it costs ${unit.cashCost}.` : null;
  }
  const price = trainingPrice(town, unit);
  if (town[price.resource] < price.amount) {
    return `Not enough ${price.resource}.`;
  }
  if (town.food < price.food) {
    return "Not enough food.";
  }
  return null;
}

/** Training starts: the price is paid (in cash, or its price and food), and its experience comes at once. */
export function payForTraining(town: Town, unit: ItemInfo, withCash: boolean): Price {
  const price = trainingPrice(town, unit);
  if (withCash) {
    town.cash -= unit.cashCost;
  } else {
    town[price.resource] -= price.amount;
    town.food -= price.food;
  }
  town.xp += unit.xp;
  return price;
}

/**
 * Training done: the unit stands on the nearest free tile beside the
 * building, and the server is told as the Flash client tells it (`buy`,
 * with the discount, or `buy_cash`). Null when there's no room around it.
 */
export function trained(town: Town, building: PlacedItem, unit: ItemInfo, price: Price, withCash: boolean): { placed: PlacedItem; command: Command } | null {
  const tile = freeTileNear(town, building);
  if (!tile) {
    return null;
  }
  const placed: PlacedItem = { item: unit, tx: tile.x, ty: tile.y, orientation: 0, unitsInside: 0, units: [], startedAt: null, workTime: 0 };
  town.items.push(placed);
  const command = withCash
    ? { cmd: "buy_cash", args: [unit.id, tile.x, tile.y, 0, town.id] }
    : { cmd: "buy", args: [unit.id, tile.x, tile.y, 0, town.id, 0, price.multiplier, "u"] };
  return { placed, command };
}
