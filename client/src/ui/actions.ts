// The card for the thing selected on the map, at the bottom middle (above
// the dock on a phone), as the Flash client's info panel: on its parchment,
// the thing's picture with its life bar, its name, its numbers by their
// pictures, what it earns with its time bar and Hurry up, its tip, who's
// inside (tap one to let it out), the unit it trains, and Move, Turn, Store
// and Upgrade (CLIENT.md, "The building card"). Selling is the bulldozer's,
// as there. The card also asks the player things ("Tap where it goes"), and
// with several units selected it shows their portraits instead.

import type { Stat } from "../rules/card.ts";
import type { Resource } from "../rules/production.ts";
import { ICONS, resourceIcon, type IconName } from "./icons.ts";

/** A unit inside a building, on the card: tap it to let it out. */
export interface Inside {
  /** "CAPACITY 1/3", in the game's words. */
  capacity: string;
  units: { name: string; picture: string }[];
  letOut: ((index: number) => void) | null;
}

export interface ActionChoices {
  name: string;
  /** What it's doing ("Ready in 2 h 13 min"), or "": changed in place by describe(). */
  detail: string;
  /** Its picture (the shop's), and its life now and at most (null: no life bar, a tree). */
  picture?: string;
  life?: { now: number; most: number } | null;
  /** Its numbers by their pictures, each with the game's words for it (a tooltip). */
  stats?: { stat: Stat; value: number; words: string }[];
  /** The panel's tip, or "". */
  tip?: string;
  /** What the next collect (or a villager's harvest) brings. */
  earns?: { resource: Resource; amount: number } | null;
  /** Its time bar: how far along, 0 to 1 (null: none); changed in place by describe(). */
  bar?: number | null;
  inside?: Inside | null;
  /** Each action: what to call when it's chosen, or null when it can't be done to this thing. */
  move: (() => void) | null;
  turn: (() => void) | null;
  store: (() => void) | null;
  /** Upgrade: the next building, and what stops it (a level) or what it costs. */
  upgrade?: { name: string; picture: string; level: number | null; price: { resource: Resource; amount: number } | null; run: () => void } | null;
  /** Hurry up: finish its work now, for cash, or ask friends (the game's hurry window); null when it can't be hurried. */
  hurry?: { price: number; run: () => void } | null;
  ask?: (() => void) | null;
  /** Train its unit: its name, picture, price and the same for cash, and what the bubble over it tells. */
  train?: {
    unit: string;
    picture: string;
    price: { resource: Resource; amount: number }[];
    run: () => void;
    cash: { price: number; run: () => void } | null;
    about: { life: number; attack: number; note: string };
  } | null;
  /** The building's own window (the market, the harbour, a gate's door): its label and picture. */
  open?: { label: string; run: () => void; icon?: IconName } | null;
  close: () => void;
}

/** The card's words in the game's own (config localization_strings), with ours for when they're missing. */
export interface CardWords {
  hurryTitle: string;
  hurryHeader: string;
  hurryAsk: string;
  hurryPay: string;
  hurryOr: string;
  hurryAskButton: string;
  buyFor: string;
  train: string;
  cost: string;
  upgrade: string;
  earns: string;
}

const ENGLISH: CardWords = {
  hurryTitle: "WORK IN PROGRESS",
  hurryHeader: "You can take the following actions",
  hurryAsk: "Ask your friends to help you speed up",
  hurryPay: "Pay to finish the work instantly",
  hurryOr: "OR",
  hurryAskButton: "Ask for help",
  buyFor: "Buy for:",
  train: "Allows you to train:",
  cost: "COST:",
  upgrade: "Upgrade",
  earns: "Earns:",
};

const STAT_ICONS: Record<Stat, IconName> = {
  attack: "stat-attack", delay: "stat-delay", range: "stat-range", speed: "stat-speed", room: "stat-room",
};

/** One of several units selected: its name, its picture, and how much of its life it has (0 to 1). */
export interface Portrait {
  name: string;
  picture: string;
  life: number;
}

