// The dragon nest's and the monster nest's window (CLIENT.md, "The nests"),
// opened by the nest's Open button, with the original window's parts: the
// progress bar, the picture of this step, Take care or Feed, the countdown
// and Speed up, the row of dragons with the one in training marked, Hire
// friends and the help. A nest that has raised them all is closed: it
// opens again for gold or cash. The rules are in rules/nest.ts; the
// commands are the Flash client's, sent at once.

import type { Command } from "../net/commands.ts";
import type { ItemInfo } from "../rules/config.ts";
import {
  STEPS, buttonWord, clockText, friendsHelped, getGrown, opened, readNest, reopen, secondsLeft, speedUp, speedUpCash, takeStep,
  writeNest, type NestKind, type NestState,
} from "../rules/nest.ts";
import type { PlacedItem, Town } from "../rules/town.ts";
import type { AskFriends } from "./askFriends.ts";
import { ICONS, iconImage } from "./icons.ts";
import { Panel } from "./panel.ts";

/** Each one's pictures from egg to grown, eleven side by side (tools/art/export_progress.py). */
const STRIPS: Record<string, string> = {
  popupDragonProgress1: new URL("./art/nest/popupDragonProgress1.webp", import.meta.url).href,
  popupDragonProgress2: new URL("./art/nest/popupDragonProgress2.webp", import.meta.url).href,
  popupDragonProgress3: new URL("./art/nest/popupDragonProgress3.webp", import.meta.url).href,
  popupDragonProgress4: new URL("./art/nest/popupDragonProgress4.webp", import.meta.url).href,
  popupDragonProgress5: new URL("./art/nest/popupDragonProgress5.webp", import.meta.url).href,
  popupDragonProgress6: new URL("./art/nest/popupDragonProgress6.webp", import.meta.url).href,
  popupMonsterProgress1: new URL("./art/nest/popupMonsterProgress1.webp", import.meta.url).href,
  popupMonsterProgress2: new URL("./art/nest/popupMonsterProgress2.webp", import.meta.url).href,
  popupMonsterProgress3: new URL("./art/nest/popupMonsterProgress3.webp", import.meta.url).href,
  popupMonsterProgress4: new URL("./art/nest/popupMonsterProgress4.webp", import.meta.url).href,
};

/** The game's words used here (localization_strings). */
const WORDS = {
  progress: 1094, finishesIn: 1095, speedUp: 1096, training: 1102, eggInfo: 1238, fedInfo: 1250,
  helpTitle: 1244, helpText: 1245, helped: 1424, helpedText: 1425, hire: 1426, hireInfo: 1427, hireTip: 1428,
  startAgain: 1413, closedInfo: 1414,
} as const;

export interface NestParts {
  town: Town;
  items: Map<number, ItemInfo>;
  /** The save's privateState, kept up to date here as the server keeps it. */
  privateState: Record<string, unknown>;
  /** The game's prices (config globals): opening a closed nest again. */
  globals: Record<string, unknown>;
  line: (id: number) => string;
  thumbnail: (item: ItemInfo) => string;
  /** Pictures in the game's images_new/. */
  picture: (name: string) => string;
  clock: () => number;
  /** Commands for the server, sent at once as the Flash client sends these. */
  send: (commands: Command[]) => void;
  /** The grown one, the player's: placed free beside the nest. */
  place: (item: ItemInfo, nest: PlacedItem) => void;
  /** Money changed. */
  changed: () => void;
  /** Not enough cash: the bank. */
  bank: (why: string) => void;
  askFriends: AskFriends | null;
}

export class NestWindow {
  private readonly panel = new Panel("nest", "", { className: "nest-window", onClose: () => this.stop() });
  private readonly parts: NestParts;
  private kind: NestKind | null = null;
  private building: PlacedItem | null = null;
  private ticking: ReturnType<typeof setInterval> | undefined;
  /** What was drawn last, so the countdown's second only changes its numbers. */
  private drawn = "";
  /** The nest itself, or its help, the friends to ask, or the friends who helped. */
  private showing: "nest" | "help" | "ask" | "helped" = "nest";

  constructor(parts: NestParts) {
    this.parts = parts;
  }

