// Tidying a town as it opens, as the Flash client does (our notes, our
// words; CLIENT.md, "The living map"). A save can have things on top of each
// other (from a bug, or an old game): the player's buildings that overlap
// another, or stand off the map, go to storage; a unit standing on a
// building steps to the nearest free tile; and a town with no villager gets
// one. Each change updates our copy of the town and returns the commands the
// server needs. No drawing here.

import type { Command } from "../net/commands.ts";
import type { ItemInfo } from "./config.ts";
import { footprintTiles, isOpenLand } from "./editing.ts";
import { MAP_TILES, type Point } from "./geometry.ts";
import { nearestFree } from "./nature.ts";
import type { PlacedItem, Town } from "./town.ts";

const TOWN_HALL = 135, FARM = 122, VILLAGER = 71;
/** Where a villager works out of sight: mills, farms and mines. */
const WORKPLACES = new Set([121, FARM, 124]);
/** Terrain (paths and the like) is built over, here as when placing (rules/editing.ts): it takes no tile. */
const TERRAIN = 6;
/** The villagers a town with none gets one of, by its people. */
const VILLAGERS: Record<string, number[]> = { h: [500, 501], t: [580, 581] };
/** Where a town with no villager gets one: near the middle of the map. */
const NEW_VILLAGER_AT = { x: MAP_TILES / 2 + 4, y: MAP_TILES / 2 + 4 };
/** How far out (in rings of tiles) the new villager looks for a free tile. */
const NEAR = 5;

/**
 * Buildings first, the town hall before all, in the save's order; then the
 * units. Each takes its tiles, if they're free: a building of the player's
 * people that finds one taken, or stands off the map, goes to storage
 * (`store_item_frombug`); anyone else's off the map is removed for nothing;
 * anyone else's on a taken tile stays, as in the Flash client. A unit on a
 * tile something else has (but a farm, which can be walked over) moves to
 * the nearest free tile (`move`); one on the player's land stays on it (the
 * Flash client's units could walk back from anywhere; ours walk on the land).
 */
export function cleanUp(town: Town): { commands: Command[]; stored: PlacedItem[]; moved: PlacedItem[] } {
  const buildingsFirst = (placed: PlacedItem) => (placed.item.isUnit ? 2 : placed.item.subcategory === TOWN_HALL ? 0 : 1);
  const ordered = [...town.items].sort((a, b) => buildingsFirst(a) - buildingsFirst(b));
  const on = new Map<string, PlacedItem>();
  const commands: Command[] = [];
  const stored: PlacedItem[] = [];
  const moved: PlacedItem[] = [];
  const take = (placed: PlacedItem, tiles: [number, number][]) => tiles.forEach(([x, y]) => on.set(`${x},${y}`, placed));
  for (const placed of ordered) {
    if (placed.item.category === TERRAIN) {
      continue;
    }
    const tiles = footprintTiles(placed);
    const offMap = tiles.some(([x, y]) => x < 0 || y < 0 || x >= MAP_TILES || y >= MAP_TILES);
    const under = tiles.map(([x, y]) => on.get(`${x},${y}`)).filter((other) => other !== undefined);
    if (!placed.item.isUnit) {
      const theirs = placed.item.race === town.race;
      if (offMap || under.length > 0) {
        if (theirs) {
          town.items.splice(town.items.indexOf(placed), 1);
          town.store.set(placed.item.id, (town.store.get(placed.item.id) ?? 0) + 1);
          commands.push({ cmd: "store_item_frombug", args: [placed.tx, placed.ty, town.id, placed.item.id] });
          stored.push(placed);
        } else if (offMap) {
          town.items.splice(town.items.indexOf(placed), 1);
          commands.push({ cmd: "sell", args: [placed.tx, placed.ty, placed.item.id, town.id, 1, "OUTOB"] });
        }
        continue;
      }
      take(placed, tiles);
      continue;
    }
    const walkable = under.every((other) => other.item.subcategory === FARM);
    if (under.length > 0 && !walkable) {
      const onLand = isOpenLand(town, placed.tx, placed.ty);
      const to = nearestFree(new Set(on.keys()), { x: placed.tx, y: placed.ty }, (p) => !onLand || isOpenLand(town, p.x, p.y));
      if (to) {
        commands.push({ cmd: "move", args: [placed.tx, placed.ty, placed.item.id, to.x, to.y, 0, town.id, `Colisio #${moved.length + 1}`] });
        placed.tx = to.x;
        placed.ty = to.y;
        moved.push(placed);
        take(placed, [[to.x, to.y]]);
      }
      continue;
    }
    take(placed, tiles);
  }
  return { commands, stored, moved };
}

/**
 * A town with no villager on the map or at work in a farm, mill or mine
 * gets one (a man or a woman of its people, by chance) on a free tile near
 * the middle of the map, as the Flash client does outside its tutorial: one
 * sheltering in a refuge doesn't count. Null when it has one.
 */
export function oneVillager(town: Town, items: Map<number, ItemInfo>, now: number, random = Math.random): { commands: Command[]; villager: PlacedItem } | null {
  const ids = VILLAGERS[town.race] ?? VILLAGERS.h;
  const has = town.items.some((placed) => placed.item.subcategory === VILLAGER
    || (WORKPLACES.has(placed.item.subcategory) && (placed.units ?? []).some((id) => items.get(id)?.subcategory === VILLAGER)));
  const item = items.get(ids[Math.floor(random() * ids.length)]);
  if (has || !item) {
    return null;
  }
  const taken = new Set<string>();
  for (const placed of town.items) {
    if (placed.item.category !== TERRAIN) {
      footprintTiles(placed).forEach(([x, y]) => taken.add(`${x},${y}`));
    }
  }
  const at = freeNear(taken, NEW_VILLAGER_AT, random);
  if (!at) {
    return null;
  }
  const villager: PlacedItem = { item, tx: at.x, ty: at.y, orientation: 0, unitsInside: 0, startedAt: now, workTime: 0 };
  town.items.push(villager);
  return { commands: [{ cmd: "buy", args: [item.id, at.x, at.y, 0, town.id, 1, 1, "u"] }], villager };
}

/** The tile itself if free, else a free one picked at random on the first ring out that has any, up to 5 out. */
function freeNear(taken: Set<string>, at: Point, random: () => number): Point | null {
  for (let ring = 0; ring <= NEAR; ring++) {
    const found: Point[] = [];
    for (let x = at.x - ring; x <= at.x + ring; x++) {
      for (let y = at.y - ring; y <= at.y + ring; y++) {
        if (Math.max(Math.abs(x - at.x), Math.abs(y - at.y)) === ring && !taken.has(`${x},${y}`)) {
          found.push({ x, y });
        }
      }
    }
    if (found.length > 0) {
      return found[Math.floor(random() * found.length)];
    }
  }
  return null;
}