/** Thousands as the game wrote them under a price: 12k. */
function short(amount: number): string {
  return amount >= 10_000 ? `${amount / 1000}k` : String(amount);
}

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text = ""): HTMLElementTagNameMap[K] {
  const made = document.createElement(tag);
  made.className = className;
  if (text) {
    made.textContent = text;
  }
  return made;
}

function picture(src: string, className: string, alt = ""): HTMLImageElement {
  const image = new Image();
  image.className = className;
  image.alt = alt;
  image.decoding = "async";
  image.draggable = false;
  if (src) {
    image.src = src;
  }
  image.addEventListener("error", () => image.classList.add("missing"), { once: true });
  return image;
}

export class ActionBar {
  private readonly bar: HTMLElement;
  private words: CardWords = ENGLISH;
  /** The line under the name shown by show(), to change in place (a countdown); null while a prompt shows. */
  private detail: HTMLElement | null = null;
  /** The time bar's yellow and its percentage, changed in place. */
  private progress: { box: HTMLElement; fill: HTMLElement; percent: HTMLElement } | null = null;
  private tiles: HTMLElement | null = null;
  /** The hurry window's time left, changed in place with the card's. */
  private hurryTime: HTMLElement | null = null;
  /** Whether the last press was a finger's: a tap on Upgrade shows what it'll be first, as hovering does. */
  private touched = false;

  constructor() {
    this.bar = document.createElement("nav");
    this.bar.className = "actions";
    this.bar.setAttribute("aria-label", "Selected");
    this.bar.hidden = true;
    this.bar.addEventListener("pointerdown", (event) => {
      this.touched = event.pointerType === "touch";
    }, { capture: true });
    document.body.appendChild(this.bar);
  }

  /** The game's words for the card, once the config has come. */
  useWords(words: Partial<CardWords>): void {
    this.words = { ...ENGLISH, ...words };
  }

  show(choices: ActionChoices): void {
    this.bar.replaceChildren();
    this.bar.classList.remove("asking", "grouped");
    this.bar.classList.add("card");
    this.tiles = null;
    this.hurryTime = null;

    // The picture in its frame, its life bar under it.
    const left = element("div", "card-left");
    const frame = element("div", "card-frame");
    frame.append(picture(choices.picture ?? "", "card-picture"));
    left.append(frame);
    if (choices.life) {
      const { now, most } = choices.life;
      const life = element("div", "card-life");
      life.setAttribute("role", "img");
      life.setAttribute("aria-label", `Life ${now} of ${most}`);
      const fill = element("span", "card-life-fill");
      fill.style.width = `${Math.round(Math.min(1, Math.max(0, now / most)) * 100)}%`;
      life.append(fill);
      // The numbers are drawn from an attribute, so the card's text starts with the name.
      const numbers = element("span", "card-life-text");
      numbers.dataset.life = `${now}/${most}`;
      left.append(life, numbers);
    }

    // The name, the numbers, what it earns and its time bar.
    const main = element("div", "card-main");
    const name = element("span", "actions-name", choices.name);
    main.append(name);
    if (choices.stats?.length) {
      const stats = element("div", "card-stats");
      for (const { stat, value, words } of choices.stats) {
        const one = element("span", "card-stat");
        one.dataset.tip = words;
        one.setAttribute("aria-label", `${words}: ${value}`);
        one.tabIndex = 0;
        one.append(picture(ICONS[STAT_ICONS[stat]], "card-stat-icon"), String(value));
        stats.append(one);
      }
      main.append(stats);
    }
    if (choices.earns) {
      const earns = element("div", "card-earns", `${this.words.earns} `);
      earns.append(picture(resourceIcon(choices.earns.resource), "icon"), ` ${choices.earns.amount.toLocaleString("en")}`);
      main.append(earns);
    }
    const bar = element("div", "card-bar");
    const fill = element("span", "card-bar-fill");
    const percent = element("span", "card-bar-percent");
    bar.append(fill, percent);
    this.progress = { box: bar, fill, percent };
    main.append(bar);
    this.showProgress(choices.bar ?? null);
    const detail = element("span", "actions-detail", choices.detail);
    this.detail = detail;
    main.append(detail);
    if (choices.hurry) {
      const hurry = choices.hurry;
      const ask = choices.ask ?? null;
      const button = element("button", "card-hurry");
      button.type = "button";
      button.setAttribute("aria-label", "Hurry up");
      button.append(picture(ICONS["hurry-up"], ""));
      button.addEventListener("click", () => this.hurryBox(choices, hurry, ask));
      main.append(button);
    }

    // The tip, who's inside, the unit it trains, its own window.
    const side = element("div", "card-side");
    const inside = choices.inside;
    if (choices.tip && !(inside && inside.units.length > 0)) {
      side.append(element("p", "card-tip", choices.tip));
    }
    if (inside) {
      side.append(this.insideOf(inside));
    }
    if (choices.train) {
      side.append(this.trainOf(choices.train));
    }
    if (choices.open) {
      const open = choices.open;
      const button = element("button", "picture-button card-open");
      button.type = "button";
      button.append(picture(ICONS[open.icon ?? "spell-book"], ""), element("span", "", open.label));
      button.addEventListener("click", open.run);
      side.append(button);
    }

    // Move, Turn, Store and Upgrade, two by two.
    const buttons = element("div", "card-buttons");
    this.tiles = buttons;
    this.button("Move", choices.move, "Move", "move");
    this.button("Turn", choices.turn, "Turn", "turn");
    this.button("Store", choices.store, "Store", "store");
    if (choices.upgrade) {
      buttons.append(this.upgradeOf(choices.upgrade));
    }

    this.bar.append(left, main);
    if (side.childElementCount > 0) {
      this.bar.append(side);
    }
    if (buttons.childElementCount > 0) {
      this.bar.append(buttons);
    }
    this.closeButton(choices.close);
    this.bar.hidden = false;
  }