  open(kind: NestKind, building: PlacedItem): void {
    this.kind = kind;
    this.building = building;
    this.panel.title = this.parts.line(kind.words.title) || building.item.name;
    const change = opened(kind, this.state());
    this.apply(change.state, change.commands);
    this.drawn = "";
    this.showing = "nest";
    this.panel.open();
    this.render();
    clearInterval(this.ticking);
    this.ticking = setInterval(() => this.render(), 1000);
    // Friends who helped since: their steps, as the original showed them on opening.
    const friends = this.helpers();
    if (kind.friends && friends.length > 0 && this.state().active) {
      this.showHelped(friends);
    }
  }

  get isOpen(): boolean {
    return this.panel.isOpen;
  }

  private stop(): void {
    clearInterval(this.ticking);
  }

  private state(): NestState {
    return readNest(this.kind!, this.parts.privateState);
  }

  private apply(state: NestState, commands: Command[]): void {
    writeNest(this.kind!, this.parts.privateState, state);
    if (commands.length > 0) {
      this.parts.send(commands);
    }
  }

  private helpers(): string[] {
    const help = this.parts.privateState.dragonSocialHelp;
    return Array.isArray(help) ? help.map(String) : [];
  }

  private word(id: number, value?: string | number): string {
    const text = this.parts.line(id);
    return value === undefined ? text : text.replace("#0#", String(value));
  }

  /** The window as the nest is now; each second only the countdown changes, unless more did. */
  private render(): void {
    const kind = this.kind;
    if (!kind || !this.panel.isOpen || this.showing !== "nest") {
      return;
    }
    const state = this.state();
    const now = this.parts.clock();
    const left = secondsLeft(state, now);
    const key = JSON.stringify([state, left > 0, buttonWord(kind, state, now)]);
    if (key === this.drawn) {
      const time = this.panel.body.querySelector(".nest-time");
      if (time) {
        time.textContent = clockText(left);
      }
      return;
    }
    this.drawn = key;
    if (!state.active) {
      this.renderClosed(kind);
      return;
    }
    const body = this.panel.body;
    body.replaceChildren();

    // Progress 7/10, its bar and the help.
    const top = document.createElement("div");
    top.className = "nest-top";
    const label = document.createElement("span");
    label.textContent = this.word(WORDS.progress);
    const bar = document.createElement("span");
    bar.className = "nest-bar";
    bar.style.backgroundImage = `url("${ICONS["nest-bar"]}")`;
    const fill = document.createElement("span");
    fill.style.backgroundImage = `url("${ICONS["nest-bar-fill"]}")`;
    fill.style.width = `${(state.step / STEPS) * 100}%`;
    bar.append(fill);
    const count = document.createElement("span");
    count.className = "nest-count";
    count.textContent = `${state.step}/${STEPS}`;
    top.append(label, bar, count);
    if (kind.friends) {
      const help = document.createElement("button");
      help.type = "button";
      help.className = "nest-help";
      help.setAttribute("aria-label", "Help");
      help.innerHTML = `<img src="${ICONS["nest-help"]}" alt="">`;
      help.addEventListener("click", () => this.showHelp());
      top.append(help);
    }

    // This step's picture.
    const strip = STRIPS[`${kind.strip}${state.number + 1}`];
    const picture = document.createElement("div");
    picture.className = "nest-picture";
    picture.style.backgroundImage = `url("${strip}")`;
    picture.style.backgroundPosition = `${Math.min(state.step, STEPS) * 10}% 0`;

    // Take care / Feed / Get Dragon!, greyed while the step's wait runs, and the countdown.
    const action = document.createElement("div");
    action.className = "nest-action";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "nest-button";
    button.style.backgroundImage = `url("${ICONS["nest-button"]}")`;
    button.textContent = this.word(buttonWord(kind, state, now));
    button.disabled = left > 0;
    button.addEventListener("click", () => this.act());
    action.append(button);
    if (left > 0) {
      const timer = document.createElement("div");
      timer.className = "nest-timer";
      timer.style.backgroundImage = `url("${ICONS["nest-timer"]}")`;
      const title = document.createElement("span");
      title.textContent = this.word(WORDS.finishesIn);
      const time = document.createElement("strong");
      time.className = "nest-time";
      time.textContent = clockText(left);
      const speed = document.createElement("button");
      speed.type = "button";
      speed.className = "nest-speed-up";
      speed.style.backgroundImage = `url("${ICONS["nest-speed-up"]}")`;
      speed.append(this.word(WORDS.speedUp, speedUpCash(kind, state)), iconImage("cash"));
      speed.addEventListener("click", () => this.speedUp());
      timer.append(title, time, speed);
      action.append(timer);
    }

    body.append(top, picture, action);
    if (kind.friends) {
      const info = document.createElement("p");
      info.className = "nest-info";
      info.textContent = this.word(state.number % 2 === 0 ? WORDS.eggInfo : WORDS.fedInfo);
      body.append(info);
    }
    body.append(this.row(kind, state));
    if (kind.friends && this.parts.askFriends) {
      const hire = document.createElement("div");
      hire.className = "nest-hire-box";
      hire.style.backgroundImage = `url("${ICONS["nest-hire-box"]}")`;
      const text = document.createElement("p");
      text.textContent = this.word(WORDS.hireInfo);
      const ask = document.createElement("button");
      ask.type = "button";
      ask.className = "nest-hire";
      ask.style.backgroundImage = `url("${ICONS["nest-hire"]}")`;
      ask.textContent = this.word(WORDS.hire);
      ask.title = this.word(WORDS.hireTip);
      ask.addEventListener("click", () => this.hire());
      hire.append(text, ask);
      body.append(hire);
    }
  }

