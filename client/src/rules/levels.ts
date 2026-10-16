// Going up a level, as the Flash client does: when the town's experience
// reaches the next level's, it goes up one level at a time, each paying its
// prize from the config's levels table, and tells the server
// ("rt_level_up", which pays the same prize into the save). No drawing here.

import type { Command } from "../net/commands.ts";
import type { ConfigLevel, ItemInfo } from "./config.ts";
import { RESOURCES, type Resource } from "./production.ts";
import type { Town } from "./town.ts";

export interface Level {
  name: string;
  /** The experience it takes to reach it. */
  xp: number;
  /** What reaching it pays, or null (prizes this client doesn't show, like mana). */
  prize: { resource: Resource; amount: number } | null;
}

/** The levels table: level n is entry n - 1. */
export function readLevels(rows: ConfigLevel[] = []): Level[] {
  return rows.map((row) => {
    const resource = RESOURCES[row.reward_type];
    const amount = Number(row.reward_amount) || 0;
    return { name: row.name, xp: Number(row.exp_required) || 0, prize: resource && amount > 0 ? { resource, amount } : null };
  });
}

export interface LevelUp {
  level: number;
  name: string;
  prize: Level["prize"];
}

/** Go up every level the town's experience has reached; its prizes are paid. */
export function levelUps(town: Town, levels: Level[]): { commands: Command[]; reached: LevelUp[] } {
  const commands: Command[] = [];
  const reached: LevelUp[] = [];
  while (town.level < levels.length && town.xp >= levels[town.level].xp) {
    town.level += 1;
    const level = levels[town.level - 1];
    if (level.prize) {
      town[level.prize.resource] += level.prize.amount;
    }
    commands.push({ cmd: "rt_level_up", args: [town.level] });
    reached.push({ level: town.level, name: level.name, prize: level.prize });
  }
  return { commands, reached };
}

/** The most new buildings the level-up window shows, as the Flash client's. */
export const UNLOCKED_SHOWN = 4;

/**
 * What a level opens, for the level-up window: the buildings first sold at
 * exactly this level, in the shop, of the town's people, as the Flash
 * client lists them; at most four.
 */
export function unlockedAt(items: Iterable<ItemInfo>, level: number, race: string): ItemInfo[] {
  const found: ItemInfo[] = [];
  for (const item of items) {
    if (item.minLevel === level && !item.isUnit && item.inStore > 0 && item.race === race) {
      found.push(item);
      if (found.length === UNLOCKED_SHOWN) {
        break;
      }
    }
  }
  return found;
}
