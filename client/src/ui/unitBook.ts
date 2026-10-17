import type { ItemInfo } from "../rules/config.ts";
import { UnitBook, type UnitCategory } from "../rules/unitBook.ts";
import type { Town } from "../rules/town.ts";
import type { Command } from "../net/commands.ts";
import { ICONS } from "./icons.ts";
import { Panel } from "./panel.ts";

interface Parts {
  book: UnitBook;
  town: Town;
  items: Map<number, ItemInfo>;
  words: (id: number, fallback: string) => string;
  thumbnail: (item: ItemInfo) => string;
  preview: (item: ItemInfo, canvas: HTMLCanvasElement, active: () => boolean) => () => void;
  send: (command: Command) => void;
  changed: () => void;
  tell: (text: string) => void;
}

export class UnitsBookWindow {
  private readonly panel = new Panel("army", "Units book", { className: "unit-book" });
  private readonly parts: Parts;
  private page = 0;

  constructor(parts: Parts) { this.parts = parts; }

  open(): void { this.parts.book.observe(this.parts.town); this.render(); this.panel.open(); }

  private render(): void {
    const { book, words } = this.parts;
    const nav = document.createElement("nav");
    nav.className = "shop-tabs";
    nav.setAttribute("aria-label", "Unit categories");
    const previous = this.button("Previous", () => { this.page--; this.render(); });
    previous.disabled = this.page === 0;
    const next = this.button("Next", () => { this.page++; this.render(); });
    next.disabled = (this.page + 1) * 3 >= book.categories.length;
    const count = document.createElement("span");
    count.textContent = `${this.page + 1} / ${Math.ceil(book.categories.length / 3)}`;
    nav.append(previous, count, next);
    const progress = document.createElement("p");
    progress.className = "rows-note";
    const total = book.categories.reduce((sum, c) => sum + c.units.length, 0);
    progress.textContent = `Units obtained: ${book.owned.size} / ${total}`;
    this.panel.body.replaceChildren(nav, progress, ...book.categories.slice(this.page * 3, this.page * 3 + 3)
      .map((category) => this.category(category, words)));
  }

  private category(category: UnitCategory, words: Parts["words"]): HTMLElement {
    const { book, items, town } = this.parts;
    const section = document.createElement("section");
    section.className = "unit-category";
    section.dataset.category = String(category.category_id);
    const title = document.createElement("h3");
    title.textContent = words(category.category_lang_id, `Category ${category.category_id}`);
    const count = document.createElement("p");
    count.textContent = `${category.units.filter((id) => book.owned.has(id)).length} / ${category.units.length}`;
    const list = document.createElement("ul");
    list.className = "unit-book-items";
    for (const id of category.units) {
      const item = items.get(id);
      if (!item) continue;
      const cell = document.createElement("li");
      cell.dataset.unit = String(id);
      const details = document.createElement("details");
      const summary = document.createElement("summary");
      const image = new Image();
      image.alt = "";
      image.src = this.parts.thumbnail(item);
      image.loading = "lazy";
      image.className = book.owned.has(id) ? "" : "missing";
      const name = document.createElement("span");
      name.textContent = item.name;
      const status = document.createElement("small");
      status.textContent = book.owned.has(id) ? "Obtained" : "Missing";
      summary.append(image, name, status);
      const stats = document.createElement("dl");
      stats.className = "unit-book-stats";
      for (const [icon, label, value] of [
        ["stat-life", "Life", item.life], ["stat-attack", "Attack", item.attack],
        ["stat-delay", "Attack delay", item.attackInterval], ["stat-speed", "Speed", item.velocity],
        ["stat-range", "Range", item.attackRange], ["stat-room", "Population", item.population],
      ] as const) {
        const key = document.createElement("dt");
        const picture = new Image(); picture.src = ICONS[icon]; picture.alt = label;
        key.append(picture);
        const number = document.createElement("dd"); number.textContent = String(value);
        stats.append(key, number);
      }
      const preview = document.createElement("canvas");
      preview.className = "unit-book-preview";
      preview.setAttribute("aria-label", `${item.name} animation`);
      let stopPreview = () => {};
      details.addEventListener("toggle", () => {
        stopPreview();
        if (details.open) {
          for (const other of this.panel.body.querySelectorAll<HTMLDetailsElement>("details[open]")) {
            if (other !== details) other.open = false;
          }
          stopPreview = this.parts.preview(item, preview, () => details.open && this.panel.isOpen);
        }
      });
      details.append(summary, preview, stats);
      if (!book.owned.has(id)) {
        const buy = this.button(`Buy for ${book.price(category, id)} cash`, () => {
          const command = book.buy(town, category, id);
          if (!command) return;
          this.parts.send(command); this.parts.changed();
          this.parts.tell(`${item.name} is now in Storage.`);
          this.render();
        });
        buy.disabled = town.cash < book.price(category, id);
        details.append(buy);
      }
      cell.append(details); list.append(cell);
    }
    const prize = document.createElement("p");
    const reward = items.get(category.rewards);
    if (reward) {
      const image = new Image(); image.src = this.parts.thumbnail(reward); image.alt = "";
      image.className = "collection-reward";
      prize.append(image);
    }
    prize.append(`Reward: ${reward?.name ?? category.rewards} and 1 cash`);
    const claim = this.button(book.completed.includes(category.category_id) ? "Completed" : "Claim reward", () => {
      const command = book.claim(town, category);
      if (!command) return;
      this.parts.send(command); this.parts.changed();
      this.parts.tell(`${reward?.name ?? "Your reward"} is now in Storage. You also received 1 cash.`);
      this.render();
    });
    claim.disabled = !book.canClaim(category);
    section.append(title, count, list, prize, claim);
    return section;
  }

  private button(label: string, run: () => void): HTMLButtonElement {
    const button = document.createElement("button"); button.type = "button";
    button.className = "button tiny gold"; button.textContent = label;
    button.addEventListener("click", run);
    return button;
  }
}
