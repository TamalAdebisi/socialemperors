// The scripted troll camps at home (CLIENT.md, "Scripted camps"), as the
// Flash client plays them: twenty of the thirty camps are stories with a
// fixed layout in the four corners of the map, keys ("activators") guarded
// by enemy units, a chest that opens when the story says, and sometimes a
// boss. Their pieces are in rules/scripted-camps.json; this file is the
// rules, with no drawing. homeScripted.ts plays them in the town.
//
// Two engines, as in the original: the old one (camps 7 and 13) works out
// how far a camp has got from the pieces still standing; the new one
// (14 to 29) saves its progress with `set_quest_var`.

import type { ItemInfo } from "./config.ts";
import type { Point } from "./geometry.ts";
import data from "./scripted-camps.json" with { type: "json" };
import { enemyIds } from "./raids.ts";

/** A piece of a camp: [item id (0: a random enemy soldier for the level), x, y, side, role]. */
export type ScriptedPiece = [number, number, number, "e" | "n", "key" | "chest" | "scenery" | "unit" | "boss" | "door" | "other"];

export interface ScriptedTile {
  /** The new engine saves the keys of the tiles whose activator was taken. */
  key: string | null;
  origin: [number, number];
  /** "neutral": the tile's buildings are nobody's. */
  side: string | null;
  pieces: ScriptedPiece[];
}

export interface ScriptedCamp {
  engine: "old" | "new";
  races: string[];
  activator: number | null;
  chest: number | null;
  /** Start title, start text, end title, end text (localisation ids). */
  popup: [number, number, number, number];
  /** The window's picture for a human and a troll player. */
  pictures: [string | null, string | null];
  /** Units given to the player when the camp starts, and the one who speaks. */
  helpers: number[];
  messenger: number | null;
  /** What the camp gives besides the level's reward. */
  prizes: number[];
  bossStage: boolean;
  steps: boolean;
  finalAnimation: boolean;
  keepIds: boolean;
  tiles: ScriptedTile[];
  bossTiles: ScriptedTile[];
  boss?: number;
  bossSay?: number;
  doors?: { at: [number, number]; id: number; opensWhenDead: { id?: number; ids?: number[]; count: number } }[];
  treasurePosOverride?: [number, number];
  rewardsGoToStorage?: boolean;
}

const CAMPS = (data as unknown as { camps: Record<string, ScriptedCamp> }).camps;

/** Scripted camps played in this client so far. */
const PLAYED = new Set([7, 13]);

export function scriptedCamp(id: number): ScriptedCamp | null {
  return CAMPS[String(id)] ?? null;
}

/** Whether this client plays a scripted camp (the others stay in the classic game for now). */
export function scriptedHere(id: number, race: string): boolean {
  return PLAYED.has(id) && Boolean(scriptedCamp(id)?.races.includes(race));
}

/** Which scripted camp a chest finishes. */
export function campOfScriptedChest(chestId: number): number | null {
  for (const [id, camp] of Object.entries(CAMPS)) {
    if (camp.chest === chestId) {
      return Number(id);
    }
  }
  return null;
}

/** What to put down for a tile: soldiers picked for the level when the camp doesn't keep its ids. */
export function tilePieces(tile: ScriptedTile, level: number, race: string, random: () => number):
  { id: number; x: number; y: number; side: "e" | "n"; role: ScriptedPiece[4] }[] {
  const soldiers = enemyIds(level, race);
  return tile.pieces.map(([id, x, y, side, role]) => ({
    id: id === 0 ? soldiers[Math.floor(random() * soldiers.length)] : id,
    x, y, side, role,
  }));
}

/** An activator's guards stand in this box round it (x - 7 to x + 6, y - 7 to y + 6). */
export function guardsBox(activator: Point): (x: number, y: number) => boolean {
  return (x, y) => x >= activator.x - 7 && x <= activator.x + 6 && y >= activator.y - 7 && y <= activator.y + 6;
}

/** The corner big tile (20 x 20) a tile lies in, as its top-left. */
export function cornerOf(x: number, y: number): Point | null {
  const cx = x < 20 ? 0 : x >= 80 ? 80 : -1;
  const cy = y < 20 ? 0 : y >= 80 ? 80 : -1;
  return cx < 0 || cy < 0 ? null : { x: cx, y: cy };
}

/**
 * How far an old-engine camp has got, from what stands on the map: nothing
 * yet, keys left, every key taken (the chest's or the bosses' turn), or a
 * muddle (a chest gone with keys left).
 */
export function oldCampState(chests: number, activators: number, total: number): "none" | "keys" | "enders" | "error" {
  if (chests === 0 && activators === 0) {
    return "none";
  }
  if (chests > 0 && activators >= 1 && activators <= total) {
    return "keys";
  }
  if (chests > 0 && activators === 0) {
    return "enders";
  }
  return "error";
}

/** A camp's tip line for its chest or its keys, when the original had one. */
export const SCRIPTED_TIPS: Record<number, number> = { 211: 266, 210: 273, 259: 270, 258: 276 };

/** Whether an item is a scripted camp's activator. */
export function isActivator(item: ItemInfo): boolean {
  return item.subcategory === 812;
}
