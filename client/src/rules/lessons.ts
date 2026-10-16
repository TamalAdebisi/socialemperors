// Mandatory tutorial objectives (CLIENT.md, "Arthur's lessons").
// Keep the original town actions and gift, with clearer instructions and
// exact saved checkpoints. No drawing here.

import type { Command } from "../net/commands.ts";
import type { ItemInfo } from "./config.ts";

/** The lesson the Flash client reports when the first half is over. */
export const LAST_LESSON = 15;
/** The last step: when it's over (three trees cut), the lessons are done. */
export const LAST_STEP = 31;
/** New-client checkpoints: reward pending, then reward saved. */
export const REWARD_STEP = 32;
export const LESSONS_DONE = 33;

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
  | { kind: "death"; enemy: boolean }
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
  /** One action at a time, in plain language. */
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
  { title: "Welcome to your empire!", text: "I'm Arthur. Let's build your town and learn to defend it. Finish these lessons to choose your first draggy. Your progress saves as you play.", next: true, target: { kind: "none" } },
  { title: "Train a villager", text: "Select your Town Hall. Villagers gather resources and work in your buildings.", next: false, target: { kind: "hall" }, done: selected(SUBCAT.townHall) },
  { title: "Train a villager", text: "Press Train on the Town Hall's card. Your villager will appear beside it.", next: false, target: { kind: "train" }, done: (e) => e.kind === "training" && peasant(e.unit) },
  { title: "Select your villager", text: "Select the villager beside your Town Hall. If training is still finishing, wait a moment.", next: false, target: { kind: "villager" }, done: selected(SUBCAT.villager) },
  { title: "Move your villager", text: "With your villager selected, tap the highlighted patch of ground to walk there.", next: false, target: { kind: "ground" }, done: is("walk") },
  { title: "Gather wood", text: "Tap the highlighted tree. Your selected villager will walk over and chop it.", next: false, target: { kind: "tree" }, done: (e) => e.kind === "harvest" && e.resource.subcategory === SUBCAT.tree },
  { title: "Gathering wood", text: "Your villager is working. The wood is collected automatically when the tree falls. Show me can help if you lose your place.", next: false, target: { kind: "tree" }, done: (e) => e.kind === "felled" && e.resource.subcategory === SUBCAT.tree },
  { title: "", text: "", next: false, target: { kind: "none" } },
  { title: "Build a house", text: "Houses make room for more people. Open Build.", next: false, target: { kind: "build" }, done: is("shop") },
  { title: "Choose House I", text: "Select House I in the shop.", next: false, target: { kind: "card", id: HOUSE_I }, done: (e) => e.kind === "choose" && e.item.id === HOUSE_I },
  { title: "Place your house", text: "Place the house on clear land near your Town Hall. On a touch screen, tap once to preview and again to build.", next: false, target: { kind: "tile", ...HOUSE_AT, id: HOUSE_I }, done: (e) => e.kind === "placed" && e.item.id === HOUSE_I },
  { title: "Defend your empire", text: "Select a soldier. Soldiers protect your villagers and buildings.", next: false, target: { kind: "knight" }, done: (e) => e.kind === "selected" && fightingUnit(e.item) },
  { title: "Attack a troll", text: "With your soldier selected, tap the highlighted troll to attack.", next: false, target: { kind: "enemy" }, done: is("attack") },
  { title: "Your first battle", text: "Your soldier is fighting. Wait until a troll is defeated. Show me brings you back to the fight.", next: false, target: { kind: "enemy" }, done: (e) => e.kind === "death" && e.enemy },
  { title: "Well done!", text: "You can now gather, build and defend your empire. Next, let's grow food for your people.", next: true, target: { kind: "none" } },
  { title: "Your goals", text: "The goal card shows what to do next and the reward. Open it to read your first goal.", next: false, target: { kind: "goals" }, done: is("goals") },
  { title: "Read your goal", text: "Close the goal window when you're ready to build your farm.", next: false, target: { kind: "close" }, done: is("closed") },
  { title: "Build a farm", text: "A farm grows food when a villager works inside. Open Build.", next: false, target: { kind: "build" }, done: is("shop") },
  { title: "Choose Farm Land", text: "Select Farm Land in the shop.", next: false, target: { kind: "card", id: FARM_LAND }, done: (e) => e.kind === "choose" && e.item.id === FARM_LAND },
  { title: "Place your farm", text: "Place the farm on clear land. On a touch screen, tap once to preview and again to build.", next: false, target: { kind: "tile", ...FARM_AT, id: FARM_LAND }, done: (e) => e.kind === "placed" && e.item.id === FARM_LAND },
  { title: "", text: "", next: false, target: { kind: "none" } },
  { title: "", text: "", next: false, target: { kind: "none" } },
  { title: "A worker for your farm", text: "Select your Town Hall to train another villager.", next: false, target: { kind: "hall" }, done: selected(SUBCAT.townHall) },
  { title: "Train another villager", text: "Press Train. This villager will work in your farm.", next: false, target: { kind: "train" }, done: (e) => e.kind === "training" && peasant(e.unit) },
  { title: "Select a villager", text: "Select a villager to work in the farm. If training is still finishing, wait a moment.", next: false, target: { kind: "villager" }, done: selected(SUBCAT.villager) },
  { title: "Put your villager to work", text: "Tap the highlighted farm with your villager selected. The villager will walk inside to grow food.", next: false, target: { kind: "farm" }, done: (e) => e.kind === "inside" && e.building.subcategory === SUBCAT.farm },
  { title: "Growing food", text: "Your villager is growing the first crop. A food bubble appears when it's ready.", next: false, target: { kind: "farm" }, done: (e) => e.kind === "ready" && e.item.subcategory === SUBCAT.farm },
  { title: "Collect your food", text: "Tap the ready farm to collect the food. Your villager stays inside for the next crop.", next: false, target: { kind: "farm" }, done: (e) => e.kind === "collected" && e.item.subcategory === SUBCAT.farm },
  { title: "", text: "", next: false, target: { kind: "none" } },
  { title: "", text: "", next: false, target: { kind: "none" } },
  { title: "One last task", text: "Select a villager outside the farm. Gather a little more wood before choosing your draggy.", next: false, target: { kind: "villager" }, done: selected(SUBCAT.villager) },
  { title: "Gather three trees", text: "Tap the marked trees to send your villager. You can queue several trees; the counter shows when they are chopped.", next: false, target: { kind: "marked" } },
];

