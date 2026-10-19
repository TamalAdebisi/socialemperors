// Changing a town as the Flash client does: moving, turning, selling and
// storing what's on the map. Each change updates our copy of the town and
// returns the command the server needs to make the same change to the save
// (net/commands.ts sends it). The rules are the Flash client's, from our
// notes on it (CLIENT.md, step 3). No drawing here.

import type { Command } from "../net/commands.ts";
import type { ItemInfo } from "./config.ts";
import { inConstruction } from "./construction.ts";
import { BLOCK_TILES, MAP_TILES, expansionOf, isOuterBlock } from "./geometry.ts";
import type { PlacedItem, Town } from "./town.ts";

const TERRAIN = 6;
const SUBCAT = {
  townHall: 135,
  tree: 125,
  stone: 126,
  gold: 127,
  regrowing: 128,
  treasure: 811,
  activator: 812,
  bossStatue: 813,
  lost: 911,
  scenery: 1011,
  isle: 1111,
  specialCollection: 1611,
};
/**
 * Rocks the bulldozer clears from bought land, though they're nobody's. The
 * Flash client leaves out rocks growing back; ours takes them too, at the
 * owner's request (DECISIONS.md, 19 October 2026).
 */
const ROCKS = new Set([SUBCAT.stone, SUBCAT.gold, SUBCAT.regrowing]);
/** Things with no Move, Turn or Store: resources, treasures, scenery... */
const NO_BUTTONS = new Set([SUBCAT.tree, SUBCAT.stone, SUBCAT.gold, SUBCAT.regrowing, SUBCAT.treasure,
  SUBCAT.activator, SUBCAT.bossStatue, SUBCAT.lost, SUBCAT.scenery, SUBCAT.isle, SUBCAT.specialCollection, TERRAIN]);
/** A sale gives back this share of what the thing cost (nothing for things bought with cash). */
const SALE_DIVISOR = 20;
const RESOURCES: Record<string, "gold" | "wood" | "food" | "stone" | "cash"> = {
  g: "gold", w: "wood", f: "food", s: "stone", c: "cash",
};

type Spot = { item: ItemInfo; tx: number; ty: number; orientation: number };

/** A thing's footprint in tiles. The Flash client uses the config's width and height whichever way it faces. */
export function footprintSize(placed: { item: ItemInfo }): [number, number] {
  return [placed.item.width, placed.item.height];
}

/** The tiles a thing covers. The save names the last one (its bottom corner on screen). */
export function footprintTiles(placed: Spot): [number, number][] {
  if (placed.item.isUnit) {
    return [[placed.tx, placed.ty]];
  }
  const [w, h] = footprintSize(placed);
  const tiles: [number, number][] = [];
  for (let x = placed.tx - w + 1; x <= placed.tx; x++) {
    for (let y = placed.ty - h + 1; y <= placed.ty; y++) {
      tiles.push([x, y]);
    }
  }
  return tiles;
}

/** Land the player has bought (the save's expansions), on the map. */
export function isOpenLand(town: Town, tx: number, ty: number): boolean {
  return tx >= 0 && ty >= 0 && tx < MAP_TILES && ty < MAP_TILES && town.expansions.has(expansionOf(tx, ty));
}

/** The wild ring around the island: what stands there isn't the player's. */
export function onWildRing(tx: number, ty: number): boolean {
  return isOuterBlock(Math.floor(tx / BLOCK_TILES), Math.floor(ty / BLOCK_TILES));
}

/** Which tiles are taken: by buildings' footprints, and by units where they stand. `skip`: things that don't count. */
export function takenTiles(town: Town, except?: PlacedItem, skip?: (placed: PlacedItem) => boolean): Set<string> {
  const taken = new Set<string>();
  for (const placed of town.items) {
    if (placed === except || placed.item.category === TERRAIN || skip?.(placed)) {
      continue;
    }
    for (const [x, y] of footprintTiles(placed)) {
      taken.add(`${x},${y}`);
    }
  }
  return taken;
}

/**
 * A mined-out rock growing back on the player's own land. In the Flash
 * client it stays in the way for its three hours, then turns back into a
 * rock. Here a building put over it clears it away, at the owner's request
 * (DECISIONS.md, 19 October 2026): the land is theirs.
 */
export function isMinedOut(town: Town, placed: PlacedItem): boolean {
  return placed.item.subcategory === SUBCAT.regrowing && isOpenLand(town, placed.tx, placed.ty);
}

/**
 * Whether a thing fits there: all on bought land, and no tile taken.
 * `clearing`: a building that would clear mined-out rocks (isMinedOut) may
 * go over them; units never do.
 */
export function fits(town: Town, placed: Spot, except?: PlacedItem, clearing = false): boolean {
  const skip = clearing && !placed.item.isUnit ? (other: PlacedItem) => isMinedOut(town, other) : undefined;
  const taken = takenTiles(town, except, skip);
  return footprintTiles(placed).every(([x, y]) => isOpenLand(town, x, y) && !taken.has(`${x},${y}`));
}

