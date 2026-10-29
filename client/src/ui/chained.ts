// A Chained building's window (CLIENT.md, "Chained buildings"): the units
// it holds, with their original pictures, how long until the chains break,
// Speed up (500 food an hour left) and, once they have, Free. The rules are
// in rules/chained.ts; the commands are ours (the server's chained.py).

import type { Command } from "../net/commands.ts";
import type { ItemInfo } from "../rules/config.ts";
import { clockText } from "../rules/nest.ts";
import { release, secondsLeft, speedUp, speedUpCash } from "../rules/chained.ts";
import { foodText } from "../rules/speedUps.ts";
import type { PlacedItem, Town } from "../rules/town.ts";
import { iconImage } from "./icons.ts";
import { Panel } from "./panel.ts";

export interface ChainedParts {
  town: Town;
  items: Map<number, ItemInfo>;
  thumbnail: (item: ItemInfo) => string;
  clock: () => number;
  send: (commands: Command[]) => void;
  /** Freed units, placed: the town draws them. */
  arrived: (placed: PlacedItem) => void;
  /** The building taken off the map. */
  removed: (placed: PlacedItem) => void;
  changed: () => void;
  tell: (words: string) => void;
}

export class ChainedWindow {
  private readonly panel = new Panel("chained", "", { className: "chained-window", onClose: () => clearInterval(this.ticking) });
  private readonly parts: ChainedParts;
  private building: PlacedItem | null = null;
  private ticking: ReturnType<typeof setInterval> | undefined;

  constructor(parts: ChainedParts) {
    this.parts = parts;
  }

  open(building: PlacedItem): void {
    this.building = building;
    this.panel.title = building.item.name;
    this.panel.open();
    this.render();
    clearInterval(this.ticking);
    this.ticking = setInterval(() => this.tick(), 1000);
  }

  get isOpen(): boolean {
    return this.panel.isOpen;
  }

  private units(): ItemInfo[] {
    return (this.building?.item.chainedUnits ?? []).flatMap((id) => this.parts.items.get(id) ?? []);
  }

  private tick(): void {
    const building = this.building;
    if (!building || !this.panel.isOpen) return;
    const left = secondsLeft(building, this.parts.clock());
    const time = this.panel.body.querySelector(".chained-time");
    if (left === 0 && time) {
      this.render();
    } else if (time) {
      time.textContent = clockText(left);
      const speed = this.panel.body.querySelector(".chained-speed-up");
      if (speed) speed.firstChild!.textContent = `Speed up for ${foodText(speedUpCash(building, this.parts.clock()))} `;
    }
  }

  private render(): void {
    const building = this.building!;
    const body = this.panel.body;
    const list = document.createElement("ul");
    list.className = "chained-units";
    for (const unit of this.units()) {
      const row = document.createElement("li");
      const picture = document.createElement("img");
      picture.src = this.parts.thumbnail(unit);
      picture.alt = "";
      const name = document.createElement("span");
      name.textContent = unit.name;
      row.append(picture, name);
      list.append(row);
    }
    const left = secondsLeft(building, this.parts.clock());
    const status = document.createElement("p");
    status.className = "chained-status";
    const actions = document.createElement("div");
    actions.className = "chained-actions";
    if (left > 0) {
      status.append("The chains break in ");
      const time = document.createElement("strong");
      time.className = "chained-time";
      time.textContent = clockText(left);
      status.append(time, ".");
      const speed = document.createElement("button");
      speed.type = "button";
      speed.className = "button small gold chained-speed-up";
      speed.append(`Speed up for ${foodText(speedUpCash(building, this.parts.clock()))} `, iconImage("food", "food"));
      speed.addEventListener("click", () => this.speedUp());
      actions.append(speed);
    } else {
      status.textContent = "The chains are broken.";
      const free = document.createElement("button");
      free.type = "button";
      free.className = "button gold chained-free";
      free.textContent = "Free";
      free.setAttribute("aria-label", `Free ${this.units().map((u) => u.name).join(" and ")}`);
      free.addEventListener("click", () => this.free());
      actions.append(free);
    }
    body.replaceChildren(list, status, actions);
  }

  private speedUp(): void {
    const result = speedUp(this.parts.town, this.building!, this.parts.clock());
    if (typeof result === "string") {
      this.parts.tell(result);
      return;
    }
    this.parts.send([result]);
    this.parts.changed();
    this.render();
  }

  private free(): void {
    const building = this.building!;
    const result = release(this.parts.town, building, this.parts.items, this.parts.clock());
    if (typeof result === "string") {
      this.parts.tell(result);
      return;
    }
    this.parts.removed(building);
    result.units.forEach((unit) => this.parts.arrived(unit));
    this.parts.send(result.commands);
    this.parts.tell(`${result.units.map((u) => u.item.name).join(" and ")} ${result.units.length > 1 ? "are" : "is"} yours!`);
    this.panel.close();
  }
}
