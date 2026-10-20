// Where things go on the map, as the Flash client lays them out, so a town
// looks the same in both clients. Measured from the Flash client (our notes,
// in CLIENT.md); no drawing here.
//
// A town is a 100 x 100 grid of tiles, drawn as 2:1 diamonds 108 px wide and
// 54 high: one tile along x is 54 px right and 27 down, along y 54 px left
// and 27 down. The grid is cut into 5 x 5 blocks of 20 x 20 tiles; the
// player opens the middle 3 x 3 (the save's "expansions", numbered 1 to 25).

import type { ItemInfo } from "./config.ts";
import type { PlacedItem } from "./town.ts";

export const MAP_TILES = 100;
export const BLOCK_TILES = 20;
export const BLOCKS = MAP_TILES / BLOCK_TILES;
export const TILE_WIDTH = 108;
export const TILE_HEIGHT = 54;
const HALF_W = TILE_WIDTH / 2;
const HALF_H = TILE_HEIGHT / 2;

export interface Point {
  x: number;
  y: number;
}

/** A box in pixels, from a sprite's origin (its anchor). */
export interface Bounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * The point a building stands on: the bottom corner of tile (tx, ty). The
 * save names a building's last tile, so this is also the bottom corner of
 * its whole footprint, which runs back to tx - width + 1, ty - height + 1.
 */
export function buildingPoint(tx: number, ty: number): Point {
  return { x: HALF_W * (tx - ty), y: HALF_H * (tx + ty) - TILE_HEIGHT };
}

/** The point a unit stands on: the middle of its tile. */
export function unitPoint(tx: number, ty: number): Point {
  const p = buildingPoint(tx, ty);
  return { x: p.x, y: p.y - HALF_H };
}

/**
 * Where a building's sprite origin goes so the picture's bottom centre sits
 * on its point. The game measures the picture with its bounds as Flash sees
 * them (`bounds`, transparent edges included) and rounds half the width down.
 */
export function buildingOrigin(point: Point, bounds: Bounds): Point {
  return { x: point.x - Math.floor(bounds.w / 2), y: point.y - bounds.h };
}

/** The tile coordinates of a point on the map, fractional: tile (tx, ty) covers tx - 1 to tx, ty - 1 to ty. */
export function tileAt(p: Point): Point {
  const a = p.x / HALF_W;
  const b = (p.y + TILE_HEIGHT) / HALF_H;
  return { x: (a + b) / 2, y: (b - a) / 2 };
}

/** The tile a point of the map is on. */
export function tileUnder(p: Point): Point {
  const t = tileAt(p);
  return { x: Math.ceil(t.x), y: Math.ceil(t.y) };
}

/** Which of the 25 blocks a tile is in, numbered like the save's expansions. */
export function expansionOf(tx: number, ty: number): number {
  return Math.floor(tx / BLOCK_TILES) + BLOCKS * Math.floor(ty / BLOCK_TILES) + 1;
}

/** Only the middle 3 x 3 blocks can be opened; the outer ring stays wild. */
export function isOuterBlock(gx: number, gy: number): boolean {
  return gx === 0 || gy === 0 || gx === BLOCKS - 1 || gy === BLOCKS - 1;
}

/** One block of ground: a terrain picture covering 20 x 20 tiles. */
export interface GroundBlock {
  gx: number;
  gy: number;
  /** The block's last tile, where its picture stands (like a building). */
  tx: number;
  ty: number;
  /** The terrain picture's frame: 3 open land, 1 the wild ring, 0 land for sale (both darker). */
  frame: number;
  open: boolean;
}

export function groundBlocks(expansions: Set<number>): GroundBlock[] {
  const blocks: GroundBlock[] = [];
  for (let gy = 0; gy < BLOCKS; gy++) {
    for (let gx = 0; gx < BLOCKS; gx++) {
      const id = gx + BLOCKS * gy + 1;
      const open = !isOuterBlock(gx, gy) && expansions.has(id);
      const frame = isOuterBlock(gx, gy) ? 1 : open ? 3 : 0;
      blocks.push({ gx, gy, tx: BLOCK_TILES * gx + BLOCK_TILES - 1, ty: BLOCK_TILES * gy + BLOCK_TILES - 1, frame, open });
    }
  }
  return blocks;
}

/** The ground's terrain item for an island skin (item 1000 is grass). */
export function terrainItemId(skin: number): number {
  return 1000 + skin;
}

/** The colour around the island for each skin, as the Flash client paints it. */
const SKIN_COLOURS = [0x669c2c, 0xeabc4c, 0xdfecf2, 0x2e94e6, 0x863814, 0x398a00, 0xffffff];

export function skinColour(skin: number): number {
  return SKIN_COLOURS[skin] ?? SKIN_COLOURS[0];
}

const SUBCAT_FARM = 122;
const SUBCAT_TREE = 125;
const ANIMAL_DRAWN_ON_TOP = 524;

export function isTree(item: ItemInfo): boolean {
  return item.subcategory === SUBCAT_TREE;
}

/**
 * Drawing order: things further back first. Farms (flat fields) go under
 * everything. Equal values keep the save's order.
 */
export function depth(placed: PlacedItem): number {
  let z = 20000 + MAP_TILES * (placed.tx + placed.ty - placed.item.width);
  if (placed.item.subcategory === SUBCAT_FARM) {
    z -= 20000;
  } else if (placed.item.id === ANIMAL_DRAWN_ON_TOP) {
    z += 1;
  }
  return z;
}

/** Room for the town's order under each step of depth (drawOrder): more than a town has things. */
const IN_TOWN_ORDER = 1_000_000;

/**
 * Drawing order as one number, for sorting by it: the depth, then for things
 * of equal depth their place in the town's list (`index`, -1 when not in it).
 */
export function drawOrder(placed: PlacedItem, index: number): number {
  return depth(placed) * IN_TOWN_ORDER + index;
}

/**
 * Units face one of 8 ways: 1 up, 2 up-right, 3 right, 4 down-right, 5 down,
 * 6 up-left, 7 left, 8 down-left. Their art draws the first five; the other
 * three are those mirrored. `frame` counts from the animation's label.
 */
export function unitFacing(direction: number): { frame: number; mirrored: boolean } {
  if (direction >= 6) {
    return { frame: direction - 5, mirrored: true };
  }
  return { frame: Math.max(direction, 1) - 1, mirrored: false };
}

/** A unit standing in a town faces one of these, picked at random when the town loads. */
export const IDLE_DIRECTIONS = [4, 5, 8];

/** The whole map's corners, in pixels: where the camera may go. */
export function mapArea(): { left: number; right: number; top: number; bottom: number } {
  const top = buildingPoint(-1, -1);
  const bottom = buildingPoint(MAP_TILES - 1, MAP_TILES - 1);
  const left = buildingPoint(-1, MAP_TILES - 1);
  const right = buildingPoint(MAP_TILES - 1, -1);
  return { left: left.x, right: right.x, top: top.y, bottom: bottom.y };
}

/** The middle of a block of the map, in pixels. */
export function blockCentre(gx: number, gy: number): Point {
  const corner = buildingPoint(BLOCK_TILES * gx + BLOCK_TILES - 1, BLOCK_TILES * gy + BLOCK_TILES - 1);
  return { x: corner.x, y: corner.y - (BLOCK_TILES * TILE_HEIGHT) / 2 };
}
