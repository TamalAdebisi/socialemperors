// The goals on screen (CLIENT.md, "Missions and bonuses"): the first few
// open goals as small cards under the resources, as the Flash client's goal
// box on the left, and a window with all of them, what each asks, how far
// along it is, and its gold. A goal's card, and its +INFO in the list, open
// its own window (ui/goalWindow.ts), as the original's goal badges did;
// goals 6 to 9 say "Click here!" until tapped, and "New Mission!" points at
// the card when a new goal joins the open ones, below level 8.

import type { Goal } from "../rules/goals.ts";
import { GoalWindow, type GoalWindowParts } from "./goalWindow.ts";
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

/** The goals' windows: a goal's own (without the list, which this view gives it), the game's words, and Arthur's lessons running. */
export interface GoalsViewParts {
  window: Omit<GoalWindowParts, "list">;
  /** The game's "Click here!", "+INFO" and "New Mission!". */
  words: { clickHere: string; info: string; newMission: string };
  quiet: () => boolean;
}

/** Goals that say "Click here!" until their card is tapped, as in the Flash client. */
const CLICK_HERE = new Set([6, 7, 8, 9]);

export class GoalsView {
  private readonly cards: HTMLElement;
  private readonly panel = new Panel("goals", "Goals", { className: "list-window goals-window" });
  private rows: GoalRow[] = [];
  private readonly window: GoalWindow | null;
  private readonly parts: GoalsViewParts | null;
  /** Goals whose card was tapped this session (their "Click here!" goes). */
  private readonly tapped = new Set<number>();
  private readonly notice: HTMLButtonElement;
  /** The notice's place in the box, beside the card. */
  private readonly noticeItem = document.createElement("li");
  constructor(parts: GoalsViewParts | null = null) {
    this.parts = parts;
    this.window = parts && new GoalWindow({ ...parts.window, list: () => this.open() });
    this.cards = document.createElement("ol");
    this.cards.className = "goal-cards";
    this.cards.setAttribute("aria-label", "Goals");
    this.notice = document.createElement("button");
    this.notice.type = "button";
    this.notice.className = "goal-new-mission";
    this.notice.hidden = true;
    this.notice.innerHTML = `<img src="${ICONS["new-mission"]}" alt="">`;
    this.notice.setAttribute("aria-label", parts?.words.newMission ?? "New Mission!");
    this.notice.addEventListener("click", () => this.open());
    this.noticeItem.className = "goal-notice";
    this.noticeItem.append(this.notice);
    document.body.append(this.cards);
  }

  /** "New Mission!" by the card (until the goals are looked at). */
  newMission(): void {
    this.notice.hidden = false;
  }

  /** A goal's own window. */
  info(goal: Goal, done: boolean): void {
    this.notice.hidden = true;
    this.window?.show(goal, done);
  }

  show(rows: GoalRow[]): void {
    this.rows = rows;
    this.cards.replaceChildren(...rows.slice(0, CARDS).map((row) => this.card(row)), this.noticeItem);
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
    this.notice.hidden = true;
    this.render();
    this.panel.open();
  }

  /** Goals over for good (level 35): the box goes. */
  remove(): void {
    this.cards.remove();
    this.window?.close();
    if (this.panel.isOpen) {
      this.panel.close();
    }
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
    if (this.parts && CLICK_HERE.has(row.goal.id) && !this.tapped.has(row.goal.id) && !this.parts.quiet()) {
      const badge = document.createElement("span");
      badge.className = "goal-click-here";
      badge.style.backgroundImage = `url("${ICONS["click-here"]}")`;
      badge.textContent = this.parts.words.clickHere;
      button.append(badge);
    }
    // A goal's own window, as the original's goal badge opened it; a done one, the list (where it's paid).
    button.addEventListener("click", () => {
      this.tapped.add(row.goal.id);
      if (this.window && !row.done) {
        button.querySelector(".goal-click-here")?.remove();
        this.info(row.goal, false);
      } else {
        this.open();
      }
    });
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
      if (this.window && !row.done) {
        const info = document.createElement("button");
        info.type = "button";
        info.className = "button tiny goal-info";
        info.textContent = this.parts!.words.info;
        info.setAttribute("aria-label", `${this.parts!.words.info}: ${row.goal.title}`);
        info.addEventListener("click", () => this.info(row.goal, row.done));
        li.append(info);
      }
      list.append(li);
    }
    const note = document.createElement("p");
    note.className = "rows-note";
    note.textContent = "Each goal pays its gold once it's done. Goals that count what you do (collecting, choosing working times) count from when the page opened, as in the classic game.";
    this.panel.body.replaceChildren(list, note);
  }
}
