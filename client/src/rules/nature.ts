// Trees, rocks and wild animals come back, as in the Flash client (our
// notes, our words; CLIENT.md, "The living map"). Each time the player
// opens their town, the game counts the trees, stone rocks and gold rocks
// on the map, and where there are too few it adds clumps of them, and
// single trees, in the wild ring round the island and on the player's land;
// then a few wild animals (rules/animals.ts). They're "bought" for nothing,
// so the server keeps them. No drawing here.

import type { Command } from "../net/commands.ts";
import { animalsToAdd } from "./animals.ts";
import type { ItemInfo } from "./config.ts";
import { takenTiles } from "./editing.ts";
import { BLOCK_TILES, BLOCKS, MAP_TILES, isOuterBlock, type Point } from "./geometry.ts";
import type { PlacedItem, Town } from "./town.ts";

/**
 * Each kind: the items it adds (one picked at random each time), the ones
 * it counts (the Flash client leaves out the fourth stone and gold rocks,
 * and counts rocks growing back), how many clumps it wants and how big.
 * For every clump's worth already there (the clump's average size), one
 * clump fewer is added.
 */
interface Kind {
  adds: number[];
  counts: number[];
  clumps: number;
  size: [number, number];
  /** Single trees: the map should have this many trees; the missing ones are added one by one. */
  single?: number;
}

const GOLD: Kind = { adds: [73, 74, 75, 76], counts: [73, 74, 75, 80], clumps: 3, size: [5, 7] };
const STONE: Kind = { adds: [69, 70, 71, 72], counts: [69, 70, 71, 81], clumps: 3, size: [5, 7] };
const TREES: Kind = { adds: [19, 20, 21], counts: [19, 20, 21], clumps: 10, size: [16, 20], single: 100 };
/** How far out (in rings of tiles) a single tree looks for a free tile; with none, it isn't added. */
const SINGLE_NEAR = 5;

/**
 * Trees, rocks and animals added to the town as it opens: on the map, and
 * the commands that tell the server. `animals`: the animals added today
 * (the save's `arrayAnimals`, by kind) and how many a kind may have a day;
 * without it, no animals. `random` is Math.random but for tests.
 */
export function growBack(town: Town, items: Map<number, ItemInfo>, now: number,
  { random = Math.random, animals }: { random?: () => number; animals?: { today: Record<string, number>; perDay: number } } = {},
): { commands: Command[]; added: PlacedItem[] } {
  // Counted before any is added, as the Flash client counts the map once.
  const wantedAnimals = animals ? animalsToAdd(town, animals.today, animals.perDay) : [];
  const count = (kind: Kind) => town.items.filter((placed) => kind.counts.includes(placed.item.id)).length;
  const counted = new Map([GOLD, STONE, TREES].map((kind) => [kind, count(kind)]));
  const taken = takenTiles(town);
  const blocks = wildAndOwnBlocks(town);
  const added: PlacedItem[] = [];
  const add = (id: number, at: Point | null) => {
    const item = items.get(id);
    if (!item || !at) {
      return;
    }
    const placed: PlacedItem = { item, tx: at.x, ty: at.y, orientation: 0, unitsInside: 0, startedAt: now, workTime: 0,
      ...(item.isUnit ? { wild: true } : {}) };
    town.items.push(placed);
    taken.add(`${at.x},${at.y}`);
    added.push(placed);
  };
  for (const kind of [GOLD, STONE, TREES]) {
    const [smallest, biggest] = kind.size;
    const clumps = Math.max(kind.clumps - Math.floor(counted.get(kind)! / ((smallest + biggest) / 2)), 0);
    // One size for all of this kind's clumps this time.
    const size = smallest + Math.floor(random() * (biggest - smallest));
    for (let clump = 0; clump < clumps; clump++) {
      const middle = tileIn(blocks[pick(random, blocks.length)], random);
      for (let n = 0; n < size; n++) {
        add(kind.adds[pick(random, kind.adds.length)], nearestFree(taken, middle));
      }
    }
    for (let n = 0; n < Math.max((kind.single ?? 0) - counted.get(kind)!, 0); n++) {
      add(kind.adds[pick(random, kind.adds.length)], freeNear(taken, tileIn(blocks[pick(random, blocks.length)], random), random));
    }
  }
  // Animals one by one, as single trees; then the server hears how many of each kind came today.
  for (const { id, count } of wantedAnimals) {
    for (let n = 0; n < count; n++) {
      add(id, freeNear(taken, tileIn(blocks[pick(random, blocks.length)], random), random));
    }
  }
  return {
    commands: [
      ...added.map((placed) => ({ cmd: "buy", args: [placed.item.id, placed.tx, placed.ty, 0, town.id, 1, 1, placed.item.isUnit ? "u" : "b"] })),
      ...wantedAnimals.map(({ kind, count }) => ({ cmd: "admin_add_animal", args: [kind, count] })),
    ],
    added,
  };
}

