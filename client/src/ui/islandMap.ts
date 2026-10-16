// The Quests window as the Flash client draws it (CLIENT.md, "Quests"): the
// sea map, seven painted pages side by side, with each island's ribbon on
// it: its name, the stars won, a padlock while it's out of reach, and Enter
// Now once it can be sailed to. Here it scrolls sideways a page at a time,
// in the panel on the right (a sheet on phones).

import type { ItemInfo } from "../rules/config.ts";
import { MIN_LEVEL_QUESTS, islandLock, playedHere, type Island } from "../rules/quest.ts";
import { Panel } from "./panel.ts";

/** The map's pages: the game's own pictures, 723 x 562 each. */
const PAGE_W = 723;
const PAGE_H = 562;
const PAGES = 7;
/** A page is never drawn narrower than this, so the islands' names stay readable; narrower screens scroll within it. */
const NARROWEST_PAGE = 560;

/** Where each island's ribbon is on the map, in the order of ISLE_ORDER (the Flash client's own places). */
const PLACES: [number, number][] = [
  [132, 203], [550, 246], [130, 400], [370, 545], [620, 435], [PAGE_W + 170, 530], [PAGE_W + 330, 318],
  [PAGE_W + 588, 214], [PAGE_W + 580, 507], [2 * PAGE_W + 280, 540], [2 * PAGE_W + 140, 270], [2 * PAGE_W + 600, 260],
  [2 * PAGE_W + 450, 415], [2 * PAGE_W + 620, 543], [2412, 541], [2779, 534], [2519, 320], [2771, 232], [3044, 250],
  [3500, 250], [3030, 500], [3250, 540], [3510, 490], [5 * PAGE_W + 155, 515], [5 * PAGE_W + 340, 308],
  [6 * PAGE_W + 158, 265], [6 * PAGE_W + 560, 260], [6 * PAGE_W + 285, 508],
];

const ART = {
  ribbon: new URL("./art/island-ribbon.webp", import.meta.url).href,
  lock: new URL("./art/island-lock.webp", import.meta.url).href,
  enter: new URL("./art/island-enter.webp", import.meta.url).href,
  stars: [0, 1, 2, 3].map((n) => new URL(`./art/island-stars-${n}.webp`, import.meta.url).href),
  next: new URL("./art/map-next.webp", import.meta.url).href,
  prev: new URL("./art/map-prev.webp", import.meta.url).href,
};

export interface IslandMapParts {
  islands: Island[];
  items: Map<number, ItemInfo>;
  unlockedIndex: () => number;
  stars: () => Record<string, number>;
  lastAttacked: () => Record<string, number>;
  level: () => number;
  armySize: () => number;
  clock: () => number;
  /** Where the map's pages are (assets' images_new/). */
  pageUrl: (page: number) => string;
  /** Told each time it opens, and how: from the menus, a harbour's or zeppelin's button, or back from an island (the goals count these). */
  opened?: (how: "menu" | "dock" | "back") => void;
  questUrl: (quest: number) => string;
  classicUrl: string;
}

export class IslandsWindow {
  private readonly panel = new Panel("quests", "Quests", { className: "islands" });
  private readonly parts: IslandMapParts;
  private readonly note = document.createElement("p");
  private readonly sea = document.createElement("div");
  private readonly strip = document.createElement("div");
  private readonly said = document.createElement("p");

