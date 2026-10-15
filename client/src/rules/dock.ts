// The harbour and the zeppelin tower (CLIENT.md, "The harbour and the
// zeppelin"), as the Flash client gives them: each time a human town opens,
// a harbour it hasn't got (on the map, in storage or in the gift box) is put down for free
// near tile (59, 59), unless the Prisoner Princess still waits in the town;
// from level 30, the zeppelin tower the same way. A new one is staffed at
// once by 20 free helpers and opened. No drawing here.

import type { ItemInfo } from "./config.ts";
import { fits } from "./editing.ts";
import { MAP_TILES, type Point } from "./geometry.ts";
import type { Command } from "../net/commands.ts";
import type { PlacedItem, Town } from "./town.ts";

export const HARBOUR = 224;
export const ZEPPELIN_TOWER = 299;
/** A camp's prisoner: while she's in the town, no harbour is given. */
const PRISONER_PRINCESS = 83;
/** The zeppelin tower is given from this level (its shop level is 25). */
export const ZEPPELIN_LEVEL = 30;
/** The free helpers the Flash client hires for a new one, whatever its crew. */
const FREE_HELPERS = 20;
const NEAR: Point = { x: 59, y: 59 };

export interface Given {
  placed: PlacedItem;
  commands: Command[];
}

/** What's given as the town opens: the harbour, then the zeppelin tower, each with its commands. */
export function givenOnOpening(town: Town, items: Map<number, ItemInfo>): Given[] {
  if (town.race !== "h") {
    return [];
  }
  const given: Given[] = [];
  const wanted: number[] = [];
  if (!town.items.some((p) => p.item.id === PRISONER_PRINCESS)) {
    wanted.push(HARBOUR);
  }
  if (town.level >= ZEPPELIN_LEVEL) {
    wanted.push(ZEPPELIN_TOWER);
  }
  for (const id of wanted) {
    const item = items.get(id);
    // Not one on the map, in the town's storage or in the gift box, as the Flash client looks.
    if (!item || town.items.some((p) => p.item.id === id) || (town.store.get(id) ?? 0) > 0 || (town.gifts.get(id) ?? 0) > 0) {
      continue;
    }
    const spot = freeSpotNear(town, item, NEAR);
    if (!spot) {
      continue;
    }
    const placed: PlacedItem = { item, tx: spot.x, ty: spot.y, orientation: 0, unitsInside: 0, units: [], startedAt: null, workTime: 0 };
    town.items.push(placed);
    const at = [spot.x, spot.y, town.id];
    const commands: Command[] = [{ cmd: "buy", args: [id, spot.x, spot.y, 0, town.id, 1, 1, "b"] }];
    for (let i = 0; i < FREE_HELPERS; i++) {
      commands.push({ cmd: "buy_si_help", args: [...at, id, 1] });
    }
    commands.push({ cmd: "finish_si", args: [...at, id] });
    given.push({ placed, commands });
  }
  return given;
}

/** The Wizardry Academy, given at level 35 (`levelThirtyFive`). */
const WIZARDRY_ACADEMY = 416;
export const GOALS_END_LEVEL = 35;

/**
 * Reaching level 35 at home, as the Flash client does it: a Wizardry
 * Academy, free, on the first spot it fits near tile (59, 59), even if the
 * town has one already; none when there's no spot. (The goals stop too:
 * goals.ts.)
 */
export function levelThirtyFive(town: Town, items: Map<number, ItemInfo>): Given | null {
  const item = items.get(WIZARDRY_ACADEMY);
  const spot = item ? freeSpotNear(town, item, NEAR) : null;
  if (!item || !spot) {
    return null;
  }
  const placed: PlacedItem = { item, tx: spot.x, ty: spot.y, orientation: 0, unitsInside: 0, units: [], startedAt: null, workTime: 0 };
  town.items.push(placed);
  return { placed, commands: [{ cmd: "buy", args: [item.id, spot.x, spot.y, 0, town.id, 1, 1, "b"] }] };
}

/** The free spot for the item nearest a tile, on the player's land, ring by ring; null when there's none. */
export function freeSpotNear(town: Town, item: ItemInfo, near: Point): Point | null {
  for (let ring = 0; ring < MAP_TILES; ring++) {
    let best: Point | null = null;
    let bestDistance = Infinity;
    for (let x = near.x - ring; x <= near.x + ring; x++) {
      for (let y = near.y - ring; y <= near.y + ring; y++) {
        if (Math.max(Math.abs(x - near.x), Math.abs(y - near.y)) !== ring) {
          continue;
        }
        const distance = (x - near.x) ** 2 + (y - near.y) ** 2;
        if (distance < bestDistance && fits(town, { item, tx: x, ty: y, orientation: 0 })) {
          best = { x, y };
          bestDistance = distance;
        }
      }
    }
    if (best) {
      return best;
    }
  }
  return null;
}
