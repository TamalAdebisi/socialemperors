// The world map (CLIENT.md, "Attacking players"), as the Flash client's
// explorations window: a continent of eight islands on the game's own
// picture, the player's town on one and seven rival players on the others
// (the server picks them, worlds.py). An island's menu offers Profile and
// Attack (or says why not); the bar has the attacks left, Battle Results,
// Options, the continent to look at with its arrows and GO!, My World and
// Relocate. Beating all seven moves the town to the next continent, with a
// prize. The ship and the zeppelin open the quests' map. The rules are in
// rules/world.ts; the art and its places come from tools/art/export_world.py.

import {
  FIRST_CONTINENT, LAST_CONTINENT, RIVALS, beatenIslands, islandChoice, islandPicture, moveOffBeaten, pictureOf, prizeFor, statueOf,
  type Continent, type Island, type Prize,
} from "../rules/world.ts";
import { iconImage } from "./icons.ts";
import { Panel } from "./panel.ts";
import places from "./art/world/places.json" with { type: "json" };

const art = (name: string) => new URL(`./art/world/${name}.webp`, import.meta.url).href;

/** The game's words (localization_strings). */
const WORDS = {
  moreAttacksIn: 104, loading: 886, progress: 1117, noAttacks: 1118, attacks: 1119, select: 1121,
  kingOfWorldText: 1122, nextIslandText: 1123, kingOfWorld: 1128, kingOfIsland: 1129, waiting: 1130,
  relocateConfirm: 1319, relocate: 1320, eagles: 1120,
} as const;

/** What the island menu says when there's no attacking. */
const WHY_NOT: Record<string, string> = {
  "yourself": "This is your empire.",
  "attacked-lately": "Already attacked: wait 4 hours to attack this player again.",
  "no-army": "You need an army to attack.",
  "no-attacks": "No attacks left for now.",
};

export interface PlayerProfile {
  name?: string;
  level?: number;
  honor_points?: number;
  attacks_won?: number;
  attacks_lost?: number;
  last_logged_in?: number;
}

export interface WorldMapParts {
  /** The player's id. */
  me: string;
  /** The server's answer for the town's continent, or another to look at. */
  continent: (options: { continent?: number; relocate?: boolean; moveOn?: boolean }) => Promise<Continent>;
  /** The islands beaten on the town's continent, as the town keeps them (live). */
  beaten: () => unknown;
  /** Relocating: the islands beaten here are lost. */
  clearBeaten: () => void;
  attacksLeft: () => { left: number; wait: number };
  /** Players attacked in the last 4 hours. */
  lately: () => Set<string>;
  armySize: () => number;
  level: () => number;
  words: (id: number) => string;
  /** The continent pictures (images_new/mapa1-5.jpg). */
  pictureUrl: (n: number) => string;
  attackUrl: (island: Island) => string;
  /** Spying: where Spy goes, whether the town has its Eagles built, and the visits left. */
  spyUrl: (island: Island) => string;
  eagles: () => boolean;
  spyingsLeft: () => { left: number; wait: number };
  profile: (pid: string) => Promise<PlayerProfile | null>;
  results: () => void;
  options: () => void;
  /** The ship and the zeppelin: the quests' map at its first page, or its third. */
  sail: (page: number) => void;
  send: (cmd: string, ...args: unknown[]) => void;
  /** The prize window owed (privateState.worldChange), and its being shown. */
  prizeOwed: () => boolean;
  prizeShown: () => void;
  prizes: unknown;
  /** The prize claimed: its cash and units given here (the server gives its own). */
  claim: (continent: number, prize: Prize) => void;
  thumbnail: (id: number) => string;
  itemName: (id: number) => string;
  /** The zeppelin shows from this level (the Zeppelin Tower's). */
  zeppelinLevel: number;
}

interface Placed {
  x: number;
  y: number;
}