  /** The row of them all: the raised and the one in training in colour, the rest locked. */
  private row(kind: NestKind, state: NestState): HTMLElement {
    const row = document.createElement("ol");
    row.className = "nest-row";
    row.style.setProperty("--ones", String(kind.ones.length));
    row.style.backgroundImage = `url("${ICONS["nest-arrows"]}")`;
    kind.ones.forEach((id, i) => {
      const item = this.parts.items.get(id);
      const slot = document.createElement("li");
      slot.className = "nest-one";
      const open = i <= state.number;
      slot.classList.toggle("locked", !open);
      slot.classList.toggle("training", i === state.number);
      if (item) {
        const image = document.createElement("img");
        image.src = this.parts.thumbnail(item);
        image.alt = item.name;
        slot.append(image);
        if (open) {
          slot.title = `${item.name}: life ${item.life}, attack ${item.attack}, range ${item.attackRange}`;
        }
      }
      if (!open) {
        const lock = document.createElement("img");
        lock.className = "nest-lock";
        lock.src = ICONS["nest-lock"];
        lock.alt = "";
        slot.append(lock);
      }
      if (i === state.number) {
        slot.style.backgroundImage = `url("${ICONS["nest-frame"]}")`;
        const marker = document.createElement("span");
        marker.className = "nest-marker";
        marker.innerHTML = `<img src="${ICONS["nest-marker"]}" alt="">`;
        marker.append(this.word(WORDS.training));
        slot.append(marker);
      }
      row.append(slot);
    });
    return row;
  }

  /** The button: a step, or the grown one taken. */
  private act(): void {
    const kind = this.kind!;
    const now = this.parts.clock();
    const got = getGrown(kind, this.state(), now);
    if (got) {
      const item = this.parts.items.get(got.item);
      this.apply(got.state, []);
      if (item && this.building) {
        this.parts.place(item, this.building);  // its free "buy" goes first, as in the original
      }
      this.parts.send(got.commands);
      this.panel.close();
      return;
    }
    const step = takeStep(kind, this.state(), now);
    if (step) {
      this.apply(step.state, step.commands);
      this.render();
    }
  }

  private speedUp(): void {
    const kind = this.kind!;
    const bought = speedUp(kind, this.state(), this.parts.clock());
    if (!bought) {
      return;
    }
    if (this.parts.town.cash < bought.cash) {
      this.parts.bank(`Not enough cash: it takes ${bought.cash}.`);
      return;
    }
    this.parts.town.cash -= bought.cash;
    this.apply(bought.state, bought.commands);
    this.parts.changed();
    this.render();
  }

