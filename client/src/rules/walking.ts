// Units walking in town, as the Flash client walks them (our notes, our
// words; CLIENT.md, "Units walking"). Which tiles a unit can walk on, the
// way it finds a path, which way it faces, how fast it goes, and the command
// that tells the server where it stopped. No drawing here.

import type { Command } from "../net/commands.ts";
import { isAnimal } from "./animals.ts";
import { inConstruction } from "./construction.ts";
import { footprintSize, footprintTiles, isOpenLand } from "./editing.ts";
import { MAP_TILES, TILE_HEIGHT, TILE_WIDTH, unitPoint, type Point } from "./geometry.ts";
import type { PlacedItem, Town } from "./town.ts";

const TERRAIN = 6;
const SUBCAT_FARM = 122;
const SUBCAT_GATE = 222;

/** The Flash client's frame rate: a unit's `velocity` is in pixels per frame of it. */
export const FLASH_FPS = 30;

/** Which tiles can be walked on: 1 or 0 for each of the 100 x 100, row by row (y * 100 + x). */
export type WalkGrid = Uint8Array;

/**
 * Where units walk: the whole map, the wild ring and land not yet bought
 * too, except under buildings, as the Flash client's paths go. Fields
 * (farms) and open wall gates can be walked over, and units don't stand in
 * each other's way. Without `anywhere`, only the bought land (for what must
 * stand on it, not for walking).
 */
export function walkGrid(town: Town, anywhere = false): WalkGrid {
  const grid = new Uint8Array(MAP_TILES * MAP_TILES);
  for (let y = 0; y < MAP_TILES; y++) {
    for (let x = 0; x < MAP_TILES; x++) {
      grid[y * MAP_TILES + x] = anywhere || isOpenLand(town, x, y) ? 1 : 0;
    }
  }
  for (const placed of town.items) {
    if (!blocksWalking(placed)) {
      continue;
    }
    for (const [x, y] of footprintTiles(placed)) {
      if (inMap(x, y)) {
        grid[y * MAP_TILES + x] = 0;
      }
    }
  }
  return grid;
}

/** Whether a thing stands in units' way: buildings do; units, the ground, fields and open gates don't. */
function blocksWalking(placed: PlacedItem): boolean {
  return !(placed.item.isUnit || placed.item.category === TERRAIN || placed.item.subcategory === SUBCAT_FARM
    || (placed.item.subcategory === SUBCAT_GATE && placed.open));
}

/**
 * Whether one tile can be walked on, as walkGrid(town, true) has it, without
 * making the whole grid: for each tile a walking unit steps onto, to see
 * whether something has been built there since it set off.
 */
export function isClearTile(town: Town, x: number, y: number): boolean {
  if (!inMap(x, y)) {
    return false;
  }
  for (const placed of town.items) {
    // A thing covers the tiles up to its own, back by its size (editing.ts, footprintTiles).
    const [w, h] = footprintSize(placed);
    if (x <= placed.tx && x > placed.tx - w && y <= placed.ty && y > placed.ty - h && blocksWalking(placed)) {
      return false;
    }
  }
  return true;
}

/**
 * Where a unit can walk: anywhere on the map but through buildings, as in
 * the Flash client, so villagers walk out to the trees and rocks that grow
 * in the wild (rules/nature.ts) and an animal caught there walks in.
 */
export function gridFor(town: Town, _unit: PlacedItem): WalkGrid {
  return walkGrid(town, true);
}

function inMap(x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < MAP_TILES && y < MAP_TILES;
}

export function isWalkable(grid: WalkGrid, x: number, y: number): boolean {
  return inMap(x, y) && grid[y * MAP_TILES + x] === 1;
}

/**
 * The ground a unit standing at `from` walks on: its own (gridFor), unless
 * it stands under a building (a gate shut on it, a building put down where
 * it stood). Then it walks out across that building; where it's sent must
 * be on its ground all the same (unitPath, reachable).
 */
function groundFrom(town: Town, unit: PlacedItem, from: Point): { grid: WalkGrid; ground: WalkGrid } {
  const grid = gridFor(town, unit);
  if (isWalkable(grid, from.x, from.y) || !inMap(from.x, from.y)) {
    return { grid, ground: grid };
  }
  const ground = grid.slice();
  ground[from.y * MAP_TILES + from.x] = 1;
  for (const key of tilesUnder(town, from)) {
    const [x, y] = key.split(",").map(Number);
    ground[y * MAP_TILES + x] = 1;
  }
  return { grid, ground };
}

/** The tiles ("x,y") of the buildings standing on a tile: a unit there may walk out across them. */
export function tilesUnder(town: Town, at: Point): Set<string> {
  const tiles = new Set<string>();
  for (const placed of town.items) {
    const footprint = placed.item.isUnit ? [] : footprintTiles(placed);
    if (footprint.some(([x, y]) => x === at.x && y === at.y)) {
      footprint.filter(([x, y]) => inMap(x, y)).forEach(([x, y]) => tiles.add(`${x},${y}`));
    }
  }
  return tiles;
}

