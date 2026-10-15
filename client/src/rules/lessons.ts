// Arthur's lessons, the Flash client's tutorial (CLIENT.md, "Arthur's
// lessons"): 32 steps in two halves. Steps 0 to 14 are Arthur's own words
// (a villager, a tree, a house, a knight and a first fight); steps 15 to 31
// walk through the first goals (a farm, a villager to work it, three trees
// cut). Each step reached is reported with complete_tutorial. At the end
// the town is given the dragon nest and a draggy of the player's choice.
// The rules are here: what each step asks, what it points at, and what
// moves it on. No drawing here.

import type { Command } from "../net/commands.ts";
import type { ItemInfo } from "./config.ts";

/** The lesson the Flash client reports when the first half is over. */
export const LAST_LESSON = 15;
/** The last step: when it's over (three trees cut), the lessons are done. */
export const LAST_STEP = 31;
/** What the Flash client has reported once everything is over. */
export const LESSONS_DONE = LAST_STEP;

export const SUBCAT = { villager: 71, mounted: 79, farm: 122, tree: 125, townHall: 135 } as const;
export const HOUSE_I = 1;
export const FARM_LAND = 10;
export const LIGHT_KNIGHT = 512;
/** Where the Flash client has the house and the farm put, as a new town is laid out. */
export const HOUSE_AT = { x: 55, y: 55 };
export const FARM_AT = { x: 52, y: 44 };
/** Trees the last step marks (a new town's clump west of the town hall), and how many must fall. */
export const MARKED_TREES = [{ x: 43, y: 54 }, { x: 44, y: 54 }, { x: 45, y: 54 }];
export const TREES_TO_CUT = 3;

/** The dragon nest the lessons give, near this tile, with this many of its first egg's ten steps done. */
export const DRAGON_NEST = 1233;
export const NEST_NEAR = { x: 50, y: 60 };
export const NEST_GIFT_STEPS = 7;
/** The three draggies to choose from, and where the chosen one stands. */
export const DRAGGIES = [651, 698, 710];
export const DRAGGY_NEAR = { x: 60, y: 60 };

/** What the player did, as the lessons hear it (the town editor tells them). */
export type LessonEvent =
  | { kind: "next" }
  | { kind: "selected"; item: ItemInfo }
  | { kind: "training"; unit: ItemInfo }
  | { kind: "walk" }
  | { kind: "harvest"; resource: ItemInfo }
  | { kind: "felled"; resource: ItemInfo }
  | { kind: "shop" }
  | { kind: "choose"; item: ItemInfo }
  | { kind: "placed"; item: ItemInfo; x: number; y: number }
  | { kind: "attack" }
  | { kind: "death" }
  | { kind: "goals" }
  | { kind: "closed" }
  | { kind: "inside"; unit: ItemInfo; building: ItemInfo }
  | { kind: "ready"; item: ItemInfo }
  | { kind: "collected"; item: ItemInfo };

/** What a step points at. */
export type Target =
  | { kind: "none" }
  | { kind: "hall" }
  | { kind: "train" }
  | { kind: "villager" }
  | { kind: "ground" }
  | { kind: "tree" }
  | { kind: "build" }
  | { kind: "card"; id: number }
  | { kind: "tile"; x: number; y: number; id: number }
  | { kind: "knight" }
  | { kind: "enemy" }
  | { kind: "goals" }
  | { kind: "close" }
  | { kind: "farm" }
  | { kind: "marked" };

export interface LessonStep {
  /** Arthur's words: the game's own (localisation ids) in the first half; ours in the second, where the original had none. */
  title: number | string;
  text: number | string;
  /** A Next button: the step only waits for it. */
  next: boolean;
  target: Target;
  /** Whether this moves the step on. Steps with neither Next nor a test pass at once. */
  done?: (event: LessonEvent) => boolean;
}

const is = (kind: LessonEvent["kind"]) => (event: LessonEvent) => event.kind === kind;
const selected = (subcategory: number) => (event: LessonEvent) => event.kind === "selected" && event.item.subcategory === subcategory;
const peasant = (item: ItemInfo) => item.subcategory === SUBCAT.villager;

