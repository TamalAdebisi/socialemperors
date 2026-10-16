// The second town (CLIENT.md, "The troll town"), as the Flash client offers
// it (our notes, our words: docs/original/rules/progress.md, "The second
// town and travelling"): from level 20 a human town can found a troll town,
// for 100,000 gold or 22 cash (the client's own numbers, not the config's),
// with `buy_map`; from then on the player travels between the two. Each town
// keeps its own resources and level; cash is the player's. No drawing here.

import type { Command } from "../net/commands.ts";
import type { Town } from "./town.ts";

export const TOWN_PRICE = { gold: 100_000, cash: 22 };
/** The level a town needs to found the troll town. */
export const TOWN_LEVEL = 20;
/** The original only ever travels between two towns. */
export const MOST_TOWNS = 2;

/** The player's towns' races, as the save counts them (privateState.maps: [{ r: "h" }, { r: "t" }]). */
export function townRaces(maps: unknown): string[] {
  if (!Array.isArray(maps)) {
    return ["h"];
  }
  const races = maps.map((m) => (m && typeof m === "object" && (m as { r?: unknown }).r === "t" ? "t" : "h"));
  return races.length > 0 ? races : ["h"];
}

/**
 * Whether the towns' button shows, as the Flash client decides it when the
 * town opens: hidden in a human town below level 20, unless there are two
 * towns to travel between.
 */
export function showsTowns(town: Town, towns: number): boolean {
  return towns > 1 || town.race !== "h" || town.level >= TOWN_LEVEL;
}

export type FoundRefusal = "level" | "gold" | "cash" | "two";

/** Found the troll town, paying from this town: the price taken, and the command. Refused below level 20, short of the price, or with two towns already. */
export function foundTown(town: Town, towns: number, withCash: boolean): { refused: FoundRefusal } | { command: Command } {
  if (towns >= MOST_TOWNS) {
    return { refused: "two" };
  }
  if (town.level < TOWN_LEVEL) {
    return { refused: "level" };
  }
  if (withCash ? town.cash < TOWN_PRICE.cash : town.gold < TOWN_PRICE.gold) {
    return { refused: withCash ? "cash" : "gold" };
  }
  if (withCash) {
    town.cash -= TOWN_PRICE.cash;
  } else {
    town.gold -= TOWN_PRICE.gold;
  }
  return { command: { cmd: "buy_map", args: [towns, withCash ? 1 : 0, "t", town.id] } };
}

/** The page's address for a town: the same page, opening that town. */
export function townAddress(search: string, town: number): string {
  const params = new URLSearchParams(search);
  for (const key of ["visit", "quest", "attack", "map", "islands"]) {
    params.delete(key);
  }
  params.set("town", String(town));
  return `?${params}`;
}
