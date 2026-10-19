// Several units selected at once, as in the Flash client (our notes, in
// CLIENT.md, "Selecting several units"): picked with a box or a double
// click, then sent off together. No drawing here.

import type { ItemInfo } from "./config.ts";
import type { Point } from "./geometry.ts";
import type { PlacedItem } from "./town.ts";

/** At most this many things selected at once. */
export const MAX_SELECTED = 20;
/** A second tap on the same unit within this long is a double click. */
export const DOUBLE_CLICK_MS = 1000;
/**
 * In a battle (ours, sameItem), a mouse's double click is a computer's
 * usual instead: Shift-clicking a unit on and off again quickly mustn't
 * pick its whole kind. A finger, with no Shift, keeps DOUBLE_CLICK_MS.
 */
export const BATTLE_DOUBLE_CLICK_MS = 500;
/** A double click picks units of the same kind within this many tiles. */
const DOUBLE_CLICK_TILES = 10;

const HEALERS = new Set([502, 590, 866, 886]);
const ENGINEER = 570;
const MONK = 569;
const KIND = {
  peasant: 71, cleric: 72, special: 77, footman: 78, mounted: 79, archer: 80, siege: 81, kamikaze: 89,
  white: 92, blue: 93, black: 94, red: 95, green: 96,
} as const;

/**
 * The kinds a double click tells apart, in the order the game asks: the
 * first a unit is, is what it picks more of. Healers are clerics too, and a
 * double click on a footman picks clerics that fight up close with it, as
 * in the original. Other units (animals, pets) pick nothing.
 */
const KINDS: ((item: ItemInfo) => boolean)[] = [
  (item) => HEALERS.has(item.id),
  (item) => item.id === ENGINEER,
  (item) => item.id === MONK,
  (item) => [KIND.cleric, KIND.footman, KIND.mounted, KIND.special].includes(item.subcategory as 72) && item.attackRange <= 1,
  (item) => item.subcategory === KIND.peasant,
  (item) => [KIND.archer, KIND.mounted].includes(item.subcategory as 80) && item.attackRange > 1,
  (item) => item.subcategory === KIND.siege,
  (item) => item.subcategory === KIND.kamikaze,
  (item) => item.subcategory === KIND.green,
  (item) => item.subcategory === KIND.white,
  (item) => item.subcategory === KIND.red,
  (item) => item.subcategory === KIND.black,
  (item) => item.subcategory === KIND.blue,
];

/**
 * A double click on a unit: it and the units of its kind (`units`, the
 * player's) within 10 tiles, nearest first, at most 20. Empty for a unit of
 * no kind the game groups.
 */
export function sameKindNear(clicked: PlacedItem, units: PlacedItem[]): PlacedItem[] {
  const kind = KINDS.find((test) => test(clicked.item));
  if (!kind || !clicked.item.isUnit) {
    return [];
  }
  const away = (u: PlacedItem) => (u.tx - clicked.tx) ** 2 + (u.ty - clicked.ty) ** 2;
  return units
    .filter((u) => u.item.isUnit && kind(u.item) && away(u) <= DOUBLE_CLICK_TILES ** 2)
    .map((u, i) => ({ u, i, d: away(u) }))
    .sort((a, b) => a.d - b.d || a.i - b.i)
    .slice(0, MAX_SELECTED)
    .map(({ u }) => u);
}

/**
 * A double click on a unit in a battle: every unit of the player's of the
 * very same kind (the same item: Archer II, not every archer), wherever it
 * stands. Ours, at the owner's request (DECISIONS.md, 19 October 2026);
 * the Flash client's double click picks a wider sort near it (sameKindNear).
 */
export function sameItem<T extends { item: { id: number } }>(clicked: T, units: T[]): T[] {
  return units.filter((unit) => unit.item.id === clicked.item.id);
}

/** A selection by kind, each kind in the order it first appears: the battle's selection bar. */
export function byKind<T extends { item: ItemInfo }>(units: T[]): { item: ItemInfo; units: T[] }[] {
  const kinds = new Map<number, { item: ItemInfo; units: T[] }>();
  for (const unit of units) {
    const kind = kinds.get(unit.item.id);
    if (kind) {
      kind.units.push(unit);
    } else {
      kinds.set(unit.item.id, { item: unit.item, units: [unit] });
    }
  }
  return [...kinds.values()];
}

/** Units picked: with Shift, added to those selected (none twice); without, instead of them. */
export function pickWith<T>(selected: T[], picked: T[], add: boolean): T[] {
  return add ? [...new Set([...selected, ...picked])] : [...picked];
}

/**
 * Where a group sent to a tile stands: a square grown from that tile as its
 * top corner, one ring at a time (the tile; then the next column down and
 * the row along; and so on), keeping only tiles that are `free`. The i-th
 * unit gets the i-th tile, as in the Flash client.
 */
export function squareTiles(start: Point, count: number, free: (tile: Point) => boolean): Point[] {
  const tiles: Point[] = [];
  const take = (x: number, y: number) => {
    if (tiles.length < count && free({ x, y })) {
      tiles.push({ x, y });
    }
  };
  // Rings out to 20 tiles: enough room for 20 units almost anywhere.
  for (let k = 0; k <= MAX_SELECTED && tiles.length < count; k++) {
    if (k === 0) {
      take(start.x, start.y);
      continue;
    }
    for (let y = start.y; y <= start.y + k; y++) {
      take(start.x + k, y);
    }
    for (let x = start.x + k - 1; x >= start.x; x--) {
      take(x, start.y + k);
    }
  }
  return tiles;
}