export const STEPS: LessonStep[] = [
  // The first half: the game's own words.
  { title: 1, text: 2, next: true, target: { kind: "none" } },
  { title: 3, text: 4, next: false, target: { kind: "hall" }, done: selected(SUBCAT.townHall) },
  { title: 5, text: 6, next: false, target: { kind: "train" }, done: (e) => e.kind === "training" && peasant(e.unit) },
  { title: 7, text: 8, next: false, target: { kind: "villager" }, done: selected(SUBCAT.villager) },
  { title: 9, text: 10, next: false, target: { kind: "ground" }, done: is("walk") },
  { title: 11, text: 12, next: false, target: { kind: "tree" }, done: (e) => e.kind === "harvest" && e.resource.subcategory === SUBCAT.tree },
  { title: 13, text: 14, next: false, target: { kind: "none" }, done: (e) => e.kind === "felled" && e.resource.subcategory === SUBCAT.tree },
  // The wood is the player's as the tree falls here (no token to pick up): this one passes.
  { title: 15, text: 16, next: false, target: { kind: "none" } },
  { title: 17, text: 18, next: false, target: { kind: "build" }, done: is("shop") },
  { title: 19, text: 20, next: false, target: { kind: "card", id: HOUSE_I }, done: (e) => e.kind === "choose" && e.item.id === HOUSE_I },
  { title: 21, text: 22, next: false, target: { kind: "tile", ...HOUSE_AT, id: HOUSE_I }, done: (e) => e.kind === "placed" && e.item.id === HOUSE_I },
  { title: 23, text: 24, next: false, target: { kind: "knight" }, done: (e) => e.kind === "selected" && e.item.isUnit && e.item.attack > 0 },
  { title: 25, text: 26, next: false, target: { kind: "enemy" }, done: is("attack") },
  { title: 27, text: 28, next: false, target: { kind: "none" }, done: is("death") },
  { title: 29, text: 30, next: true, target: { kind: "none" } },
  // The second half: the goals. The original showed no words of Arthur's here; these are ours. After
  // each look at the goals, Arthur waits quietly for them to be closed.
  { title: "Your goals", text: "Arthur keeps goals for you, at the bottom left. Tap them!", next: false, target: { kind: "goals" }, done: is("goals") },
  { title: "", text: "", next: false, target: { kind: "close" }, done: is("closed") },
  { title: "A farm", text: "The first goal: a farm. Tap BUILD.", next: false, target: { kind: "build" }, done: is("shop") },
  { title: "Select the farm", text: "Choose the Farm Land.", next: false, target: { kind: "card", id: FARM_LAND }, done: (e) => e.kind === "choose" && e.item.id === FARM_LAND },
  { title: "Place the farm", text: "Put it down near your Town Hall.", next: false, target: { kind: "tile", ...FARM_AT, id: FARM_LAND },
    done: (e) => e.kind === "placed" && e.item.id === FARM_LAND },
  { title: "Your goals", text: "A farm needs a villager to work it: tap the goals again.", next: false, target: { kind: "goals" }, done: is("goals") },
  { title: "", text: "", next: false, target: { kind: "close" }, done: is("closed") },
  { title: "Select the Town Hall", text: "Tap your Town Hall.", next: false, target: { kind: "hall" }, done: selected(SUBCAT.townHall) },
  { title: "Train a villager", text: "Train another villager.", next: false, target: { kind: "train" }, done: (e) => e.kind === "training" && peasant(e.unit) },
  { title: "Select the villager", text: "When it's out, select your new villager.", next: false, target: { kind: "villager" }, done: selected(SUBCAT.villager) },
  { title: "Into the farm", text: "Tap the farm: the villager goes in and works it.", next: false, target: { kind: "farm" },
    done: (e) => e.kind === "inside" && e.building.subcategory === SUBCAT.farm },
  { title: "Wait", text: "The crop is growing...", next: false, target: { kind: "none" }, done: (e) => e.kind === "ready" && e.item.subcategory === SUBCAT.farm },
  { title: "Collect the food", text: "The farm is ready: tap it to collect the food.", next: false, target: { kind: "farm" },
    done: (e) => e.kind === "collected" && e.item.subcategory === SUBCAT.farm },
  { title: "Your goals", text: "One more goal: tap the goals.", next: false, target: { kind: "goals" }, done: is("goals") },
  { title: "", text: "", next: false, target: { kind: "close" }, done: is("closed") },
  { title: "Select a villager", text: "You'll need wood too. Select a villager.", next: false, target: { kind: "villager" }, done: selected(SUBCAT.villager) },
  { title: "Cut trees", text: "Send it to the marked trees: cut three.", next: false, target: { kind: "marked" } },
];

/** Whether an event moves step `step` on. */
export function moves(step: number, event: LessonEvent): boolean {
  const lesson = STEPS[step];
  if (!lesson) {
    return false;
  }
  return lesson.next ? event.kind === "next" : Boolean(lesson.done?.(event));
}

/** Whether a step passes by itself, as soon as it's reached. */
export function passes(step: number): boolean {
  const lesson = STEPS[step];
  return Boolean(lesson) && !lesson.next && !lesson.done && step !== LAST_STEP;
}

/** The step to carry on from after a reload: the start of the lesson it was in. */
export function resumeAt(step: number): number {
  const starts = [0, 1, 8, 11, 14, 15, 17, 20, 28, 30];
  return starts.filter((s) => s <= step).at(-1) ?? 0;
}

/** "1 of 7": the original's page line for the first half (half the step, rounded down). */
export function pageOf(step: number): string {
  return step <= 14 ? `${Math.floor(step / 2)} of 7` : "";
}

/** Whether the player hasn't started Arthur's lessons: none reported, and this is their first town. */
export function lessonsNotStarted(completed: unknown, town: number): boolean {
  return town === 0 && reported(completed) === 0;
}

/**
 * Whether the lessons were left part way in this browser, to carry on: the
 * step saved, the town the first, not yet over. (15 alone means the first
 * half was finished or skipped elsewhere, so it only counts when this
 * browser says the lessons were going on.)
 */
export function lessonsUnderWay(completed: unknown, town: number, here: number | null): boolean {
  const step = reported(completed);
  return town === 0 && step > 0 && step < LAST_STEP && (step !== LAST_LESSON || here === LAST_LESSON);
}

export function reported(completed: unknown): number {
  return Number.parseInt(String(completed ?? "0"), 10) || 0;
}

/** A step reached, as the Flash client reports it. */
export function stepReached(step: number): Command {
  return { cmd: "complete_tutorial", args: [step] };
}

/** Skipping them: the report the Flash client sends when the first half is over (no nest, no draggy). */
export function skipLessons(): Command {
  return stepReached(LAST_LESSON);
}
