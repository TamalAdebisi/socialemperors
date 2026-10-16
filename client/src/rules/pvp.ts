// Attacking another player (CLIENT.md, "Attacking players"), as the Flash
// client's assault works: how many attacks are left, where the army may
// start, what of the defender's town fights and what is cleared away, what
// each thing killed is worth, who comes home, the honour, and the report
// sent at the end (`end_attack`). The server checks the report the same
// way (pvp.py). No drawing here.

import type { ItemInfo } from "./config.ts";
import { BLOCKS, BLOCK_TILES, type Point } from "./geometry.ts";
import type { PlacedItem, Town } from "./town.ts";

/** Player attacks open at this level. */
export const MIN_LEVEL_PVP = 6;
/** Attacks in each 6 hours (one more with an Odin Statue); spy visits in each 24. */
export const ATTACKS_MAX = 3;
export const ATTACKS_PERIOD = 6 * 3600;
export const ODIN_STATUE = 366;
export const SPYINGS_MAX = 3;
export const SPYINGS_PERIOD = 24 * 3600;
/** A kill pays at most this; a whole battle at most MAX_GOLD (the config's MAX_GOLD_ASSAULT); a win with none, WIN_FLOOR. */
export const KILL_GOLD_CAP = 200;
export const MAX_GOLD = 20000;
export const WIN_FLOOR = 25;

const SUB = { peasant: 71, townHall: 135, wall: 221, deco: 411, lost: 911, refuge: 1311 } as const;
/** The spy's eagle; the Eagles buildings, and its life with each (Eagles I to IV; the troll one, its own). */
export const EAGLE = 543;
const EAGLES_LIFE = new Map([[185, 200], [186, 400], [187, 800], [217, 10000]]);
const SUB_EAGLES = 136;
/** Coming home to an attack not yet seen: the town hall and this many other buildings are found half burnt. */
const BURNT_ON_RETURN = 5;
/** The attacker's own transports, which never fight on either side. */
const TRANSPORTS = new Set([542, 582, 543, 583]);

/** An attack made or received, as the save keeps them. */
export interface AttackEntry { time: number | string; victim_id?: string; attacker_id?: string; description?: Report; viewPending?: number }

/**
 * Attacks left now, as the Flash client counts them: those made in the 6
 * hours up to the last one (all come back together 6 hours after it),
 * against 3, or 4 with an Odin Statue in town; none made before `reset`
 * (the save's tsAttacksReset). `wait`: seconds until they come back, when
 * none are left.
 */
export function attacksLeft(sent: AttackEntry[], now: number, statue: boolean, reset = 0, max = ATTACKS_MAX,
  period = ATTACKS_PERIOD): { left: number; wait: number } {
  const times = sent.map((e) => Number(e.time) || 0).filter((t) => t > reset);
  const allowed = max + (statue ? 1 : 0);
  if (times.length === 0) {
    return { left: allowed, wait: 0 };
  }
  const last = Math.max(...times);
  if (now - last >= period) {
    return { left: allowed, wait: 0 };
  }
  const made = times.filter((t) => t > last - period && t <= last).length;
  const left = Math.max(allowed - made, 0);
  return { left, wait: left > 0 ? 0 : Math.max(Math.ceil(last + period - now), 0) };
}

/** The 16 start points: the middle of each border block (block x, y; the tile 10 + 20x, 10 + 20y). The first is the default. */
export function startPoints(): { block: Point; tile: Point }[] {
  const points: { block: Point; tile: Point }[] = [];
  for (let y = 0; y < BLOCKS; y++) {
    for (let x = 0; x < BLOCKS; x++) {
      if (x === 0 || y === 0 || x === BLOCKS - 1 || y === BLOCKS - 1) {
        points.push({ block: { x, y }, tile: { x: x * BLOCK_TILES + BLOCK_TILES / 2, y: y * BLOCK_TILES + BLOCK_TILES / 2 } });
      }
    }
  }
  return points;
}

function onBorder(tx: number, ty: number): boolean {
  const bx = Math.floor(tx / BLOCK_TILES);
  const by = Math.floor(ty / BLOCK_TILES);
  return bx <= 0 || by <= 0 || bx >= BLOCKS - 1 || by >= BLOCKS - 1;
}