  /** A closed nest: its picture, and starting again for gold or cash. */
  private renderClosed(kind: NestKind): void {
    const body = this.panel.body;
    body.replaceChildren();
    const picture = document.createElement("img");
    picture.className = "nest-closed";
    picture.src = this.parts.picture(kind.closed);
    picture.alt = "";
    const info = document.createElement("p");
    info.className = "nest-info";
    info.textContent = this.word(WORDS.closedInfo);
    const buttons = document.createElement("div");
    buttons.className = "nest-pay-row";
    for (const [currency, field, icon] of [["g", kind.price.gold, "gold"], ["c", kind.price.cash, "cash"]] as const) {
      const price = Number(this.parts.globals[field]) || 0;
      const pay = document.createElement("button");
      pay.type = "button";
      pay.className = "nest-pay";
      pay.style.backgroundImage = `url("${ICONS["nest-pay"]}")`;
      pay.append(this.word(WORDS.startAgain, price.toLocaleString("en")), iconImage(icon));
      pay.setAttribute("aria-label", `Start again for ${price} ${icon}`);
      pay.addEventListener("click", () => this.reopen(currency, price));
      buttons.append(pay);
    }
    body.append(picture, info, buttons);
  }

  private reopen(currency: "g" | "c", price: number): void {
    const town = this.parts.town;
    if ((currency === "c" ? town.cash : town.gold) < price) {
      if (currency === "c") {
        this.parts.bank(`Not enough cash: it takes ${price}.`);
      } else {
        this.panel.body.querySelector(".nest-info")!.textContent = `Not enough gold: it takes ${price.toLocaleString("en")}.`;
      }
      return;
    }
    if (currency === "c") {
      town.cash -= price;
    } else {
      town.gold -= price;
    }
    const change = reopen(this.kind!, currency);
    this.apply(change.state, change.commands);
    this.parts.changed();
    this.drawn = "";
    this.render();
  }

  /** "Congratulations!! 2 friend/s accepted helping you": OK takes their steps. */
  private showHelped(friends: string[]): void {
    this.showing = "helped";
    const box = document.createElement("div");
    box.className = "nest-helped";
    box.setAttribute("role", "alertdialog");
    const title = document.createElement("strong");
    title.textContent = this.word(WORDS.helped);
    const text = document.createElement("p");
    text.textContent = this.word(WORDS.helpedText, friends.length);
    const ok = document.createElement("button");
    ok.type = "button";
    ok.className = "button small gold";
    ok.textContent = "OK";
    ok.addEventListener("click", () => {
      const change = friendsHelped(this.state(), friends);
      this.parts.privateState.dragonSocialHelp = [];
      this.apply(change.state, change.commands);
      this.back();
    });
    box.append(title, text, ok);
    this.panel.body.replaceChildren(box);
    ok.focus();
  }

  /** The original's help: its picture and how the nest works. */
  private showHelp(): void {
    this.showing = "help";
    const body = this.panel.body;
    body.replaceChildren();
    const title = document.createElement("h3");
    title.textContent = this.word(WORDS.helpTitle);
    const picture = document.createElement("img");
    picture.className = "nest-closed";
    picture.src = this.parts.picture("help_dragon_nest.jpg");
    picture.alt = "";
    const text = document.createElement("p");
    text.className = "nest-help-text";
    text.textContent = this.word(WORDS.helpText);
    body.append(title, picture, text, this.backButton());
  }

  private hire(): void {
    this.showing = "ask";
    const box = document.createElement("div");
    box.className = "nest-ask";
    this.panel.body.replaceChildren(box);
    this.parts.askFriends!.show(box, { kind: "nest", town: 0, x: 0, y: 0, item: 0 }, () => this.back());
  }

  private backButton(): HTMLButtonElement {
    const back = document.createElement("button");
    back.type = "button";
    back.className = "button small";
    back.textContent = "Back";
    back.addEventListener("click", () => this.back());
    return back;
  }

  /** From the help or the friends, back to the nest. */
  private back(): void {
    this.showing = "nest";
    this.drawn = "";
    this.render();
  }
}
