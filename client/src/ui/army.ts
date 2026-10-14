// The Army window: the units in this town, by kind, with how many of each,
// and the town's people against the room for them. Units are trained at
// the buildings that train them (barracks, archery ranges, stables...).

import type { ItemInfo } from "../rules/config.ts";
import { Panel } from "./panel.ts";

export interface ArmyParts {
  /** The town's units now, by kind. */
  units: () => { item: ItemInfo; count: number }[];
  /** The item's picture in the Flash client's windows. */
  thumbnail: (item: ItemInfo) => string;
  /** The town's people and the room for them. */
  people: () => { current: number; max: number };
}

export class ArmyWindow {
  private readonly panel = new Panel("army", "Army", { className: "list-window" });
  private readonly parts: ArmyParts;

  constructor(parts: ArmyParts) {
    this.parts = parts;
  }

  toggle(): void {
    if (!this.panel.isOpen) {
      this.render();
    }
    this.panel.toggle();
  }

  private render(): void {
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
    this.panel.body.replaceChildren(room, list, note);
  }
}
