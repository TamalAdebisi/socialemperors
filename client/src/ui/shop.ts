// The shop window, in HTML over the map (CLIENT.md: windows in HTML): the
// categories and their tabs, and a card for each building with its picture,
// price and experience, and what stops buying it. Choosing one closes the
// window; the editor then places it. What's sold is up to rules/shop.ts.

import type { ItemInfo } from "../rules/config.ts";
import { describe, priceOf, type Obstacle, type ShopCategory } from "../rules/shop.ts";

const numbers = new Intl.NumberFormat();

export interface ShopWindowParts {
  categories: ShopCategory[];
  /** What a category (and tab: 0 for all) shows. */
  items: (category: number, tab: number) => ItemInfo[];
  /** What stops buying an item now, or null. */
  obstacle: (item: ItemInfo) => Obstacle | null;
  /** Draw an item's picture on a canvas. */
  picture: (item: ItemInfo, canvas: HTMLCanvasElement) => Promise<void>;
  /** The player chose to buy this. */
  choose: (item: ItemInfo) => void;
}

export class ShopWindow {
  private readonly parts: ShopWindowParts;
  private readonly panel: HTMLElement;
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
    this.panel.setAttribute("aria-label", "Shop");
    this.panel.innerHTML = `
      <header class="shop-head">
        <h2>Shop</h2>
        <button class="hud-button" type="button" aria-label="Close" title="Close">✕</button>
      </header>
      <nav class="shop-categories" aria-label="Categories"></nav>
      <nav class="shop-tabs" aria-label="Kinds"></nav>
      <ul class="shop-items"></ul>`;
    this.categoryBar = this.panel.querySelector(".shop-categories")!;
    this.tabBar = this.panel.querySelector(".shop-tabs")!;
    this.list = this.panel.querySelector(".shop-items")!;
    this.panel.querySelector(".shop-head button")!.addEventListener("click", () => this.close());
    // Escape closes the shop, wherever the focus is; nothing else hears it then.
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
          void this.parts.picture(item, entry.target as HTMLCanvasElement);
        }
      }
    }, { root: this.list, rootMargin: "200px" });
    document.body.appendChild(this.panel);
  }

  get isOpen(): boolean {
    return !this.panel.hidden;
  }

  open(): void {
    this.render();
    this.panel.hidden = false;
    this.panel.querySelector<HTMLButtonElement>(".shop-categories [aria-pressed=true]")?.focus();
  }

  close(): void {
    this.panel.hidden = true;
  }

  private show(category: number, tab: number, focus: "categories" | "tabs"): void {
    this.category = category;
    this.tab = tab;
    this.render();
    // The buttons were made again: keep the keyboard where it was.
    this.panel.querySelector<HTMLButtonElement>(`.shop-${focus} [aria-pressed=true]`)?.focus();
  }

  private render(): void {
    const current = this.parts.categories.find((c) => c.id === this.category);
    this.categoryBar.replaceChildren(...this.parts.categories.map((c) =>
      this.toggle(c.name, c.id === this.category, () => this.show(c.id, 0, "categories"))));
    const tabs = current && current.tabs.length > 1 ? [{ id: 0, name: "All" }, ...current.tabs] : [];
    this.tabBar.replaceChildren(...tabs.map((t) => this.toggle(t.name, t.id === this.tab, () => this.show(this.category, t.id, "tabs"))));
    this.tabBar.hidden = tabs.length === 0;

    this.waiting.clear();
    this.pictures.disconnect();
    const items = this.parts.items(this.category, this.tab);
    this.list.replaceChildren(...items.map((item) => this.card(item)));
    if (items.length === 0) {
      const empty = document.createElement("li");
      empty.className = "shop-empty";
      empty.textContent = "Nothing here for you yet.";
      this.list.append(empty);
    }
    this.list.scrollTop = 0;
  }

  private toggle(label: string, pressed: boolean, run: () => void): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "shop-toggle";
    button.textContent = label;
    button.setAttribute("aria-pressed", String(pressed));
    button.addEventListener("click", run);
    return button;
  }

  private card(item: ItemInfo): HTMLLIElement {
    const li = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "shop-card";
    const canvas = document.createElement("canvas");
    canvas.className = "shop-picture";
    canvas.setAttribute("aria-hidden", "true");
    const name = document.createElement("span");
    name.className = "shop-name";
    name.textContent = item.name;
    const price = priceOf(item);
    const cost = document.createElement("span");
    cost.className = "shop-price";
    cost.innerHTML = `<span class="dot ${price.resource}"></span>`;
    cost.append(numbers.format(price.amount));
    cost.title = `${numbers.format(price.amount)} ${price.resource}`;
    button.append(canvas, name, cost);
    if (item.xp > 0) {
      const xp = document.createElement("span");
      xp.className = "shop-xp";
      xp.textContent = `+${numbers.format(item.xp)} XP`;
      button.append(xp);
    }
    const blocked = this.parts.obstacle(item);
    if (blocked) {
      const note = document.createElement("span");
      note.className = `shop-note ${blocked.kind}`;
      note.textContent = describe(blocked);
      button.append(note);
      button.disabled = true;
    } else {
      button.addEventListener("click", () => {
        this.close();
        this.parts.choose(item);
      });
    }
    li.append(button);
    this.waiting.set(canvas, item);
    this.pictures.observe(canvas);
    return li;
  }
}
