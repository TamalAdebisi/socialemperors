// Keeps the goals: every 2 seconds, as the Flash client does, checks the
// open goals, tells the server of those reached and pays the first done
// one's gold. The rules are in rules/goals.ts, the cards and window in
// ui/goals.ts. (No skipping for cash: the Flash client had it switched off.)

import type { ItemInfo } from "./rules/config.ts";
import { Doings, completeGoal, openGoals, payGoal, progress, type Goal } from "./rules/goals.ts";
import type { Town } from "./rules/town.ts";
import { GoalsView } from "./ui/goals.ts";

/** How often the goals are checked: every 60 frames of the Flash client. */
const CHECK_MS = 2000;

export interface GoalKeeperParts {
  town: Town;
  /** What the player does, as the editor tells it. */
  doings: Doings;
  goals: Map<number, Goal>;
  items: Map<number, ItemInfo>;
  /** Goals done, and paid, as the save has them (privateState). */
  done: number[];
  paid: number[];
  send: (cmd: string, ...args: unknown[]) => void;
  /** The town's people now. */
  people: () => number;
  /** The camera's zoom now, for the zoom goal. */
  zoom: () => number;
  say: (text: string) => void;
  /** The town's numbers changed (gold paid, cash spent). */
  changed: () => void;
}

export class GoalKeeper {
  private readonly doings: Doings;
  private readonly parts: GoalKeeperParts;
  private readonly done: Set<number>;
  private readonly paid: Set<number>;
  private readonly view: GoalsView;
  private readonly startZoom: number;
  private lastCash: number;

  constructor(parts: GoalKeeperParts) {
    this.parts = parts;
    this.doings = parts.doings;
    this.done = new Set(parts.done.map(Number));
    this.paid = new Set(parts.paid.map(Number));
    this.view = new GoalsView();
    this.startZoom = parts.zoom();
    this.lastCash = parts.town.cash;
    setInterval(() => this.check(), CHECK_MS);
    this.check();
  }

  /** Check the open goals: those reached are done; the first done one is paid. */
  check(): void {
    const { town } = this.parts;
    // Cash spent since the last check counts for the goal that asks for it.
    if (town.cash < this.lastCash) {
      this.doings.spend("c", this.lastCash - town.cash);
    }
    this.lastCash = town.cash;
    if (Math.abs(this.parts.zoom() - this.startZoom) > 0.01) {
      this.doings.zoomed = true;
    }
    const open = openGoals(this.parts.goals, this.done, this.paid);
    for (const goal of open) {
      if (this.done.has(goal.id)) {
        continue;
      }
      const now = progress(town, goal, this.doings, this.parts.people(), this.parts.items);
      if (now && now.done >= now.of) {
        this.complete(goal);
      }
    }
    const toPay = open.find((goal) => this.done.has(goal.id) && !this.paid.has(goal.id));
    if (toPay) {
      const command = payGoal(town, toPay);
      this.parts.send(command.cmd, ...command.args);
      this.paid.add(toPay.id);
      this.parts.say(`Goal reached: ${toPay.title}! +${toPay.reward} gold`);
      this.parts.changed();
    }
    this.show();
  }

  private complete(goal: Goal): void {
    const command = completeGoal(goal, false);
    this.parts.send(command.cmd, ...command.args);
    this.done.add(goal.id);
  }

  private show(): void {
    const { town } = this.parts;
    const open = openGoals(this.parts.goals, this.done, this.paid);
    this.view.show(open.map((goal) => ({
      goal,
      done: this.done.has(goal.id),
      progress: progress(town, goal, this.doings, this.parts.people(), this.parts.items),
    })));
  }
}
