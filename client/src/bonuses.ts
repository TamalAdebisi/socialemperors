// The bonuses on offer (CLIENT.md, "Missions and bonuses"): the daily
// bonus, Monday's chest and the welcome-back chest, each a round button at
// the top right while it's on offer, opening its window. The rules are in
// rules/bonuses.ts; the server pays the same from the config.

import {
  DAILY_DAYS, collectDaily, collectMonday, collectWelcomeBack, dailyBonusDay, mondayChest, welcomeBackDay,
  type BonusConfig, type BonusState, type Prize,
} from "./rules/bonuses.ts";
import type { ItemInfo } from "./rules/config.ts";
import type { Town } from "./rules/town.ts";
import { ICONS } from "./ui/icons.ts";
import { Panel } from "./ui/panel.ts";

const numbers = new Intl.NumberFormat("en-US");

export interface BonusDeskParts {
  town: Town;
  state: BonusState;
  config: BonusConfig;
  items: Map<number, ItemInfo>;
  /** Days since the empire was made, as the page says (the welcome-back chest). */
  days: number;
  clock: () => number;
  send: (cmd: string, ...args: unknown[]) => void;
  say: (text: string) => void;
  changed: () => void;
  /** The daily bonus's day collected, for the goals. */
  dailyCollected: (day: number) => void;
  /** An item's picture in the Flash client's windows (a hero won). */
  thumbnail: (item: ItemInfo) => string;
}

export class BonusDesk {
  private readonly parts: BonusDeskParts;
  private readonly offers: HTMLElement;
  private readonly daily = new Panel("daily", "Daily bonus", { className: "list-window bonus" });
  private readonly monday = new Panel("monday", "Monday's chest", { className: "list-window bonus" });
  private readonly welcome = new Panel("welcome", "Welcome back!", { className: "list-window bonus" });

  constructor(parts: BonusDeskParts) {
    this.parts = parts;
    this.offers = document.createElement("nav");
    this.offers.className = "offers";
    this.offers.setAttribute("aria-label", "Bonuses");
    document.body.append(this.offers);
    this.refresh();
  }

  /** The buttons for what's on offer now. */
  refresh(): void {
    const { state, clock, town, days } = this.parts;
    const now = clock();
    const buttons: HTMLButtonElement[] = [];
    if (dailyBonusDay(state, now) !== null) {
      buttons.push(this.offer("Daily bonus", ICONS["daily-bonus"], () => this.openDaily()));
    }
    const chest = mondayChest(state, now);
    if (chest === "ready" || chest === "soon") {
      buttons.push(this.offer("Monday's chest", ICONS.gifts, () => this.openMonday()));
    }
    if (welcomeBackDay(town, state, days) !== null) {
      buttons.push(this.offer("Welcome-back chest", ICONS.gifts, () => this.openWelcome()));
    }
    this.offers.replaceChildren(...buttons);
  }

  private offer(label: string, icon: string, run: () => void): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "offer";
    button.setAttribute("aria-label", label);
    button.title = label;
    button.innerHTML = `<img src="${icon}" alt="">`;
    button.addEventListener("click", run);
    return button;
  }

  private openDaily(): void {
    const day = dailyBonusDay(this.parts.state, this.parts.clock());
    if (day === null) {
      return;
    }
    const intro = this.note("Come back every day: each day's prize is bigger, and missing a day starts again from the first.");
    const list = document.createElement("ol");
    list.className = "bonus-days";
    this.parts.config.daily.slice(0, DAILY_DAYS).forEach((prize, i) => {
      const li = document.createElement("li");
      li.className = i + 1 < day ? "past" : i + 1 === day ? "today" : "";
      li.innerHTML = `<span class="bonus-day"></span>${this.prizeHtml(prize)}`;
      li.querySelector(".bonus-day")!.textContent = i + 1 === day ? "Today" : `Day ${i + 1}`;
      list.append(li);
    });
    const collect = this.button("Collect", () => {
      const done = collectDaily(this.parts.town, this.parts.state, this.parts.config, day, this.parts.clock());
      this.parts.send(done.command.cmd, ...done.command.args);
      this.parts.dailyCollected(day);
      this.won(this.daily, done.prize, done.hero, "Your daily bonus");
    });
    this.daily.body.replaceChildren(intro, list, collect);
    this.daily.open();
  }

  private openMonday(): void {
    const state = mondayChest(this.parts.state, this.parts.clock());
    const intro = this.note(state === "ready" ? "It's Monday: pick a chest! Each holds gold, cash or a unit."
      : "Come back tomorrow, Monday, to pick a chest: gold, cash or a unit.");
    const chests = document.createElement("div");
    chests.className = "bonus-chests";
    for (let i = 1; i <= 3; i++) {
      const chest = this.button(`Chest ${i}`, () => {
        const done = collectMonday(this.parts.town, this.parts.state, this.parts.config, this.parts.clock());
        this.parts.send(done.command.cmd, ...done.command.args);
        this.won(this.monday, done.prize, done.unit, "Monday's chest");
      });
      chest.disabled = state !== "ready";
      chest.innerHTML = `<img src="${ICONS.gifts}" alt=""><span>Chest ${i}</span>`;
      chests.append(chest);
    }
    this.monday.body.replaceChildren(intro, chests);
    this.monday.open();
  }

  private openWelcome(): void {
    const day = welcomeBackDay(this.parts.town, this.parts.state, this.parts.days);
    if (day === null) {
      return;
    }
    const intro = this.note("Thanks for coming back! This chest holds gold, cash or a unit.");
    const open = this.button("Open the chest", () => {
      const done = collectWelcomeBack(this.parts.town, this.parts.state, this.parts.config, day);
      this.parts.send(done.command.cmd, ...done.command.args);
      this.won(this.welcome, done.prize, done.unit, "The chest");
    });
    this.welcome.body.replaceChildren(intro, open);
    this.welcome.open();
  }

  /** Say what was won, in the window, and take its button away. */
  private won(panel: Panel, prize: Prize, unit: number, what: string): void {
    const item = this.parts.items.get(unit);
    const text = unit && item ? `${what}: ${item.name}! It's in your storage.`
      : `${what}: ${numbers.format(prize.amount)} ${prize.type === "c" ? "cash" : "gold"}!`;
    const result = this.note(text);
    result.classList.add("bonus-won");
    const parts: HTMLElement[] = [result];
    if (unit && item) {
      const picture = new Image();
      picture.className = "bonus-unit";
      picture.alt = "";
      picture.src = this.parts.thumbnail(item);
      parts.unshift(picture);
    }
    parts.push(this.button("OK", () => panel.close()));
    panel.body.replaceChildren(...parts);
    this.parts.say(text);
    this.parts.changed();
    this.refresh();
  }

  private prizeHtml(prize: Prize): string {
    if (prize.type === "hero" || prize.type === "u") {
      return `<img class="icon" src="${ICONS.units}" alt=""><span>A hero</span>`;
    }
    const icon = prize.type === "c" ? ICONS.cash : ICONS.gold;
    return `<img class="icon" src="${icon}" alt=""><span>${numbers.format(prize.amount)} ${prize.type === "c" ? "cash" : "gold"}</span>`;
  }

  private note(text: string): HTMLParagraphElement {
    const p = document.createElement("p");
    p.className = "rows-note";
    p.textContent = text;
    return p;
  }

  private button(label: string, run: () => void): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "button gold";
    button.textContent = label;
    button.addEventListener("click", run);
    return button;
  }
}
