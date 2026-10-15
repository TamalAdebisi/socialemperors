// The Quests window (CLIENT.md, "Quests"): the 28 islands in the game's
// order, each with its picture, the stars won there, and Sail, or why it
// can't be sailed to yet (an island not reached, a level, the army resting
// 4 hours after attacking it). Sailing opens the island in this client.

import type { ItemInfo } from "../rules/config.ts";
import { MIN_LEVEL_QUESTS, islandLock, playedHere, type Island } from "../rules/quest.ts";
import { iconImage } from "./icons.ts";
import { Panel } from "./panel.ts";

export interface IslandsParts {
  islands: Island[];
  items: Map<number, ItemInfo>;
  /** The player's progress: the furthest island open, the stars by island, when each was last attacked. */
  unlockedIndex: () => number;
  stars: () => Record<string, number>;
  lastAttacked: () => Record<string, number>;
  level: () => number;
  /** Units ready to sail. */
  armySize: () => number;
  /** The server's clock, in seconds. */
  clock: () => number;
  /** Draw an island's picture (from its sprite sheet). */
  picture: (item: ItemInfo, canvas: HTMLCanvasElement) => void;
  questUrl: (quest: number) => string;
  /** The classic game, for the islands not played here yet. */
  classicUrl: string;
}

export class IslandsWindow {
  private readonly panel = new Panel("quests", "Quests", { className: "list-window islands" });
  private readonly parts: IslandsParts;
  private readonly list = document.createElement("ul");
  private readonly note = document.createElement("p");
  private drawn = false;

  constructor(parts: IslandsParts) {
    this.parts = parts;
    this.list.className = "rows";
    this.note.className = "rows-note";
    this.panel.body.append(this.note, this.list);
  }

  toggle(): void {
    this.fill();
    this.panel.toggle();
  }

  open(): void {
    this.fill();
    this.panel.open();
  }

  private fill(): void {
    const p = this.parts;
    const level = p.level();
    const army = p.armySize();
    this.note.textContent = level < MIN_LEVEL_QUESTS ? `Quests open at level ${MIN_LEVEL_QUESTS}.`
      : army === 0 ? "You need an army to sail: train some units first."
        : `Your whole army sails: ${army} unit${army === 1 ? "" : "s"}. Units that fall may not all come home.`;
    const stars = p.stars();
    const attacked = p.lastAttacked();
    const now = p.clock();
    this.list.replaceChildren();
    p.islands.forEach((island, index) => {
      const item = p.items.get(island.item);
      const lock = islandLock(island, index, p.unlockedIndex(), level, attacked[island.quest], now);
      const row = document.createElement("li");
      row.className = `row island${lock.open ? "" : " locked"}`;
      const canvas = document.createElement("canvas");
      canvas.className = "island-picture";
      const text = document.createElement("span");
      text.className = "row-text";
      const name = document.createElement("strong");
      name.textContent = item?.name ?? `Island ${index + 1}`;
      const detail = document.createElement("small");
      // The stars won, on an island reached (resting ones too), and why it can't be sailed to.
      if (lock.open || lock.until) {
        const row = document.createElement("span");
        row.className = "island-stars";
        const won = Number(stars[island.quest] ?? 0);
        for (let s = 1; s <= 3; s++) {
          row.append(iconImage(s <= won ? "star-on" : "star-off", s <= won ? "star won" : ""));
        }
        detail.append(row);
      }
      if (!lock.open) {
        detail.append(lock.until ? `Resting: ${restingFor(lock.until - now)}` : lock.why ?? "");
      }
      const here = playedHere(island);
      if (lock.open && !here) {
        const note = document.createElement("small");
        note.textContent = "Played in the classic game for now";
        text.append(name, detail, note);
      } else {
        text.append(name, detail);
      }
      row.append(canvas, text);
      if (lock.open && !here) {
        const classic = document.createElement("a");
        classic.className = "button tiny plain";
        classic.href = p.classicUrl;
        classic.textContent = "Classic";
        classic.setAttribute("aria-label", `Play ${name.textContent} in the classic game`);
        row.append(classic);
      } else if (lock.open && level >= MIN_LEVEL_QUESTS && army > 0) {
        const sail = document.createElement("a");
        sail.className = "button tiny gold";
        sail.href = p.questUrl(island.quest);
        sail.textContent = "Sail";
        sail.setAttribute("aria-label", `Sail to ${name.textContent}`);
        row.append(sail);
      }
      this.list.append(row);
      if (item) {
        // Drawn once the row is laid out, so the canvas has its size.
        requestAnimationFrame(() => p.picture(item, canvas));
      }
    });
    this.drawn = true;
  }

  get filled(): boolean {
    return this.drawn;
  }
}

/** "3 h 20 min", "12 min". */
function restingFor(seconds: number): string {
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  const hours = Math.floor(minutes / 60);
  return hours ? `${hours} h ${minutes % 60} min` : `${minutes} min`;
}