  constructor(parts: IslandMapParts) {
    this.parts = parts;
    this.note.className = "rows-note";
    this.sea.className = "island-sea";
    this.strip.className = "island-strip";
    this.said.className = "island-said";
    this.said.setAttribute("role", "status");
    for (let page = 0; page < PAGES; page++) {
      const picture = document.createElement("img");
      picture.className = "island-page";
      picture.src = parts.pageUrl(page + 1);
      picture.alt = "";
      picture.draggable = false;
      picture.style.left = `${(page * 100) / PAGES}%`;
      picture.decoding = "async";
      this.strip.append(picture);
    }
    this.sea.append(this.strip);
    const arrows = document.createElement("div");
    arrows.className = "island-arrows";
    for (const [art, label, way] of [[ART.prev, "Previous page", -1], [ART.next, "Next page", 1]] as const) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `island-arrow ${way < 0 ? "prev" : "next"}`;
      button.setAttribute("aria-label", label);
      const image = document.createElement("img");
      image.src = art;
      image.alt = "";
      button.append(image);
      button.addEventListener("click", () => this.sea.scrollBy({ left: way * this.sea.clientWidth, behavior: "smooth" }));
      arrows.append(button);
    }
    const holder = document.createElement("div");
    holder.className = "island-holder";
    holder.append(this.sea, arrows);
    this.panel.body.append(this.note, holder, this.said);
    window.addEventListener("resize", () => this.size());
  }

  /** A page as wide as the window's room for it, but never narrower than NARROWEST_PAGE. */
  private size(): void {
    const room = this.panel.body.clientWidth;
    if (room > 0) {
      this.sea.style.setProperty("--page", `${Math.max(room, NARROWEST_PAGE)}px`);
    }
  }

  toggle(): void {
    this.fill();
    this.panel.toggle();
    if (this.panel.isOpen) {
      this.parts.opened?.("menu");
    }
    this.showFurthest();
  }

  /** Open it; `page` (from 1) shows that page of the map, as the harbour (1) and the zeppelin tower (3) do. */
  open(page?: number, how: "menu" | "dock" | "back" = page === undefined ? "menu" : "dock"): void {
    this.fill();
    this.panel.open();
    this.parts.opened?.(how);
    if (page === undefined) {
      this.showFurthest();
      return;
    }
    requestAnimationFrame(() => {
      this.size();
      const width = Number.parseFloat(this.sea.style.getPropertyValue("--page")) || NARROWEST_PAGE;
      this.sea.scrollLeft = (Math.min(Math.max(page, 1), PAGES) - 1) * width;
    });
  }

  /** Sized to the window, and scrolled to the furthest island open. */
  private showFurthest(): void {
    const index = Math.min(this.parts.unlockedIndex(), PLACES.length - 1);
    requestAnimationFrame(() => {
      this.size();
      const page = Number.parseFloat(this.sea.style.getPropertyValue("--page")) || NARROWEST_PAGE;
      // The island in the middle of the view.
      this.sea.scrollLeft = (PLACES[index][0] / PAGE_W) * page - this.sea.clientWidth / 2;
    });
  }

  private fill(): void {
    const p = this.parts;
    const level = p.level();
    const army = p.armySize();
    this.note.textContent = level < MIN_LEVEL_QUESTS ? `Quests open at level ${MIN_LEVEL_QUESTS}.`
      : army === 0 ? "You need an army to sail: train some units first."
        : `Your whole army sails: ${army} unit${army === 1 ? "" : "s"}. Units that fall may not all come home.`;
    this.said.textContent = "";
    const stars = p.stars();
    const attacked = p.lastAttacked();
    const now = p.clock();
    this.strip.querySelectorAll(".island-button").forEach((button) => button.remove());
    p.islands.forEach((island, index) => {
      const place = PLACES[index];
      if (!place) {
        return;
      }
      const name = p.items.get(island.item)?.name ?? `Island ${index + 1}`;
      const lock = islandLock(island, index, p.unlockedIndex(), level, attacked[island.quest], now);
      const reachable = lock.open || Boolean(lock.until);
      const ready = lock.open && level >= MIN_LEVEL_QUESTS && army > 0;
      const here = playedHere(island);

      const button = document.createElement("a");
      button.className = `island-button${reachable ? "" : " locked"}`;
      // Placed by the island's point on the map, as a share of the whole strip.
      button.style.left = `${(place[0] / (PAGE_W * PAGES)) * 100}%`;
      button.style.top = `${(place[1] / PAGE_H) * 100}%`;
      const ribbon = document.createElement("span");
      ribbon.className = "island-name";
      ribbon.textContent = name;
      button.append(ribbon);
      if (!reachable) {
        button.append(picture("island-lock", ART.lock));
      } else {
        button.append(picture("island-stars", ART.stars[Math.min(3, Number(stars[island.quest] ?? 0))], `${stars[island.quest] ?? 0} of 3 stars`));
      }
      if (ready && here) {
        button.href = p.questUrl(island.quest);
        button.append(picture("island-enter", ART.enter, "Enter now"));
        button.setAttribute("aria-label", `${name}: sail`);
      } else {
        button.href = "#";
        const why = !reachable ? `${lock.why}.`
          : lock.until ? `Your army rests from its attack on ${name} for ${restingFor(lock.until - now)}.`
            : !here ? `${name} is not available yet.`
              : level < MIN_LEVEL_QUESTS ? `Quests open at level ${MIN_LEVEL_QUESTS}.` : "You need an army to sail.";
        button.setAttribute("aria-label", `${name}: ${why}`);
        button.title = why;
        button.addEventListener("click", (e) => {
          e.preventDefault();
          this.say(why);
        });
      }
      this.strip.append(button);
    });
  }

  private say(text: string): void {
    this.said.replaceChildren(text);
  }

}

function picture(className: string, src: string, alt = ""): HTMLImageElement {
  const image = document.createElement("img");
  image.className = className;
  image.src = src;
  image.alt = alt;
  image.draggable = false;
  return image;
}

/** "3 h 20 min", "12 min". */
function restingFor(seconds: number): string {
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  const hours = Math.floor(minutes / 60);
  return hours ? `${hours} h ${minutes % 60} min` : `${minutes} min`;
}
