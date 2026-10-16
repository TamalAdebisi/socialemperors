// The Army window: the units in this town, by kind, with how many of each,
// and the town's people against the room for them. Units are trained at
// the buildings that train them (barracks, archery ranges, stables...).
// Its second tab is the town's defence plan for when another player
// attacks (rules/defencePlans.ts), as the Flash client's battle options
// window: four plans with the game's pictures and words, saved with
// set_strategy as the window closes, if it changed.

import type { ItemInfo } from "../rules/config.ts";
import { ALL_STAY, FOCUS_SIEGE, HALF_OUT, RANGED_VERSUS_SIEGE } from "../rules/defencePlans.ts";
import { ICONS } from "./icons.ts";
import { Panel } from "./panel.ts";

/** The four plans in the window's order, with the game's words for each (localization_strings: name, description). */
const PLANS = [
  { plan: ALL_STAY, name: 676, about: 680, picture: ICONS["plan-defensive"] },
  { plan: RANGED_VERSUS_SIEGE, name: 677, about: 681, picture: ICONS["plan-mid-defensive"] },
  { plan: HALF_OUT, name: 678, about: 682, picture: ICONS["plan-mid-aggressive"] },
  { plan: FOCUS_SIEGE, name: 679, about: 683, picture: ICONS["plan-aggressive"] },
];
/** The game's words for the tabs and the line on top. */
const WORDS = { army: 673, plans: 674, header: 675 } as const;

export interface ArmyParts {
  /** The town's units now, by kind. */
  units: () => { item: ItemInfo; count: number }[];
  /** The item's picture in the Flash client's windows. */
  thumbnail: (item: ItemInfo) => string;
  /** The town's people and the room for them. */
  people: () => { current: number; max: number };
  /** The game's words (localization_strings), by number. */
  words: (id: number) => string;
  /** The town's defence plan now (rules/defencePlans.ts, planOf). */
  plan: () => number;
  /** A plan picked (each pick, for the goal that asks for one). */
  picked: (plan: number) => void;
  /** The window closed on a different plan than it opened on: save it (set_strategy). */
  save: (plan: number) => void;
}

export class ArmyWindow {
  private readonly panel: Panel;
  private readonly parts: ArmyParts;
  private tab: "army" | "plan" = "army";
  /** The plan as the window opened, and as picked since. */
  private opened = HALF_OUT;
  private chosen = HALF_OUT;

  constructor(parts: ArmyParts) {
    this.parts = parts;
    this.panel = new Panel("army", "Army", { className: "list-window", onClose: () => {
      if (this.chosen !== this.opened) {
        this.parts.save(this.chosen);
        this.opened = this.chosen;
      }
    } });
  }

  toggle(): void {
    if (!this.panel.isOpen) {
      this.opened = this.chosen = this.parts.plan();
      this.tab = "army";
      this.render();
    }
    this.panel.toggle();
  }

  /** Open on the defence plans (the world map's Options button). */
  openPlans(): void {
    if (!this.panel.isOpen) {
      this.opened = this.chosen = this.parts.plan();
      this.panel.toggle();
    }
    this.tab = "plan";
    this.render();
  }

  private render(): void {
    const tabs = document.createElement("nav");
    tabs.className = "shop-tabs army-tabs";
    tabs.setAttribute("aria-label", "Army or defence");
    for (const [tab, label] of [["army", this.parts.words(WORDS.army)], ["plan", this.parts.words(WORDS.plans)]] as const) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "shop-toggle";
      button.textContent = label;
      button.setAttribute("aria-pressed", String(this.tab === tab));
      button.addEventListener("click", () => {
        this.tab = tab;
        this.render();
      });
      tabs.append(button);
    }
    if (this.tab === "plan") {
      this.renderPlans(tabs);
    } else {
      this.renderArmy(tabs);
    }
  }

  private renderPlans(tabs: HTMLElement): void {
    this.panel.title = "Defence";
    const header = document.createElement("p");
    header.className = "rows-note army-plan-header";
    header.textContent = this.parts.words(WORDS.header);
    const list = document.createElement("ul");
    list.className = "army-plans";
    for (const { plan, picture, ...words } of PLANS) {
      const name = this.parts.words(words.name);
      const row = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "army-plan";
      button.setAttribute("aria-pressed", String(plan === this.chosen));
      button.setAttribute("aria-label", name);
      const frame = document.createElement("span");
      frame.className = "army-plan-picture";
      const image = new Image();
      image.alt = "";
      image.src = picture;
      frame.append(image);
      if (plan === this.chosen) {
        const tick = new Image();
        tick.className = "army-plan-tick";
        tick.alt = "";
        tick.src = ICONS["plan-picked"];
        frame.append(tick);
      }
      const text = document.createElement("span");
      text.className = "row-text";
      const title = document.createElement("strong");
      title.textContent = name;
      const small = document.createElement("small");
      small.textContent = this.parts.words(words.about);
      text.append(title, small);
      button.append(frame, text);
      button.addEventListener("click", () => {
        this.chosen = plan;
        this.parts.picked(plan);
        this.render();
      });
      row.append(button);
      list.append(row);
    }
    this.panel.body.replaceChildren(tabs, header, list);
  }

  private renderArmy(tabs: HTMLElement): void {
    const units = this.parts.units();
    const total = units.reduce((sum, u) => sum + u.count, 0);
    this.panel.title = total ? `Army (${total})` : "Army";
    const list = document.createElement("ul");
    list.className = "army";
    for (const { item, count } of units) {
      const card = document.createElement("li");
      card.className = "army-card";
      const picture = new Image();
      picture.alt = "";
      picture.loading = "lazy";
      picture.src = this.parts.thumbnail(item);
      picture.addEventListener("error", () => picture.classList.add("missing"), { once: true });
      const name = document.createElement("span");
      name.className = "shop-name";
      name.textContent = item.name;
      const many = document.createElement("span");
      many.className = "shop-count";
      many.textContent = `×${count}`;
      card.append(picture, name, many);
      list.append(card);
    }
    const people = this.parts.people();
    const room = document.createElement("p");
    room.className = "rows-note army-people";
    room.textContent = `People: ${people.current} of ${people.max}. Houses make room for more.`;
    const note = document.createElement("p");
    note.className = "rows-note";
    note.textContent = "Train units at the barracks, archery range, stables or workshop (villagers at the town hall): select it and choose Train.";
    this.panel.body.replaceChildren(tabs, room, list, note);
  }
}
