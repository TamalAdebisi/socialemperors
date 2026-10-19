// The shop, as the Flash client runs it: which buildings a town can buy, in
// which tab and order, and what stops a purchase (its level, a limit on how
// many a town may have, the price). Buying puts the building on the map and
// returns the command for the server. From our notes on the Flash client
// (CLIENT.md, step 3). No drawing here.

import type { Command } from "../net/commands.ts";
import type { ConfigCategory, ItemInfo } from "./config.ts";
import { clearUnder, fits, type Cleared } from "./editing.ts";
import { RESOURCES, type Resource } from "./production.ts";
import type { PlacedItem, Town } from "./town.ts";

export interface ShopCategory {
  id: number;
  name: string;
  tabs: { id: number; name: string }[];
}

/** The "New" category: its own items, plus new and cash items from the others, in tabs of their own. */
const NEW = { category: 12, newTab: 122, cashTab: 123 };
/** Gold members only, which nobody is here. */
const MEMBERS_ONLY = new Set([1234 /* Diamond Castle */, 1426 /* Dragon Killer Castle */]);
/** Items above the player's level go after the others. */
const LOCKED_LAST = 10000;

/** The shop's categories and their tabs, from the config: Village, Defense, Army, Decorations, Wonders, New. */
export function readShop(categories: Record<string, ConfigCategory> = {}): ShopCategory[] {
  return Object.values(categories)
    .filter((c): c is ConfigCategory & { id: number; name: string } => Boolean(c.id && c.name))
    .map((c) => ({ id: c.id, name: c.name, tabs: c.sub.map((tab) => ({ id: tab.id, name: tab.name })) }))
    .sort((a, b) => a.id - b.id);
}

/** Whether the shop sells this to the town's people: humans or trolls. */
function soldTo(item: ItemInfo, race: string): boolean {
  return race === "t" ? item.inStore === 2 || item.inStore === 4 : item.inStore === 1 || item.inStore === 3;
}

/** The tabs an item shows under in a category (none: not in it). */
export function tabsOf(item: ItemInfo, category: number): number[] {
  if (category !== NEW.category) {
    return item.category === category ? [item.shopTab] : [];
  }
  if (item.category === NEW.category) {
    return [item.shopTab];
  }
  if (item.category >= 1 && item.category < NEW.category) {
    if (item.isNew) {
      return [NEW.newTab];
    }
    if (item.costType === "c") {
      return [NEW.cashTab];
    }
  }
  return [];
}

export function isLocked(town: Town, item: ItemInfo): boolean {
  return item.minLevel > town.level && !town.unlocked.has(item.id);
}

/** What the shop shows in a category (and tab: 0 for all of it), in the shop's order. */
export function shopItems(items: Iterable<ItemInfo>, town: Town, category: number, tab = 0): ItemInfo[] {
  const shown: ItemInfo[] = [];
  for (const item of items) {
    const tabs = tabsOf(item, category);
    if (tabs.length === 0 || (tab && !tabs.includes(tab)) || item.isUnit || !soldTo(item, town.race)
        || (item.storeLevel > 0 && item.storeLevel > town.level) || MEMBERS_ONLY.has(item.id)) {
      continue;
    }
    shown.push(item);
  }
  const order = (item: ItemInfo) => item.displayOrder + (isLocked(town, item) ? LOCKED_LAST : 0);
  return shown.sort((a, b) => order(a) - order(b));
}

// How many of some buildings a town may have.
const SUBCAT = { tower: 211, market: 132, eagle: 136 };
const TOWERS_PER_BLOCK = 400;
const NURSERY = { id: 226, most: 3 };
/** One of each: every level of mill and of gold, stone and lumber mine, and the special buildings. */
const ONE_EACH = new Set([
  5, 6, 7, 202, 300, 301, 302,          // mills
  13, 14, 15, 203, 315, 316, 317,       // gold mines
  16, 17, 18, 204, 318, 319, 320,       // stone mines
  77, 78, 79, 205, 312, 313, 314,       // lumber mills
  // the university, blacksmith, church, heroes' altar, temple, bakery, markets of allies...
  22, 24, 25, 150, 151, 197, 212, 218, 220, 221, 222, 223, 224, 229, 231, 232, 233, 234, 244, 261, 262,
  266, 271, 299, 325, 343, 344, 352, 363, 366, 378, 387, 389, 397, 415, 428, 430, 470, 486, 1232, 1233,
  1255, 1283, 1284, 1299, 1316, 1345, 1346, 1372, 1394, 1405, 1441, 1463, 1499,
]);

