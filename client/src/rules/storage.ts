// Storage, as the Flash client runs it: things kept off the map, in two
// boxes. Gifts and prizes are shared by the player's towns; what a town put
// away is its own. A stored thing can be placed on the map again (one at a
// time, under the shop's limits) or sold. From our notes on the Flash client
// (CLIENT.md, step 3). No drawing here.

import type { Command } from "../net/commands.ts";
import type { ItemInfo } from "./config.ts";
import { fits } from "./editing.ts";
import type { Level } from "./levels.ts";
import { atLimit, describe, priceOf, type Price } from "./shop.ts";
import type { PlacedItem, Town } from "./town.ts";

export interface Stored {
  item: ItemInfo;
  /** From the gifts box (shared by the towns), or the town's own store. */
  gift: boolean;
  count: number;
}

const TOWN_HALL = 135;
const SPECIAL_COLLECTION = 1611;
const BAHAMUT_HEART = 1410;
/** Placing it gives the experience missing for the next level. */
const LEVEL_UP_STATUE = 1478;
/** Sold from storage for nothing: the Dock and the Zeppelin Tower. */
const SOLD_FOR_NOTHING = new Set([224, 299]);
const SALE_DIVISOR = 20;

/** What's in storage: the gifts, then the town's own, each by name. */
export function storedItems(town: Town, items: Map<number, ItemInfo>): Stored[] {
  const list = (box: Map<number, number>, gift: boolean) => [...box]
    .flatMap(([id, count]) => {
      const item = items.get(id);
      return item && count > 0 ? [{ item, gift, count }] : [];
    })
    .sort((a, b) => a.item.name.localeCompare(b.item.name));
  return [...list(town.gifts, true), ...list(town.store, false)];
}

/** What can be done with a stored thing: the storage window's Use and Sell, and why not. */
export function storageChoices(town: Town, stored: Stored, room = 0): { place: boolean; sell: boolean; why: string } {
  const { item } = stored;
  if (item.id === BAHAMUT_HEART || item.subcategory === SPECIAL_COLLECTION) {
    return { place: false, sell: false, why: "Kept for something special" };
  }
  const sell = item.subcategory !== TOWN_HALL;
  if (item.race !== town.race && item.race !== "n" && item.race !== "a") {
    return { place: false, sell, why: town.race === "t" ? "For a human town" : "For a troll town" };
  }
  // A unit needs room among the town's people (`room`: how much there is, rules/training.ts).
  if (item.isUnit && room < item.population) {
    return { place: false, sell, why: "No room for more people" };
  }
  const most = atLimit(town, item);
  if (most !== null) {
    return { place: false, sell, why: describe({ kind: "limit", most }) };
  }
  return { place: true, sell, why: "" };
}

/** What selling it from storage gives: a twentieth of its price; nothing for cash things, the Dock and the Zeppelin Tower. */
export function storageRefund(item: ItemInfo): Price | null {
  const price = priceOf(item);
  if (item.costType === "c" || SOLD_FOR_NOTHING.has(item.id) || price.amount < SALE_DIVISOR) {
    return null;
  }
  return { resource: price.resource, amount: Math.floor(price.amount / SALE_DIVISOR) };
}

function take(town: Town, stored: Stored): void {
  const box = stored.gift ? town.gifts : town.store;
  const left = (box.get(stored.item.id) ?? 0) - 1;
  if (left > 0) {
    box.set(stored.item.id, left);
  } else {
    box.delete(stored.item.id);
  }
  stored.count = Math.max(stored.count - 1, 0);
}

/** Sell one from storage. */
export function sellStored(town: Town, stored: Stored): Command {
  take(town, stored);
  const back = storageRefund(stored.item);
  if (back) {
    town[back.resource] += back.amount;
  }
  return { cmd: stored.gift ? "sell_gift" : "sell_stored_item", args: [stored.item.id, town.id] };
}

/**
 * Place one from storage on a tile. A gift also gives its experience (the
 * level-up statue: what's missing for the next level). A string when it can't be.
 */
export function placeStored(town: Town, stored: Stored, tx: number, ty: number, now: number,
  levels: Level[], room = 0): { command: Command; placed: PlacedItem } | string {
  const { item } = stored;
  const can = storageChoices(town, stored, room);
  if (!can.place || stored.count <= 0) {
    return `${item.name}: ${(can.why || "none left").toLowerCase()}.`;
  }
  const placed: PlacedItem = { item, tx, ty, orientation: 0, unitsInside: 0, units: [], startedAt: item.isUnit ? null : now, workTime: 0 };
  if (!fits(town, placed)) {
    return `${item.name} doesn't fit there.`;
  }
  take(town, stored);
  if (stored.gift) {
    const next = levels[town.level];
    town.xp = item.id === LEVEL_UP_STATUE && next ? Math.max(town.xp, next.xp) : town.xp + item.xp;
  }
  town.items.push(placed);
  // [item, x, y, facing, town]
  const command = { cmd: stored.gift ? "place_gift" : "place_stored_item", args: [item.id, tx, ty, 0, town.id] };
  return { command, placed };
}