/** Whether an event moves step `step` on. */
export function moves(step: number, event: LessonEvent, race?: string): boolean {
  if (event.kind === "selected" && race !== undefined && event.item.race !== race) return false;
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

/** Transient selections are restored by Lessons; persisted objectives do not restart. */
export function resumeAt(step: number): number {
  return Math.max(0, Math.min(REWARD_STEP, Math.trunc(step) || 0));
}

/** Eight clear chapters, including the goals and the reward task. */
export function pageOf(step: number): string {
  const starts = [0, 4, 8, 11, 15, 22, 25, 30];
  return `${starts.filter((s) => s <= step).length} of ${starts.length}`;
}

export interface TutorialCheckpoint { step: number; trees: number; draggy?: number }

/** The server's checkpoint wins over browser storage, which can be ahead of an unsaved action. */
export function tutorialStart(completed: unknown, town: number, saved: Record<string, unknown>, hasNest: boolean, hasDraggy: boolean): number | null {
  if (town !== 0) return null;
  const checkpoint = saved.tutorial as TutorialCheckpoint | undefined;
  if (checkpoint) return checkpoint.step >= LESSONS_DONE ? null : resumeAt(checkpoint.step);
  const step = reported(completed);
  if (step >= LESSONS_DONE || step >= LAST_STEP && hasNest && hasDraggy) return null;
  // Old clients recorded 31 before the last trees and before the reward.
  // A nest with no draggy means the player reloaded during the choice.
  if (step >= LAST_STEP) return hasNest ? REWARD_STEP : LAST_STEP;
  return resumeAt(step);
}

export function reported(completed: unknown): number {
  return Math.max(0, Number.parseInt(String(completed ?? "0"), 10) || 0);
}

/** Progress and tree count travel in the same batch as the action that earned them. */
export function stepReached(step: number, trees = 0): Command {
  return { cmd: "complete_tutorial", args: [step, { trees }] };
}

/** Villagers have attack points too, but are never the combat lesson's soldier. */
export function fightingUnit(item: ItemInfo): boolean {
  return item.isUnit && item.attack > 0 && item.subcategory !== SUBCAT.villager;
}
