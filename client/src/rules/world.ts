// The world map for attacking players (CLIENT.md, "Attacking players"), as
// the Flash client's explorations window works: fifty continents of eight
// islands, the player's town on one with seven rival players around it
// (the server picks them, worlds.py); beat all seven to move on. What each
// island shows, what its menu offers, the progress, and the prize for a new
// continent. No drawing here.

import type { AttackEntry } from "./pvp.ts";

/** The continents, and the islands on each. */
export const FIRST_CONTINENT = 1;
export const LAST_CONTINENT = 50;
export const ISLANDS = 8;
export const RIVALS = ISLANDS - 1;
/** The same player can't be attacked again from the map for this long. */
export const SAME_PLAYER_WAIT = 4 * 3600;
/** The five continent pictures take turns: continent n has picture n % 5 + 1. */
export const PICTURES = 5;

/** An island as the server sends it (get_continent_ranking.php). */
export interface Island {
  posicion: number;
  nivel: number | string;
  user_id: string;
  map: number;
  name?: string;
  level?: number;
  race?: string;
  world_id?: number;
}

export interface Continent {
  world_id?: number;
  continent: Island[];
}

/** The continent picture (1 to 5) for a continent. */
export function pictureOf(continent: number): number {
  return (continent % PICTURES) + 1;
}

/** The statue standing on a continent (1 to 20). */
export function statueOf(continent: number): number {
  return (continent % 20) + 1;
}

/**
 * The picture of an island (1 to 10): beaten (the flag on the rubble,
 * only on the player's own continent), a troll town, or a town by its
 * owner's level: below 10, 12, 14 ... 22, and up.
 */
export function islandPicture(island: Island, beaten: boolean): number {
  if (beaten) {
    return 10;
  }
  if (island.race === "t") {
    return 9;
  }
  const level = Number(island.level) || 1;
  return level < 10 ? 1 : Math.min(Math.floor((level - 10) / 2) + 2, 8);
}

/** The islands beaten on the town's continent, as the town keeps them (universAttackWin). */
export function beatenIslands(saved: unknown): number[] {
  return Array.isArray(saved) ? saved.map(Number) : [];
}

/** Players attacked from anywhere in the last 4 hours (the map won't attack them again yet). */
export function attackedLately(sent: AttackEntry[], now: number): Set<string> {
  return new Set(sent.filter((e) => now - (Number(e.time) || 0) < SAME_PLAYER_WAIT).map((e) => String(e.victim_id)));
}

/** What an island's menu offers, as the Flash client decides it. */
export type IslandChoice = "yourself" | "attacked-lately" | "no-army" | "attack" | "no-attacks";

export function islandChoice(island: Island, me: string, lately: Set<string>, army: number, attacksLeft: number): IslandChoice {
  if (island.user_id === me) {
    return "yourself";
  }
  if (lately.has(island.user_id)) {
    return "attacked-lately";
  }
  if (army === 0) {
    return "no-army";
  }
  return attacksLeft > 0 ? "attack" : "no-attacks";
}

/**
 * The player's own island beaten (it can happen when islands are swapped
 * about): as the Flash client does, it changes places with the first rival
 * island not beaten yet, and tells the server (modify_position_univers,
 * [own island, the other]). Returns that command's arguments, or null.
 */
export function moveOffBeaten(islands: Island[], me: string, beaten: number[]): [number, number] | null {
  const mine = islands.find((i) => i.user_id === me);
  const free = islands.find((i) => i.user_id !== me && !beaten.includes(Number(i.posicion)));
  if (!mine || !free || !beaten.includes(Number(mine.posicion))) {
    return null;
  }
  const own = Number(mine.posicion);
  const other = Number(free.posicion);
  mine.posicion = other;
  free.posicion = own;
  return [own, other];
}

/** A continent's prize (the config's level_ranking_reward row for it). */
export interface Prize {
  cash: number;
  units: [number, number][];
}

export function prizeFor(rows: unknown, continent: number): Prize | null {
  const row = (Array.isArray(rows) ? rows as { level: number | string; cash?: number | string; units?: Record<string, number | string> }[] : [])
    .find((r) => Number(r.level) === continent);
  if (!row) {
    return null;
  }
  return { cash: Number(row.cash) || 0, units: Object.entries(row.units ?? {}).map(([id, n]) => [Number(id), Number(n) || 0]) };
}