/** A unit's way from one tile to another (findPath), out of a building first if it stands in one. */
export function unitPath(town: Town, unit: PlacedItem, from: Point, to: Point): Point[] | null {
  if (unit.item.flying) {
    return findPath(gridFor(town, unit), from, to, true);
  }
  const { grid, ground } = groundFrom(town, unit, from);
  return isWalkable(grid, to.x, to.y) ? findPath(ground, from, to) : null;
}

/**
 * Every tile a unit standing at `from` can walk to, found at once (by
 * spreading out from it with the path finder's steps): for choosing among
 * many tiles without a path search for each.
 */
export function reachable(town: Town, unit: PlacedItem, from: Point): (tile: Point) => boolean {
  if (unit.item.flying) {
    return (tile) => inMap(tile.x, tile.y);
  }
  const { grid, ground } = groundFrom(town, unit, from);
  const seen = new Uint8Array(MAP_TILES * MAP_TILES);
  if (inMap(from.x, from.y) && isWalkable(ground, from.x, from.y)) {
    const queue = [from.y * MAP_TILES + from.x];
    seen[queue[0]] = 1;
    while (queue.length > 0) {
      const at = queue.pop()!;
      const cx = at % MAP_TILES;
      const cy = (at - cx) / MAP_TILES;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = cx + dx;
          const ny = cy + dy;
          if ((dx === 0 && dy === 0) || !isWalkable(ground, nx, ny) || seen[ny * MAP_TILES + nx]) {
            continue;
          }
          // As findPath: no squeezing diagonally between two corners.
          if (dx !== 0 && dy !== 0 && (!isWalkable(ground, cx + dx, cy) || !isWalkable(ground, cx, cy + dy))) {
            continue;
          }
          seen[ny * MAP_TILES + nx] = 1;
          queue.push(ny * MAP_TILES + nx);
        }
      }
    }
  }
  return (tile) => isWalkable(grid, tile.x, tile.y) && seen[tile.y * MAP_TILES + tile.x] === 1
    || (tile.x === from.x && tile.y === from.y);
}

/**
 * The tiles to walk through from one tile to another, the last being the
 * destination (the start not included); [] when already there; null when
 * there's no way (blocked, or walled off). Paths go in 8 directions, but
 * never cut a corner past something in the way. Flying units go straight.
 */
export function findPath(grid: WalkGrid, from: Point, to: Point, flying = false): Point[] | null {
  if (!inMap(from.x, from.y) || !inMap(to.x, to.y)) {
    return null;
  }
  if (from.x === to.x && from.y === to.y) {
    return [];
  }
  if (flying) {
    return straightLine(from, to);
  }
  if (!isWalkable(grid, from.x, from.y) || !isWalkable(grid, to.x, to.y)) {
    return null;
  }
  // A*, with steps costing 10 straight and 14 diagonally, and the distance
  // still to go guessed as diagonal steps then straight ones.
  const size = MAP_TILES * MAP_TILES;
  const cost = new Float64Array(size).fill(Infinity);
  const cameFrom = new Int32Array(size).fill(-1);
  const closed = new Uint8Array(size);
  const start = from.y * MAP_TILES + from.x;
  const goal = to.y * MAP_TILES + to.x;
  const open = new Heap();
  cost[start] = 0;
  open.push(start, guess(from.x, from.y, to));
  while (open.size > 0) {
    const current = open.pop();
    if (current === goal) {
      return route(cameFrom, start, goal);
    }
    if (closed[current]) {
      continue;
    }
    closed[current] = 1;
    const cx = current % MAP_TILES;
    const cy = (current - cx) / MAP_TILES;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = cx + dx;
        const ny = cy + dy;
        if ((dx === 0 && dy === 0) || !isWalkable(grid, nx, ny)) {
          continue;
        }
        const diagonal = dx !== 0 && dy !== 0;
        // No squeezing between two corners: both tiles beside a diagonal step must be free.
        if (diagonal && (!isWalkable(grid, cx + dx, cy) || !isWalkable(grid, cx, cy + dy))) {
          continue;
        }
        const next = ny * MAP_TILES + nx;
        const through = cost[current] + (diagonal ? 14 : 10);
        if (!closed[next] && through < cost[next]) {
          cost[next] = through;
          cameFrom[next] = current;
          open.push(next, through + guess(nx, ny, to));
        }
      }
    }
  }
  return null;
}

function guess(x: number, y: number, to: Point): number {
  const dx = Math.abs(to.x - x);
  const dy = Math.abs(to.y - y);
  return 10 * Math.max(dx, dy) + 4 * Math.min(dx, dy);
}

function route(cameFrom: Int32Array, start: number, goal: number): Point[] {
  const path: Point[] = [];
  for (let at = goal; at !== start; at = cameFrom[at]) {
    path.push({ x: at % MAP_TILES, y: Math.floor(at / MAP_TILES) });
  }
  return path.reverse();
}

/** The tiles on a straight line from one tile to another, the start left out. */
function straightLine(from: Point, to: Point): Point[] {
  const steps = Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y));
  const path: Point[] = [];
  for (let i = 1; i <= steps; i++) {
    path.push({ x: Math.round(from.x + ((to.x - from.x) * i) / steps), y: Math.round(from.y + ((to.y - from.y) * i) / steps) });
  }
  return path;
}

