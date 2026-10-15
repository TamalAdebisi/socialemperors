// The goals (the game's missions), as the Flash client keeps them (our notes,
// our words; CLIENT.md, "Missions and bonuses"). The config has each goal's
// title, text and gold; goals.json, what each asks. The first 15 not yet
// done and paid are open; every 2 seconds the open ones are checked, those
// reached are sent as done, and the first done one is paid its gold. Some
// goals count the town as it is (houses built, villagers in mills); others
// count what the player did since the page opened (fields collected, mills
// set to work), as the Flash client counts them. No drawing here.

import type { Command } from "../net/commands.ts";
import type { ItemInfo } from "./config.ts";
import { isTheirs } from "./editing.ts";
import type { Town } from "./town.ts";

/** How many goals are open at once. */
export const OPEN_GOALS = 15;
/** The goals go up to this number; the ones after it are never offered. */
const LAST_GOAL = 226;
/** The Small Refuge: the refuge goal counts the units in it. */
const SMALL_REFUGE = 151;
const SUBCAT_TOWN_HALL = 135;

/** What a goal asks: its kind, then its numbers (goals.json). */
export type Need = [string, ...unknown[]];

export interface Goal {
  id: number;
  title: string;
  description: string;
  /** The gold it pays. */
  reward: number;
  need: Need | null;
}

/** The game's host, who stands in the goals' texts. */
const HOST = "Arthur";

/** The config's missions with what each asks. */
export function readGoals(missions: { id: number | string; title: string; description?: string; reward?: number | string }[],
  needs: Record<string, Need>): Map<number, Goal> {
  const goals = new Map<number, Goal>();
  for (const mission of missions) {
    const id = Number(mission.id);
    if (goals.has(id)) {
      continue;  // the server's config adds a stand-in for goal 1 after the real one (config/patch): the first counts
    }
    // "#0#" stands for the host, as in the Flash client: Arthur (it said Guinevere to players who were women; we don't keep that).
    const host = (text: string) => text.replaceAll("#0#", HOST);
    goals.set(id, { id, title: host(mission.title), description: host(mission.description ?? ""), reward: Number(mission.reward) || 0, need: needs[id] ?? null });
  }
  return goals;
}

/** From this level a human town has the spells box instead of goals (Beta 2). */
const GOALS_UNTIL_LEVEL = 35;

/**
 * Whether the town has goals at all, decided when it loads, as the Flash
 * client does: only a human town, below level 35.
 */
export function goalsRun(town: Town): boolean {
  return town.race === "h" && town.level < GOALS_UNTIL_LEVEL;
}

/** The open goals, in order: the first 15 not both done and paid. */
export function openGoals(goals: Map<number, Goal>, done: Set<number>, paid: Set<number>): Goal[] {
  const open: Goal[] = [];
  for (let id = 1; id <= LAST_GOAL && open.length < OPEN_GOALS; id++) {
    if (!(done.has(id) && paid.has(id))) {
      const goal = goals.get(id);
      if (goal) {
        open.push(goal);
      }
    }
  }
  return open;
}

/**
 * What the player did since the page opened, for the goals that count
 * doings rather than the town: by kind of thing (its subcategory) and by item.
 */
export class Doings {
  collectedKind = new Map<number, number>();
  collectedItem = new Map<number, number>();
  workTimeKind = new Map<number, number>();
  workTimeItem = new Map<number, number>();
  letOutOf = new Map<number, number>();
  movedKind = new Map<number, number>();
  storedKind = new Map<number, number>();
  /** Wild animals caught, by kind. */
  capturedKind = new Map<number, number>();
  /** Units pushed: by the building's kind, then the unit's kind. */
  pushed = new Map<number, Map<number, number>>();
  /** Units trained: by the building, then the unit. */
  trainedAt = new Map<number, Map<number, number>>();
  /** Resources spent, by letter (g, w, f, s, c). */
  spent = new Map<string, number>();
  zoomed = false;
  /** The square tool taken up (its button, or Space). */
  selectionToolUsed = false;
  placedStored = false;
  /** The daily bonus's day collected (1 to 5), 0 for none. */
  dailyBonusDay = 0;
  /** The neighbour visited last (their pid), and how many of neighbours' buildings were helped. */
  lastVisited = "";
  helpedBuildings = 0;

