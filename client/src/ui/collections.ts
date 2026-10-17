import { CollectionBook, COLLECTION_REWARDS } from "../rules/collectionBook.ts";
import { pieceFrame, pieceLines } from "../rules/collections.ts";
import type { ItemInfo } from "../rules/config.ts";
import type { Command } from "../net/commands.ts";
import type { Town } from "../rules/town.ts";
import { Panel } from "./panel.ts";

interface Parts {
  book: CollectionBook;
  town: Town;
  items: Map<number, ItemInfo>;
  sheet: string;
  words: (id: number, fallback: string) => string;
  thumbnail: (item: ItemInfo) => string;
  send: (command: Command) => void;
  changed: () => void;
  tell: (text: string) => void;
}

export class CollectionsWindow {
  private readonly panel = new Panel("army", "Collections", { className: "collections" });
  private readonly parts: Parts;
  private page = 0;

  constructor(parts: Parts) { this.parts = parts; }

  open(): void { this.render(); this.panel.open(); }
  refresh(): void { if (this.panel.isOpen) this.render(); }

  private render(): void {
    const { book, words } = this.parts;
    this.panel.title = words(694, "Collections");
    const nav = document.createElement("nav");
    nav.className = "shop-tabs";
    nav.setAttribute("aria-label", "Collection pages");
    const previous = this.button("Previous", () => { this.page--; this.render(); });
    previous.disabled = this.page === 0;
    const next = this.button("Next", () => { this.page++; this.render(); });
    next.disabled = this.page === 7;
    const page = document.createElement("span");
    page.textContent = `${this.page + 1} / 8`;
    nav.append(previous, page, next);
    const cards = [];
    for (let id = this.page * 3 + 1; id <= Math.min(23, this.page * 3 + 3); id++) {
      const card = document.createElement("article");
      card.className = "collection-card";
      card.dataset.collection = String(id);
      const reward = this.parts.items.get(COLLECTION_REWARDS[id - 1]);
      const title = document.createElement("h3");
      title.textContent = words(id <= 20 ? 319 + id : [1385, 1384, 1386][id - 21], reward?.name ?? `Collection ${id}`);
      const pieces = document.createElement("ol");
      pieces.className = "collection-pieces";
      for (let piece = 1; piece <= 5; piece++) {
        const count = book.rows[id][piece];
        const cell = document.createElement("li");
        const lines = pieceLines({ collection: id, piece });
        const name = words(lines?.piece ?? 1369 + (id - 21) * 5 + piece - 1, `Piece ${piece}`);
        const picture = document.createElement("span");
        const frame = pieceFrame({ collection: id, piece });
        picture.className = `collection-piece${count ? "" : " missing"}`;
        picture.style.backgroundImage = `url("${this.parts.sheet}")`;
        picture.style.backgroundPosition = `-${frame.x}px -${frame.y}px`;
        picture.setAttribute("role", "img");
        picture.setAttribute("aria-label", name);
        picture.title = name;
        const number = document.createElement("span");
        number.textContent = `×${count}`;
        cell.append(picture, number);
        pieces.append(cell);
      }
      const prize = document.createElement("p");
      if (reward) {
        const image = new Image();
        image.src = this.parts.thumbnail(reward);
        image.alt = "";
        image.className = "collection-reward";
        prize.append(image);
      }
      prize.append(`${words(103, "Reward")}: ${reward?.name ?? COLLECTION_REWARDS[id - 1]}`);
      const exchange = this.button(words(695, "Claim reward"), () => this.finish(id, false));
      exchange.disabled = !book.canExchange(id);
      card.append(title, pieces, prize, exchange);
      if (book.canBuy(id)) {
        const buy = this.button(`${words(696, "Complete for")} ${book.price(id)} cash`, () => this.finish(id, true));
        buy.disabled = this.parts.town.cash < book.price(id);
        card.append(buy);
      }
      if (book.rows[id][0]) {
        const done = document.createElement("p");
        done.textContent = "Completed";
        card.append(done);
      }
      cards.push(card);
    }
    this.panel.body.replaceChildren(nav, ...cards);
  }

  private finish(id: number, cash: boolean): void {
    const { town, items, book } = this.parts;
    const reward = items.get(COLLECTION_REWARDS[id - 1]);
    // The original exchange protects non-decoration rewards already owned.
    if (!cash && reward && reward.subcategory !== 411 &&
      ((town.gifts.get(reward.id) ?? 0) > 0 || town.items.some((p) =>
        p.item.id === reward.id || p.units?.includes(reward.id)))) {
      this.parts.tell("You already have this collection's reward.");
      return;
    }
    const command = book.finish(town, id, cash);
    if (!command) return;
    this.parts.send(command);
    this.parts.changed();
    this.parts.tell(`${reward?.name ?? "Collection reward"} is now in Storage.`);
    this.render();
  }

  private button(label: string, run: () => void): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "button tiny gold";
    button.textContent = label;
    button.addEventListener("click", run);
    return button;
  }
}