/** The open list: the tile with the lowest guess first. */
class Heap {
  private readonly keys: number[] = [];
  private readonly values: number[] = [];

  get size(): number {
    return this.keys.length;
  }

  push(key: number, value: number): void {
    this.keys.push(key);
    this.values.push(value);
    let i = this.keys.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.values[parent] <= this.values[i]) {
        break;
      }
      this.swap(i, parent);
      i = parent;
    }
  }

  pop(): number {
    const top = this.keys[0];
    const lastKey = this.keys.pop()!;
    const lastValue = this.values.pop()!;
    if (this.keys.length > 0) {
      this.keys[0] = lastKey;
      this.values[0] = lastValue;
      let i = 0;
      for (;;) {
        const left = 2 * i + 1;
        const right = left + 1;
        let smallest = i;
        if (left < this.keys.length && this.values[left] < this.values[smallest]) {
          smallest = left;
        }
        if (right < this.keys.length && this.values[right] < this.values[smallest]) {
          smallest = right;
        }
        if (smallest === i) {
          break;
        }
        this.swap(i, smallest);
        i = smallest;
      }
    }
    return top;
  }

  private swap(a: number, b: number): void {
    [this.keys[a], this.keys[b]] = [this.keys[b], this.keys[a]];
    [this.values[a], this.values[b]] = [this.values[b], this.values[a]];
  }
}

/** The 8 ways a unit faces (as rules/geometry.ts numbers them). */
export const DIRECTION = { up: 1, upRight: 2, right: 3, downRight: 4, down: 5, upLeft: 6, left: 7, downLeft: 8 } as const;

/**
 * Which way a unit at `from` faces to look at `to` (both points on the
 * map), as the Flash client decides: by whether the point is left or right,
 * and above or below. Something closer than a third of a tile each way
 * doesn't turn it (`current` is kept).
 */
export function directionTo(from: Point, to: Point, current: number): number {
  if (Math.abs(to.x - from.x) < TILE_WIDTH / 3 && Math.abs(to.y - from.y) < TILE_HEIGHT / 3) {
    return current;
  }
  return headingTo(from, to, current);
}

/** The same without the third-of-a-tile rule: the way to walk to the next point. */
export function headingTo(from: Point, to: Point, current: number): number {
  const right = to.x > from.x;
  const left = to.x < from.x;
  const up = to.y < from.y;
  const down = to.y > from.y;
  if (right) {
    return up ? DIRECTION.upRight : down ? DIRECTION.downRight : DIRECTION.right;
  }
  if (left) {
    return up ? DIRECTION.upLeft : down ? DIRECTION.downLeft : DIRECTION.left;
  }
  return up ? DIRECTION.up : down ? DIRECTION.down : current;
}

/**
 * A unit standing in town now and then looks around: every 61 frames of the
 * Flash client (about 2 seconds) there's a 4% chance it turns towards one of
 * the tiles around it. The new way it faces, or null when it doesn't turn.
 */
export const LOOK_AROUND_MS = (61 * 1000) / FLASH_FPS;

export function lookAround(placed: PlacedItem, current: number, random: () => number = Math.random): number | null {
  if (random() >= 0.04) {
    return null;
  }
  const dx = Math.round(random() * 2) - 1;
  const dy = Math.round(random() * 2) - 1;
  const here = unitPoint(placed.tx, placed.ty);
  const there = unitPoint(placed.tx + dx, placed.ty + dy);
  return directionTo(here, there, current);
}

/**
 * One step of a walk towards `to`: the Flash client moves the unit `speed`
 * pixels a frame along the longer of x and y, and the other in proportion,
 * so it reaches both at once. Returns where it is after `ms`.
 */
export function stepTowards(at: Point, to: Point, velocity: number, ms: number): Point {
  const reach = (velocity * FLASH_FPS * ms) / 1000;
  const dx = to.x - at.x;
  const dy = to.y - at.y;
  const longest = Math.max(Math.abs(dx), Math.abs(dy));
  if (longest <= reach) {
    return { ...to };
  }
  return { x: at.x + (dx * reach) / longest, y: at.y + (dy * reach) / longest };
}

/** Whether a unit is the player's to send about: their people's, anyone's, or an animal they caught (rules/animals.ts); not while it's being built. */
export function canWalk(town: Town, placed: PlacedItem, now = Date.now()): boolean {
  const theirs = placed.item.race === town.race || placed.item.race === "a" || (isAnimal(placed.item) && !placed.wild);
  return placed.item.isUnit && theirs && placed.item.velocity > 0 && !inConstruction(placed, now);
}

/**
 * The command for a unit that walked from where the save has it to where it
 * stopped, as the Flash client sends it (every few seconds, for the units
 * that moved): `move` with the old tile, the item, the new tile, which way
 * it faces, the town, and "Unitat" (unit).
 */
export function unitMoved(town: Town, placed: PlacedItem, from: Point): Command {
  return { cmd: "move", args: [from.x, from.y, placed.item.id, placed.tx, placed.ty, placed.orientation, town.id, "Unitat"] };
}
