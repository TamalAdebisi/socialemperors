// The Neighbours window (CLIENT.md, "The menus: rail and dock"): one row
// for each neighbour the server sends with the town (friends first, then
// the most recently active players, then Arthur), with their level and a
// Visit button that opens their town to look at.

import { Panel } from "./panel.ts";

export interface Neighbour {
  pid: string | number;
  name?: string;
  level?: number | string;
  /** A picture for the portrait (Arthur's, the game's own); the others get their initial. */
  picture?: string;
}

/** The colours of the letter portraits: picked by the name, so a neighbour keeps theirs. */
const PORTRAITS = ["#c0392b", "#2e86c1", "#8e44ad", "#16a085", "#d35400", "#27ae60", "#b7950b", "#7f8c8d"];

export class NeighboursWindow {
  private readonly panel = new Panel("neighbours", "Neighbours", { className: "list-window" });

  constructor(neighbours: Neighbour[], visitUrl: (pid: string) => string) {
    this.panel.title = `Neighbours (${neighbours.length})`;
    const list = document.createElement("ul");
    list.className = "rows";
    for (const neighbour of neighbours) {
      const name = neighbour.name?.trim() || "Emperor";
      const row = document.createElement("li");
      row.className = "row";
      const portrait = document.createElement("span");
      portrait.className = "portrait";
      portrait.setAttribute("aria-hidden", "true");
      if (neighbour.picture) {
        portrait.style.backgroundImage = `url("${neighbour.picture}")`;
        portrait.classList.add("picture");
      } else {
        portrait.textContent = name[0].toUpperCase();
        portrait.style.background = PORTRAITS[[...name].reduce((sum, c) => sum + c.charCodeAt(0), 0) % PORTRAITS.length];
      }
      const text = document.createElement("span");
      text.className = "row-text";
      const title = document.createElement("strong");
      title.textContent = name;
      const level = document.createElement("small");
      level.textContent = `Level ${neighbour.level ?? 1}`;
      text.append(title, level);
      const visit = document.createElement("a");
      visit.className = "button tiny gold";
      visit.href = visitUrl(String(neighbour.pid));
      visit.textContent = "Visit";
      visit.setAttribute("aria-label", `Visit ${name}`);
      row.append(portrait, text, visit);
      list.append(row);
    }
    const more = document.createElement("p");
    more.className = "rows-note";
    more.innerHTML = `Add your friends as neighbours on the <a href="/friends">Friends page</a>.`;
    this.panel.body.append(list, more);
  }

  toggle(): void {
    this.panel.toggle();
  }
}
