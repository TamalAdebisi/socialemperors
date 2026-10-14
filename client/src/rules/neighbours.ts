// Neighbours, as the Flash client has them (our notes, our words; CLIENT.md,
// "Neighbours"): Arthur, always the last neighbour, whose town grows with the
// player's; helping a neighbour's working buildings on a visit; and the
// donkey carts that bring the share of help received. No drawing here.

import type { Command } from "../net/commands.ts";
import type { ItemInfo } from "./config.ts";
import { RESOURCES, type Resource } from "./production.ts";
import type { PlacedItem, Town } from "./town.ts";

/** Arthur's three towns, one for each stage of the player's: up to level 10, up to 20, then the grown one. */
const ARTHUR = ["100000030", "100000031", "100000032"];
/** A neighbour can be helped once a day; up to 5 of their buildings on a visit. */
const DAY = 24 * 3600;
export const MOST_HELPED = 5;
/** What each help gives the visitor. */
export const HELP_GOLD = 10;
export const HELP_XP = 3;
/** What a cart brings for each building helped: a quarter of one harvest, and 10 experience. */
const SHARE_DIVISOR = 4;
export const SHARE_XP = 10;
/** The donkey cart that brings it. */
export const CART = 506;

const SUBCAT = { mill: 121, farm: 122, ranch: 123, mine: 124, collect: 138, wonder: 511 };
const NOT_HELPED = new Set([
  218,  // the treasure mine
  225,  // the sacrifice altar
  226,  // the hatchery
  227,  // the training stables
]);

export interface Neighbour {
  pid: string;
  name: string;
  level: number;
}

/**
 * Arthur, as the Flash client adds him after the others: his level a fifth
 * above the player's (no higher than the last level), and the town to visit
 * the one for the player's stage.
 */
export function arthur(playerLevel: number, levels: number): Neighbour {
  const town = playerLevel <= 10 ? 0 : playerLevel <= 20 ? 1 : 2;
  return { pid: ARTHUR[town], name: "Arthur", level: Math.min(Math.round(playerLevel * 1.2), Math.max(levels - 1, 1)) };
}

/** Whether a building of a neighbour's can be helped: mills, farms, mines, ranches, the bakery and wonders that house nobody. */
export function canBeHelped(item: ItemInfo): boolean {
  if (item.isUnit || NOT_HELPED.has(item.id)) {
    return false;
  }
  return [SUBCAT.mill, SUBCAT.farm, SUBCAT.mine, SUBCAT.ranch, SUBCAT.collect].includes(item.subcategory)
    || (item.subcategory === SUBCAT.wonder && item.population <= 0);
}

/** Whether the player helped this neighbour in the last day (their privateState's neighborAssists). */
export function helpedLately(assists: Record<string, number> | undefined, pid: string, now: number): boolean {
  const last = Number(assists?.[`u${pid}`] ?? assists?.[pid] ?? 0);
  return now - last < DAY;
}

/** A visit's help: up to 5 buildings, each once; sent as one command on leaving, as the Flash client does. */
export class Helping {
  readonly neighbour: string;
  readonly helped: PlacedItem[] = [];
  private sent = false;

  constructor(neighbour: string) {
    this.neighbour = neighbour;
  }

  /** Help a building: what it gave, or why not. */
  help(placed: PlacedItem): { gold: number; xp: number } | string {
    if (!canBeHelped(placed.item)) {
      return "";
    }
    if (this.sent || this.helped.length >= MOST_HELPED) {
      return `You've helped ${MOST_HELPED} buildings here today.`;
    }
    if (this.helped.includes(placed)) {
      return `You've helped ${placed.item.name} already.`;
    }
    this.helped.push(placed);
    return { gold: HELP_GOLD, xp: HELP_XP };
  }

  get left(): number {
    return this.sent ? 0 : MOST_HELPED - this.helped.length;
  }

  /** On leaving: the command for all the help, once (null when there was none). */
  finish(): Command | null {
    if (this.sent || this.helped.length === 0) {
      return null;
    }
    this.sent = true;
    const buildings = this.helped.map((p) => [p.tx, p.ty, p.item.id]);
    return { cmd: "assist_neighbor_new", args: [this.neighbour, 0, JSON.stringify(buildings)] };
  }
}

/** The help waiting for the player: one cart for each neighbour who helped, with the buildings (map.receivedAssists). */
export function carts(received: Record<string, unknown> | undefined): { helper: string; buildings: { x: number; y: number; id: number }[] }[] {
  return Object.entries(received ?? {}).map(([key, list]) => ({
    helper: key.replace(/^u/, ""),
    buildings: (Array.isArray(list) ? list : []).map((b: unknown[]) => ({ x: Number(b[0]), y: Number(b[1]), id: Number(b[2]) })),
  })).filter((cart) => cart.buildings.length > 0);
}

/** What a cart brings to a building: a quarter of its harvest, and experience. */
export function share(item: ItemInfo): { resource: Resource; amount: number; xp: number } {
  const resource = RESOURCES[item.collectType];
  return { resource: resource && resource !== "cash" ? resource : "gold", amount: Math.floor(item.collect / SHARE_DIVISOR), xp: SHARE_XP };
}

/** The cart delivers to a building: its share to the town, and the command. */
export function deliver(town: Town, building: PlacedItem): { resource: Resource; amount: number; xp: number; command: Command } {
  const brought = share(building.item);
  town[brought.resource] += brought.amount;
  town.xp += brought.xp;
  return { ...brought, command: { cmd: "assist_receive", args: [town.id, building.item.id] } };
}

/** The player has met a helper's cart: let in or sent away, the server hears it first, as from the Flash client. */
export function cartMet(town: Town, helper: string): Command {
  return { cmd: "clean_received_assists", args: [helper, town.id] };
}
