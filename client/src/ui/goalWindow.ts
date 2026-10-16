// A goal's own window (CLIENT.md, "Missions and bonuses"), as the Flash
// client's "Goal INFO": the game's parchment and band, the goal's title and
// text, its picture of the steps (goals 1 to 100 have one), one of the
// game's children beside it, the reward in gold, OK, and for goals that
// build something HELP!, which points at where to start. The original's
// fourth button (paying cash to skip the goal) was switched off; in its
// place, Goals opens the list of them all.

import type { Goal } from "../rules/goals.ts";
import { ICONS } from "./icons.ts";

/** The game's words: "Goal INFO", "Reward", "OK", "HELP!", "Goals". */
export interface GoalWords {
  band: string;
  reward: string;
  ok: string;
  help: string;
  goals: string;
}

export interface GoalWindowParts {
  words: GoalWords;
  /** The goal's picture of the steps, or null when the game has none. */
  picture: (goal: Goal) => string | null;
  /** One of the game's children, by the goal's number. */
  figure: (goal: Goal) => string;
  /** HELP!: show where to start (after the window closes). */
  help: (goal: Goal) => void;
  /** Goals: the list of them all. */
  list: () => void;
}

const numbers = new Intl.NumberFormat("en-US");

/** Told on the document as a goal's window opens and closes ({ open }): Arthur's lessons hear it, as the original's did. */
export const GOAL_WINDOW_EVENT = "se-goal-window";

/** Whether a goal's window offers HELP!, as the Flash client's: goals 1 and 2 and those that build something, while not done. */
export function hasHelp(goal: Goal, done: boolean): boolean {
  const kind = goal.need?.[0];
  return !done && (goal.id === 1 || goal.id === 2 || kind === "build" || kind === "build-kind");
}

export class GoalWindow {
  private readonly parts: GoalWindowParts;
  private open: HTMLElement | null = null;

  constructor(parts: GoalWindowParts) {
    this.parts = parts;
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.open) {
        e.stopPropagation();
        this.close();
      }
    }, true);
  }

  get showing(): boolean {
    return this.open !== null;
  }

  show(goal: Goal, done: boolean): void {
    // Already open (a second tap on the card): its content changes, and it isn't told as closed and opened again.
    const wasOpen = this.open !== null;
    this.open?.remove();
    this.open = null;
    const { words } = this.parts;
    const box = document.createElement("section");
    box.className = "goal-window";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-label", goal.title);
    box.style.backgroundImage = `url("${ICONS["goal-window"]}")`;

    const band = document.createElement("h2");
    band.className = "goal-band";
    band.style.backgroundImage = `url("${ICONS["goal-band"]}")`;
    band.textContent = words.band;
    const close = document.createElement("button");
    close.type = "button";
    close.className = "goal-close";
    close.setAttribute("aria-label", "Close");
    close.innerHTML = `<img src="${ICONS.close}" alt="">`;
    close.addEventListener("click", () => this.close());
    const title = document.createElement("h3");
    title.className = "goal-name";
    title.textContent = goal.title;
    const text = document.createElement("p");
    text.className = "goal-text";
    text.textContent = goal.description;
    box.append(band, close, title, text);

    const picture = this.parts.picture(goal);
    if (picture) {
      const steps = document.createElement("img");
      steps.className = "goal-picture";
      steps.src = picture;
      steps.alt = "";
      steps.addEventListener("error", () => steps.remove(), { once: true });
      box.append(steps);
    }
    const figure = document.createElement("img");
    figure.className = "goal-figure";
    figure.src = this.parts.figure(goal);
    figure.alt = "";
    figure.addEventListener("error", () => figure.remove(), { once: true });

    const reward = document.createElement("p");
    reward.className = "goal-prize";
    reward.innerHTML = `<span></span> <b></b><img src="${ICONS.gold}" alt="gold">`;
    reward.querySelector("span")!.textContent = `${words.reward}:`;
    reward.querySelector("b")!.textContent = numbers.format(goal.reward);

    const button = (label: string, className: string, run: () => void) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = `goal-button ${className}`;
      b.style.backgroundImage = `url("${ICONS["goal-button"]}")`;
      b.textContent = label;
      b.addEventListener("click", run);
      return b;
    };
    const ok = button(words.ok, "goal-ok", () => this.close());
    box.append(figure, reward, ok, button(words.goals, "goal-all", () => {
      this.close();
      this.parts.list();
    }));
    if (hasHelp(goal, done)) {
      box.append(button(words.help, "goal-help", () => {
        this.close();
        this.parts.help(goal);
      }));
    }
    document.body.append(box);
    this.open = box;
    ok.focus();
    if (!wasOpen) {
      document.dispatchEvent(new CustomEvent(GOAL_WINDOW_EVENT, { detail: { open: true } }));
    }
  }

  close(): void {
    if (!this.open) {
      return;
    }
    this.open.remove();
    this.open = null;
    document.dispatchEvent(new CustomEvent(GOAL_WINDOW_EVENT, { detail: { open: false } }));
  }
}