/** Puts a picture at its place on the map: its point (a share of its size) on the place, in % of the map. */
function put(element: HTMLElement, name: string, at: Placed): void {
  const anchor = (places.anchors as Record<string, { x: number; y: number; w: number; h: number }>)[name];
  const { w: W, h: H } = places.picture;
  element.style.left = `${((at.x - anchor.x * anchor.w) / W) * 100}%`;
  element.style.top = `${((at.y - anchor.y * anchor.h) / H) * 100}%`;
  element.style.width = `${(anchor.w / W) * 100}%`;
}

function picture(name: string, className: string): HTMLImageElement {
  const image = new Image();
  image.className = className;
  image.alt = "";
  image.draggable = false;
  image.src = art(name);
  return image;
}

function button(className: string, label: string, content: string | HTMLElement, run: () => void): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.className = className;
  b.setAttribute("aria-label", label);
  b.title = label;
  b.append(content);
  b.addEventListener("click", run);
  return b;
}

export class WorldMapWindow {
  private readonly panel = new Panel("world-map", "World Map", { className: "world-window" });
  private readonly parts: WorldMapParts;
  private readonly bar = document.createElement("div");
  private readonly map = document.createElement("div");
  private readonly footer = document.createElement("div");
  private readonly menu = document.createElement("div");
  private readonly number = document.createElement("input");
  /** The town's own continent, once known, and the one shown. */
  private home = 0;
  private shown = 0;
  private loading = false;

