// Villagers grow with the town hall, as in the Flash client (our notes, our
// words; CLIENT.md, "Villagers at work"). A better town hall makes them walk
// faster and line up more trees and rocks to work one after another, and
// their name says which town hall they have. The Academy (in a troll town,
// the Troll Coliseum) adds to both. No drawing here.

import type { ItemInfo } from "./config.ts";
import type { PlacedItem, Town } from "./town.ts";

/** Each town hall and its number, I to IV (the trolls' stop at III). */
const TOWN_HALLS = new Map([[26, 1], [289, 1], [139, 2], [321, 2], [140, 3], [322, 3], [141, 4]]);
/** By the town hall's number (0 with none): how fast villagers walk, in pixels per frame of the Flash client... */
const SPEED = [3, 5, 5, 6, 6];
/** ...and how many trees and rocks each can have in line. */
const LINE = [3, 5, 7, 9, 10];
/** Their names count from I: no town hall is I as well. */
const NUMERALS = ["I", "I", "II", "III", "IV"];
/** The Academy and the Troll Coliseum: 2 more to the speed and the line. */
const ACADEMIES = new Set([221, 325]);
const ACADEMY_BONUS = 2;
const VILLAGER = 71;
/** The human villagers the barracks and shop offer: they take the name even before there are any. */
const OFFERED = new Set([500, 501]);

/** The town hall's number, I to IV; 0 with none. */
export function townHallLevel(town: Town): number {
  let level = 0;
  for (const placed of town.items) {
    level = Math.max(level, TOWN_HALLS.get(placed.item.id) ?? 0);
  }
  return level;
}

export interface Villagers {
  /** Pixels per frame of the Flash client, as an item's `velocity`. */
  speed: number;
  /** How many trees and rocks a villager can have in line. */
  line: number;
  name: string;
}

export function villagers(town: Town): Villagers {
  const level = townHallLevel(town);
  const bonus = town.items.some((placed) => ACADEMIES.has(placed.item.id)) ? ACADEMY_BONUS : 0;
  return {
    speed: SPEED[level] + bonus,
    line: LINE[level] + bonus,
    name: `${town.race === "t" ? "Peasant" : "Villager"} ${NUMERALS[level]}`,
  };
}

/**
 * Give the villagers their speed and name. The Flash client changes its own
 * copy of the items, so we do too: every villager walks at the speed, and
 * the ones offered for training and those in town take the name. True if
 * anything changed.
 */
export function applyVillagers(town: Town, items: Map<number, ItemInfo>): boolean {
  const now = villagers(town);
  const inTown = new Set(town.items.filter((placed) => placed.item.subcategory === VILLAGER).map((placed) => placed.item));
  let changed = false;
  for (const item of new Set([...items.values(), ...inTown])) {
    if (item.subcategory !== VILLAGER) {
      continue;
    }
    if (item.velocity !== now.speed) {
      item.velocity = now.speed;
      changed = true;
    }
    if ((OFFERED.has(item.id) || inTown.has(item)) && item.name !== now.name) {
      item.name = now.name;
      changed = true;
    }
  }
  return changed;
}

/**
 * A tree or rock tapped with a villager selected: it joins the end of the
 * villager's line (in it already, it moves to the end), if there's room.
 * Null when the line is full. `marked` when it's new in the line (it
 * glows); `goNow` when the villager should set off for it now: it's the
 * only one in line, or the villager isn't busy with another.
 */
export function lineUp(line: PlacedItem[], resource: PlacedItem, room: number, busy: boolean): { marked: boolean; goNow: boolean } | null {
  const at = line.indexOf(resource);
  if (at < 0 && line.length >= room) {
    return null;
  }
  if (at >= 0) {
    line.splice(at, 1);
  }
  line.push(resource);
  return { marked: at < 0, goNow: line.length === 1 || !busy };
}

/**
 * A villager done with a tree or rock: it leaves the line, and so do the
 * ones at the front that are gone or another villager is at. The next one
 * to go to stays at the front until it's done. Null when the line is empty:
 * the villager picks the ones touching the last (work.ts, nextResources).
 */
export function nextInLine(line: PlacedItem[], done: PlacedItem, free: (placed: PlacedItem) => boolean): { next: PlacedItem | null; dropped: PlacedItem[] } {
  const at = line.indexOf(done);
  if (at >= 0) {
    line.splice(at, 1);
  }
  const dropped: PlacedItem[] = [];
  while (line.length > 0 && !free(line[0])) {
    dropped.push(line.shift()!);
  }
  return { next: line[0] ?? null, dropped };
}
