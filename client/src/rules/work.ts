// Villagers at work, and units going into buildings, as the Flash client
// runs them (our notes, our words; CLIENT.md, "Villagers at work"): cutting
// trees and mining rocks on the map, rocks growing back, units walking into
// mills, mines, farms and refuges, and being let out again. Each change
// updates our copy of the town and returns the commands the server needs.
// No drawing here.

import type { Command } from "../net/commands.ts";
import { canLiveIn, isAnimal } from "./animals.ts";
import type { ItemInfo } from "./config.ts";
import { DRAGON_TAMING, RIDER_IDS } from "./dragonRiders.ts";
import { inConstruction } from "./construction.ts";
import { takenTiles } from "./editing.ts";
import { MAP_TILES, type Point } from "./geometry.ts";
import { RESOURCES, type Resource } from "./production.ts";
import type { PlacedItem, Town } from "./town.ts";
import { gridFor, isWalkable, reachable } from "./walking.ts";
import { UNIT_WAREHOUSE, warehouseCapacity, warehouseCount, warehouseUnits } from "./warehouse.ts";

export const SUBCAT = {
  villager: 71, siege: 81,
  mill: 121, farm: 122, mine: 124,
  tree: 125, stone: 126, gold: 127, regrowing: 128,
  refuge: 1311,
};
/** The things on the map a villager works: trees for wood, stone and gold rocks. */
const RESOURCE_KINDS = new Set([SUBCAT.tree, SUBCAT.stone, SUBCAT.gold]);
/** What a villager can go into to work. */
const WORKPLACES = new Set([SUBCAT.mill, SUBCAT.mine, SUBCAT.farm]);
/** The Sacrifice Altar: a mine by its kind, but it sacrifices whoever goes in (in the classic game for now). */
const SACRIFICE_ALTAR = 225;
/** A cleared rock leaves one growing back; after its time it's a new rock of a kind picked at random. */
export const REGROWING = { stone: 81, gold: 80 };
const NEW_ROCKS = { [REGROWING.stone]: 69, [REGROWING.gold]: 73 };
/** How far out (in rings of tiles) a unit looks for a place to stand by what it's going to. */
const NEAR = 4;

export function isResource(item: ItemInfo): boolean {
  return RESOURCE_KINDS.has(item.subcategory);
}

/** Whether a unit can work a thing on the map: villagers cut trees and mine stone and gold. */
export function canHarvest(unit: ItemInfo, target: ItemInfo): boolean {
  return unit.subcategory === SUBCAT.villager && isResource(target);
}

/**
 * Whether a unit can go into a building: one of the player's, with room;
 * villagers into mills, mines and farms; animals into ranches of their kind
 * (rules/animals.ts); any unit into a refuge, siege engines too, as in the
 * Flash client; not into one burnt out in a raid, nor one still being
 * built (`now`: milliseconds, rules/construction.ts). (The special
 * buildings such as the Sacrifice Altar come later.)
 */
export function canGoInside(town: Town, unit: ItemInfo, building: PlacedItem, now = Date.now()): boolean {
  const target = building.item;
  if (target.isUnit || inConstruction(building, now)) {
    return false;
  }
  if (building.ruined) {
    return false;  // burnt out: nobody goes in until it's repaired in full, as in the original
  }
  if (target.race !== town.race && target.race !== "a") {
    return false;
  }
  if (target.id === UNIT_WAREHOUSE) {
    return unit.isUnit && warehouseCount(town) < warehouseCapacity(town);
  }
  if (building.unitsInside >= target.capacity) return false;
  if (target.subcategory === SUBCAT.refuge) {
    return true;
  }
  if (target.id === DRAGON_TAMING) {
    const rider = RIDER_IDS.some((id) => id === unit.id);
    if (!rider && !unit.dragonRider) return false;
    // A dragon and a rider, in either order. A wrong rider type can enter;
    // the original explains that mismatch inside the taming window.
    const inside = building.units ?? [];
    return inside.length === 0 || (inside.length === 1 && RIDER_IDS.some((id) => id === inside[0]) !== rider);
  }
  if (isAnimal(unit)) {
    return canLiveIn(unit, target, building.units ?? []);
  }
  return unit.subcategory === SUBCAT.villager && WORKPLACES.has(target.subcategory) && target.id !== SACRIFICE_ALTAR;
}

