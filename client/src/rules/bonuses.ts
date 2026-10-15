// The daily bonus and Monday's chest, as the Flash client offers them (our
// notes, our words; CLIENT.md, "Missions and bonuses"). The server decides
// what each pays (daily_bonus.py, monday_bonus.py) from the same config;
// this decides when to offer them and draws the prize the client shows. No
// drawing here. (The Flash client also had a welcome-back chest, switched
// off in the game as it was built: it never showed, so it isn't here.)

import type { Command } from "../net/commands.ts";
import type { Town } from "./town.ts";

const DAY = 24 * 3600;
/** The daily bonus's five days, then they start again. */
export const DAILY_DAYS = 5;
/** The daily bonus is offered from this level, in a human town. */
const DAILY_BONUS_LEVEL = 5;

export interface Prize {
  /** g gold, c cash, hero or u a unit (into storage). */
  type: string;
  amount: number;
}

/** The game config's prizes, as it keeps them. */
export interface BonusConfig {
  daily: Prize[];
  dailyHeroes: number[];
  /** Monday's three chests: gold, a unit, cash. */
  monday: Prize[];
  mondayUnits: number[];
}

export function readBonusConfig(globals: Record<string, unknown> | undefined): BonusConfig {
  const list = (value: unknown) => (Array.isArray(value) ? value : String(value ?? "").split(",")).map(Number).filter((n) => n > 0);
  const prizes = (value: unknown, amount: string) => (Array.isArray(value) ? value : [])
    .map((row: Record<string, unknown>) => ({ type: String(row.type), amount: Number(row[amount]) || 0 }));
  return {
    daily: prizes(globals?.DAILY_BONUS_CONFIG, "qty"),
    dailyHeroes: list(globals?.DAILY_BONUS_CONFIG_HEROES),
    monday: prizes(globals?.MONDAY_BONUS_REWARDS, "value"),
    mondayUnits: list(globals?.MONDAY_BONUS_UNITS),
  };
}

/** What the save keeps about the bonuses (privateState). */
export interface BonusState {
  /** The daily bonus's day collected last, plus one; 0 for never. */
  bonusNextId?: number;
  timestampLastBonus?: number;
  timeStampMondayBonus?: number;
}

/** Whether the daily bonus is offered at all: from level 5, in a human town, as in the Flash client. */
export function dailyBonusOffered(town: Town): boolean {
  return town.level >= DAILY_BONUS_LEVEL && town.race === "h";
}

/**
 * The daily bonus: ready from the next calendar day (UTC) after the last
 * one; the day of the five comes after the last one collected, or the first
 * again when a day was missed. Null when it's not ready.
 */
export function dailyBonusDay(state: BonusState, now: number): number | null {
  const daysSince = Math.floor(now / DAY) - Math.floor((state.timestampLastBonus ?? 0) / DAY);
  if (daysSince < 1) {
    return null;
  }
  const after = (state.bonusNextId ?? 0) - 1;
  if (daysSince > 1 || after <= 0) {
    return 1;
  }
  return (after % DAILY_DAYS) + 1;
}

/** Collect the daily bonus's day: gold or cash now, or a hero (drawn at random) into storage. */
export function collectDaily(town: Town, state: BonusState, config: BonusConfig, day: number, now: number, random = Math.random): { prize: Prize; hero: number; command: Command } {
  const prize = config.daily[day - 1] ?? { type: "g", amount: 0 };
  let hero = 0;
  let gold = 0;
  let cash = 0;
  if (prize.type === "hero") {
    hero = config.dailyHeroes[Math.round(random() * (config.dailyHeroes.length - 1))] ?? 0;
    town.store.set(hero, (town.store.get(hero) ?? 0) + 1);
  } else if (prize.type === "c") {
    cash = prize.amount;
    town.cash += cash;
  } else {
    gold = prize.amount;
    town.gold += gold;
  }
  state.bonusNextId = day + 1;
  state.timestampLastBonus = now;
  return { prize, hero, command: { cmd: "win_bonus", args: [gold, town.id, hero, day, cash] } };
}

/** Monday's chest: "ready" on a Monday not yet collected, "soon" on Sunday, else null (the player's own week). */
export function mondayChest(state: BonusState, now: number): "ready" | "collected" | "soon" | null {
  const today = new Date(now * 1000);
  if (today.getDay() === 1) {
    const last = new Date((state.timeStampMondayBonus ?? 0) * 1000);
    const same = last.getFullYear() === today.getFullYear() && last.getMonth() === today.getMonth() && last.getDate() === today.getDate();
    return same ? "collected" : "ready";
  }
  return today.getDay() === 0 ? "soon" : null;
}

/** Open one of Monday's chests: one of its prizes, by chance. */
export function openChest(town: Town, config: BonusConfig, units: number[], random = Math.random): { prize: Prize; unit: number } {
  const prize = config.monday[Math.floor(random() * config.monday.length)] ?? { type: "g", amount: 0 };
  let unit = 0;
  if (prize.type === "u") {
    unit = units[Math.floor(random() * units.length)] ?? 0;
    town.store.set(unit, (town.store.get(unit) ?? 0) + 1);
  } else if (prize.type === "c") {
    town.cash += prize.amount;
  } else {
    town.gold += prize.amount;
  }
  return { prize, unit };
}

export function collectMonday(town: Town, state: BonusState, config: BonusConfig, now: number, random = Math.random): { prize: Prize; unit: number; command: Command } {
  const { prize, unit } = openChest(town, config, config.mondayUnits, random);
  state.timeStampMondayBonus = now;
  return { prize, unit, command: { cmd: "weekly_reward", args: [prize.type, prize.type === "u" ? unit : prize.amount] } };
}

