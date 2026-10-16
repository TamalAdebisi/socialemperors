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
import type { PlacedItem, Town } from "./town.ts";

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
  /** The islands' best stars, as the save keeps them (questsRank: quest id to stars). */
  questStars: Record<string, number> = {};
  /** The island map opened at all, and from the menus (not a harbour's button). */
  islandsOpened = false;
  islandsFromMenu = false;
  /** The market's trades, by good (w, s, f): what was bought, and what was sold (as a negative count). */
  bought = new Map<string, number>();
  sold = new Map<string, number>();
  /** A defence plan picked in the army window (while its goal is open, as the Flash client counted it). */
  planPicked = false;
  /** Attacks on players fought to the end (not left), and the neighbours attacked, since the page opened. */
  attacksMade = 0;
  neighboursAttacked = new Set<string>();
  /** Spy visits; attacks on players of the player's level and above it (left or not, as the Flash client counted them). */
  spied = 0;
  attacksSameLevel = 0;
  attacksHigherLevel = 0;
  /** Attacks won in all (the save's privateState.attacksWon). */
  attacksWon = 0;
  /** The Battle Results window opened. */
  historyOpened = false;
  /**
   * The goal kinds listened for: the open goals' (GoalKeeper sets them before
   * each check), or null for all. As in the Flash client, most doings count
   * only while a goal of their kind is open; collecting, catching, letting
   * out, zooming and a few others always count.
   */
  private listening: Set<string> | null = null;

  listen(kinds: Iterable<string>): void {
    this.listening = new Set(kinds);
  }

  private hears(...kinds: string[]): boolean {
    return this.listening === null || kinds.some((kind) => this.listening!.has(kind));
  }

  collected(item: ItemInfo): void {
    add(this.collectedKind, item.subcategory);
    add(this.collectedItem, item.id);
  }

  /** A mill or mine set to work: the minutes chosen, the last choice counting, as in the Flash client. */
  workTime(item: ItemInfo, minutes: number): void {
    if (!this.hears("work-time-kind", "work-time")) {
      return;
    }
    this.workTimeKind.set(item.subcategory, minutes);
    this.workTimeItem.set(item.id, minutes);
  }

  letOut(building: ItemInfo): void {
    add(this.letOutOf, building.subcategory);
  }

  moved(item: ItemInfo): void {
    if (this.hears("move-kind")) {
      add(this.movedKind, item.subcategory);
    }
  }

  captured(item: ItemInfo): void {
    add(this.capturedKind, item.subcategory);
  }

  stored(item: ItemInfo): void {
    if (this.hears("store-kind")) {
      add(this.storedKind, item.subcategory);
    }
  }

  pushedInto(unit: ItemInfo, building: ItemInfo): void {
    if (!this.hears("push-kind")) {
      return;
    }
    const inner = this.pushed.get(building.subcategory) ?? new Map<number, number>();
    add(inner, unit.subcategory);
    this.pushed.set(building.subcategory, inner);
  }

  trained(unit: ItemInfo, building: ItemInfo): void {
    if (!this.hears("train-at")) {
      return;
    }
    const inner = this.trainedAt.get(building.id) ?? new Map<number, number>();
    add(inner, unit.id);
    this.trainedAt.set(building.id, inner);
  }

  /** Something placed from storage. */
  placedFromStorage(): void {
    if (this.hears("place-stored")) {
      this.placedStored = true;
    }
  }

  /** The daily bonus collected: its day of the five. */
  dailyBonus(day: number): void {
    if (this.hears("daily-bonus")) {
      this.dailyBonusDay = day;
    }
  }

  /** The island map opened (a window, counted only while its goal is open); from the menus counts always. */
  openedIslands(fromMenu: boolean): void {
    if (this.hears("islands-opened")) {
      this.islandsOpened = true;
    }
    this.islandsFromMenu ||= fromMenu;
  }

  /** A trade at the market: the good and how much, bought (above 0) or sold (below). */
  traded(good: string, amount: number): void {
    if (this.hears("market-trade")) {
      const counts = amount > 0 ? this.bought : this.sold;
      counts.set(good, (counts.get(good) ?? 0) + amount);
    }
  }

  pickedPlan(): void {
    if (this.hears("defence-plan")) {
      this.planPicked = true;
    }
  }

  /** An attack on a player, played on its own page: told here when the player comes home (attackPlay.ts). */
  attacked(victim: string, voluntary: boolean, neighbour: boolean, levels?: { theirs?: number; mine?: number }): void {
    if (!voluntary) {
      this.attacksMade++;
    }
    if (neighbour) {
      this.neighboursAttacked.add(victim);
    }
    if (levels?.theirs !== undefined && levels.mine !== undefined) {
      this.attacksSameLevel += levels.theirs === levels.mine ? 1 : 0;
      this.attacksHigherLevel += levels.theirs > levels.mine ? 1 : 0;
    }
  }

  spend(letter: string, amount: number): void {
    if (amount > 0 && this.hears("spend")) {
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
    case "quest":
      return of(Math.min(Number(doings.questStars[String(args[0])] ?? 0), n(1)), n(1));
    case "islands-opened":
      return of(doings.islandsOpened ? 1 : 0, 1);
    case "islands-from-menu":
      return of(doings.islandsFromMenu ? 1 : 0, 1);
    case "market-trade":
      return of(marketTraded(doings, args[0] as unknown[]) ? 1 : 0, 1);
    case "attack-player":
      return of(doings.attacksMade, n(0));
    case "spy-player":
      return of(doings.spied, n(0));
    case "attacks-won":
      return of(doings.attacksWon, n(0));
    case "attack-same-level":
      return of(doings.attacksSameLevel, n(0));
    case "attack-higher-level":
      return of(doings.attacksHigherLevel, n(0));
    case "attack-neighbour":
      return of(doings.neighboursAttacked.size ? 1 : 0, 1);
    case "history-opened":
      return of(doings.historyOpened ? 1 : 0, 1);
    case "defence-plan":
      return of(doings.planPicked ? 1 : 0, 1);
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

/** Whether each good was bought (a count above 0) or sold (below 0) as much as asked: ["s", 200, ...]. */
function marketTraded(doings: Doings, asked: unknown[]): boolean {
  for (let i = 0; i < asked.length; i += 2) {
    const good = String(asked[i]), amount = Number(asked[i + 1]);
    if (amount > 0 && (doings.bought.get(good) ?? 0) < amount) {
      return false;
    }
    if (amount < 0 && (doings.sold.get(good) ?? 0) > amount) {
      return false;
    }
  }
  return true;
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

/**
 * Whether there are enough units of each kind near the town hall: [kind,
 * how many, ...]. As the Flash client counts: the nearest 20 of the
 * player's units on the map within a circle of 3 tiles round the hall's
 * tile (its corner).
 */
function nearHall(town: Town, wanted: number[]): boolean {
  const hall = town.items.find((p) => p.item.subcategory === SUBCAT_TOWN_HALL);
  if (!hall) {
    return false;
  }
  const away = (p: PlacedItem) => (p.tx - hall.tx) ** 2 + (p.ty - hall.ty) ** 2;
  const nearest = town.items
    .filter((p) => p.item.isUnit && isTheirs(town, p.item) && away(p) <= NEAR_HALL ** 2)
    .sort((a, b) => away(a) - away(b))
    .slice(0, NEAR_HALL_MOST);
  for (let i = 0; i < wanted.length; i += 2) {
    if (nearest.filter((p) => p.item.subcategory === wanted[i]).length < wanted[i + 1]) {
      return false;
    }
  }
  return true;
}

/** Goal 18's circle round the town hall, in tiles, and how many of the nearest units it looks at. */
const NEAR_HALL = 3;
const NEAR_HALL_MOST = 20;

/** A goal reached: the server hears it (skipped: paid for in cash). */
export function completeGoal(goal: Goal, skipped: boolean): Command {
  return { cmd: "complete_mission", args: [goal.id, skipped ? 1 : 0] };
}

/** A done goal's gold: it goes to the town, and the server pays it too. */
export function payGoal(town: Town, goal: Goal): Command {
  town.gold += goal.reward;
  return { cmd: "reward_mission", args: [town.id, goal.id] };
}