/**
 * Where a unit stands to work a thing or go into it: a free tile in the
 * rings around the thing's tile (the corner the save names), the first ring
 * with any, the one nearest the unit; it must be reachable. Null when there's none.
 * `avoid`: tiles ("x,y") others sent with it have taken, so a group spreads out.
 */
export function standingTile(town: Town, unit: PlacedItem, target: PlacedItem, avoid: Set<string> = new Set()): Point | null {
  const grid = gridFor(town, unit);
  const taken = takenTiles(town, unit);
  // Where it can get to, worked out once (and only if there's a free tile to look at).
  let canReach: ((tile: Point) => boolean) | null = null;
  for (let ring = 1; ring <= NEAR; ring++) {
    const around: Point[] = [];
    for (let x = target.tx - ring; x <= target.tx + ring; x++) {
      for (let y = target.ty - ring; y <= target.ty + ring; y++) {
        const edge = Math.max(Math.abs(x - target.tx), Math.abs(y - target.ty)) === ring;
        if (edge && isWalkable(grid, x, y) && !taken.has(`${x},${y}`) && !avoid.has(`${x},${y}`)) {
          around.push({ x, y });
        }
      }
    }
    around.sort((a, b) => distance2(a, unit) - distance2(b, unit));
    canReach ??= reachable(town, unit, { x: unit.tx, y: unit.ty });
    const tile = around.find((t) => canReach!(t));
    if (tile) {
      return tile;
    }
  }
  return null;
}

function distance2(a: Point, unit: PlacedItem): number {
  return (a.x - unit.tx) ** 2 + (a.y - unit.ty) ** 2;
}

/** The academies that make harvesting quick: the Forestry Academy for trees, the Minery Academy for rocks. */
const FORESTRY_ACADEMY = 223;
const MINERY_ACADEMY = 222;

/**
 * How long a tree or rock takes to work, in whole seconds, from the first
 * villager's arrival. With the town's Forestry Academy (trees) or Minery
 * Academy (stone and gold) it's done in a second, as in the Flash client.
 */
export function harvestSeconds(resource: ItemInfo, town?: Town): number {
  const academy = resource.subcategory === SUBCAT.tree ? FORESTRY_ACADEMY
    : resource.subcategory === SUBCAT.stone || resource.subcategory === SUBCAT.gold ? MINERY_ACADEMY : 0;
  if (academy && town?.items.some((placed) => placed.item.id === academy)) {
    return 1;
  }
  return Math.max(Math.ceil(resource.activation), 1);
}

/** Gold rocks give more as the town grows: 1 to 5 times, by level. */
export function goldMultiplier(level: number): number {
  return level <= 10 ? 1 : level <= 15 ? 2 : level <= 20 ? 3 : level <= 25 ? 4 : 5;
}

export interface Harvested {
  commands: Command[];
  resource: Resource;
  amount: number;
  xp: number;
  /** A rock growing back where it was (null for a tree). */
  regrowing: PlacedItem | null;
}

/**
 * A tree or rock worked to the end: what it gives goes to the town (gold
 * times the level's multiplier), it goes from the map, and a rock leaves one
 * growing back. `workers`: how many villagers were at it, as the server is told.
 */