/**
 * Clear the mined-out rocks under a building being put down: each goes, as
 * the bulldozer takes one. Their commands come before the building's.
 */
export function clearUnder(town: Town, placed: Spot): Cleared {
  if (placed.item.isUnit) {
    return [];
  }
  const under = new Set(footprintTiles(placed).map(([x, y]) => `${x},${y}`));
  return town.items
    .filter((other) => isMinedOut(town, other) && footprintTiles(other).some(([x, y]) => under.has(`${x},${y}`)))
    .map((rock) => ({ placed: rock, command: sell(town, rock) }));
}

/** What a building put down cleared away (clearUnder): each thing, and its command. */
export type Cleared = { placed: PlacedItem; command: Command }[];

/** Whether a thing is the player's: their people's, or anyone's ("a"). Trees and rocks are nobody's ("n"). */
export function isTheirs(town: Town, item: ItemInfo): boolean {
  return item.race === "a" || item.race === town.race;
}

/** What can be done to a thing: the buttons the Flash client's info panel shows, and its bulldozer (nothing while it's being built). */
export function choices(town: Town, placed: PlacedItem, now = Date.now()): { move: boolean; turn: boolean; store: boolean; sell: boolean; why: string } {
  const none = { move: false, turn: false, store: false, sell: false };
  const { item } = placed;
  if (inConstruction(placed, now)) {
    return { ...none, why: "" };  // nothing to do with it until it's built (rules/construction.ts)
  }
  if (onWildRing(placed.tx, placed.ty)) {
    return { ...none, why: "It isn't on your land." };
  }
  if (item.isUnit) {
    return { ...none, why: "" };
  }
  if (!isTheirs(town, item)) {
    // The bulldozer takes only the player's things, and gold and stone rocks on their land.
    if (ROCKS.has(item.subcategory) && isOpenLand(town, placed.tx, placed.ty)) {
      return { ...none, sell: true, why: "" };
    }
    if (item.subcategory === SUBCAT.tree) {
      return { ...none, why: "Select a villager, then tap it to cut it for wood." };
    }
    return { ...none, why: "" };
  }
  if (item.subcategory === SUBCAT.townHall) {
    return { ...none, move: true, turn: item.facings > 1, why: "" };
  }
  if (placed.soulMixing) {
    return { ...none, turn: item.facings > 1, why: "Collect the mixed unit before moving, storing or selling this building." };
  }
  if (NO_BUTTONS.has(item.subcategory) || item.category === TERRAIN) {
    return { ...none, sell: item.category !== TERRAIN, why: "" };
  }
  return { move: true, turn: item.facings > 1, store: true, sell: true, why: "" };
}

/** What selling gives back: a twentieth of the cost, in what it cost; nothing for cash. */
export function refund(item: ItemInfo): { resource: string; amount: number } | null {
  const resource = RESOURCES[item.costType];
  if (!resource || resource === "cash" || item.cost <= 0) {
    return null;
  }
  return { resource, amount: Math.floor(item.cost / SALE_DIVISOR) };
}

/**
 * Move a thing to another tile, clearing the mined-out rocks there
 * (clearUnder; their commands go first). Null when it doesn't fit there.
 */
export function move(town: Town, placed: PlacedItem, tx: number, ty: number): { command: Command; cleared: Cleared } | null {
  if (!fits(town, { ...placed, tx, ty }, placed, true)) {
    return null;
  }
  const cleared = clearUnder(town, { ...placed, tx, ty });
  const command = { cmd: "move", args: [placed.tx, placed.ty, placed.item.id, tx, ty, placed.orientation, town.id, "mouseUsed"] };
  placed.tx = tx;
  placed.ty = ty;
  return { command, cleared };
}

/** Turn a thing to face its next way (round its art's frames). */
export function turn(town: Town, placed: PlacedItem): Command {
  placed.orientation = (placed.orientation + 1) % Math.max(placed.item.facings, 1);
  return { cmd: "orient", args: [placed.tx, placed.ty, placed.orientation, town.id] };
}

/** Sell a thing: it goes, and a twentieth of its cost comes back. */
export function sell(town: Town, placed: PlacedItem): Command {
  remove(town, placed);
  const back = refund(placed.item);
  if (back) {
    town[back.resource as "gold" | "wood" | "food" | "stone"] += back.amount;
  }
  return { cmd: "sell", args: [placed.tx, placed.ty, placed.item.id, town.id, 0, "BLDZE"] };
}

/** Put a thing away in the town's store, to place again later. */
export function store(town: Town, placed: PlacedItem): Command {
  remove(town, placed);
  town.store.set(placed.item.id, (town.store.get(placed.item.id) ?? 0) + 1);
  return { cmd: "store_item", args: [placed.tx, placed.ty, town.id, placed.item.id] };
}

function remove(town: Town, placed: PlacedItem): void {
  const index = town.items.indexOf(placed);
  if (index >= 0) {
    town.items.splice(index, 1);
  }
}
