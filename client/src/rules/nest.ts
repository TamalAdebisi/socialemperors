// The dragon nest and the monster nest (CLIENT.md, "The nests"): a row of
// dragons (or monsters) raised one after another, ten steps each, a step
// every six hours or sooner for cash; at ten the grown one is the player's
// and the next one starts. The save keeps where each nest is
// (privateState); these rules read it, change it as the Flash client does
// and say which commands to send. No drawing here.

import type { Command } from "../net/commands.ts";

/** Steps to raise one; the wait after each step, in seconds. */
export const STEPS = 10;
export const STEP_SECONDS = 6 * 3600;
/** Each friend who helps gives this many steps, without their wait. */
export const FRIEND_STEPS = 2;

export interface NestKind {
  /** The building. */
  building: number;
  /** What it raises, in order. */
  ones: number[];
  /** The save's fields: which one, its step, when the last step began, whether the nest is open. */
  fields: { number: string; step: string; since: string; active: string };
  commands: { step: string; buyStep: string; next: string; activate: string; deactivate: string };
  /** Cash to finish a wait: the first, third, fifth one's and the others'. */
  speedUp: [number, number];
  /** Friends can help (the dragon nest only). */
  friends: boolean;
  /** Its pictures, step by step (ui/art/nest/<name><n>.webp). */
  strip: string;
  /** The game's words: the title, the button that gets the grown one. */
  words: { title: number; get: number };
  /** Opening it again once all are raised: gold or cash (the game's globals). */
  price: { gold: string; cash: string };
  /** The picture of the closed nest (images_new/). */
  closed: string;
}

export const DRAGON_NEST: NestKind = {
  building: 1233,
  ones: [638, 649, 651, 684, 698, 695],
  fields: { number: "dragonNumber", step: "stepNumber", since: "timeStampTakeCare", active: "dragonNestActive" },
  commands: { step: "next_step", buyStep: "dragon_buy_step_cash", next: "next_dragon", activate: "activate_dragon", deactivate: "desactivate_dragon" },
  speedUp: [3, 15],
  friends: true,
  strip: "popupDragonProgress",
  words: { title: 1093, get: 1099 },
  price: { gold: "ACTIVATE_DRAGON_NEST_GOLD", cash: "ACTIVATE_DRAGON_NEST_CASH" },
  closed: "dragonNestInactive.jpg",
};

export const MONSTER_NEST: NestKind = {
  building: 1255,
  ones: [717, 713, 742, 653],
  fields: { number: "monsterNumber", step: "stepMonsterNumber", since: "timeStampTakeCareMonster", active: "monsterNestActive" },
  commands: { step: "next_monster_step", buyStep: "monster_buy_step_cash", next: "next_monster", activate: "activate_monster", deactivate: "desactivate_monster" },
  speedUp: [7, 7],
  friends: false,
  strip: "popupMonsterProgress",
  words: { title: 1134, get: 1133 },
  price: { gold: "ACTIVATE_MONSTER_NEST_GOLD", cash: "ACTIVATE_MONSTER_NEST_CASH" },
  closed: "monsterNestInactive.jpg",
};

export const NESTS = [DRAGON_NEST, MONSTER_NEST];

/** The game's words for the two kinds of step: the first, third and fifth hatch from eggs ("Take care"), the others are fed. */
export const TAKE_CARE = 1097;
export const FEED = 1098;

/** Where a nest is, read from the save. `since`: when the last step's wait began (0: none). */
export interface NestState {
  active: boolean;
  /** Which one is being raised (all raised: ones.length). */
  number: number;
  step: number;
  since: number;
}

const int = (value: unknown) => Number.parseInt(String(value ?? "0"), 10) || 0;

export function readNest(kind: NestKind, privateState: Record<string, unknown>): NestState {
  const f = kind.fields;
  return {
    active: int(privateState[f.active]) === 1,
    number: int(privateState[f.number]),
    step: int(privateState[f.step]),
    since: Math.max(int(privateState[f.since]), 0),  // the server keeps -1 for none
  };
}

/** The save as the client keeps it after a change (the server makes the same change from the commands). */
export function writeNest(kind: NestKind, privateState: Record<string, unknown>, state: NestState): void {
  const f = kind.fields;
  privateState[f.active] = state.active ? 1 : 0;
  privateState[f.number] = state.number;
  privateState[f.step] = state.step;
  privateState[f.since] = state.since;
}

