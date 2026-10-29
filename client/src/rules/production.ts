// Buildings that produce, as the Flash client runs them: mills, mines, farms,
// ranches, wonders... Each works for a while; then its harvest is collected
// and the work starts over. The rules are from our notes on the Flash client
// (CLIENT.md, step 3). No drawing here.

import type { Command } from "../net/commands.ts";
import type { ConfigItem } from "./config.ts";
import type { PlacedItem, Town } from "./town.ts";
import { cantPayFood, payFood } from "./speedUps.ts";

export type Resource = "gold" | "wood" | "food" | "stone" | "cash";

export const RESOURCES: Record<string, Resource> = { g: "gold", w: "wood", f: "food", s: "stone", c: "cash" };

/**
 * How a building works:
 *   workers  while units are inside (farms, ranches, troll mills...), over and over
 *   chosen   while units are inside, for a time the player picks each round (human mills and mines)
 *   always   on its own, over and over (wonders, the bakery, the temple...)
 */
export type ProductionKind = "workers" | "chosen" | "always";

export interface Production {
  kind: ProductionKind;
  /** One round of work, in seconds (for "chosen": the time picked instead). */
  seconds: number;
  /** What one round gives with one worker, before the working time counts. */
  amount: number;
  resource: Resource;
  xp: number;
  /** Farms use up wood each harvest. */
  farm: boolean;
}

const SUBCAT = { mill: 121, farm: 122, ranch: 123, mine: 124, foodShop: 138, wonder: 511 };
const WITH_WORKERS = new Set([SUBCAT.mill, SUBCAT.farm, SUBCAT.ranch, SUBCAT.mine]);

/** The working times a player can choose, in minutes, and what each does to the harvest. */
export const WORK_TIMES = [
  { minutes: 5, harvest: 0.5 },
  { minutes: 60, harvest: 1 },
  { minutes: 240, harvest: 2 },
  { minutes: 480, harvest: 3 },
];
/** Each worker after the first adds this share of the harvest. */
const EXTRA_PER_WORKER = 0.2;

/**
 * What a config item produces, or null. Things that produce in other ways
 * aren't here yet: trees, rocks and mines on the map (a villager works
 * them), isles, markets, the nursery, the sacrifice altar, treasures.
 * `chosenTime` lists the items whose working time the player picks.
 */
export function productionOf(item: ConfigItem, chosenTime: Set<number>): Production | null {
  const seconds = Number(item.activation) || 0;
  const amount = Math.floor(Number(item.collect) || 0);
  const resource = RESOURCES[item.collect_type ?? ""];
  if (item.type !== "b" || seconds <= 0 || amount <= 0 || resource === undefined) {
    return null;
  }
  const subcategory = Number(item.subcat_functional);
  const capacity = Number(item.unit_capacity) || 0;
  let kind: ProductionKind;
  if (capacity > 0 && WITH_WORKERS.has(subcategory)) {
    kind = chosenTime.has(Number(item.id)) ? "chosen" : "workers";
  } else if (capacity === 0) {
    // Anything else with a working time and no room for workers works on its own, as in
    // the Flash client: the wonders, the bakery and the like, the Cash Wonder.
    kind = "always";
  } else {
    return null;
  }
  return { kind, seconds, amount, resource, xp: Number(item.collect_xp) || 0, farm: subcategory === SUBCAT.farm };
}

export type WorkState =
  /** Nobody inside to work it. */
  | { status: "idle" }
  /** Workers inside, waiting for the player to choose how long they work. */
  | { status: "asleep" }
  | { status: "working"; secondsLeft: number; done: number }
  | { status: "ready" };

/** Where a producing thing is in its work at `now` (the server's clock, seconds); null if it doesn't produce. */
export function workState(placed: PlacedItem, now: number): WorkState | null {
  const production = placed.item.production;
  if (!production) {
    return null;
  }
  if (production.kind !== "always" && placed.unitsInside === 0) {
    return { status: "idle" };
  }
  const length = roundLength(placed);
  if (length === null) {
    return { status: "asleep" };
  }
  if (placed.startedAt === null) {
    return { status: "idle" };  // the save doesn't say when it started: the Flash client never finishes it either
  }
  const worked = Math.max(now - placed.startedAt, 0);
  if (worked >= length) {
    return { status: "ready" };
  }
  return { status: "working", secondsLeft: length - worked, done: worked / length };
}

/** How long a round takes, in seconds; null when the player hasn't chosen yet. */
function roundLength(placed: PlacedItem): number | null {
  const production = placed.item.production!;
  if (production.kind !== "chosen") {
    return production.seconds;
  }
  const time = WORK_TIMES[placed.workTime - 1];
  return time ? time.minutes * 60 : null;
}

