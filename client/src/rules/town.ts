// A player's town, read from get_player_info.php: what is on the map, where,
// and the numbers shown at the top of the screen. No drawing here.

import type { ItemInfo } from "./config.ts";

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
}

export interface PlayerInfo {
  result: string;
  timestamp: number;
  playerInfo: { name: string; cash: number; map_names?: string[] };
  map: SaveMap;
}

export interface PlacedItem {
  item: ItemInfo;
  /** The tile the save names. */
  tx: number;
  ty: number;
  /** Buildings: which way it faces (the sprite's frame). Units: their direction. */
  orientation: number;
  /** How many units are inside (a barracks' soldiers, a mill's workers). */
  unitsInside: number;
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
  items: PlacedItem[];
  /** Item ids the config doesn't know (drawn as nothing, reported once). */
  unknown: number[];
}

export function readTown(info: PlayerInfo, items: Map<number, ItemInfo>): Town {
  const map = info.map;
  const placed: PlacedItem[] = [];
  const unknown: number[] = [];
  for (const [id, tx, ty, orientation, , , units] of map.items) {
    const item = items.get(id);
    if (item === undefined) {
      unknown.push(id);
      continue;
    }
    placed.push({ item, tx, ty, orientation: orientation ?? 0, unitsInside: Array.isArray(units) ? units.length : 0 });
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
    items: placed,
    unknown,
  };
}
