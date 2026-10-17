// A player's town, read from get_player_info.php: what is on the map, where,
// and the numbers shown at the top of the screen. No drawing here.

import type { ItemInfo } from "./config.ts";
import { readHelpers } from "./friendsHelp.ts";

/** One thing on the map, as the save stores it:
 * [item id, x, y, orientation, collected at, level, units inside, attributes]. */
export type SaveItem = [number, number, number, number, number?, number?, unknown[]?, Record<string, unknown>?];

export interface SaveMap {
  id: number;
  /** The 20 x 20 tile blocks of the island the player has opened (1 to 25). */
  expansions: number[];
  level: number;
  xp: number;
  coins: number;
  wood: number;
  food: number;
  stone: number;
  /** "h" humans or "t" trolls (the second town). */
  race: string;
  /** The island's look. */
  skin: number;
  items: SaveItem[];
  /** What this town put away: { "<item id>": count } (older saves: a list indexed by id). */
  store?: Box;
  /** The Great Church's steps done: each adds room for people. */
  increasedPopulation?: number;
  /** The troll camps (rules/camps.ts): which comes next, and when the last chest was opened (seconds). */
  idCurrentTreasure?: number;
  timestampLastTreasure?: number;
  /** Help from neighbours waiting for their donkey carts: { "u<pid>": [[x, y, building], ...] }. */
  receivedAssists?: Record<string, unknown>;
  /** The market (rules/market.ts): purchases minus sales by good, trades so far, the last one's time. */
  resourcesTraded?: Record<string, number>;
  numTradesDone?: number;
  timestampLastTrade?: number;
}

/** A storage box as the save keeps it: { "<item id>": count }, or a list of counts by item id. */
export type Box = Record<string, number> | number[];

export interface PlayerInfo {
  result: string;
  timestamp: number;
  /** completed_tutorial: the last of Arthur's lessons reached (0: none; rules/lessons.ts). */
  playerInfo: { name: string; cash: number; map_names?: string[]; completed_tutorial?: number | string };
  map: SaveMap;
  /** Buildings opened before their level, for cash: { "<item id>": true }. */
  privateState?: {
    unlockedEarlyBuildings?: Record<string, unknown>;
    gifts?: Box;
    /** Goals done, and paid (rules/goals.ts). */
    completedMissions?: number[];
    rewardedMissions?: number[];
    /** The bonuses (rules/bonuses.ts). */
    bonusNextId?: number;
    timestampLastBonus?: number;
    timeStampMondayBonus?: number;
    comebackBonusCollected?: number[];
    /** When the player last helped each neighbour: { "u<pid>": time }. */
    neighborAssists?: Record<string, number>;
  };
  /** The neighbours shown in the game: their player info, with their home town's level. */
  neighbors?: { pid: string | number; name?: string; level?: number | string; xp?: number | string }[];
}

export interface PlacedItem {
  /**
   * Where the server has it, when a fight has moved it since (an enemy: only
   * the player's own units tell the server where they go). Commands about it
   * name this tile (`savedTile`).
   */
  serverAt?: { x: number; y: number };
  /** An enemy that holds its ground in a fight (a camp's soldier just put up: until the page loads again). */
  defensive?: boolean;
  item: ItemInfo;
  /** The tile the save names (or, for an enemy a fight has moved, where it stands now: `serverAt`). */
  tx: number;
  ty: number;
  /** Buildings: which way it faces (the sprite's frame). Units: their direction. */
  orientation: number;
  /** How many units are inside (a barracks' soldiers, a mill's workers). */
  unitsInside: number;
  /** Which: their item ids, as the save keeps them (rules/work.ts keeps both in step). */
  units?: number[];
  /** When its current round of work started (the server's clock, seconds), or null. */
  startedAt: number | null;
  /** The working time chosen for a mill or mine (1 to 4), or 0 for none (rules/production.ts). */
  workTime: number;
  /**
   * A building hurt in a raid: its life now (rules/raids.ts), until
   * villagers repair it; undefined when whole. Never saved, as in the
   * Flash client: reopening the town finds it whole again.
   */
  health?: number;
  /** Burnt out in a raid: no room for people (but the town hall's) until it's repaired in full. */
  ruined?: boolean;
  /** An animal in the wild, nobody's until one of the player's units comes near (rules/animals.ts). Not saved. */
  wild?: boolean;
  /** A wall gate opened, for units to pass. Not saved: gates are shut each time the town opens, as in the Flash client. */
  open?: boolean;
  /** A social building's helpers so far, when the save keeps its staff list (the item's `si`). */
  staff?: number;
  staffIds?: string[];
  staffAsked?: Set<string>;
  /**
   * Being built (rules/construction.ts): when its scaffolding comes down
   * (milliseconds, Date.now()). Not saved, as in the Flash client: opened
   * again, the town shows it finished.
   */
  builtAt?: number;
  /**
   * Friends whose help waits over the building, an hour off its work each
   * (rules/friendsHelp.ts): their empires, the one shown on top last. From
   * the item's `hc`.
   */
  helpers?: string[];
  /** A scripted camp's chest that fills up as the camp goes (homeScripted.ts): how many steps show. Not saved. */
  steps?: number;
  /** A scripted camp's piece that is nobody's whatever the border says (its festival, its pen's walls). Not saved. */
  nobodys?: boolean;
  /** A scripted camp's boss's own rules in a fight (rules/battle.ts): it gets away, can't be hurt yet, is drawn bigger. Not saved. */
  boss?: { flee?: { below: number; line: number | null }; invulnerable?: boolean; scale?: number };
}

