// The graveyards (CLIENT.md, "The graveyard"), as the Flash client keeps
// them: every unit of the player's that falls is counted in the save
// (`privateState.deadHeroes`, unit id: how many), the heroes apart. The
// Graveyard (486) brings units back for potions or for half their price
// (and their whole price in food, for those bought with gold); the Heroes'
// Graveyard (239) brings heroes back for gold. No drawing here.

import type { ItemInfo } from "./config.ts";
import { MAP_TILES, type Point } from "./geometry.ts";
import { countOf, fits, population } from "./training.ts";
import { takenTiles } from "./editing.ts";
import type { PlacedItem, Town } from "./town.ts";

export const GRAVEYARD = 486;
export const HEROES_GRAVEYARD = 239;
/** The eight heroes, in the order the Heroes' Graveyard shows them. */
export const HEROES = [535, 533, 534, 550, 554, 555, 556, 557];
/** A cash's worth in gold, as the original priced heroes: what the potion pack's cash comes to. */
const HERO_GOLD_PER_CASH = 500;
/** Room for people stops here (wonders aside). */
const MOST_POPULATION = 175;

/** The fallen: unit id to how many, as the save keeps them (an empty one may come as a list). */
export type Dead = Map<number, number>;

export function readDead(saved: unknown): Dead {
  const dead: Dead = new Map();
  if (saved && typeof saved === "object" && !Array.isArray(saved)) {
    for (const [id, count] of Object.entries(saved as Record<string, unknown>)) {
      if (Number(count) > 0) {
        dead.set(Number(id), Number(count));
      }
    }
  }
  return dead;
}

export function bury(dead: Dead, id: number): void {
  dead.set(id, (dead.get(id) ?? 0) + 1);
}

export function unbury(dead: Dead, id: number): void {
  const left = (dead.get(id) ?? 0) - 1;
  if (left > 0) {
    dead.set(id, left);
  } else {
    dead.delete(id);
  }
}

/**
 * What the Graveyard lists: the fallen of the town's race (or any race)
 * bought with gold or cash, heroes aside, by the shop's order.
 */
export function graveyardUnits(dead: Dead, items: Map<number, ItemInfo>, race: string): { item: ItemInfo; count: number }[] {
  const list: { item: ItemInfo; count: number }[] = [];
  for (const [id, count] of dead) {
    const item = items.get(id);
    if (!item || HEROES.includes(id) || !(item.costType === "g" || item.costType === "c") || item.cost <= 0
      || !(item.race === race || item.race === "a")) {
      continue;
    }
    list.push({ item, count });
  }
  return list.sort((a, b) => a.item.displayOrder - b.item.displayOrder || a.item.id - b.item.id);
}

/** Health times attack, for each food it takes to bring a unit back. */
export const STRENGTH_PER_FOOD = 8;

/**
 * What bringing a unit back costs: its potions, or what it's worth in battle
 * (the owner's rule, 31 October 2026): a food for each 8 points of its
 * health times attack, and half that in gold, never cash. 8 is how the game
 * prices its own gold units, at the median, so an ordinary unit costs about
 * what it did (the original asked its whole price in food and half in gold);
 * a strong dragon costs in proportion. The server asks the same (graveyard.py).
 */
export function revivalPrice(item: ItemInfo): { potions: number; gold: number; food: number } {
  const sold = item.costType === "g" || item.costType === "c";
  const food = sold ? Math.ceil(item.life * Math.max(item.attack, 1) / STRENGTH_PER_FOOD) : 0;  // a few, like eggs, don't attack
  return { potions: item.potion ?? 0, gold: Math.ceil(food / 2), food };
}

/** The potion pack's price, its cash (the config's GRAVEYARD_POTIONS) at 500 gold a cash, half in gold and half in food. */
export function potionPackPrice(cash: number): { gold: number; food: number } {
  const gold = Math.floor(cash * HERO_GOLD_PER_CASH / 2);
  return { gold, food: cash * HERO_GOLD_PER_CASH - gold };
}

/** A hero brought back from the Heroes' Graveyard: by strength too (the original asked 500 gold a cash of its price). */
export function heroPrice(item: ItemInfo): { gold: number; food: number } {
  const { gold, food } = revivalPrice({ ...item, costType: "g" });  // heroes are gold units
  return { gold, food };
}

/** Why a unit can't come back now (no room, as many as allowed), or null. */
export function cantRevive(town: Town, item: ItemInfo, items: Map<number, ItemInfo>): string | null {
  const people = population(town, items);
  if (!fits(people, item)) {
    return people.current >= MOST_POPULATION ? "Your town can't grow any bigger." : "No room for more people: build houses.";
  }
  if (item.unitsLimit > 0 && countOf(town, item.id) >= item.unitsLimit) {
    return `That's as many ${item.name} as a town can have.`;
  }
  return null;
}

/**
 * Where a unit comes back: the nearest free tile round the building's tile,
 * ring by ring; on the first ring with a free tile, the one furthest down
 * and right (the original takes the one nearest (200, 200)). The building's
 * own tile when the map is full.
 */
export function revivalSpot(town: Town, at: Point): Point {
  const taken = takenTiles(town);
  for (let ring = 1; ring < MAP_TILES; ring++) {
    let best: Point | null = null;
    let bestDistance = Infinity;
    for (let x = at.x - ring; x <= at.x + ring; x++) {
      for (let y = at.y - ring; y <= at.y + ring; y++) {
        if (Math.max(Math.abs(x - at.x), Math.abs(y - at.y)) !== ring || x < 0 || y < 0 || x >= MAP_TILES || y >= MAP_TILES || taken.has(`${x},${y}`)) {
          continue;
        }
        const distance = (200 - x) ** 2 + (200 - y) ** 2;
        if (distance < bestDistance) {
          best = { x, y };
          bestDistance = distance;
        }
      }
    }
    if (best) {
      return best;
    }
  }
  return { ...at };
}

/** A price as the game writes it: 1000 or more as thousands with a "k" (1.5k, 17.5k). */
export function shortPrice(amount: number): string {
  return amount >= 1000 ? `${Math.round(amount / 100) / 10}k` : String(amount);
}

/** A unit back (from a graveyard or the Altar of Heroes): it stands on the nearest free tile to the building. */
export function standBeside(town: Town, item: ItemInfo, building: { tx: number; ty: number }): PlacedItem {
  const tile = revivalSpot(town, { x: building.tx, y: building.ty });
  const placed: PlacedItem = { item, tx: tile.x, ty: tile.y, orientation: 0, unitsInside: 0, units: [], startedAt: null, workTime: 0 };
  town.items.push(placed);
  return placed;
}
