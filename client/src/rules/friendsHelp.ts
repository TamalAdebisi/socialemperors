// Friends' help at a building at work (CLIENT.md, "Neighbours"), as the
// Flash client uses it (our notes, our words: docs/original/rules/
// neighbours.md, "Friends' help asked for elsewhere"). A building's Ask
// friends asks them on the site (helps.py); each friend who answers waits
// over it as their picture, the last on top. A tap on the building takes
// the top one: an hour off its work, and `accept_collect_help`. Only at
// home; the pictures go once the building is ready, until the town opens
// again. No drawing here.

import type { Command } from "../net/commands.ts";
import type { PlacedItem, Town } from "./town.ts";

/** An hour, unless the config says otherwise (COLLECT_HELP_SECONDS). */
export function helpSeconds(globals: Record<string, unknown>): number {
  return Number(globals.COLLECT_HELP_SECONDS) || 3600;
}

/** The friends waiting, from the save's `hc` ({ "u<empire>": used }): those not used yet, in its order. */
export function readHelpers(hc: unknown): string[] {
  if (!hc || typeof hc !== "object" || Array.isArray(hc)) {
    return [];
  }
  return Object.entries(hc as Record<string, unknown>).filter(([, used]) => !used).map(([key]) => key.replace(/^u/, ""));
}

/** The top friend's help used: the building's work an hour on, and the command; null when none waits. */
export function useHelp(town: Town, placed: PlacedItem, seconds: number): { friend: string; command: Command } | null {
  const friend = placed.helpers?.pop();
  if (friend === undefined) {
    return null;
  }
  if (placed.helpers!.length === 0) {
    delete placed.helpers;
  }
  if (placed.startedAt !== null && placed.startedAt > 0) {
    placed.startedAt -= seconds;  // as the server does: the work counts from an hour earlier
  }
  return { friend, command: { cmd: "accept_collect_help", args: [placed.tx, placed.ty, town.id, placed.item.id, friend] } };
}
