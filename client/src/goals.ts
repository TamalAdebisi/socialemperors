// Keeps the goals: every 2 seconds, as the Flash client does, checks the
// open goals, tells the server of those reached and pays the first done
// one's gold. The rules are in rules/goals.ts, the cards and window in
// ui/goals.ts. (No skipping for cash: the Flash client had it switched off.)

import type { ItemInfo } from "./rules/config.ts";
import { Doings, OPEN_GOALS, completeGoal, openGoals, payGoal, progress, type Goal } from "./rules/goals.ts";
import type { Town } from "./rules/town.ts";
import { GoalsView, type GoalsViewParts } from "./ui/goals.ts";

/** Below this level a new goal joining the open ones is announced ("New Mission!"), as in the Flash client. */
const NEW_MISSION_UNTIL = 8;

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
  /** The goals' own windows (ui/goalWindow.ts) and notices; without them, the list alone. */
  windows?: GoalsViewParts;
}

export class GoalKeeper {
  private readonly doings: Doings;
  private readonly parts: GoalKeeperParts;
  private readonly done: Set<number>;
  private readonly paid: Set<number>;
  private readonly view: GoalsView;
  private readonly startZoom: number;
  private lastCash: number;
  private timer: ReturnType<typeof setInterval> | undefined;
  /** The last of the 15 open goals at the last look: when it changes, a new goal has joined them. */
  private lastOpen = -1;

  constructor(parts: GoalKeeperParts) {
    this.parts = parts;
    this.doings = parts.doings;
    this.done = new Set(parts.done.map(Number));
    this.paid = new Set(parts.paid.map(Number));
    this.view = new GoalsView(parts.windows ?? null);
    this.startZoom = parts.zoom();
    this.lastCash = parts.town.cash;
    this.timer = setInterval(() => this.check(), CHECK_MS);
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
    // From now to the next check, doings count only for the kinds of goals open and not done, as in the Flash client.
    this.doings.listen(open.filter((goal) => !this.done.has(goal.id)).flatMap((goal) => goal.need ? [String(goal.need[0])] : []));
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

  /** Goals stop for the rest of the session (level 35 reached), as in the Flash client: the box goes. */
  stop(): void {
    clearInterval(this.timer);
    this.view.remove();
  }

  private complete(goal: Goal): void {
    const command = completeGoal(goal, false);
    this.parts.send(command.cmd, ...command.args);
    this.done.add(goal.id);
  }

  private show(): void {
    const { town } = this.parts;
    const open = openGoals(this.parts.goals, this.done, this.paid);
    // The 15th open goal changed (and, as there, on opening): "New Mission!", below level 8, not in Arthur's lessons.
    const last = open.length === OPEN_GOALS ? open[OPEN_GOALS - 1].id : -1;
    if (last !== this.lastOpen && last !== -1 && this.parts.windows && !this.parts.windows.quiet()) {
      this.lastOpen = last;
      if (town.level < NEW_MISSION_UNTIL) {
        this.view.newMission();
      }
    }
    this.view.show(open.map((goal) => ({
      goal,
      done: this.done.has(goal.id),
      progress: progress(town, goal, this.doings, this.parts.people(), this.parts.items),
    })));
  }
}