  /**
   * Several units selected: their portraits, as on the Flash client's info
   * panel (ten to a row, each with its life bar). Tapping one selects it
   * alone (`pick`).
   */
  showGroup(units: Portrait[], pick: (index: number) => void, close: () => void): void {
    this.bar.replaceChildren();
    this.bar.classList.remove("asking", "card");
    this.bar.classList.add("grouped");
    this.detail = null;
    this.progress = null;
    this.tiles = null;
    const grid = document.createElement("span");
    grid.className = "actions-group";
    grid.style.gridTemplateColumns = `repeat(${Math.min(10, units.length)}, minmax(0, 42px))`;
    units.forEach((unit, i) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "portrait";
      button.title = unit.name;
      button.setAttribute("aria-label", unit.name);
      button.innerHTML = `<img alt=""><span class="portrait-life"><span></span></span>`;
      const image = button.querySelector("img")!;
      image.src = unit.picture;
      image.addEventListener("error", () => image.classList.add("missing"), { once: true });
      button.querySelector<HTMLElement>(".portrait-life span")!.style.width = `${Math.round(unit.life * 100)}%`;
      button.addEventListener("click", () => pick(i));
      grid.append(button);
    });
    this.bar.append(grid);
    this.closeButton(close);
    this.bar.hidden = false;
  }

  /** Change the line show() put up, and its time bar, leaving its buttons be (they'd lose a click being replaced). */
  describe(text: string, bar: number | null = null): void {
    if (this.detail && this.detail.textContent !== text) {
      this.detail.textContent = text;
    }
    if (this.hurryTime && this.hurryTime.textContent !== text) {
      this.hurryTime.textContent = text;
    }
    this.showProgress(bar);
  }

  /** A message with ways out, like "Tap where it goes" with Cancel. */
  prompt(text: string, actions: { label: string; run: () => void }[]): void {
    this.bar.replaceChildren();
    this.bar.classList.remove("card", "grouped");
    this.bar.classList.add("asking");
    this.detail = null;
    this.progress = null;
    const message = document.createElement("span");
    message.className = "actions-name";
    message.textContent = text;
    const choices = document.createElement("span");
    choices.className = "actions-choices";
    this.tiles = choices;
    this.bar.append(message, choices);
    for (const action of actions) {
      this.button(action.label, action.run);
    }
    this.bar.hidden = false;
  }

  hide(): void {
    this.bar.hidden = true;
    this.bar.replaceChildren();
    this.detail = null;
    this.progress = null;
    this.tiles = null;
  }

  private showProgress(share: number | null): void {
    if (!this.progress) {
      return;
    }
    const { box, fill, percent } = this.progress;
    box.hidden = share === null;
    if (share !== null) {
      const shown = Math.min(1, Math.max(0, share));
      fill.style.width = `calc(${shown} * (100% - 8px))`;  // inside the bar's edge
      percent.textContent = `${Math.floor(shown * 100)}%`;
    }
  }

  /** Who's inside: how many fit, then each one's picture in the game's frame; a tap lets that one out. */
  private insideOf(inside: Inside): HTMLElement {
    const box = element("div", "card-inside");
    box.append(element("span", "card-capacity", inside.capacity));
    if (inside.units.length > 0) {
      const units = element("div", "card-units");
      inside.units.forEach((unit, i) => {
        const button = element("button", "card-unit");
        button.type = "button";
        button.title = `${unit.name}: let out`;
        button.setAttribute("aria-label", `Let out ${unit.name}`);
        button.disabled = inside.letOut === null;
        button.append(picture(unit.picture, "card-unit-picture"));
        button.addEventListener("click", () => inside.letOut?.(i));
        units.append(button);
      });
      box.append(units);
    }
    return box;
  }

  /** Train: BUY with cash, the unit's picture on the TRAIN box (its bubble over it), and the price under. */
  private trainOf(train: NonNullable<ActionChoices["train"]>): HTMLElement {
    const box = element("div", "card-train");
    box.append(element("span", "card-train-name", train.unit));
    const row = element("div", "card-train-row");
    if (train.cash) {
      const cash = train.cash;
      const buy = element("button", "card-train-cash");
      buy.type = "button";
      buy.setAttribute("aria-label", `Train ${train.unit} for ${cash.price} cash`);
      buy.dataset.tip = `${this.words.buyFor} ${cash.price} cash`;
      buy.append(picture(ICONS["train-cash"], ""), element("span", "card-train-cash-price", String(cash.price)));
      buy.addEventListener("click", cash.run);
      row.append(buy);
    }
    const button = element("button", "card-train-button");
    button.type = "button";
    button.setAttribute("aria-label", `Train ${train.unit}`);
    button.append(picture(ICONS.train, "card-train-box"), picture(train.picture, "card-train-unit"));
    button.addEventListener("click", train.run);
    // The bubble over the unit, as the game's when the mouse is on it: what it is and its numbers.
    const bubble = element("div", "card-train-bubble");
    bubble.setAttribute("aria-hidden", "true");
    bubble.append(element("span", "", this.words.train), element("strong", "", train.unit));
    const numbers = element("span", "card-train-numbers");
    numbers.append(picture(ICONS["stat-life"], "card-stat-icon"), String(train.about.life), " ",
      picture(ICONS["stat-attack"], "card-stat-icon"), String(train.about.attack));
    bubble.append(numbers);
    if (train.about.note) {
      bubble.append(element("span", "", train.about.note));
    }
    const holder = element("div", "card-train-holder");
    holder.append(button, bubble);
    row.append(holder);
    box.append(row);
    const cost = element("span", "card-train-cost", `${this.words.cost} `);
    for (const { resource, amount } of train.price) {
      cost.append(`${short(amount)}`, picture(resourceIcon(resource), "icon", resource), " ");
    }
    box.append(cost);
    return box;
  }

  /** Upgrade: the game's button; over it (or at a first tap on a phone) the next building, and its level or price. */
  private upgradeOf(upgrade: NonNullable<ActionChoices["upgrade"]>): HTMLElement {
    const holder = element("div", "card-upgrade");
    const button = element("button", "picture-button card-upgrade-button");
    button.type = "button";
    button.setAttribute("aria-label", `${this.words.upgrade} to ${upgrade.name}`);
    button.append(picture(ICONS.upgrade, ""));
    const bubble = element("div", "card-upgrade-bubble");
    bubble.append(element("strong", "", upgrade.name));
    const frame = element("div", "card-frame");
    frame.append(picture(upgrade.picture, "card-picture"));
    bubble.append(frame);
    if (upgrade.level !== null) {
      const lock = element("span", "card-unlock");
      lock.append(picture(ICONS["unlock-at"], "card-unlock-badge"), element("span", "card-unlock-level", String(upgrade.level)));
      lock.setAttribute("aria-label", `From level ${upgrade.level}`);
      bubble.append(lock);
    } else if (upgrade.price) {
      const price = element("span", "card-upgrade-price", "Cost ");
      price.append(picture(resourceIcon(upgrade.price.resource), "icon", upgrade.price.resource), ` ${upgrade.price.amount.toLocaleString("en")}`);
      bubble.append(price);
    }
    button.addEventListener("click", () => {
      if (this.touched && !holder.classList.contains("showing")) {
        holder.classList.add("showing");
        return;
      }
      holder.classList.remove("showing");
      upgrade.run();
    });
    holder.addEventListener("pointerleave", () => holder.classList.remove("showing"));
    holder.append(bubble, button);
    return holder;
  }

  /**
   * The game's hurry window, over the card: the building, how long it has
   * left, and the two ways: ask friends for help, or pay to finish now.
   */
  private hurryBox(choices: ActionChoices, hurry: { price: number; run: () => void }, ask: (() => void) | null): void {
    this.bar.querySelector(".card-hurry-box")?.remove();
    const box = element("div", "card-hurry-box");
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-label", this.words.hurryTitle);
    const close = () => {
      box.remove();
      this.hurryTime = null;
    };
    const band = element("strong", "card-hurry-band", this.words.hurryTitle);
    const shut = element("button", "card-hurry-close");
    shut.type = "button";
    shut.setAttribute("aria-label", "Close");
    shut.append(picture(ICONS.close, ""));
    shut.addEventListener("click", close);
    const head = element("div", "card-hurry-head");
    const frame = element("div", "card-frame");
    frame.append(picture(choices.picture ?? "", "card-picture"));
    const named = element("div", "card-hurry-name");
    const time = element("span", "card-hurry-time", choices.detail);
    this.hurryTime = time;
    named.append(element("strong", "", choices.name), time);
    head.append(frame, named);
    box.append(band, shut, head, element("span", "card-hurry-header", this.words.hurryHeader));
    const ways = element("div", "card-hurry-ways");
    const way = (text: string, label: string, run: () => void, cash = 0) => {
      const option = element("div", "card-hurry-option");
      const button = element("button", "card-hurry-button", label);
      button.type = "button";
      if (cash) {
        button.setAttribute("aria-label", `Finish now for ${cash} cash`);
        button.append(` ${cash}`, picture(ICONS.cash, "icon"));
      }
      button.addEventListener("click", () => {
        close();
        run();
      });
      option.append(element("span", "", text), button);
      return option;
    };
    if (ask) {
      ways.append(way(this.words.hurryAsk, this.words.hurryAskButton, ask), element("span", "card-hurry-or", this.words.hurryOr));
    }
    ways.append(way(this.words.hurryPay, this.words.buyFor.replace(/:$/, ""), hurry.run, hurry.price));
    box.append(ways);
    this.bar.append(box);
  }

  /** A button in the card's row; with `icon`, the info panel's picture over its name. */
  private button(label: string, run: (() => void) | null, title = label, icon?: IconName): void {
    if (run === null) {
      return;
    }
    const button = document.createElement("button");
    button.type = "button";
    if (icon) {
      button.className = "picture-button";
      button.dataset.slot = title.toLowerCase();  // each keeps its place on the card, as the game's
      button.innerHTML = `<img src="${ICONS[icon]}" alt=""><span></span>`;
      button.querySelector("span")!.textContent = label;
    } else {
      button.className = "button tiny gold";
      button.textContent = label;
    }
    if (title !== label) {
      button.setAttribute("aria-label", title);
    }
    button.addEventListener("click", run);
    (this.tiles ?? this.bar).append(button);
  }

  /** The game's close button, in the card's corner. */
  private closeButton(run: () => void): void {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "actions-close";
    button.setAttribute("aria-label", "Close");
    button.innerHTML = `<img src="${ICONS.close}" alt="">`;
    button.addEventListener("click", run);
    this.bar.append(button);
  }
}