/** The blocks things grow in: the wild ring round the island, and the land the player bought. */
function wildAndOwnBlocks(town: Town): Point[] {
  const blocks: Point[] = [];
  for (let gy = 0; gy < BLOCKS; gy++) {
    for (let gx = 0; gx < BLOCKS; gx++) {
      if (isOuterBlock(gx, gy) || town.expansions.has(gx + BLOCKS * gy + 1)) {
        blocks.push({ x: gx, y: gy });
      }
    }
  }
  return blocks;
}

/** One of `length`, as the Flash client picks: rounding, so the first and last come up half as often. */
function pick(random: () => number, length: number): number {
  return Math.round(random() * (length - 1));
}

function tileIn(block: Point, random: () => number): Point {
  return { x: block.x * BLOCK_TILES + pick(random, BLOCK_TILES), y: block.y * BLOCK_TILES + pick(random, BLOCK_TILES) };
}

function free(taken: Set<string>, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < MAP_TILES && y < MAP_TILES && !taken.has(`${x},${y}`);
}

/** The tiles on the square ring `ring` tiles out from a tile that are free (and `ok`). */
function freeOnRing(taken: Set<string>, at: Point, ring: number, ok: (p: Point) => boolean = () => true): Point[] {
  const found: Point[] = [];
  for (let x = at.x - ring; x <= at.x + ring; x++) {
    for (let y = at.y - ring; y <= at.y + ring; y++) {
      if (Math.max(Math.abs(x - at.x), Math.abs(y - at.y)) === ring && free(taken, x, y) && ok({ x, y })) {
        found.push({ x, y });
      }
    }
  }
  return found;
}

/**
 * A clump's next tree or rock: the tile itself if free, otherwise the first
 * ring out with a free tile, and on it the one furthest down the map (the
 * Flash client sorts them by their distance from a corner past the map).
 * `ok`: a further test the tile must pass (on the player's land, say).
 */
export function nearestFree(taken: Set<string>, at: Point, ok: (p: Point) => boolean = () => true): Point | null {
  if (free(taken, at.x, at.y) && ok(at)) {
    return at;
  }
  const corner = 2 * MAP_TILES;
  for (let ring = 1; ring < MAP_TILES; ring++) {
    const found = freeOnRing(taken, at, ring, ok);
    if (found.length > 0) {
      const away = (p: Point) => (p.x - corner) ** 2 + (p.y - corner) ** 2;
      return found.reduce((best, p) => (away(p) < away(best) ? p : best));
    }
  }
  return null;
}

/** A single tree's tile: the tile itself if free, otherwise any free one on the first ring out that has some, up to 5 out. */
function freeNear(taken: Set<string>, at: Point, random: () => number): Point | null {
  if (free(taken, at.x, at.y)) {
    return at;
  }
  for (let ring = 1; ring <= SINGLE_NEAR; ring++) {
    const found = freeOnRing(taken, at, ring);
    if (found.length > 0) {
      return found[Math.floor(random() * found.length)];
    }
  }
  return null;
}