export function harvested(town: Town, resource: PlacedItem, workers: number, now: number, items: Map<number, ItemInfo>): Harvested {
  const { item } = resource;
  const kind = RESOURCES[item.collectType] ?? "wood";
  const multiplier = item.subcategory === SUBCAT.gold ? goldMultiplier(town.level) : 1;
  const amount = Math.floor(item.collect) * multiplier;
  town[kind] += amount;
  town.xp += item.collectXp;
  remove(town, resource);
  const at = [resource.tx, resource.ty];
  const commands: Command[] = [
    { cmd: "collect_new", args: [...at, town.id, item.id, workers, multiplier, 0] },
    { cmd: "sell", args: [at[0], at[1], item.id, town.id, 0, "HARV"] },
  ];
  let regrowing: PlacedItem | null = null;
  const regrowId = item.subcategory === SUBCAT.stone ? REGROWING.stone : item.subcategory === SUBCAT.gold ? REGROWING.gold : null;
  const regrowItem = regrowId === null ? undefined : items.get(regrowId);
  if (regrowItem) {
    regrowing = { item: regrowItem, tx: resource.tx, ty: resource.ty, orientation: 1, unitsInside: 0, units: [], startedAt: now, workTime: 0 };
    town.items.push(regrowing);
    commands.push({ cmd: "buy", args: [regrowItem.id, ...at, 1, town.id, 0, 1, "b"] });
  }
  return { commands, resource: kind, amount, xp: item.collectXp, regrowing };
}

/**
 * The next trees or rocks of the same kind after one is done: those that
 * touch it, and those that touch them, and so on, nearest first, without
 * the ones another villager is at.
 */
export function nextResources(town: Town, done: Point, kind: number, busy: (placed: PlacedItem) => boolean): PlacedItem[] {
  const at = new Map<string, PlacedItem>();
  for (const placed of town.items) {
    if (placed.item.subcategory === kind) {
      at.set(`${placed.tx},${placed.ty}`, placed);
    }
  }
  const found = new Set<PlacedItem>();
  const look = [done];
  while (look.length > 0) {
    const { x, y } = look.pop()!;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const next = at.get(`${x + dx},${y + dy}`);
        if (next && !found.has(next) && !(next.tx === done.x && next.ty === done.y)) {
          found.add(next);
          look.push({ x: next.tx, y: next.ty });
        }
      }
    }
  }
  // The Flash client sorts them by a rough distance in tiles from where it finished.
  const rough = (p: PlacedItem) => Math.max(Math.abs(p.tx - done.x), Math.abs(p.ty - done.y));
  return [...found].filter((p) => !busy(p)).sort((a, b) => rough(a) - rough(b));
}

/**
 * A rock growing back whose time is up becomes a new rock, of one of the
 * four kinds by chance. The commands and the new rock, or null when it isn't time yet.
 */
export function regrow(town: Town, placed: PlacedItem, now: number, items: Map<number, ItemInfo>, random = Math.random): { commands: Command[]; rock: PlacedItem } | null {
  const first = NEW_ROCKS[placed.item.id];
  if (first === undefined || placed.startedAt === null || now < placed.startedAt + placed.item.activation) {
    return null;
  }
  const rockItem = items.get(first + Math.floor(random() * 4));
  if (!rockItem) {
    return null;
  }
  remove(town, placed);
  const rock: PlacedItem = { item: rockItem, tx: placed.tx, ty: placed.ty, orientation: 1, unitsInside: 0, units: [], startedAt: null, workTime: 0 };
  town.items.push(rock);
  return {
    rock,
    commands: [
      { cmd: "sell", args: [placed.tx, placed.ty, placed.item.id, town.id, 0, "REGEN"] },
      { cmd: "buy", args: [rockItem.id, placed.tx, placed.ty, 1, town.id, 0, 1, "b"] },
    ],
  };
}

/**
 * A unit walks into a building: it leaves the map, and a building with
 * nobody inside starts its work now (a mill whose time is chosen waits for
 * the choice). `from`: where the save has the unit, as the server is told.
 */
