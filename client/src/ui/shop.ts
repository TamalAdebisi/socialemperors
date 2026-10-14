// The shop window, in HTML over the map (CLIENT.md: windows in HTML): the
// categories and their tabs, a card for each building with its picture,
// price and experience, and what stops buying it; and, as in the Flash
// client's build window, the storage, with Place and Sell on each card.
// Choosing to buy or place closes the window; the editor then places it.
// What's sold, and what can be done with what's stored, is up to the rules.

import type { ItemInfo } from "../rules/config.ts";
import { describe, priceOf, type Obstacle, type ShopCategory } from "../rules/shop.ts";
import { resourceIcon } from "./icons.ts";

const numbers = new Intl.NumberFormat();
/** The storage's place among the categories. */
export const STORAGE = -1;

/** A stored thing as the storage shows it. */
export interface StorageCard {
  item: ItemInfo;
  count: number;
  gift: boolean;
  /** Why it can't be placed, or "". */
  note: string;
  place: (() => void) | null;
  /** "Sell for 6 stone", or null when it can't be sold. */
  sell: { label: string; run: () => void } | null;
}

export interface ShopWindowParts {
  categories: ShopCategory[];
  /** What a category (and tab: 0 for all) shows. */
  items: (category: number, tab: number) => ItemInfo[];
  /** What stops buying an item now, or null. */
  obstacle: (item: ItemInfo) => Obstacle | null;
  /** The item's picture in the Flash client's windows (buildingthumbs/<img_name>.jpg). */
  thumbnail: (item: ItemInfo) => string;
  /** For items without one: draw a picture from the map's art instead. */
  picture: (item: ItemInfo, canvas: HTMLCanvasElement) => Promise<void>;
  /** The player chose to buy this. */
  choose: (item: ItemInfo) => void;
  /** What's in storage. */
  storage: () => StorageCard[];
}

export class ShopWindow {
  private readonly parts: ShopWindowParts;
  private readonly panel: HTMLElement;
  private readonly title: HTMLElement;
  private readonly categoryBar: HTMLElement;
  private readonly tabBar: HTMLElement;
  private readonly list: HTMLElement;
  private readonly pictures: IntersectionObserver;
  private readonly waiting = new Map<Element, ItemInfo>();
  private category: number;
  private tab = 0;

