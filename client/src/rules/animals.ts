// Wild animals, as in the Flash client (our notes, our words; CLIENT.md,
// "The living map"). Sheep, cows and horses (boars in a troll town) come
// onto the map when the town opens, a few each day. They stand in the wild,
// looking about, until one of the player's units comes near; then they're
// the player's, and walk to a ranch of their kind. Which animals are wild
// isn't saved: the Flash client decides by where they stand when the town
// opens (on the player's land: theirs). No drawing here.

import type { ItemInfo } from "./config.ts";
import { isOpenLand, isTheirs } from "./editing.ts";
import { CART } from "./neighbours.ts";
import type { PlacedItem, Town } from "./town.ts";

export const ANIMAL = { cow: 74, sheep: 75, horse: 88, boar: 90 };
/** Each kind's unit, how many of it the map should have, in whose town, and from which level. */
const WANTED = [
  { kind: ANIMAL.sheep, id: 505, count: 7, race: "h", from: 0 },
  { kind: ANIMAL.cow, id: 504, count: 7, race: "h", from: 0 },
  { kind: ANIMAL.horse, id: 571, count: 6, race: "h", from: 11 },
  { kind: ANIMAL.boar, id: 584, count: 7, race: "t", from: 0 },
];
/** Where each kind goes in: its ranches (horses, the training stable). The hatchery takes any of them. */
const HOMES = new Map([
  [ANIMAL.sheep, [11, 190, 191]], [ANIMAL.cow, [12, 192, 193]], [ANIMAL.horse, [227]], [ANIMAL.boar, [340, 341, 342]],
]);
const HATCHERY = 226;
/** How near (in tiles) one of the player's units must come to catch a wild animal. */
const CATCH_RANGE = 4;

export function isAnimal(item: ItemInfo): boolean {
  return item.isUnit && HOMES.has(item.subcategory);
}

/** As the town opens: the animals off the player's land are wild; those on it, theirs. */
export function markWild(town: Town): void {
  for (const placed of town.items) {
    if (isAnimal(placed.item)) {
      placed.wild = !isOpenLand(town, placed.tx, placed.ty);
    }
  }
}

/**
 * How many of each kind to add as the town opens: the kind's number less
 * those on the map, but no more than the day's room (`perDay` a kind, less
 * those added today: the save's `arrayAnimals`, by kind).
 */
export function animalsToAdd(town: Town, today: Record<string, number>, perDay: number): { kind: number; id: number; count: number }[] {
  const wanted: { kind: number; id: number; count: number }[] = [];
  for (const { kind, id, count, race, from } of WANTED) {
    if (town.race !== race || town.level < from) {
      continue;
    }
    const missing = count - town.items.filter((placed) => placed.item.id === id).length;
    const room = perDay - (Number(today[String(kind)]) || 0);
    const adding = Math.min(missing, room);
    if (adding > 0) {
      wanted.push({ kind, id, count: adding });
    }
  }
  return wanted;
}

/** The animals the Nursery (the hatchery) takes: the white cow and sheep, the horse and the boar. */
const HATCHABLE = new Set([504, 505, 571, 584]);

/**
 * Whether an animal can go into a building: one of its kind's ranches, or
 * the Nursery, which takes only the same animal as the first already inside
 * (any of the four, when empty), as in the Flash client. `inside`: the
 * building's units, by id.
 */
export function canLiveIn(animal: ItemInfo, building: ItemInfo, inside: number[] = []): boolean {
  if (building.id === HATCHERY) {
    return HATCHABLE.has(animal.id) && (inside.length === 0 || inside[0] === animal.id);
  }
  return (HOMES.get(animal.subcategory) ?? []).includes(building.id);
}

/**
 * The wild animals one of the player's units has come near, and so are
 * caught: any of their units on the map (animals caught before too, but not
 * a neighbour's cart) within 4 tiles.
 */
export function caught(town: Town): PlacedItem[] {
  const catchers = town.items.filter((placed) => placed.item.isUnit && !placed.wild && placed.item.id !== CART
    && (isTheirs(town, placed.item) || isAnimal(placed.item)));
  return town.items.filter((animal) => animal.wild && catchers.some((unit) =>
    (unit.tx - animal.tx) ** 2 + (unit.ty - animal.ty) ** 2 <= CATCH_RANGE ** 2));
}

/** Where a caught animal goes: the nearest of its kind's ranches (full or not, as in the Flash client); null with none. */
export function homeFor(town: Town, animal: PlacedItem): PlacedItem | null {
  const homes = HOMES.get(animal.item.subcategory) ?? [];
  let best: PlacedItem | null = null;
  const away = (placed: PlacedItem) => (placed.tx - animal.tx) ** 2 + (placed.ty - animal.ty) ** 2;
  for (const placed of town.items) {
    if (homes.includes(placed.item.id) && (best === null || away(placed) < away(best))) {
      best = placed;
    }
  }
  return best;
}