/** Seconds left of the wait after the last step (0: none). */
export function secondsLeft(state: NestState, now: number): number {
  return state.since > 0 ? Math.max(Math.ceil(state.since + STEP_SECONDS - now), 0) : 0;
}

/** The steps done and waited for: ten, and the grown one can be taken. */
export function stepsDone(state: NestState, now: number): number {
  return state.step - (secondsLeft(state, now) > 0 ? 1 : 0);
}

/** Cash to finish the wait now. */
export function speedUpCash(kind: NestKind, state: NestState): number {
  return kind.speedUp[state.number % 2];
}

/** The step's word: "Take care" for eggs, "Feed" for the others; the get word at ten. */
export function buttonWord(kind: NestKind, state: NestState, now: number): number {
  return stepsDone(state, now) >= STEPS ? kind.words.get : state.number % 2 === 0 ? TAKE_CARE : FEED;
}

export interface Change {
  state: NestState;
  commands: Command[];
}

/**
 * As the window opens: a step count past ten (an old save) moves on to the
 * next one; past the last one, the nest closes, and opening it again costs.
 */
export function opened(kind: NestKind, state: NestState): Change {
  let next = { ...state };
  const commands: Command[] = [];
  if (next.step > STEPS) {
    next = { ...next, number: next.number + 1 };
    if (next.number <= kind.ones.length - 1) {
      next = { ...next, step: 0, since: 0 };
      commands.push({ cmd: kind.commands.next, args: ["0"] });
    }
  }
  if (next.active && next.number > kind.ones.length - 1) {
    next = { active: false, number: 0, step: 0, since: 0 };
    commands.push({ cmd: kind.commands.deactivate, args: [] });
  }
  return { state: next, commands };
}

/** "Take care" or "Feed": a step, and its six-hour wait. */
export function takeStep(kind: NestKind, state: NestState, now: number): Change | null {
  if (!state.active || secondsLeft(state, now) > 0 || state.step >= STEPS) {
    return null;
  }
  return { state: { ...state, step: state.step + 1, since: Math.floor(now) }, commands: [{ cmd: kind.commands.step, args: [0] }] };
}

/** "Speed up for 3": the wait over, for cash. */
export function speedUp(kind: NestKind, state: NestState, now: number): (Change & { cash: number }) | null {
  if (secondsLeft(state, now) === 0) {
    return null;
  }
  const cash = speedUpCash(kind, state);
  return { state: { ...state, since: 0 }, commands: [{ cmd: kind.commands.buyStep, args: [cash] }], cash };
}

/** "Get Dragon!": the grown one is the player's (the caller places it, free), and the next one starts. */
export function getGrown(kind: NestKind, state: NestState, now: number): (Change & { item: number }) | null {
  if (stepsDone(state, now) < STEPS || state.number > kind.ones.length - 1) {
    return null;
  }
  return {
    item: kind.ones[state.number],
    state: { ...state, number: state.number + 1, step: 0, since: 0 },
    commands: [{ cmd: kind.commands.next, args: ["0"] }],
  };
}

/** Opening the nest again, for gold or cash: from the first one. */
export function reopen(kind: NestKind, currency: "g" | "c"): Change {
  return { state: { active: true, number: 0, step: 0, since: 0 }, commands: [{ cmd: kind.commands.activate, args: [currency] }] };
}

/**
 * Friends who helped (privateState.dragonSocialHelp): two steps each, no
 * wait, up to the tenth; then the server is told whose help was used.
 */
export function friendsHelped(state: NestState, friends: string[]): Change {
  const commands: Command[] = [];
  let step = state.step;
  let since = state.since;
  for (let i = 0; i < friends.length * FRIEND_STEPS; i++) {
    if (step >= STEPS) {
      since = 0;
      break;
    }
    step++;
    commands.push({ cmd: "next_step", args: [0] });
  }
  commands.push({ cmd: "clear_dragon_hires", args: [JSON.stringify(friends)] });
  return { state: { ...state, step, since }, commands };
}

/** "5:26:01". */
export function clockText(seconds: number): string {
  const s = Math.max(Math.floor(seconds), 0);
  const two = (n: number) => String(n).padStart(2, "0");
  return `${Math.floor(s / 3600)}:${two(Math.floor((s % 3600) / 60))}:${two(s % 60)}`;
}
