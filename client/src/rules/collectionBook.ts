// The collection window's saved counts and exchanges. Drop rules stay in
// collections.ts so harvest and combat use the same Piece interface.
import type { Command } from "../net/commands.ts";
import type { Piece } from "./collections.ts";
import type { Town } from "./town.ts";

export const COLLECTION_REWARDS = [176, 177, 178, 179, 180, 551, 546, 544, 552, 553,
  206, 207, 208, 209, 124, 561, 562, 563, 564, 565, 875, 853, 1410];

export class CollectionBook {
  readonly rows: number[][];
  readonly completed: number[];

  constructor(saved: Record<string, unknown>) {
    const rows = Array.isArray(saved.collections) ? saved.collections : [];
    this.rows = Array.from({ length: 24 }, (_, id) => id === 0 ? [] :
      Array.from({ length: 6 }, (_, piece) => {
        const value = Number(Array.isArray(rows[id]) ? rows[id][piece] : 0);
        return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
      }));
    this.completed = Array.isArray(saved.collectionsCompleted)
      ? [...new Set(saved.collectionsCompleted.map(Number).filter((id) => id >= 1 && id <= 23))] : [];
    saved.collections = this.rows;
    saved.collectionsCompleted = this.completed;
  }

  found({ collection, piece }: Piece): void {
    if (this.rows[collection] && piece >= 1 && piece <= 5) this.rows[collection][piece]++;
  }

  price(id: number): number {
    if (id === 10) return 15;
    if (id === 20) return 20;
    // The two Bahamuts' 400 cash, shrunk as every big cash price is (economy.py, cash_price).
    const full = id === 21 || id === 22 ? 91 : 5;
    return Math.max(1, full - this.rows[id].slice(1).filter((n) => n > 0).length);
  }

  canExchange(id: number): boolean {
    return Boolean(this.rows[id]?.slice(1).every((n) => n > 0)) &&
      !([21, 22].includes(id) && this.completed.includes(id));
  }

  canBuy(id: number): boolean {
    return id >= 1 && id <= 22 && !this.rows[id][0] &&
      !([21, 22].includes(id) && this.completed.includes(id));
  }

  finish(town: Town, id: number, cash: boolean): Command | null {
    if (cash ? !this.canBuy(id) || town.cash < this.price(id) : !this.canExchange(id)) return null;
    const cost = this.price(id);
    if (cash) town.cash -= cost;
    const row = this.rows[id];
    row[0] = 1;
    for (let piece = 1; piece <= 5; piece++) row[piece] = Math.max(0, row[piece] - 1);
    if (!this.completed.includes(id)) this.completed.push(id);
    const reward = COLLECTION_REWARDS[id - 1];
    town.gifts.set(reward, (town.gifts.get(reward) ?? 0) + 1);
    return { cmd: "finish_collection", args: cash ? [id, 1, cost] : [id] };
  }
}
