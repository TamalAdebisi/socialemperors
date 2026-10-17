// The Neighbours window (CLIENT.md, "The menus: rail and dock"): one row
// for each registered player the server sends with the town (then Arthur), with their level, a
// Visit button that opens their town to look at and, from level 6, an
// Attack button that sends the army against it (attackPlay.ts).

import { ICONS } from "./icons.ts";
import { Panel } from "./panel.ts";

export interface Neighbour {
  pid: string | number;
  name?: string;
  level?: number | string;
  /** A picture for the portrait (Arthur's, the game's own); the others get their initial. */
  picture?: string;
  /** Not a player (Arthur): no attacking him. */
  noAttack?: boolean;
  /** Their experience, shown as the original's cards did. */
  xp?: number | string;
  /** Not helped in the last 24 hours: the original's "ASSIST!" mark. */
  canHelp?: boolean;
}

const numbers = new Intl.NumberFormat("en-US");

/** The colours of the letter portraits: picked by the name, so a neighbour keeps theirs. */
const PORTRAITS = ["#c0392b", "#2e86c1", "#8e44ad", "#16a085", "#d35400", "#27ae60", "#b7950b", "#7f8c8d"];

export class NeighboursWindow {
  private readonly panel = new Panel("neighbours", "Neighbours", { className: "list-window" });

  /**
   * `attackUrl`: where Attack goes, or null while the player is below the level for attacks.
   * `gifts`: the gifts window (ui/gifts.ts), first in the list, as the original's Send gift was on a neighbour.
   */
  constructor(neighbours: Neighbour[], visitUrl: (pid: string) => string, attackUrl: ((pid: string) => string) | null = null,
    gifts: (() => void) | null = null, profile?: (pid: string) => void) {
    this.panel.title = `Neighbours (${neighbours.length})`;
    const list = document.createElement("ul");
    list.className = "rows";
    if (gifts) {
      const row = document.createElement("li");
      row.className = "row";
      const icon = document.createElement("img");
      icon.className = "row-icon";
      icon.src = ICONS.storage;
      icon.alt = "";
      const text = document.createElement("span");
      text.className = "row-text";
      text.innerHTML = "<strong>Gifts</strong><small>For you, a free gift, and giving from storage</small>";
      const open = document.createElement("button");
      open.type = "button";
      open.className = "button tiny gold";
      open.textContent = "Gifts";
      open.addEventListener("click", gifts);
      row.append(icon, text, open);
      list.append(row);
    }
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
      level.textContent = `Level ${neighbour.level ?? 1}` + (neighbour.xp !== undefined ? ` · ${numbers.format(Number(neighbour.xp) || 0)} XP` : "");
      text.append(title, level);
      if (neighbour.canHelp) {
        const mark = document.createElement("img");
        mark.className = "assist-mark";
        mark.src = ICONS["assist-mark"];
        mark.alt = "Can be helped today";
        mark.title = "Can be helped today";
        text.append(mark);
      }
      const visit = document.createElement("a");
      visit.className = "button tiny gold";
      visit.href = visitUrl(String(neighbour.pid));
      visit.textContent = "Visit";
      visit.setAttribute("aria-label", `Visit ${name}`);
      row.append(portrait, text, visit);
      if(profile){
        const button=document.createElement("button");button.type="button";button.className="button tiny gold";button.textContent="Profile";button.setAttribute("aria-label",`Profile of ${name}`);
        button.addEventListener("click",()=>profile(String(neighbour.pid)));row.append(button);
      }
      if (attackUrl && !neighbour.noAttack) {
        const attack = document.createElement("a");
        attack.className = "button tiny danger";
        attack.href = attackUrl(String(neighbour.pid));
        attack.textContent = "Attack";
        attack.setAttribute("aria-label", `Attack ${name}`);
        row.append(attack);
      }
      list.append(row);
    }
    const more = document.createElement("p");
    more.className = "rows-note";
    more.innerHTML = `Everybody with an empire is here. No friend requests needed. <a href="/friends" target="_blank" rel="noopener">Everybody, gifts and help</a>. Arthur is the game's guide.`;
    this.panel.body.append(list, more);
  }

  toggle(): void {
    this.panel.toggle();
  }
}