  collected(item: ItemInfo): void {
    add(this.collectedKind, item.subcategory);
    add(this.collectedItem, item.id);
  }

  /** A mill or mine set to work: the minutes chosen, the longest counting. */
  workTime(item: ItemInfo, minutes: number): void {
    this.workTimeKind.set(item.subcategory, Math.max(this.workTimeKind.get(item.subcategory) ?? 0, minutes));
    this.workTimeItem.set(item.id, Math.max(this.workTimeItem.get(item.id) ?? 0, minutes));
  }

  letOut(building: ItemInfo): void {
    add(this.letOutOf, building.subcategory);
  }

  moved(item: ItemInfo): void {
    add(this.movedKind, item.subcategory);
  }

  captured(item: ItemInfo): void {
    add(this.capturedKind, item.subcategory);
  }

  stored(item: ItemInfo): void {
    add(this.storedKind, item.subcategory);
  }

  pushedInto(unit: ItemInfo, building: ItemInfo): void {
    const inner = this.pushed.get(building.subcategory) ?? new Map<number, number>();
    add(inner, unit.subcategory);
    this.pushed.set(building.subcategory, inner);
  }

  trained(unit: ItemInfo, building: ItemInfo): void {
    const inner = this.trainedAt.get(building.id) ?? new Map<number, number>();
    add(inner, unit.id);
    this.trainedAt.set(building.id, inner);
  }

  spend(letter: string, amount: number): void {
    if (amount > 0) {
      this.spent.set(letter, (this.spent.get(letter) ?? 0) + amount);
    }
  }
}

function add(counts: Map<number, number>, key: number): void {
  counts.set(key, (counts.get(key) ?? 0) + 1);
}

/** How far along a goal is: done of what's needed. Null when it's played in the classic game for now. */
export function progress(town: Town, goal: Goal, doings: Doings, people: number, items: Map<number, ItemInfo>): { done: number; of: number } | null {
  const need = goal.need;
  if (!need) {
    return null;
  }
  const [kind, ...args] = need;
  const n = (i: number) => Number(args[i]);
  const ids = (i: number) => new Set((args[i] as number[]).map(Number));
  const of = (done: number, needed: number) => ({ done: Math.min(done, needed), of: needed });
  switch (kind) {
    case "build-kind":
    case "have-kind":
      return of(count(town, items, (item) => item.subcategory === n(0)), n(1));
    case "build":
    case "have": {
      const wanted = ids(0);
      return of(count(town, items, (item) => wanted.has(item.id)), n(1));
    }
    case "inside-kind":
      return of(inside(town, items, (b) => b.subcategory === n(0), n(1)), n(2));
    case "inside": {
      const wanted = ids(0);
      return of(inside(town, items, (b) => wanted.has(b.id), n(1)), n(2));
    }
    case "collect-kind":
      return of(doings.collectedKind.get(n(0)) ?? 0, n(1));
    case "collect": {
      let done = 0;
      for (const id of ids(0)) {
        done += doings.collectedItem.get(id) ?? 0;
      }
      return of(done, n(1));
    }
    case "work-time-kind":
      return of((doings.workTimeKind.get(n(0)) ?? 0) >= n(1) ? 1 : 0, 1);
    case "work-time": {
      const longest = Math.max(0, ...[...ids(0)].map((id) => doings.workTimeItem.get(id) ?? 0));
      return of(longest >= n(1) ? 1 : 0, 1);
    }
    case "let-out-kind":
      return of(doings.letOutOf.get(n(0)) ?? 0, n(1));
    case "move-kind":
      return of(doings.movedKind.get(n(0)) ?? 0, n(1));
    case "capture-kind":
      return of(doings.capturedKind.get(n(0)) ?? 0, n(1));
    case "store-kind": {
      let done = 0;
      for (const kind_ of ids(0)) {
        done += doings.storedKind.get(kind_) ?? 0;
      }
      return of(done, n(1));
    }
    case "push-kind":
      return of(doings.pushed.get(n(1))?.get(n(0)) ?? 0, n(2));
    case "train-at":
      return of(trainedAt(doings, args[0], n(1)) ? 1 : 0, 1);
    case "zoom":
      return of(doings.zoomed ? 1 : 0, 1);
    case "selection-tool":
      return of(doings.selectionToolUsed ? 1 : 0, 1);
    case "place-stored":
      return of(doings.placedStored ? 1 : 0, 1);
    case "daily-bonus":
      return of(doings.dailyBonusDay >= n(0) ? 1 : 0, 1);
    case "visited":
      return of((args[0] as string[]).includes(doings.lastVisited) ? 1 : 0, 1);
    case "helped":
      return of(doings.helpedBuildings, n(0));
    case "spend":
      return of(doings.spent.get(String(args[0])) ?? 0, n(1));
    case "people":
      return of(people, n(0));
    case "land":
      return of(town.expansions.size, n(0));
    case "refuge": {
      const refuge = town.items.find((p) => p.item.id === SMALL_REFUGE && isTheirs(town, p.item));
      return of((refuge?.units?.length ?? 0) >= n(0) ? 1 : 0, 1);
    }
    case "walls":
      return of(wallsAlongTheFront(town, n(1)), n(0));
    case "near-hall":
      return of(nearHall(town, args[0] as number[]) ? 1 : 0, 1);
    default:
      return null;  // battles, quests, the social buildings: the classic game, for now
  }
}

