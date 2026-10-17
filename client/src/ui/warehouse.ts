import "./warehouse.css";

import type { Command } from "../net/commands.ts";
import type { ItemInfo } from "../rules/config.ts";
import type { PlacedItem, Town } from "../rules/town.ts";
import { UNIT_WAREHOUSE, WAREHOUSE_PAGE, buyWarehouseCapacity, deployWarehouse, warehouseCapacity,
  warehouseCards, warehouseCount, type WarehouseRules } from "../rules/warehouse.ts";
import { ICONS, iconImage } from "./icons.ts";
import { Panel } from "./panel.ts";

export interface WarehouseParts {
  town: Town;
  items: Map<number, ItemInfo>;
  rules: WarehouseRules;
  thumbnail: (item: ItemInfo) => string;
  send: (command: Command) => void;
  arrived: (unit: PlacedItem) => void;
  changed: () => void;
  spent: (cash: number) => void;
}

/** The original's eighteen slots per page, laid out in the town's shared
 * panel. The box is shared with walking units, so changes beside the open
 * panel refresh its counters too. */
export class WarehouseWindow {
  private readonly parts: WarehouseParts;
  private readonly panel = new Panel("warehouse", "Unit Warehouse", {
    className: "warehouse-window", onClose: () => this.stopWatching(),
  });
  private building: PlacedItem | null = null;
  private page = 0;
  private said = "";
  private watching: ReturnType<typeof setInterval> | null = null;
  private shown = "";

  constructor(parts: WarehouseParts) { this.parts = parts; }

  buttonFor(building: PlacedItem): { label: string; icon: "open-warehouse"; run: () => void } | null {
    return building.item.id === UNIT_WAREHOUSE
      ? { label: "Open warehouse", icon: "open-warehouse", run: () => this.open(building) } : null;
  }

  open(building: PlacedItem): void {
    this.stopWatching();
    this.building = building;
    this.page = 0;
    this.said = "";
    this.render();
    this.panel.open();
    this.watching = setInterval(() => {
      if (!this.building || !this.parts.town.items.includes(this.building)) {
        this.panel.close();
      } else if (this.signature() !== this.shown) {
        this.render();
      }
    }, 250);
  }

  private stopWatching(): void {
    if (this.watching !== null) clearInterval(this.watching);
    this.watching = null;
  }

  private signature(): string {
    const { town } = this.parts;
    return JSON.stringify([[...town.warehouse ?? []], town.warehouseCapacity, town.cash]);
  }

  private render(): void {
    const { town, items, rules } = this.parts;
    const capacity = warehouseCapacity(town, rules.start);
    const pages = Math.max(1, Math.ceil(capacity / WAREHOUSE_PAGE));
    this.page = Math.min(this.page, pages - 1);
    const total = warehouseCount(town);
    const counts = document.createElement("p");
    counts.className = "warehouse-counts";
    counts.textContent = `Slots used: ${total} · Slots empty: ${Math.max(0, capacity - total)}`;
    const hint = document.createElement("p");
    hint.className = "rows-note";
    hint.textContent = "Click on a unit on your map and click on the warehouse to store it.";
    const status = document.createElement("p");
    status.className = "rows-note warehouse-status";
    status.setAttribute("role", "status");
    status.textContent = this.said;
    const grid = document.createElement("div");
    grid.className = "warehouse-slots";
    const cards = warehouseCards(town, items);
    const start = this.page * WAREHOUSE_PAGE;
    for (let slot = start; slot < Math.min(start + WAREHOUSE_PAGE, capacity); slot++) {
      const item = cards[slot];
      const card = document.createElement("div");
      card.className = `warehouse-slot ${item ? "occupied" : "empty"}`;
      card.style.backgroundImage = `url("${item ? ICONS["warehouse-card"] : ICONS["warehouse-empty"]}")`;
      if (item) {
        card.title = item.name;
        const picture = document.createElement("img");
        picture.src = this.parts.thumbnail(item);
        picture.alt = item.name;
        picture.draggable = false;
        const name = document.createElement("span");
        name.className = "warehouse-name";
        name.textContent = item.name;
        const use = document.createElement("button");
        use.type = "button";
        use.className = "warehouse-use";
        use.style.backgroundImage = `url("${ICONS["warehouse-use"]}")`;
        use.textContent = "USE UNIT";
        use.setAttribute("aria-label", `Use ${item.name}`);
        use.addEventListener("click", () => this.use(item));
        card.append(picture, name, use);
      } else {
        card.setAttribute("aria-label", "Empty slot");
      }
      grid.append(card);
    }
    const navigation = document.createElement("div");
    navigation.className = "warehouse-pages";
    const previous = this.button("Previous page", () => { this.page--; this.render(); });
    previous.disabled = this.page === 0;
    const counter = document.createElement("span");
    counter.className = "warehouse-page";
    counter.textContent = `${this.page + 1} / ${pages}`;
    const next = this.button("Next page", () => { this.page++; this.render(); });
    next.disabled = this.page + 1 >= pages;
    navigation.append(previous, counter, next);
    const buy = document.createElement("div");
    buy.className = "warehouse-buy";
    if (capacity < rules.maximum) {
      const price = document.createElement("span");
      price.append(`Buy 1 more slot for ${rules.price} `, iconImage("cash", "cash"));
      buy.append(price, this.button("Buy now", () => this.buy()));
    }
    this.panel.body.replaceChildren(hint, counts, status, grid, navigation, buy);
    this.shown = this.signature();
  }

  private button(label: string, run: () => void): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "button tiny";
    button.textContent = label;
    button.addEventListener("click", run);
    return button;
  }

  private use(item: ItemInfo): void {
    if (!this.building) return;
    const done = deployWarehouse(this.parts.town, item, this.building, this.parts.items);
    if (typeof done === "string") this.said = done;
    else {
      this.parts.send(done.command);
      this.parts.arrived(done.unit);
      this.parts.changed();
      this.said = `${item.name} is back.`;
    }
    this.render();
  }

  private buy(): void {
    if (!this.building || !this.parts.town.items.includes(this.building)) return;
    const done = buyWarehouseCapacity(this.parts.town, this.parts.rules);
    if (typeof done === "string") this.said = done;
    else {
      this.parts.send(done);
      this.parts.spent(this.parts.rules.price);
      this.parts.changed();
      this.said = "";
    }
    this.render();
  }
}