/**
 * What a thing of the defender's town is in the battle: on their side, on
 * nobody's (trees, rocks, animals, refuges), or cleared away for the
 * battle (units of the other race, buildings on the border blocks, lost
 * objects, the attacker's transports). `race`: the defender's town's.
 */
export function placeOf(item: ItemInfo, tx: number, ty: number, race: string): "enemy" | "neutral" | "cleared" {
  if (TRANSPORTS.has(item.id) || item.subcategory === SUB.lost) {
    return "cleared";
  }
  if (item.isUnit && (item.race === "h" || item.race === "t") && item.race !== race) {
    return "cleared";
  }
  if (!item.isUnit && onBorder(tx, ty) && item.race !== "n") {
    return "cleared";
  }
  if (item.race === "n" || item.subcategory === SUB.refuge) {
    return "neutral";
  }
  return "enemy";
}

/** Whether a thing of the defender's counts as a target (the counter at the top): fighting buildings inside, the town hall, fighting units. */
export function isTarget(item: ItemInfo, tx: number, ty: number, race: string): boolean {
  if (!item.isUnit) {
    return item.subcategory === SUB.townHall || (item.attack > 0 && !onBorder(tx, ty));
  }
  return item.attack > 0 && item.subcategory !== SUB.peasant && (item.race === race || item.race === "a");
}

/** What killing it pays (`Assault.killed`): a town hall its owner's level x 100; a fighter by its price, at most 200. */
export function killWorth(item: ItemInfo, defenderLevel: number): { gold: number; xp: number } {
  let gold = 0;
  if (item.subcategory === SUB.townHall) {
    gold = defenderLevel * 100;
  } else if (item.attack > 0) {
    const price = item.cost;
    gold = Math.min(item.costType === "g" ? Math.floor(price / 2) : item.costType === "s" ? Math.floor(price / 8)
      : item.costType === "c" ? price * 10 : 0, KILL_GOLD_CAP);
  }
  const xp = Math.ceil(gold / 20) || (item.subcategory === SUB.wall ? 0 : 1);
  return { gold, xp };
}

/** What the defender earns for one of the attacker's fallen: a tenth of its worth, rounded up. */
export function defenderTenth(item: ItemInfo): number {
  return item.attack > 0 ? Math.ceil(killWorth(item, 0).gold / 10) : 0;
}

/** A row of the report: item id, how many came, how many fell, how many came home anyway. */
export type Row = [number, number, number, number];

/** An army's worth for honour: each item's price up to 1,000, a hundredth. */
function worth(rows: Row[], column: 1 | 2, items: Map<number, ItemInfo>): number {
  return rows.reduce((sum, row) => sum + row[column] * Math.min(items.get(row[0])?.cost ?? 0, 1000) / 100, 0);
}

/** Honour (HonorManager): what the defender lost less what the attacker lost, against what it had, 1 to 10. */
export function honour(attacker: Row[], victim: Row[], items: Map<number, ItemInfo>): number {
  const sent = worth(victim, 1, items);
  if (sent <= 0) {
    return 1;
  }
  const score = Math.round((10 * (worth(victim, 2, items) - worth(attacker, 2, items))) / sent);
  return Math.min(Math.max(score, 1), 10);
}

/** The share (percent) of the attacker's fallen that come home anyway, by its level. */
export function attackerShare(level: number): number {
  return level < 10 ? 95 : level <= 15 ? 75 : 50;
}

/**
 * Who of the fallen comes home: killed x share (rounded up) of them; the
 * rest are lost, drawn one at a time from all the fallen (each kind as
 * often as it fell). Returns the rows with their "came home" filled in.
 */
export function recover(rows: Row[], share: number, random: () => number): Row[] {
  const out = rows.map((r) => [r[0], r[1], r[2], r[2]] as Row);
  const killed = out.reduce((sum, r) => sum + r[2], 0);
  let lose = killed - Math.ceil((killed * share) / 100);
  while (lose > 0) {
    const pool = out.reduce((sum, r) => sum + r[3], 0);
    let pick = Math.floor(random() * pool);
    const row = out.find((r) => {
      pick -= r[3];
      return pick < 0;
    });
    if (!row) {
      break;
    }
    row[3]--;
    lose--;
  }
  return out;
}

