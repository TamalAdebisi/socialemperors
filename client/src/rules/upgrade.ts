// Upgrading a building from its card, as the Flash client does it (our
// notes, our words: docs/original/rules/town.md, "Upgrading"). A building
// whose config names a next one (`upgrades_to`) can become it, once the
// player has the next one's level: they pay its full price, get back a
// twentieth of the old one's (nothing if it was bought with cash, as when
// selling) and gain its experience. The server hears it as a sale for
// "UPGR" and a purchase of the next one on the same tile. Town Hall II to
// IV are only had this way. No drawing here.

import type { Command } from "../net/commands.ts";
import type { ItemInfo } from "./config.ts";
import { refund } from "./editing.ts";
import { RESOURCES, type Resource } from "./production.ts";
import type { PlacedItem, Town } from "./town.ts";

/** What a building upgrades to, or null when it doesn't. */
export function upgradeOf(item: ItemInfo, items: Map<number, ItemInfo>): ItemInfo | null {
  return item.upgradesTo > 0 ? items.get(item.upgradesTo) ?? null : null;
}

/** What the upgrade costs: the next building's whole price, in what it costs. */
export function upgradePrice(next: ItemInfo): { resource: Resource; amount: number } {
  return { resource: RESOURCES[next.costType] ?? "gold", amount: next.cost };
}

/** Why it can't be upgraded now: the level it needs, or the price it can't pay; null when it can. */
export type UpgradeRefusal = { kind: "level"; level: number } | { kind: "price"; resource: Resource; amount: number };

export function cantUpgrade(town: Town, next: ItemInfo): UpgradeRefusal | null {
  if (town.level < next.minLevel) {
    return { kind: "level", level: next.minLevel };
  }
  const price = upgradePrice(next);
  if (town[price.resource] < price.amount) {
    return { kind: "price", ...price };
  }
  return null;
}

export interface Upgraded {
  /** The new building, on the old one's tile, started now. */
  placed: PlacedItem;
  commands: Command[];
  /** What it cost, what came back for the old one (or null) and the experience: to show rising from it. */
  price: { resource: Resource; amount: number };
  back: { resource: Resource; amount: number } | null;
  xp: number;
}

/**
 * Upgrade a building (`now`: the server's clock, seconds): the old one goes
 * and the next stands in its place. Whoever was inside must be let out first
 * (the editor does, as for selling). Null when it can't be: cantUpgrade says why.
 */
export function upgrade(town: Town, placed: PlacedItem, next: ItemInfo, now: number): Upgraded | null {
  if (cantUpgrade(town, next)) {
    return null;
  }
  const price = upgradePrice(next);
  const old = refund(placed.item);
  const back = old ? { resource: old.resource as Resource, amount: old.amount } : null;
  if (back) {
    town[back.resource] += back.amount;
  }
  town[price.resource] -= price.amount;
  town.xp += next.xp;
  const index = town.items.indexOf(placed);
  const fresh: PlacedItem = { item: next, tx: placed.tx, ty: placed.ty, orientation: 0, unitsInside: 0, units: [], startedAt: now, workTime: 0 };
  if (index >= 0) {
    town.items.splice(index, 1, fresh);
  } else {
    town.items.push(fresh);
  }
  const commands: Command[] = [
    { cmd: "sell", args: [placed.tx, placed.ty, placed.item.id, town.id, 0, "UPGR"] },
    // [item, x, y, facing, town, bought for free, price multiplier, type], as the shop's.
    { cmd: "buy", args: [next.id, placed.tx, placed.ty, 0, town.id, 0, 1, "b"] },
  ];
  return { placed: fresh, commands, price, back, xp: next.xp };
}
