// The goals on screen (CLIENT.md, "Missions and bonuses"): the first few
// open goals as small cards under the resources, as the Flash client's goal
// box on the left, and a window with all of them, what each asks, how far
// along it is, its gold, and Skip for cash.

import type { Goal } from "../rules/goals.ts";
import { ICONS } from "./icons.ts";
import { Panel } from "./panel.ts";

/** How many goals show as cards (the next one, so the town stays in view); the window shows them all. */
const CARDS = 1;
const numbers = new Intl.NumberFormat("en-US");

export interface GoalRow {
  goal: Goal;
  /** How far along: done of what's needed; null for the classic game's. */
  progress: { done: number; of: number } | null;
  done: boolean;
}

export class GoalsView {
  private readonly cards: HTMLElement;
  private readonly panel = new Panel("goals", "Goals", { className: "list-window goals-window" });
  private rows: GoalRow[] = [];
  private readonly skip: (goal: Goal) => void;
  private readonly skipPrice: number;

  constructor(skip: (goal: Goal) => void, skipPrice: number) {
    this.skip = skip;
    this.skipPrice = skipPrice;
    this.cards = document.createElement("ol");
    this.cards.className = "goal-cards";
    this.cards.setAttribute("aria-label", "Goals");
    document.body.append(this.cards);
  }

  show(rows: GoalRow[]): void {
    this.rows = rows;
    this.cards.replaceChildren(...rows.slice(0, CARDS).map((row) => this.card(row)));
    const count = this.cards.querySelector(".goal-count");
    if (count) {
      const done = rows.filter((row) => row.done).length;
      count.textContent = rows.length > 1 ? `+${rows.length - 1} more${done ? `, ${done} done` : ""}` : "";
    }
    if (this.panel.isOpen) {
      this.render();
    }
  }

  open(): void {
    this.render();
    this.panel.open();
  }

  private card(row: GoalRow): HTMLLIElement {
    const li = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = `goal-card${row.done ? " done" : ""}`;
    button.innerHTML = `<img src="${ICONS.xp}" alt=""><span class="goal-title"></span><span class="goal-bar" aria-hidden="true"><span></span></span><span class="goal-count"></span>`;
    button.querySelector(".goal-title")!.textContent = row.goal.title;
    const share = row.done ? 1 : row.progress ? row.progress.done / row.progress.of : 0;
    button.querySelector<HTMLElement>(".goal-bar span")!.style.width = `${Math.round(share * 100)}%`;
    button.setAttribute("aria-label", `Goal: ${row.goal.title}${row.progress ? `, ${row.progress.done} of ${row.progress.of}` : ""}`);
    button.addEventListener("click", () => this.open());
    li.append(button);
    return li;
  }

  private render(): void {
    const list = document.createElement("ul");
    list.className = "rows";
    for (const row of this.rows) {
      const li = document.createElement("li");
      li.className = "row goal-row";
      const text = document.createElement("span");
      text.className = "row-text";
      const title = document.createElement("strong");
      title.textContent = row.goal.title;
      const about = document.createElement("small");
      about.textContent = row.goal.description;
      const state = document.createElement("small");
      state.className = "goal-state";
      state.textContent = row.done ? "Done!" : row.progress ? `${row.progress.done} of ${row.progress.of}`
        : "Played in the classic game for now";
      text.append(title, about, state);
      const reward = document.createElement("span");
      reward.className = "goal-reward";
      reward.innerHTML = `<img class="icon" src="${ICONS.gold}" alt="">`;
      reward.append(numbers.format(row.goal.reward));
      reward.setAttribute("aria-label", `${row.goal.reward} gold`);
      li.append(text, reward);
      if (!row.done) {
        const skip = document.createElement("button");
        skip.type = "button";
        skip.className = "button tiny gold";
        skip.innerHTML = `<img class="icon" src="${ICONS.cash}" alt="">`;
        skip.append(`Skip: ${this.skipPrice}`);
        skip.setAttribute("aria-label", `Skip ${row.goal.title} for ${this.skipPrice} cash`);
        skip.addEventListener("click", () => this.skip(row.goal));
        li.append(skip);
      }
      list.append(li);
    }
    const note = document.createElement("p");
    note.className = "rows-note";
    note.textContent = "Each goal pays its gold once it's done. Goals that count what you do (collecting, choosing working times) count from when the page opened, as in the classic game.";
    this.panel.body.replaceChildren(list, note);
  }
}
