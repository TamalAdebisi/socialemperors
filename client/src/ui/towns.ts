// The towns' window (CLIENT.md, "The troll town"), as the Flash client's
// town selector, in the panel like every window here: with one town, the
// game's picture of a troll town, its words, and founding it for 100,000
// gold or 22 cash (from level 20); with two, both towns and Travel! to the
// other. Travelling sends what's waiting and opens the other town. The rules
// are rules/towns.ts.

import { TOWN_LEVEL, TOWN_PRICE, foundTown } from "../rules/towns.ts";
import type { Town } from "../rules/town.ts";
import type { Command } from "../net/commands.ts";
import { ICONS } from "./icons.ts";
import { Panel } from "./panel.ts";

const numbers = new Intl.NumberFormat("en-US");

export interface TownsParts {
  town: Town;
  /** The player's towns' races and names, town 0 first. */
  races: string[];
  names: string[];
  /** The game's pictures of a human and a troll town. */
  picture: (race: string) => string;
  /** The game's words: "SELECT TOWN", and the level warning ("#0#": the level). */
  words: { select: string; level: string };
  /** Send a command at once (founding is sent before travelling). */
  send: (command: Command) => Promise<void>;
  /** Open another of the player's towns (what's waiting is sent first). */
  travel: (town: number) => void;
  tell: (text: string) => void;
  /** Short of gold or cash: the bank, with why. */
  bank: (why: string) => void;
  changed: () => void;
}

export class TownsWindow {
  private readonly panel = new Panel("towns", "Towns", { className: "list-window towns-window" });
  private readonly parts: TownsParts;

  constructor(parts: TownsParts) {
    this.parts = parts;
  }

  toggle(): void {
    if (this.panel.isOpen) {
      this.panel.close();
    } else {
      this.render();
      this.panel.open();
    }
  }

  private render(): void {
    const { races } = this.parts;
    if (races.length > 1) {
      this.panel.title = this.parts.words.select;
      this.panel.body.replaceChildren(...races.map((race, i) => this.townRow(race, i)));
    } else {
      this.panel.title = "Start a new Empire";
      this.panel.body.replaceChildren(this.offer());
    }
  }

  /** One of the two towns: its picture and name, and Travel! unless it's this one. */
  private townRow(race: string, id: number): HTMLElement {
    const here = id === this.parts.town.id;
    const row = document.createElement("section");
    row.className = `town-row${here ? " here" : ""}`;
    const picture = document.createElement("img");
    picture.className = "town-picture";
    picture.src = this.parts.picture(race);
    picture.alt = "";
    const name = document.createElement("h3");
    name.textContent = this.parts.names[id] || "My Empire";
    const about = document.createElement("p");
    about.textContent = race === "t" ? "Troll town" : "Human town";
    const travel = document.createElement("button");
    travel.type = "button";
    travel.className = "button small gold";
    travel.textContent = here ? "You're here" : "Travel!";
    travel.disabled = here;
    travel.setAttribute("aria-label", here ? `${name.textContent}: you're here` : `Travel to ${name.textContent}`);
    travel.addEventListener("click", () => this.parts.travel(id));
    row.append(picture, name, about, travel);
    return row;
  }

  /** The troll town on offer, as the original's window has it. */
  private offer(): HTMLElement {
    const { town } = this.parts;
    const box = document.createElement("section");
    box.className = "town-offer";
    const picture = document.createElement("img");
    picture.className = "town-picture";
    picture.src = this.parts.picture("t");
    picture.alt = "";
    const pitch = document.createElement("p");
    pitch.className = "town-pitch";
    pitch.textContent = "Start your amazing Troll Empire and take revenge on humans. Don't worry, you'll be able to play your Human Empire too.";
    const buttons = document.createElement("div");
    buttons.className = "town-buttons";
    const unlock = (amount: number, icon: string, label: string, withCash: boolean) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "button gold";
      button.innerHTML = `Unlock for <b></b><img class="icon" src="${icon}" alt="">`;
      button.querySelector("b")!.textContent = numbers.format(amount);
      button.setAttribute("aria-label", `Unlock for ${numbers.format(amount)} ${label}`);
      button.addEventListener("click", () => void this.found(withCash));
      return button;
    };
    buttons.append(unlock(TOWN_PRICE.gold, ICONS.gold, "gold", false), unlock(TOWN_PRICE.cash, ICONS.cash, "cash", true));
    box.append(picture, pitch, buttons);
    if (town.level < TOWN_LEVEL) {
      const level = document.createElement("p");
      level.className = "town-level";
      level.textContent = `(Level ${TOWN_LEVEL} required)`;
      box.append(level);
    }
    return box;
  }

  private async found(withCash: boolean): Promise<void> {
    const { town } = this.parts;
    const done = foundTown(town, this.parts.races.length, withCash);
    if ("refused" in done) {
      if (done.refused === "level") {
        this.parts.tell(this.parts.words.level.replace("#0#", String(TOWN_LEVEL)).trim());
      } else if (done.refused === "gold") {
        this.parts.bank(`Not enough gold: a troll town takes ${numbers.format(TOWN_PRICE.gold)}.`);
      } else if (done.refused === "cash") {
        this.parts.bank(`Not enough cash: a troll town takes ${TOWN_PRICE.cash}.`);
      }
      return;
    }
    this.parts.changed();
    await this.parts.send(done.command);
    this.parts.travel(this.parts.races.length);
  }
}