/** The player's things on the map, and units inside their buildings, that match. */
function count(town: Town, items: Map<number, ItemInfo>, match: (item: ItemInfo) => boolean): number {
  let n = 0;
  for (const placed of town.items) {
    if (!isTheirs(town, placed.item)) {
      continue;
    }
    n += match(placed.item) ? 1 : 0;
    for (const id of placed.units ?? []) {
      const unit = items.get(id);
      n += unit && match(unit) ? 1 : 0;
    }
  }
  return n;
}

/** Units of a kind inside the player's buildings that match. */
function inside(town: Town, items: Map<number, ItemInfo>, building: (item: ItemInfo) => boolean, unitKind: number): number {
  let n = 0;
  for (const placed of town.items) {
    if (isTheirs(town, placed.item) && building(placed.item)) {
      n += (placed.units ?? []).filter((id) => items.get(id)?.subcategory === unitKind).length;
    }
  }
  return n;
}

function trainedAt(doings: Doings, what: unknown, buildingId: number): boolean {
  const trained = doings.trainedAt.get(buildingId);
  if (!trained) {
    return false;
  }
  if (Array.isArray(what)) {
    for (let i = 0; i < what.length; i += 2) {
      if ((trained.get(Number(what[i])) ?? 0) < Number(what[i + 1])) {
        return false;
      }
    }
    return true;
  }
  return [...trained.values()].reduce((a, b) => a + b, 0) >= Number(what);
}

/** Walls of an item along the island's south edge, as the Flash client counts them: one row, x 40 to 59. */
function wallsAlongTheFront(town: Town, wallId: number): number {
  const row = town.expansions.has(18) ? 79 : 59;
  return town.items.filter((p) => p.item.id === wallId && p.ty === row && p.tx >= 40 && p.tx <= 59).length;
}

/** Whether there are enough units of each kind within 3 tiles of the town hall's corner: [kind, how many, ...]. */
function nearHall(town: Town, wanted: number[]): boolean {
  const hall = town.items.find((p) => p.item.subcategory === SUBCAT_TOWN_HALL);
  if (!hall) {
    return false;
  }
  for (let i = 0; i < wanted.length; i += 2) {
    const near = town.items.filter((p) => p.item.isUnit && p.item.subcategory === wanted[i] && isTheirs(town, p.item)
      && Math.max(Math.abs(p.tx - hall.tx), Math.abs(p.ty - hall.ty)) <= 3).length;
    if (near < wanted[i + 1]) {
      return false;
    }
  }
  return true;
}

/** A goal reached: the server hears it (skipped: paid for in cash). */
export function completeGoal(goal: Goal, skipped: boolean): Command {
  return { cmd: "complete_mission", args: [goal.id, skipped ? 1 : 0] };
}

/** A done goal's gold: it goes to the town, and the server pays it too. */
export function payGoal(town: Town, goal: Goal): Command {
  town.gold += goal.reward;
  return { cmd: "reward_mission", args: [town.id, goal.id] };
}