export function goInside(town: Town, unit: PlacedItem, building: PlacedItem, from: Point, now: number): Command {
  remove(town, unit);
  if (building.item.id === UNIT_WAREHOUSE) {
    const units = warehouseUnits(town);
    units.set(unit.item.id, (units.get(unit.item.id) ?? 0) + 1);
    return { cmd: "add_unit_warehouse", args: [from.x, from.y, town.id, unit.item.id] };
  }
  if (building.unitsInside === 0) {
    building.startedAt = now;
  }
  building.units = [...(building.units ?? []), unit.item.id];
  building.unitsInside += 1;
  return { cmd: "push_unit", args: [from.x, from.y, unit.item.id, building.tx, building.ty, town.id] };
}

/**
 * Let a unit in a building out (the last in, or the one at `index`, tapped
 * on the card), onto the nearest free tile around it
 * (anywhere on the map, nearest first). The unit, and the commands; null when
 * nobody's inside, the config doesn't know them, or there's no room. The last
 * one out ends the building's work, as in the Flash client: a mill or mine
 * whose time is chosen forgets the choice too (`activate`, 0), and asks again
 * when the next worker comes in.
 */
export function letOut(town: Town, building: PlacedItem, items: Map<number, ItemInfo>, index = -1): { unit: PlacedItem; commands: Command[] } | null {
  const id = building.units?.at(index);
  const item = id === undefined ? undefined : items.get(id);
  if (!item) {
    return null;
  }
  const tile = freeTileNear(town, building);
  if (!tile) {
    return null;
  }
  const gone = index < 0 ? building.units!.length + index : index;
  building.units = building.units!.filter((_, i) => i !== gone);
  building.unitsInside = Math.max(building.unitsInside - 1, 0);
  const unit: PlacedItem = { item, tx: tile.x, ty: tile.y, orientation: 0, unitsInside: 0, units: [], startedAt: null, workTime: 0 };
  town.items.push(unit);
  const commands: Command[] = [{ cmd: "pop_unit", args: [building.tx, building.ty, town.id, item.id, tile.x, tile.y, 0] }];
  if (building.unitsInside === 0) {
    building.startedAt = null;
    if (building.item.production?.kind === "chosen") {
      building.workTime = 0;
      commands.push({ cmd: "activate", args: [building.tx, building.ty, town.id, building.item.id, 0] });
    }
  }
  return { unit, commands };
}

/** Everybody out, as the Flash client does before a building is sold or stored. */
export function letAllOut(town: Town, building: PlacedItem, items: Map<number, ItemInfo>): { unit: PlacedItem; commands: Command[] }[] {
  const out = [];
  while ((building.units?.length ?? 0) > 0) {
    const one = letOut(town, building, items);
    if (!one) {
      break;
    }
    out.push(one);
  }
  return out;
}

/**
 * Where a unit comes out by a building (trained, let out) or is put by the
 * town hall: ring by ring round the building's tile, the first ring with a
 * free tile, and on it the one nearest the far corner of the map, anywhere
 * on the map, as in the Flash client. (A unit put off the bought land walks
 * back when it's sent: rules/walking.ts.)
 */
export function freeTileNear(town: Town, building: PlacedItem): Point | null {
  const taken = takenTiles(town);
  // Past the map's last corner: the tile nearest it is the furthest down the map.
  const corner = 2 * MAP_TILES;
  const away = (p: Point) => (p.x - corner) ** 2 + (p.y - corner) ** 2;
  for (let ring = 1; ring < MAP_TILES; ring++) {
    let best: Point | null = null;
    for (let x = building.tx - ring; x <= building.tx + ring; x++) {
      for (let y = building.ty - ring; y <= building.ty + ring; y++) {
        const edge = Math.max(Math.abs(x - building.tx), Math.abs(y - building.ty)) === ring;
        const inMap = x >= 0 && y >= 0 && x < MAP_TILES && y < MAP_TILES;
        if (edge && inMap && !taken.has(`${x},${y}`) && (!best || away({ x, y }) < away(best))) {
          best = { x, y };
        }
      }
    }
    if (best) {
      return best;
    }
  }
  return null;
}

function remove(town: Town, placed: PlacedItem): void {
  const index = town.items.indexOf(placed);
  if (index >= 0) {
    town.items.splice(index, 1);
  }
}