/** The most of this building the town may have, when it already has that many; null when it may have more. */
export function atLimit(town: Town, item: ItemInfo): number | null {
  if (item.subcategory === SUBCAT.tower) {
    if (item.costType === "c") {
      return null;  // towers bought with cash don't count
    }
    const towers = town.items.filter((p) => p.item.subcategory === SUBCAT.tower && p.item.costType !== "c").length;
    const most = town.expansions.size * TOWERS_PER_BLOCK;
    return towers > most ? most : null;
  }
  const same = town.items.filter((p) => p.item.id === item.id).length;
  const sameKind = town.items.filter((p) => p.item.subcategory === item.subcategory).length;
  if ((item.subcategory === SUBCAT.market || item.subcategory === SUBCAT.eagle) && sameKind >= 1) {
    return 1;
  }
  if (ONE_EACH.has(item.id) && same >= 1) {
    return 1;
  }
  if (item.id === NURSERY.id && same >= NURSERY.most) {
    return NURSERY.most;
  }
  return null;
}

export interface Price {
  resource: Resource;
  amount: number;
}

export function priceOf(item: ItemInfo): Price {
  return { resource: RESOURCES[item.costType] ?? "gold", amount: item.cost };
}

/** What stops the town buying this now, or null when nothing does. */
export type Obstacle =
  | { kind: "level"; level: number }
  | { kind: "limit"; most: number }
  | { kind: "price"; price: Price };

export function obstacle(town: Town, item: ItemInfo): Obstacle | null {
  if (isLocked(town, item)) {
    return { kind: "level", level: item.minLevel };
  }
  const most = atLimit(town, item);
  if (most !== null) {
    return { kind: "limit", most };
  }
  const price = priceOf(item);
  if (town[price.resource] < price.amount) {
    return { kind: "price", price };
  }
  return null;
}

export function describe(obstacle: Obstacle): string {
  switch (obstacle.kind) {
    case "level":
      return `From level ${obstacle.level}`;
    case "limit":
      return obstacle.most === 1 ? "You have one" : `You have ${obstacle.most}`;
    case "price":
      return `Not enough ${obstacle.price.resource}`;
  }
}

/** Opening a building before its level costs a third of the level in cash, rounded up. */
export function unlockPrice(item: ItemInfo): number {
  return Math.ceil(item.minLevel / 3);
}

/** Whether a building can be opened early now: shown in the shop but still above the level, and not opened already. */
export function canUnlock(town: Town, item: ItemInfo): boolean {
  return isLocked(town, item);
}

/** Open a building early, for cash: the shop sells it from now on. A string when there isn't enough cash. */
export function unlock(town: Town, item: ItemInfo): Command | string {
  const cash = unlockPrice(item);
  if (town.cash < cash) {
    return `Not enough cash: opening ${item.name} early costs ${cash}.`;
  }
  town.cash -= cash;
  town.unlocked.add(item.id);
  return { cmd: "unlock_building", args: [String(item.id)] };
}

/**
 * Buy a building and put it on a tile: the price is paid and its experience
 * gained. Mined-out rocks on the player's land there are cleared first
 * (rules/editing.ts, clearUnder). A string when it can't be.
 */
export function buy(town: Town, item: ItemInfo, tx: number, ty: number, now: number, orientation = 0): { command: Command; placed: PlacedItem; cleared: Cleared } | string {
  const blocked = obstacle(town, item);
  if (blocked) {
    return `${item.name}: ${describe(blocked).toLowerCase()}.`;
  }
  const placed: PlacedItem = { item, tx, ty, orientation, unitsInside: 0, startedAt: now, workTime: 0 };
  if (!fits(town, placed, undefined, true)) {
    return `${item.name} doesn't fit there.`;
  }
  const cleared = clearUnder(town, placed);
  const price = priceOf(item);
  town[price.resource] -= price.amount;
  town.xp += item.xp;
  town.items.push(placed);
  // [item, x, y, facing, town, bought for free, price multiplier, type]
  return { command: { cmd: "buy", args: [item.id, tx, ty, orientation, town.id, 0, 1, "b"] }, placed, cleared };
}
