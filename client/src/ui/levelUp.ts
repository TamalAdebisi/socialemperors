// The level-up window, as the Flash client shows it (CLIENT.md, "Step 3:
// run your town"): the game's parchment in its wooden frame and its title
// band, "LEVEL 7!", "You've reached Cadet rank", up to four buildings the
// level opens, with the game's thumbnails, and the level's reward (and from
// level 36 its 2 mana). One window per level, one after another. The
// original's two buttons (Share and Skip) both only closed it: Facebook is
// gone, so there is one, OK.

import type { ItemInfo } from "../rules/config.ts";
import type { Resource } from "../rules/production.ts";
import { ICONS } from "./icons.ts";

export interface LevelShown {
  level: number;
  /** The level's rank, from the levels table ("Cadet"). */
  name: string;
  prize: { resource: Resource; amount: number } | null;
  /** The buildings first sold at this level (rules/levels.ts, unlockedAt). */
  unlocked: ItemInfo[];
  /** Mana the level gives (from level 36), or 0. */
  mana: number;
}

export interface LevelWords {
  /** The game's words: "LEVEL #0#!", "You've reached #0# rank", "You can now buy:", "Level reward:". */
  title: string;
  rank: string;
  canBuy: string;
  reward: string;
}

export class LevelUpWindows {
  private readonly queue: LevelShown[] = [];
  private open: HTMLElement | null = null;
  private readonly words: LevelWords;
  private readonly thumbnail: (item: ItemInfo) => string;
  private readonly opened: () => void;

  /** `opened` hears each window open (the level-up sound plays then, as in the game). */
  constructor(words: LevelWords, thumbnail: (item: ItemInfo) => string, opened: () => void) {
    this.words = words;
    this.thumbnail = thumbnail;
    this.opened = opened;
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.open) {
        e.stopPropagation();
        this.close();
      }
    }, true);
  }

  /** Levels just reached: a window for each, one after another. */
  show(levels: LevelShown[]): void {
    this.queue.push(...levels);
    if (!this.open) {
      this.next();
    }
  }

  /** Whether a window is showing (for the browser tests). */
  get showing(): boolean {
    return this.open !== null;
  }

  private next(): void {
    const level = this.queue.shift();
    if (!level) {
      return;
    }
    const fill = (text: string, value: string | number) => text.replace("#0#", String(value));
    const box = document.createElement("section");
    box.className = "level-window";
    box.setAttribute("role", "dialog");
    const title = fill(this.words.title, level.level);
    box.setAttribute("aria-label", title);
    box.style.backgroundImage = `url("${ICONS["level-window"]}")`;

    const band = document.createElement("h2");
    band.className = "level-band";
    band.style.backgroundImage = `url("${ICONS["level-band"]}")`;
    band.textContent = title;
    const rank = document.createElement("p");
    rank.className = "level-rank";
    rank.textContent = fill(this.words.rank, level.name);
    box.append(band, rank);

    if (level.unlocked.length > 0) {
      const header = document.createElement("p");
      header.className = "level-header";
      header.textContent = this.words.canBuy;
      const row = document.createElement("div");
      row.className = "level-unlocked";
      for (const item of level.unlocked) {
        const card = document.createElement("figure");
        const name = document.createElement("figcaption");
        name.textContent = item.name;
        const picture = document.createElement("img");
        picture.src = this.thumbnail(item);
        picture.alt = "";
        card.append(name, picture);
        row.append(card);
      }
      box.append(header, row);
    }

    const reward = document.createElement("p");
    reward.className = "level-reward";
    const label = document.createElement("span");
    label.textContent = this.words.reward;
    reward.append(label);
    if (level.prize) {
      reward.append(amount(String(level.prize.amount), ICONS[level.prize.resource], level.prize.resource));
    }
    if (level.mana > 0) {
      reward.append(amount(`+${level.mana}`, ICONS.mana, "mana"));
    }
    if (level.prize || level.mana > 0) {
      box.append(reward);
    }

    const ok = document.createElement("button");
    ok.type = "button";
    ok.className = "button gold level-ok";
    ok.textContent = "OK";
    ok.addEventListener("click", () => this.close());
    box.append(ok);
    document.body.append(box);
    this.open = box;
    ok.focus();
    this.opened();
  }

  private close(): void {
    this.open?.remove();
    this.open = null;
    this.next();
  }
}

/** "50" and the resource's icon. */
function amount(text: string, icon: string, name: string): HTMLElement {
  const part = document.createElement("span");
  part.className = "level-amount";
  const number = document.createElement("b");
  number.textContent = text;
  const picture = document.createElement("img");
  picture.src = icon;
  picture.alt = name;
  part.append(number, picture);
  return part;
}