/** The report the Flash client sends at the end (`end_attack`'s first argument, as JSON). */
export interface Report {
  attacker: { name: string; level: number; user_id: string; world_id: number; map: number; race: string };
  victim: Record<string, unknown>;
  resources: { g: number; x: number };
  resources_victim: { g: number };
  attacker_units: Row[];
  victim_units: Row[];
  win: number;
  duration: number;
  voluntary_end: number;
  townhall_gold: number;
  honor: number;
}

/** The report from the battle's totals: the 25 floor for a win, the cap, nothing with no town hall. */
export function report(parts: {
  attacker: Report["attacker"]; victim: Record<string, unknown>; gold: number; xp: number; attackerRows: Row[]; victimRows: Row[];
  won: boolean; seconds: number; voluntary: boolean; townHallGold: number; defenderGold: number; noTownHall: boolean;
  items: Map<number, ItemInfo>;
}): Report {
  let gold = Math.min(parts.gold, MAX_GOLD);
  let xp = parts.xp;
  if (parts.won && gold === 0) {
    gold = WIN_FLOOR;
  }
  if (parts.noTownHall) {
    gold = 0;
    xp = 0;
  }
  return {
    attacker: parts.attacker,
    victim: parts.victim,
    resources: { g: gold, x: xp },
    resources_victim: { g: parts.won ? 0 : parts.defenderGold },
    attacker_units: parts.attackerRows,
    victim_units: parts.victimRows,
    win: parts.won ? 1 : 0,
    duration: Math.round(parts.seconds),
    voluntary_end: parts.voluntary ? 1 : 0,
    townhall_gold: parts.townHallGold,
    honor: parts.noTownHall ? 0 : honour(parts.attackerRows, parts.victimRows, parts.items),
  };
}

/**
 * Coming home to an attack not yet seen, as the Flash client shows it: the
 * town hall at half its life, and the first five of the player's buildings
 * (by the save's order; not walls or decorations) too, for villagers to
 * repair. Not saved, as there. Returns what was burnt, to draw again.
 */
export function burnOnReturn(town: Town): PlacedItem[] {
  const burnt: PlacedItem[] = [];
  const burn = (placed: PlacedItem) => {
    placed.health = Math.floor(placed.item.life / 2);
    if (!burnt.includes(placed)) {
      burnt.push(placed);
    }
  };
  const theirs = (item: ItemInfo) => !item.isUnit && item.life > 0 && (item.race === "a" || item.race === town.race);
  const hall = town.items.find((p) => p.item.subcategory === SUB.townHall && theirs(p.item));
  if (hall) {
    burn(hall);
  }
  let count = 0;
  for (const placed of town.items) {
    if (count >= BURNT_ON_RETURN) {
      break;
    }
    if (theirs(placed.item) && placed.item.subcategory !== SUB.wall && placed.item.subcategory !== SUB.deco) {
      burn(placed);
      count++;
    }
  }
  return burnt;
}

/**
 * The town's Eagles building, if it has one built, as the Flash client
 * looks for it: spying needs it, and its level sets the eagle's life.
 */
export function eaglesOf(town: Town, built: (placed: PlacedItem) => boolean): PlacedItem | null {
  return town.items.find((p) => p.item.subcategory === SUB_EAGLES && built(p)) ?? null;
}

/** The spy eagle's life: 200, 400, 800 or 10,000 by the Eagles building; the troll Eagles keep the eagle's own. */
export function eagleLife(eagles: ItemInfo, eagle: ItemInfo): number {
  return EAGLES_LIFE.get(eagles.id) ?? eagle.life;
}

/** Spy visits left now: 3 in the 24 hours up to the last, counted as attacks are (`attacksLeft`). */
export function spyingsLeft(spyings: AttackEntry[], now: number, reset = 0): { left: number; wait: number } {
  return attacksLeft(spyings, now, false, reset, SPYINGS_MAX, SPYINGS_PERIOD);
}
