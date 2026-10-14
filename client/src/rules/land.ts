// Buying land, as the Flash client sells it (our notes, our words; CLIENT.md,
// "Land and cash"). The island is 5 x 5 blocks; the player opens the middle
// 3 x 3, one block at a time. No drawing here.

import type { Command } from "../net/commands.ts";
import { BLOCKS, BLOCK_TILES, expansionOf, isOuterBlock } from "./geometry.ts";
import type { Town } from "./town.ts";

/** One row of the config's `expansion_prices`: the price of the next block, by how many are open. */
export interface LandPrice {
  coins: number;
  cash: number;
  /** How many neighbours it takes to pay in gold (cash needs none). */
  neighbors: number;
}

export function readLandPrices(rows: { coins: number | string; cash: number | string; neighbors: number | string }[] = []): LandPrice[] {
  return rows.map((row) => ({ coins: Number(row.coins) || 0, cash: Number(row.cash) || 0, neighbors: Number(row.neighbors) || 0 }));
}

/** The block a tile is in, if it's for sale: in the middle 3 x 3, not open yet, and beside one that is. Else null. */
export function landForSale(town: Town, tx: number, ty: number): number | null {
  const gx = Math.floor(tx / BLOCK_TILES);
  const gy = Math.floor(ty / BLOCK_TILES);
  if (gx < 0 || gy < 0 || gx >= BLOCKS || gy >= BLOCKS || isOuterBlock(gx, gy)) {
    return null;
  }
  const block = expansionOf(tx, ty);
  if (town.expansions.has(block)) {
    return null;
  }
  // As the Flash client checks it: the block before or after it, or the one above or below, is open.
  const beside = [block - 1, block + 1, block - BLOCKS, block + BLOCKS].some((b) => town.expansions.has(b));
  return beside ? block : null;
}

/** The next block's price: by how many are open already. Null when there's no more to buy. */
export function landPrice(town: Town, prices: LandPrice[]): LandPrice | null {
  return prices[town.expansions.size - 1] ?? null;
}

/** Why the block can't be bought that way now, or null. */
export function cantBuyLand(town: Town, price: LandPrice, withCash: boolean, neighbours: number): string | null {
  if (withCash) {
    return town.cash < price.cash ? `Not enough cash: it costs ${price.cash}.` : null;
  }
  if (neighbours < price.neighbors) {
    const missing = price.neighbors - neighbours;
    return `Paying in gold takes ${price.neighbors} neighbour${price.neighbors > 1 ? "s" : ""}: ${missing} more.`;
  }
  return town.gold < price.coins ? "Not enough gold." : null;
}

/** Buy a block: it's paid for and open, and the server is told as the Flash client tells it. */
export function buyLand(town: Town, block: number, price: LandPrice, withCash: boolean): Command {
  if (withCash) {
    town.cash -= price.cash;
  } else {
    town.gold -= price.coins;
  }
  town.expansions.add(block);
  return { cmd: "expand", args: [block, withCash ? "cash" : "gold", town.id] };
}