export interface Town {
  /** Which of the player's towns this is (the server's town number, 0 or 1). */
  id: number;
  name: string;
  townName: string;
  level: number;
  xp: number;
  cash: number;
  gold: number;
  wood: number;
  food: number;
  stone: number;
  race: string;
  skin: number;
  expansions: Set<number>;
  /** Buildings opened before their level, for cash: the shop sells them already. */
  unlocked: Set<number>;
  /** Storage, by item id: gifts and prizes (shared by the player's towns), and what this town put away. */
  gifts: Map<number, number>;
  store: Map<number, number>;
  items: PlacedItem[];
  /** Item ids the config doesn't know (drawn as nothing, reported once). */
  unknown: number[];
  /** The Great Church's steps done (rules/training.ts). */
  increasedPopulation?: number;
}

export function readTown(info: PlayerInfo, items: Map<number, ItemInfo>): Town {
  const map = info.map;
  const placed: PlacedItem[] = [];
  const unknown: number[] = [];
  for (const [id, tx, ty, orientation, started, , units, attributes] of map.items) {
    const item = items.get(id);
    if (item === undefined) {
      unknown.push(id);
      continue;
    }
    placed.push({
      item, tx, ty,
      orientation: orientation ?? 0,
      unitsInside: Array.isArray(units) ? units.length : 0,
      units: Array.isArray(units) ? units.map(Number) : [],
      startedAt: Number.isFinite(started) ? Number(started) : null,
      workTime: Number(attributes?.cp) || 0,
      ...(Array.isArray(attributes?.si) ? { staff: attributes.si.length, staffIds: attributes.si.map(String) } : {}),
      ...(attributes?.sif && typeof attributes.sif === "object" ? { staffAsked: new Set(Object.keys(attributes.sif).map((id) => id.replace(/^u/, ""))) } : {}),
      ...(readHelpers(attributes?.hc).length > 0 ? { helpers: readHelpers(attributes?.hc) } : {}),
    });
  }
  return {
    id: map.id ?? 0,
    name: info.playerInfo.name,
    townName: info.playerInfo.map_names?.[map.id] ?? "",
    level: map.level,
    xp: map.xp,
    cash: info.playerInfo.cash,
    gold: map.coins,
    wood: map.wood,
    food: map.food,
    stone: map.stone,
    race: map.race,
    skin: map.skin ?? 0,
    expansions: new Set(map.expansions),
    unlocked: new Set(Object.keys(info.privateState?.unlockedEarlyBuildings ?? {}).map(Number)),
    gifts: readBox(info.privateState?.gifts),
    store: readBox(map.store),
    items: placed,
    unknown,
    increasedPopulation: Number(map.increasedPopulation) || 0,
  };
}

/** A storage box as counts by item id, whichever way the save keeps it. */
export function readBox(box: Box | undefined): Map<number, number> {
  const counts = new Map<number, number>();
  const entries: [string | number, number][] = Array.isArray(box) ? box.map((count, id) => [id, count]) : Object.entries(box ?? {});
  for (const [id, count] of entries) {
    if (Number(count) > 0) {
      counts.set(Number(id), Number(count));
    }
  }
  return counts;
}

/** The tile the server has a thing on: where it was saved, if a fight has moved it since. */
export function savedTile(placed: PlacedItem): { x: number; y: number } {
  return placed.serverAt ?? { x: placed.tx, y: placed.ty };
}