  constructor(parts: WorldMapParts) {
    this.parts = parts;
    this.bar.className = "world-bar";
    this.map.className = "world-map";
    this.footer.className = "world-footer";
    this.menu.className = "world-menu";
    this.menu.hidden = true;
    this.number.type = "number";
    this.number.min = String(FIRST_CONTINENT);
    this.number.max = String(LAST_CONTINENT);
    this.number.className = "world-number";
    this.number.setAttribute("aria-label", "Continent");
    this.number.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        this.go(Number(this.number.value));
      }
    });
    this.map.addEventListener("click", (e) => {
      if (e.target === this.map) {
        this.menu.hidden = true;
      }
    });
    this.panel.body.append(this.bar, this.map, this.footer);
  }

  toggle(): void {
    if (this.panel.isOpen) {
      this.panel.toggle();
      return;
    }
    this.open();
  }

  /** Open on the town's continent, or `continent` (back from spying there, as the Flash client comes back). */
  open(continent?: number): void {
    if (!this.panel.isOpen) {
      this.panel.toggle();
    }
    void this.load(continent);
  }

  private word(id: number): string {
    return this.parts.words(id);
  }

  /** A continent: the town's own (undefined), or another to look at. */
  private async load(continent: number | undefined, relocate = false): Promise<void> {
    if (this.loading) {
      return;
    }
    this.loading = true;
    this.menu.hidden = true;
    this.map.classList.add("loading");
    this.map.dataset.loading = this.word(WORDS.loading);
    const owed = this.parts.prizeOwed();
    try {
      const answer = await this.parts.continent({ continent, relocate, moveOn: owed });
      const islands = answer.continent ?? [];
      const nivel = Number(islands[0]?.nivel) || this.home || FIRST_CONTINENT;
      if (continent === undefined || islands.some((i) => i.user_id === this.parts.me)) {
        this.home = nivel;
        // The player's own island beaten: it changes places with one that isn't, as in the Flash client.
        const moved = moveOffBeaten(islands, this.parts.me, beatenIslands(this.parts.beaten()));
        if (moved) {
          this.parts.send("modify_position_univers", ...moved);
        }
      }
      this.shown = nivel;
      this.draw(islands);
      if (owed && continent === undefined) {
        this.parts.send("reset_world_change");
        this.parts.prizeShown();
        this.prizeWindow(nivel);
      }
    } catch (error) {
      this.map.dataset.loading = `The map didn't load: ${String(error)}`;
      return;
    } finally {
      this.loading = false;
    }
    this.map.classList.remove("loading");
  }

  private go(continent: number): void {
    const n = Math.min(Math.max(Math.round(continent) || FIRST_CONTINENT, FIRST_CONTINENT), LAST_CONTINENT);
    void this.load(n === this.home ? undefined : n);
  }

  private draw(islands: Island[]): void {
    const atHome = this.shown === this.home;
    const beaten = atHome ? beatenIslands(this.parts.beaten()) : [];
    const m = pictureOf(this.shown);
    const spot = places.maps[m - 1];
    this.panel.title = `World Map · Continent ${this.shown}`;
    this.number.value = String(this.shown);

    // The bar: attacks left, the windows, the continent to look at, home, Relocate.
    const count = this.parts.attacksLeft();
    const attacks = document.createElement("span");
    attacks.className = "world-attacks";
    if (count.left > 0) {
      attacks.textContent = `${this.word(WORDS.attacks)} ${count.left}`;
    } else {
      const h = Math.floor(count.wait / 3600);
      const min = Math.ceil((count.wait % 3600) / 60);
      attacks.textContent = `${this.word(WORDS.noAttacks)}${count.wait > 0 ? ` · ${this.word(WORDS.moreAttacksIn)} ${h ? `${h} h ` : ""}${min} min` : ""}`;
      attacks.classList.add("none");
    }
    const eagles = document.createElement("span");
    eagles.className = "world-attacks";
    eagles.textContent = `${this.word(WORDS.eagles)} ${this.parts.spyingsLeft().left}`;
    eagles.hidden = !this.parts.eagles();
    const results = button("world-art results", "Battle Results", picture("results", ""), () => this.parts.results());
    const options = button("world-art options", "Options: your army and defence", picture("options", ""), () => this.parts.options());
    const pick = document.createElement("div");
    pick.className = "world-pick";
    const label = document.createElement("span");
    label.textContent = this.word(WORDS.select);
    const prev = button("world-art prev", "Previous continent", picture("prev", ""), () => this.go(this.shown - 1));
    prev.disabled = this.shown <= FIRST_CONTINENT;
    const next = button("world-art next", "Next continent", picture("prev", "flip"), () => this.go(this.shown + 1));
    next.disabled = this.shown >= LAST_CONTINENT;
    const go = button("world-art go", "Go to that continent", picture("go", ""), () => this.go(Number(this.number.value)));
    pick.append(label, prev, this.number, next, go);
    const home = button("world-art my-world", "My World: back to your continent", picture("my-world", ""), () => void this.load(undefined));
    home.hidden = atHome;
    this.bar.replaceChildren(attacks, eagles, results, options, pick, home);

    // The map: the continent's picture, its borders and the islands beaten (on the town's own), the islands.
    const parts: HTMLElement[] = [];
    const backdrop = new Image();
    backdrop.className = "world-picture";
    backdrop.alt = "";
    backdrop.draggable = false;
    backdrop.src = this.parts.pictureUrl(m);
    parts.push(backdrop);
    if (atHome) {
      islands.forEach((island, i) => {
        if (i < spot.tints.length && (beaten.includes(Number(island.posicion)) || island.user_id === this.parts.me)) {
          const tint = document.createElement("span");
          tint.className = "world-tint";
          tint.style.setProperty("--mask", `url("${art(`tint-${m}${i + 1}`)}")`);
          put(tint, `tint-${m}${i + 1}`, spot.tints[i]);
          tint.style.aspectRatio = String((places.anchors as Record<string, { w: number; h: number }>)[`tint-${m}${i + 1}`].w
            / (places.anchors as Record<string, { w: number; h: number }>)[`tint-${m}${i + 1}`].h);
          parts.push(tint);
        }
      });
      const lines = picture(`lines-${m}`, "world-piece");
      put(lines, `lines-${m}`, spot.lines);
      parts.push(lines);
    }
    const statue = picture(`statue-${statueOf(this.shown)}`, "world-piece");
    put(statue, `statue-${statueOf(this.shown)}`, spot.statue);
    parts.push(statue);
    const ship = button("world-piece world-ship", "Let's sail! The quests' islands", picture("ship", ""), () => this.parts.sail(1));
    put(ship, "ship", spot.ship);
    parts.push(ship);
    if (this.parts.level() >= this.parts.zeppelinLevel) {
      const zeppelin = button("world-piece world-ship", "Let's fly! The quests' islands", picture("zeppelin", ""), () => this.parts.sail(3));
      put(zeppelin, "zeppelin", spot.zeppelin);
      parts.push(zeppelin);
    }
    islands.slice(0, spot.islands.length).forEach((island, i) => {
      const isBeaten = beaten.includes(Number(island.posicion));
      const name = island.name ?? "Emperor";
      const frame = islandPicture(island, isBeaten);
      const b = button(`world-piece world-island${island.user_id === this.parts.me ? " mine" : ""}`,
        `${name}, level ${island.level ?? 1}${isBeaten ? ", beaten" : ""}`, picture(`island-${frame}`, ""), () => this.islandMenu(island, b));
      put(b, `island-${frame}`, spot.islands[i]);
      const tag = document.createElement("span");
      tag.className = "world-name";
      tag.textContent = `${name} · ${island.level ?? 1}`;
      b.append(tag);
      b.dataset.island = String(island.posicion);
      parts.push(b);
    });
    parts.push(this.menu);
    this.map.replaceChildren(...parts);

    // Below: the progress on the town's continent, Relocate, or waiting for more players.
    const footer: HTMLElement[] = [];
    if (atHome) {
      const won = Math.min(new Set(beaten).size, RIVALS);
      const progress = document.createElement("div");
      progress.className = "world-progress";
      progress.setAttribute("role", "progressbar");
      progress.setAttribute("aria-valuemin", "0");
      progress.setAttribute("aria-valuemax", String(RIVALS));
      progress.setAttribute("aria-valuenow", String(won));
      progress.setAttribute("aria-label", this.word(WORDS.progress));
      const fill = document.createElement("span");
      fill.style.width = `${(won / RIVALS) * 100}%`;
      const text = document.createElement("strong");
      text.textContent = `${this.word(WORDS.progress)}: ${won}/${RIVALS}`;
      progress.append(fill, text);
      footer.push(progress);
      const relocate = button("button small plain world-relocate", this.word(WORDS.relocate), this.word(WORDS.relocate), () => this.relocate());
      footer.push(relocate);
      if (islands.length < spot.islands.length && won >= islands.length - 1) {
        const waiting = document.createElement("p");
        waiting.className = "rows-note";
        waiting.textContent = this.word(WORDS.waiting);
        footer.push(waiting);
      }
    }
    this.footer.replaceChildren(...footer);
  }

  /** The menu over an island: its owner and level, Profile, and Attack or why not. */
  private islandMenu(island: Island, anchor: HTMLElement): void {
    const name = island.name ?? "Emperor";
    const title = document.createElement("strong");
    title.textContent = name;
    const level = document.createElement("span");
    level.className = "world-menu-level";
    level.append(iconImage("xp"), String(island.level ?? 1));
    const items: HTMLElement[] = [title, level];
    const profile = button("world-art profile", `Profile of ${name}`, picture("profile", ""), () => void this.profile(island));
    items.push(profile);
    // Spy, as the Flash client offers it: with the Eagles built and visits left, on anyone but the player.
    if (island.user_id !== this.parts.me) {
      if (this.parts.eagles() && this.parts.spyingsLeft().left > 0) {
        const spy = document.createElement("a");
        spy.className = "world-art spy";
        spy.href = this.parts.spyUrl(island);
        spy.setAttribute("aria-label", `Spy on ${name}`);
        spy.append(picture("spy", ""));
        items.push(spy);
      } else {
        const why = document.createElement("p");
        why.className = "world-why";
        why.textContent = this.parts.eagles() ? "No eagles left for now." : "Build Eagles to spy.";
        items.push(why);
      }
    }
    const choice = islandChoice(island, this.parts.me, this.parts.lately(), this.parts.armySize(), this.parts.attacksLeft().left);
    if (choice === "attack") {
      const attack = document.createElement("a");
      attack.className = "world-art attack";
      attack.href = this.parts.attackUrl(island);
      attack.setAttribute("aria-label", `Attack ${name}`);
      attack.append(picture("attack", ""));
      items.push(attack);
    } else {
      const why = document.createElement("p");
      why.className = "world-why";
      why.textContent = WHY_NOT[choice];
      items.push(why);
    }
    this.menu.replaceChildren(...items);
    this.menu.style.left = anchor.style.left;
    this.menu.style.top = anchor.style.top;
    this.menu.classList.toggle("right", Number.parseFloat(anchor.style.left) > 55);
    this.menu.hidden = false;
  }

  private async profile(island: Island): Promise<void> {
    const shown = await this.parts.profile(island.user_id);
    const box = document.createElement("div");
    box.className = "world-profile";
    const title = document.createElement("strong");
    title.textContent = shown?.name ?? island.name ?? "Emperor";
    const lines = shown ? [
      `Level ${shown.level ?? island.level ?? 1}`,
      `Honour: ${shown.honor_points ?? 0}`,
      `Attacks won: ${shown.attacks_won ?? 0} · lost: ${shown.attacks_lost ?? 0}`,
      ...(shown.last_logged_in ? [`Last seen: ${new Date(shown.last_logged_in * 1000).toLocaleDateString()}`] : []),
    ] : ["No profile for this empire."];
    box.append(title, ...lines.map((text) => {
      const p = document.createElement("p");
      p.textContent = text;
      return p;
    }));
    box.append(button("button small plain", "Close the profile", "OK", () => {
      this.menu.hidden = true;
    }));
    this.menu.replaceChildren(box);
  }

  private relocate(): void {
    if (!confirm(this.word(WORDS.relocateConfirm))) {
      return;
    }
    this.parts.send("reset_position_univers");
    this.parts.clearBeaten();
    void this.load(undefined, true);
  }

  /** The town reached a new continent: its prize, given on OK (apply_rewards_ranking), as in the Flash client. */
  private prizeWindow(continent: number): void {
    const prize = prizeFor(this.parts.prizes, continent);
    if (!prize) {
      return;
    }
    const box = document.createElement("div");
    box.className = "world-prize";
    box.setAttribute("role", "dialog");
    const title = document.createElement("strong");
    title.textContent = this.word(continent === FIRST_CONTINENT ? WORDS.kingOfWorld : WORDS.kingOfIsland);
    const text = document.createElement("p");
    text.textContent = this.word(continent === FIRST_CONTINENT ? WORDS.kingOfWorldText : WORDS.nextIslandText);
    const gifts = document.createElement("p");
    gifts.className = "quest-earned";
    gifts.append(iconImage("cash"), String(prize.cash));
    for (const [id, n] of prize.units.slice(0, 2)) {
      const thumb = new Image();
      thumb.className = "world-prize-unit";
      thumb.src = this.parts.thumbnail(id);
      thumb.alt = this.parts.itemName(id);
      gifts.append(thumb, `×${n}`);
    }
    const ok = button("button gold", "OK: take the prize", "OK", () => {
      this.parts.claim(continent, prize);
      this.parts.send("apply_rewards_ranking", continent, prize.cash, JSON.stringify(Object.fromEntries(prize.units)));
      box.remove();
    });
    box.append(title, text, gifts, ok);
    this.panel.body.append(box);
  }
}
