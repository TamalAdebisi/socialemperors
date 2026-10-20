// The units book uses the game's configured categories and prices. Acquired
// units stay recognized for this session; explicit book purchases persist.
import type { Command } from "../net/commands.ts";
import type { ItemInfo } from "./config.ts";
import type { Town } from "./town.ts";

export interface UnitCategory {
  category_id: number;
  category_lang_id: number;
  units: number[];
  rewards: number;
  cost: number;
  costs: number[] | null;
  position: number;
}

export class UnitBook {
  readonly categories: UnitCategory[];
  readonly owned = new Set<number>();
  readonly completed: number[];
  private readonly bought: number[];
  private readonly known: Set<number>;
  /** A player's own version of a book unit, under another id: the same name and picture (DECISIONS.md, 20 October). */
  private readonly twins = new Map<number, number>();

  constructor(categories: Record<string, UnitCategory>, saved: Record<string, unknown>, town: Town, items?: Map<number, ItemInfo>) {
    this.categories = Object.values(categories).sort((a, b) => a.position - b.position);
    this.known = new Set(this.categories.flatMap((c) => c.units));
    // The book's troll pages list the wild trolls' ids, and a troll empire trains
    // look-alikes under others; the Scary Zombie has two too. Either counts.
    const key = (item: ItemInfo) => `${item.name.trim().toLowerCase()}|${item.art}`;
    const byKey = new Map<string, number>();
    for (const id of this.known) {
      const item = items?.get(id);
      if (item) byKey.set(key(item), id);
    }
    for (const item of items?.values() ?? []) {
      const id = item.isUnit && !this.known.has(item.id) ? byKey.get(key(item)) : undefined;
      if (id !== undefined) this.twins.set(item.id, id);
    }
    this.bought = Array.isArray(saved.boughtUnits) ? saved.boughtUnits.map(Number) : [];
    this.completed = Array.isArray(saved.unitCollectionsCompleted) ? saved.unitCollectionsCompleted.map(Number) : [];
    saved.boughtUnits = this.bought;
    saved.unitCollectionsCompleted = this.completed;
    this.bought.forEach((id) => { if (this.known.has(id)) this.owned.add(id); });
    this.observe(town);
  }

  observe(town: Town): UnitCategory[] {
    const added = new Set<number>();
    for (const placed of town.items) {
      if (placed.item.isUnit && !placed.wild && (placed.item.race === town.race || placed.item.race === "a")) {
        const id = this.twins.get(placed.item.id) ?? placed.item.id;
        if (this.known.has(id) && !this.owned.has(id)) {
          this.owned.add(id); added.add(id);
        }
      }
    }
    return this.categories.filter((c) => c.units.some((id) => added.has(id)) && this.canClaim(c));
  }

  price(category: UnitCategory, id: number): number {
    const index = category.units.indexOf(id);
    return Number(category.costs?.[index] ?? category.cost);
  }

  buy(town: Town, category: UnitCategory, id: number): Command | null {
    if (!this.categories.includes(category) || !category.units.includes(id) || this.owned.has(id)) return null;
    const price = this.price(category, id);
    if (town.cash < price) return null;
    town.cash -= price;
    town.store.set(id, (town.store.get(id) ?? 0) + 1);
    this.owned.add(id);
    if (!this.bought.includes(id)) this.bought.push(id);
    return { cmd: "buy_stored_item_cash", args: [town.id, id, price] };
  }

  canClaim(category: UnitCategory): boolean {
    return this.categories.includes(category) && category.units.length > 0 &&
      category.units.every((id) => this.owned.has(id)) && !this.completed.includes(category.category_id);
  }

  claim(town: Town, category: UnitCategory): Command | null {
    if (!this.canClaim(category)) return null;
    this.completed.push(category.category_id);
    town.cash++;
    town.gifts.set(category.rewards, (town.gifts.get(category.rewards) ?? 0) + 1);
    return { cmd: "unit_collections_completed", args: [category.category_id] };
  }
}
