// Dragon rider training and matching, using the game's config and saved
// fields. Time is in seconds, as in the server's commands.
import type { Command } from "../net/commands.ts";

export const RIDER_ACADEMY = 1345;
export const DRAGON_TAMING = 1346;
export const RIDER_IDS = [822, 823, 824] as const;
export const RECOVERY_SECONDS = 15 * 60 * 60;

export interface RiderKind { number: number; item: number; level: number; steps: number; cash: number }
export interface DragonMatch { dragon: number; rider: number; tamed: number }
export interface RiderState { number: number; step: number; since: number }

export function riderKinds(globals: Record<string, unknown>): RiderKind[] {
  const table = globals.DRAGON_RIDERS as Record<string, Record<string, unknown>> | undefined;
  return RIDER_IDS.map((item, index) => {
    const number = index + 1, row = table?.[number];
    return { number, item, level: Number(row?.unlockLevel) || 35 + index * 5,
      steps: Number(row?.steps) || 5 + index, cash: Number(row?.stepCost) || 15 };
  });
}

export function dragonMatches(globals: Record<string, unknown>): DragonMatch[] {
  const table = globals.DRAGONS as Record<string, Record<string, unknown>> | undefined;
  return Object.entries(table ?? {}).map(([dragon, row]) => ({
    dragon: Number(dragon), rider: Number(row.rider), tamed: Number(row.tamedId ?? row.tamed_id),
  })).filter((row) => row.dragon > 0 && row.rider >= 1 && row.rider <= 3 && row.tamed > 0);
}

export function riderState(saved: Record<string, unknown>): RiderState {
  const number = Number(saved.riderNumber) || 0;
  return { number: number >= 1 && number <= 3 ? number : 0,
    step: Math.max(0, Number(saved.riderStepNumber) || 0), since: Number(saved.riderTimeStamp) || 0 };
}

export function saveRider(saved: Record<string, unknown>, state: RiderState): void {
  saved.riderNumber = state.number;
  saved.riderStepNumber = state.step;
  saved.riderTimeStamp = state.since;
}

export function recoveryLeft(state: RiderState, now: number): number {
  return state.since > 0 ? Math.max(0, Math.ceil(state.since + RECOVERY_SECONDS - now)) : 0;
}

export function trainRider(kind: RiderKind, state: RiderState, now: number): { state: RiderState; commands: Command[] } | null {
  if (state.number !== kind.number || state.step >= kind.steps || recoveryLeft(state, now) > 0) return null;
  return { state: { ...state, step: state.step + 1, since: now }, commands: [{ cmd: "rider_next_step", args: ["1"] }] };
}

export function recoverRider(kind: RiderKind, state: RiderState, now: number, cash: number): { state: RiderState; commands: Command[] } | null {
  if (state.number !== kind.number || recoveryLeft(state, now) === 0 || cash < kind.cash) return null;
  return { state: { ...state, since: -1 }, commands: [{ cmd: "rider_buy_step_cash", args: [kind.cash] }] };
}

export function matchingDragon(units: readonly number[], matches: readonly DragonMatch[]): DragonMatch | null {
  if (units.length !== 2) return null;
  return matches.find((row) => units.includes(row.dragon) && units.includes(RIDER_IDS[row.rider - 1]!)) ?? null;
}
