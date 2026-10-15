// Visiting a neighbour (CLIENT.md, "Neighbours"): their town to look at,
// with their numbers in the top bar, and help for up to 5 of
// their working buildings, once a day: 10 gold and 3 experience each for
// the player. The help goes to the server as one command on leaving, as the
// Flash client sends it.

import type { CommandSender } from "./net/commands.ts";
import { Helping, MOST_HELPED, helpedLately } from "./rules/neighbours.ts";
import type { Point } from "./rules/geometry.ts";
import type { Hud } from "./ui/hud.ts";
import { RESOURCE_COLOURS } from "./view/markers.ts";
import type { TownView } from "./view/townView.ts";

export interface VisitParts {
  /** Their pid, and their town on screen. */
  neighbour: string;
  view: TownView;
  /** The top bar, which shows the neighbour's numbers, and the helps left. */
  hud: Hud;
  commands: CommandSender;
  /** When the player last helped each neighbour (their privateState's neighborAssists). */
  assists: Record<string, number> | undefined;
  clock: () => number;
  say: (text: string) => void;
}

/**
 * What visits did, for the goals back home (visiting Arthur, helping
 * buildings): kept in this browser tab, as the Flash client kept it until
 * the game was reloaded.
 */
const VISITS = "se-visits";

export function visitsSoFar(): { last: string; helped: number } {
  try {
    const saved = JSON.parse(sessionStorage.getItem(VISITS) ?? "{}") as { last?: unknown; helped?: unknown };
    return { last: String(saved.last ?? ""), helped: Number(saved.helped) || 0 };
  } catch {
    return { last: "", helped: 0 };  // storage refused (a private window): the goals count this page only
  }
}

function rememberVisits(visits: { last: string; helped: number }): void {
  try {
    sessionStorage.setItem(VISITS, JSON.stringify(visits));
  } catch {
    // Not kept, then.
  }
}

export class Visit {
  private readonly parts: VisitParts;
  private readonly helping: Helping;
  private readonly allowed: boolean;

  constructor(parts: VisitParts) {
    this.parts = parts;
    this.helping = new Helping(parts.neighbour);
    this.allowed = !helpedLately(parts.assists, parts.neighbour, parts.clock());
    rememberVisits({ ...visitsSoFar(), last: parts.neighbour });
    parts.hud.helpsLeft(this.allowed ? MOST_HELPED : 0);
    parts.say(this.allowed ? `Tap their farms, mills and mines to help: up to ${MOST_HELPED}, for 10 gold and 3 XP each.`
      : "You've helped here today: come back tomorrow to help again.");
    // On leaving, the help goes: before the commands' own last send (registered after this).
    const leave = () => this.finish();
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        leave();
      }
    });
    window.addEventListener("pagehide", leave);
    // Back home: the help is sent first.
    document.querySelector<HTMLAnchorElement>("[data-home]")?.addEventListener("click", (e) => {
      e.preventDefault();
      const home = (e.currentTarget as HTMLAnchorElement).href;
      this.finish();
      void parts.commands.flush().finally(() => location.assign(home));
    });
  }

  /** A tap on their town: help what's under it, if it can be. */
  tap(at: Point): void {
    const placed = this.parts.view.itemAt(at);
    if (!placed || !this.allowed) {
      return;
    }
    const done = this.helping.help(placed);
    if (done === "") {
      return;  // not a working building: nothing to help
    }
    if (typeof done === "string") {
      this.parts.say(done);
      return;
    }
    // The gold and experience are the visitor's; the top bar shows the neighbour's, so they rise from the building.
    this.parts.view.rise(placed, [
      { text: `+${done.gold} gold`, colour: RESOURCE_COLOURS.gold },
      { text: `+${done.xp} XP`, colour: RESOURCE_COLOURS.xp },
    ]);
    const visits = visitsSoFar();
    rememberVisits({ ...visits, helped: visits.helped + 1 });
    const left = this.helping.left;
    this.parts.hud.helpsLeft(left);
    this.parts.say(left > 0 ? `Helped! ${left} more today.` : "That's all the help for today. Thanks!");
  }

  private finish(): void {
    const command = this.helping.finish();
    if (command) {
      this.parts.commands.add(command.cmd, ...command.args);
    }
  }
}
