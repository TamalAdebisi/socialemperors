// The Survival window (CLIENT.md, "Survival"), as the Flash client's: the
// lives (three hearts, the next one's countdown, Buy life), the five arenas
// with their pictures, the best time and the units won for holding out (the
// last three "Coming soon", as there), and the help, shown by itself the
// first time. An arena opens the battle (survivalPlay.ts).

import { SURVIVAL, LIVES, type SurvivalMap } from "../rules/survival.ts";
import { ICONS, iconImage } from "./icons.ts";
import { Panel } from "./panel.ts";

/** The game's words (localization_strings). */
const WORDS = {
  title: 1150, help: 1151, best: 1154, next: 1155, surviveAndWin: 1156, available: 1159, soon: 1160, select: 1166, buy: 1167,
  minutes: 1173,
} as const;
const HELP_KEY = "helpSurvival";

export interface SurvivalParts {
  words: (id: number) => string;
  /** The arenas' pictures (images_new/). */
  pictureUrl: (name: string) => string;
  thumbnail: (id: number) => string;
  itemName: (id: number) => string;
  lives: () => { left: number; next: number };
  /** The arenas open to the player, and their best times (privateState.survivalMaps). */
  arenas: () => Record<string, { tp?: number } | undefined>;
  lifePrice: number;
  /** A life bought (add_survival_vida_extra): false when there isn't the cash. */
  buyLife: () => boolean;
  play: (quest: number) => void;
  /** The help seen before (privateState.helpMap), and seen now (set_help_map). */
  helpSeen: () => boolean;
  sawHelp: () => void;
}

function clock(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}

export class SurvivalWindow {
  private readonly panel = new Panel("survival", "Survival", { className: "list-window survival-window" });
  private readonly parts: SurvivalParts;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(parts: SurvivalParts) {
    this.parts = parts;
  }

  toggle(): void {
    if (this.panel.isOpen) {
      this.panel.toggle();
      return;
    }
    this.open();
  }

  open(): void {
    this.render();
    if (!this.panel.isOpen) {
      this.panel.toggle();
    }
    if (!this.parts.helpSeen()) {
      this.help(true);
      this.parts.sawHelp();
    }
    if (this.timer === null) {
      // The next life's countdown, once a second while the window is open.
      this.timer = setInterval(() => {
        if (!this.panel.isOpen) {
          clearInterval(this.timer!);
          this.timer = null;
          return;
        }
        this.lives();
      }, 1000);
    }
  }

  private word(id: number, value?: string | number): string {
    return this.parts.words(id).replace("#0#", String(value ?? ""));
  }

  private readonly livesRow = document.createElement("div");

  private render(): void {
    this.panel.title = this.word(WORDS.select);
    this.livesRow.className = "survival-lives";
    this.lives();
    const helpButton = document.createElement("button");
    helpButton.type = "button";
    helpButton.className = "button small plain survival-help-button";
    helpButton.textContent = "?";
    helpButton.setAttribute("aria-label", "How survival works");
    helpButton.addEventListener("click", () => this.help(!this.panel.body.querySelector(".survival-help-box")));
    const list = document.createElement("ul");
    list.className = "survival-arenas";
    const open = this.parts.arenas();
    for (const map of SURVIVAL.maps) {
      list.append(this.arena(map, open[String(map.quest)]));
    }
    this.panel.body.replaceChildren(this.livesRow, helpButton, list);
  }

  /** The hearts, the next life's countdown, and Buy life. */
  private lives(): void {
    const { left, next } = this.parts.lives();
    const hearts = document.createElement("span");
    hearts.className = "survival-hearts";
    hearts.setAttribute("aria-label", `${left} ${left === 1 ? "life" : "lives"}`);
    if (left > LIVES) {
      hearts.append(this.heart(true), `×${left}`);
    } else {
      for (let i = 0; i < LIVES; i++) {
        hearts.append(this.heart(i < left));
      }
    }
    const countdown = document.createElement("span");
    countdown.className = "survival-next";
    // As the Flash client: while one of the three is used, bought lives or not.
    countdown.textContent = next > 0 ? this.word(WORDS.next, clock(next)) : "";
    const buy = document.createElement("button");
    buy.type = "button";
    buy.className = "button small gold";
    buy.append(`${this.word(WORDS.buy)} ${this.parts.lifePrice}`, iconImage("cash"));
    buy.addEventListener("click", () => {
      if (this.parts.buyLife()) {
        this.lives();
      }
    });
    this.livesRow.replaceChildren(hearts, countdown, buy);
  }

  private heart(full: boolean): HTMLImageElement {
    const image = new Image();
    image.className = "survival-heart";
    image.alt = "";
    image.src = full ? ICONS["survival-life"] : ICONS["survival-life-used"];
    return image;
  }

  /** An arena's card: its picture, name, best time or Coming soon, and the units won for holding out. */
  private arena(map: SurvivalMap, saved: { tp?: number } | undefined): HTMLLIElement {
    const playable = map.available && saved !== undefined;
    const card = document.createElement("li");
    card.className = `survival-arena${playable ? "" : " locked"}`;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "survival-arena-button";
    const name = this.word(map.name);
    button.setAttribute("aria-label", playable ? `Play ${name}` : `${name}: ${this.word(WORDS.soon)}`);
    button.disabled = !playable || this.parts.lives().left <= 0;
    const picture = new Image();
    picture.className = "survival-arena-picture";
    picture.alt = "";
    picture.src = this.parts.pictureUrl(map.picture);
    button.append(picture);
    if (!playable) {
      const lock = new Image();
      lock.className = "survival-lock";
      lock.alt = "";
      lock.src = ICONS["survival-lock"];
      button.append(lock);
    }
    button.addEventListener("click", () => this.parts.play(map.quest));
    const title = document.createElement("strong");
    title.textContent = name;
    const status = document.createElement("small");
    status.textContent = !map.available ? this.word(WORDS.soon)
      : saved?.tp ? this.word(WORDS.best, clock(saved.tp)) : this.word(WORDS.available);
    const prizes = document.createElement("ul");
    prizes.className = "survival-prizes";
    prizes.setAttribute("aria-label", this.word(WORDS.surviveAndWin));
    for (const [minutes, unit] of map.prizes) {
      const row = document.createElement("li");
      const thumb = new Image();
      thumb.alt = "";
      thumb.src = this.parts.thumbnail(unit);
      thumb.addEventListener("error", () => thumb.classList.add("missing"), { once: true });
      row.append(this.word(WORDS.minutes, minutes), thumb, this.parts.itemName(unit));
      prizes.append(row);
    }
    card.append(button, title, status, prizes);
    return card;
  }

  /** The game's help, over the arenas. */
  private help(show: boolean): void {
    this.panel.body.querySelector(".survival-help-box")?.remove();
    if (!show) {
      return;
    }
    const box = document.createElement("div");
    box.className = "survival-help-box";
    box.setAttribute("role", "note");
    const title = document.createElement("strong");
    title.textContent = this.word(WORDS.title);
    const text = document.createElement("p");
    text.textContent = this.word(WORDS.help);
    const ok = document.createElement("button");
    ok.type = "button";
    ok.className = "button small gold";
    ok.textContent = "OK";
    ok.addEventListener("click", () => box.remove());
    box.append(title, text, ok);
    this.panel.body.prepend(box);
  }
}

export { HELP_KEY };
