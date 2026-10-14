// Arthur's lessons, the Flash client's tutorial (CLIENT.md, "Arthur's
// lessons"). The Flash client gives them in a player's first town while its
// playerInfo.completed_tutorial is 0, and reports each lesson reached with
// complete_tutorial; the last is 15. The new client has no lessons yet, so it
// offers the classic game's, or skipping them with the Flash client's own
// last report. No drawing here.

import type { Command } from "../net/commands.ts";

/** The lesson the Flash client reports when the last one is closed. */
export const LAST_LESSON = 15;

/** Whether the player hasn't started Arthur's lessons: none reported, and this is their first town. */
export function lessonsNotStarted(completed: unknown, town: number): boolean {
  return town === 0 && (Number.parseInt(String(completed ?? "0"), 10) || 0) === 0;
}

/** Skipping them: the report the Flash client sends when the last lesson is over. */
export function skipLessons(): Command {
  return { cmd: "complete_tutorial", args: [LAST_LESSON] };
}