/** What collecting gives: the amount, a fifth more for each extra worker, times the working time's share. */
export function harvest(placed: PlacedItem, workTime = placed.workTime): number {
  const production = placed.item.production!;
  const base = production.amount;
  const share = production.kind === "chosen" ? (WORK_TIMES[workTime - 1]?.harvest ?? 1) : 1;
  const workers = placed.unitsInside;
  if (workers > 1) {
    return Math.floor(Math.floor(base + (workers - 1) * base * EXTRA_PER_WORKER) * share);
  }
  return Math.floor(base * share);
}

/** The wood a farm uses up each harvest: a third of what it gives with one worker. */
export function farmWood(production: Production): number {
  return production.farm ? Math.round(production.amount / 3) : 0;
}

export interface Collected {
  commands: Command[];
  resource: Resource;
  amount: number;
  xp: number;
  wood: number;
  /** A ranch's harvest uses up an animal: its item id, gone for good. */
  usedUp?: number;
}

/** The Nursery: a ranch by its kind, but it keeps its animals. */
const NURSERY = 226;

/**
 * Collect a ready building: the harvest and experience go to the town, its
 * work starts over (a "chosen" one waits for a new choice). A string when it
 * can't be collected.
 */
export function collect(town: Town, placed: PlacedItem, now: number, hurried = false): Collected | string {
  const production = placed.item.production;
  if (!production || (!hurried && workState(placed, now)?.status !== "ready")) {
    return `${placed.item.name} isn't ready yet.`;
  }
  const wood = farmWood(production);
  if (town.wood < wood) {
    // The Flash client lets the farm go to waste here; this client keeps it for when there's wood.
    return `Harvesting ${placed.item.name} takes ${wood} wood.`;
  }
  const amount = harvest(placed);
  town.wood -= wood;
  town[production.resource] += amount;
  town.xp += production.xp;
  const commands: Command[] = [{
    cmd: "collect_new",
    args: [placed.tx, placed.ty, town.id, placed.item.id, placed.unitsInside, 1, 0],
  }];
  placed.startedAt = now;
  if (production.kind === "chosen") {
    placed.workTime = 0;
    commands.push({ cmd: "activate", args: [placed.tx, placed.ty, town.id, placed.item.id, 0] });
  }
  // A ranch's harvest uses up its first animal, for good, as in the Flash client:
  // pop_unit with no tile to put it on. When the last has gone the ranch stops.
  let usedUp: number | undefined;
  if (placed.item.subcategory === SUBCAT.ranch && placed.item.id !== NURSERY && placed.unitsInside > 0) {
    usedUp = placed.units?.shift();
    placed.unitsInside -= 1;
    if (usedUp !== undefined) {
      commands.push({ cmd: "pop_unit", args: [placed.tx, placed.ty, town.id, usedUp] });
    }
  }
  return { commands, resource: production.resource, amount, xp: production.xp, wood, ...(usedUp === undefined ? {} : { usedUp }) };
}

/** What finishing a building's work at once cost in the original, in cash (the Flash client's hurry up): paid in food (rules/speedUps.ts). */
export const HURRY_CASH = 2;
const HURRIED = new Set([SUBCAT.mill, SUBCAT.mine, SUBCAT.foodShop]);

/** Whether a building working now can be hurried: mills, mines, the bakery, and wonders that house nobody. */
export function canHurry(placed: PlacedItem, now: number): boolean {
  const item = placed.item;
  const kind = HURRIED.has(item.subcategory) || (item.subcategory === SUBCAT.wonder && item.population === 0);
  return kind && workState(placed, now)?.status === "working";
}

/** Finish a building's work now for food, and collect it: as collecting, with the original's cash in the command. */
export function hurry(town: Town, placed: PlacedItem, now: number): Collected | string {
  if (!canHurry(placed, now)) {
    return `${placed.item.name} isn't working.`;
  }
  // Food, not cash (the owner's rule, 29 October 2026).
  const short = cantPayFood(town, HURRY_CASH);
  if (short) {
    return short;
  }
  const done = collect(town, placed, now, true);
  if (typeof done !== "string") {
    payFood(town, HURRY_CASH);
    done.commands[0].args[6] = HURRY_CASH;  // as the Flash client sends it; the server takes the food
  }
  return done;
}

/** Choose how long a "chosen" building works (1 to 4: WORK_TIMES); it starts now. */
export function chooseWorkTime(town: Town, placed: PlacedItem, choice: number, now: number): Command {
  placed.workTime = choice;
  placed.startedAt = now;
  return { cmd: "activate", args: [placed.tx, placed.ty, town.id, placed.item.id, choice] };
}
