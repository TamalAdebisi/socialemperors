// The Army window: the units in this town, by kind, with how many of each.
// Training them, and the town's population, come with Beta 1's training
// slice; until then the window says where to train.

import type { ItemInfo } from "../rules/config.ts";
import { Panel } from "./panel.ts";

export interface ArmyParts {
  /** The town's units now, by kind. */
  units: () => { item: ItemInfo; count: number }[];
  /** The item's picture in the Flash client's windows. */
  thumbnail: (item: ItemInfo) => string;
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
    const note = document.createElement("p");
    note.className = "rows-note";
    note.textContent = total ? "Train more in the classic game for now: training comes to the new game soon."
      : "No units in this town yet. Train them in the classic game for now: training comes to the new game soon.";
    this.panel.body.replaceChildren(list, note);
  }
}