  constructor(parts: ShopWindowParts) {
    this.parts = parts;
    this.category = parts.categories[0]?.id ?? 0;
    this.panel = document.createElement("section");
    this.panel.className = "shop";
    this.panel.hidden = true;
    this.panel.setAttribute("role", "dialog");
    this.panel.innerHTML = `
      <header class="shop-head">
        <h2></h2>
        <button class="button tiny plain" type="button" aria-label="Close">✕</button>
      </header>
      <nav class="shop-categories" aria-label="Categories"></nav>
      <nav class="shop-tabs" aria-label="Kinds"></nav>
      <ul class="shop-items"></ul>`;
    this.title = this.panel.querySelector("h2")!;
    this.categoryBar = this.panel.querySelector(".shop-categories")!;
    this.tabBar = this.panel.querySelector(".shop-tabs")!;
    this.list = this.panel.querySelector(".shop-items")!;
    this.panel.querySelector(".shop-head button")!.addEventListener("click", () => this.close());
    // Escape closes the window, wherever the focus is; nothing else hears it then.
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.isOpen) {
        e.stopImmediatePropagation();
        this.close();
      }
    });
    // Pictures load as their cards come into view, not all of a category at once.
    this.pictures = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const item = this.waiting.get(entry.target);
        if (entry.isIntersecting && item) {
          this.waiting.delete(entry.target);
          this.pictures.unobserve(entry.target);
          this.loadPicture(entry.target as HTMLElement, item);
        }
      }
    }, { root: this.list, rootMargin: "200px" });
    document.body.appendChild(this.panel);
  }

  get isOpen(): boolean {
    return !this.panel.hidden;
  }

  /** Open at a category (STORAGE for the storage), or where it was last. */
  open(category = this.category === STORAGE ? this.parts.categories[0]?.id ?? 0 : this.category): void {
    this.category = category;
    this.tab = 0;
    this.render();
    this.panel.hidden = false;
    this.panel.querySelector<HTMLButtonElement>(".shop-categories [aria-pressed=true]")?.focus();
  }

  close(): void {
    this.panel.hidden = true;
  }

  /** Show it again as things are now (after a sale from storage...). */
  refresh(): void {
    if (this.isOpen) {
      const scroll = this.list.scrollTop;
      this.render();
      this.list.scrollTop = scroll;
    }
  }

  private show(category: number, tab: number, focus: "categories" | "tabs"): void {
    this.category = category;
    this.tab = tab;
    this.render();
    this.list.scrollTop = 0;
    // The buttons were made again: keep the keyboard where it was.
    this.panel.querySelector<HTMLButtonElement>(`.shop-${focus} [aria-pressed=true]`)?.focus();
  }

  private render(): void {
    const storing = this.category === STORAGE;
    this.title.textContent = storing ? "Storage" : "Shop";
    this.panel.setAttribute("aria-label", this.title.textContent);
    const stored = this.parts.storage();
    const inStorage = stored.reduce((sum, card) => sum + card.count, 0);
    this.categoryBar.replaceChildren(
      ...this.parts.categories.map((c) => this.toggle(c.name, c.id === this.category, () => this.show(c.id, 0, "categories"))),
      this.toggle(inStorage ? `Storage (${inStorage})` : "Storage", storing, () => this.show(STORAGE, 0, "categories"), "shop-storage"),
    );
    const current = this.parts.categories.find((c) => c.id === this.category);
    const tabs = current && current.tabs.length > 1 ? [{ id: 0, name: "All" }, ...current.tabs] : [];
    this.tabBar.replaceChildren(...tabs.map((t) => this.toggle(t.name, t.id === this.tab, () => this.show(this.category, t.id, "tabs"))));
    this.tabBar.hidden = tabs.length === 0;

    this.waiting.clear();
    this.pictures.disconnect();
    const cards = storing ? stored.map((card) => this.storageCard(card))
      : this.parts.items(this.category, this.tab).map((item) => this.shopCard(item));
    this.list.replaceChildren(...cards);
    if (cards.length === 0) {
      const empty = document.createElement("li");
      empty.className = "shop-empty";
      empty.textContent = storing ? "Nothing in storage. Select a building on the map and choose Store to keep it here."
        : "Nothing here for you yet.";
      this.list.append(empty);
    }
  }

  private toggle(label: string, pressed: boolean, run: () => void, className = ""): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `shop-toggle ${className}`.trim();
    button.textContent = label;
    button.setAttribute("aria-pressed", String(pressed));
    button.addEventListener("click", run);
    return button;
  }

  /** The picture, name and price every card starts with. */
  private cardTop(item: ItemInfo, card: HTMLElement): void {
    const picture = document.createElement("span");
    picture.className = "shop-picture";
    picture.setAttribute("aria-hidden", "true");
    const name = document.createElement("span");
    name.className = "shop-name";
    name.textContent = item.name;
    card.append(picture, name);
    this.waiting.set(picture, item);
    this.pictures.observe(picture);
  }

  /** The Flash client's picture for the item; drawn from the map's art when it has none. */
  private loadPicture(holder: HTMLElement, item: ItemInfo): void {
    const image = new Image();
    image.alt = "";
    image.decoding = "async";
    image.addEventListener("error", () => {
      const canvas = document.createElement("canvas");
      image.replaceWith(canvas);
      holder.classList.add("drawn");
      void this.parts.picture(item, canvas);
    }, { once: true });
    image.src = this.parts.thumbnail(item);
    holder.append(image);
  }

  private shopCard(item: ItemInfo): HTMLLIElement {
    const li = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "shop-card";
    this.cardTop(item, button);
    const price = priceOf(item);
    const cost = document.createElement("span");
    cost.className = "shop-price";
    cost.innerHTML = `<img class="icon" src="${resourceIcon(price.resource)}" alt="">`;
    cost.append(numbers.format(price.amount));
    cost.setAttribute("aria-label", `${numbers.format(price.amount)} ${price.resource}`);
    button.append(cost);
    if (item.xp > 0) {
      const xp = document.createElement("span");
      xp.className = "shop-xp";
      xp.textContent = `+${numbers.format(item.xp)} XP`;
      button.append(xp);
    }
    const blocked = this.parts.obstacle(item);
    if (blocked) {
      button.append(this.note(describe(blocked), blocked.kind));
      button.disabled = true;
    } else {
      button.addEventListener("click", () => {
        this.close();
        this.parts.choose(item);
      });
    }
    li.append(button);
    return li;
  }

  private storageCard(card: StorageCard): HTMLLIElement {
    const li = document.createElement("li");
    const box = document.createElement("div");
    box.className = "shop-card stored";
    this.cardTop(card.item, box);
    const count = document.createElement("span");
    count.className = "shop-count";
    count.textContent = `×${card.count}`;
    count.setAttribute("aria-label", `${card.count} in storage`);
    box.append(count);
    if (card.gift) {
      const gift = document.createElement("span");
      gift.className = "shop-xp";
      gift.textContent = card.item.xp > 0 ? `Gift: +${numbers.format(card.item.xp)} XP` : "Gift";
      box.append(gift);
    }
    if (card.note) {
      box.append(this.note(card.note, "limit"));
    }
    const actions = document.createElement("span");
    actions.className = "shop-actions";
    if (card.place) {
      const place = card.place;
      actions.append(this.action("Place", () => {
        this.close();
        place();
      }));
    }
    if (card.sell) {
      const sell = card.sell;
      // Selling asks first: the button asks again, and a second press sells.
      const button = this.action("Sell", () => {
        if (button.dataset.asking) {
          sell.run();
        } else {
          button.dataset.asking = "yes";
          button.textContent = `${sell.label}?`;
        }
      });
      button.addEventListener("blur", () => {
        delete button.dataset.asking;
        button.textContent = "Sell";
      });
      actions.append(button);
    }
    box.append(actions);
    li.append(box);
    return li;
  }

  private action(label: string, run: () => void): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "button tiny gold";
    button.textContent = label;
    button.addEventListener("click", run);
    return button;
  }

  private note(text: string, kind: string): HTMLSpanElement {
    const note = document.createElement("span");
    note.className = `shop-note ${kind}`;
    note.textContent = text;
    return note;
  }
}
