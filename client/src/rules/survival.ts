// The Survival Arena (CLIENT.md, "Survival"), as the Flash client plays it:
// the player's 30 strongest units guard the relic in the middle of an arena
// while waves of enemies come from eight points round the edge, faster as
// it goes, with a boss between (and two short waves while the boss lives);
// the last stage never ends. The longer the stand, the better the unit
// won. Lives: 3, each back 3 hours after it was used, plus any bought.
// The arenas' numbers are in survival.json. No drawing here.

import { ENEMY, FPS, type Battle, type Fighter } from "./battle.ts";
import type { ItemInfo } from "./config.ts";
import type { Point } from "./geometry.ts";
import data from "./survival.json" with { type: "json" };

export interface SurvivalWave {
  units: number[];
  /** Seconds to the next wave; while a boss lives, `bossSeconds` between the waves that come meanwhile. */
  seconds: number;
  bossSeconds?: number;
  count: number;
  boss: boolean;
  /** How many times it comes before the next wave's kind. */
  spawns: number;
}

export interface SurvivalMap {
  quest: number;
  /** Its name in the game's words (localization_strings). */
  name: number;
  /** Its picture, images_new/<picture>.jpg. */
  picture: string;
  terrain: number;
  available: boolean;
  /** [minutes held, unit won]. */
  prizes: [number, number][];
  waves: SurvivalWave[];
}

export const SURVIVAL = data as unknown as {
  shape: number[]; water: number; relic: number; arenaBuilding: number; maps: SurvivalMap[];
};

export const MIN_LEVEL_SURVIVAL = 20;
export const LIVES = 3;
/** The army: the 30 strongest units of the town (copies: the town keeps them). */
export const ARMY_SIZE = 30;
/** The eight points the waves come from. */
export const SPAWN_POINTS: Point[] = [
  { x: 5, y: 95 }, { x: 95, y: 5 }, { x: 95, y: 95 }, { x: 5, y: 5 }, { x: 50, y: 95 }, { x: 95, y: 50 }, { x: 50, y: 5 }, { x: 5, y: 50 },
];
/** While a boss lives, at most two waves of this many come (from all eight points). */
const BOSS_WAVES = 2;
const UNITS_WHILE_BOSS = 5;
/** The last stage stops at this many enemies, and goes on below the second number. */
const MOST_ENEMIES = 80;
const GO_ON_BELOW = 30;
/** After a boss falls, the next wave this many seconds later. */
const AFTER_BOSS = 5;
/** The army stands round this tile. */
export const ARMY_AT: Point = { x: 50, y: 50 };

export function survivalMap(quest: number | string): SurvivalMap | null {
  return SURVIVAL.maps.find((m) => String(m.quest) === String(quest)) ?? null;
}

/**
 * Lives left now, as the Flash client counts them: of the save's
 * survivalVidaTimeStamp (each life's use), those older than `hours` are
 * back, the rest are used, out of 3; bought lives on top. `next`: seconds
 * until the next one comes back (0 when none is out).
 */
export function livesLeft(used: unknown, extra: unknown, now: number, hours: number): { left: number; next: number } {
  const bought = Number(extra) || 0;
  if (!Array.isArray(used)) {
    return { left: bought, next: 0 };
  }
  const times = used.map(Number);
  const back = hours * 3600;
  const out = times.filter((t) => now - t < back);
  const left = times.length - out.length + Math.max(LIVES - times.length, 0) + bought;
  const next = out.length ? Math.max(Math.min(...out) + back - now, 0) : 0;
  return { left, next };
}

/** The unit won for holding out this long, or null: the best of the arena's prizes passed. */
export function prizeOf(map: SurvivalMap, seconds: number): number | null {
  if (!map.prizes.length || seconds <= map.prizes[0][0] * 60) {
    return null;
  }
  let won: number | null = null;
  for (const [minutes, unit] of map.prizes) {
    if (seconds < minutes * 60) {
      break;
    }
    won = unit;
  }
  return won;
}

/** The arena's army: the town's units (armyOf), strongest first, 30 at most. */
export function survivalArmy(army: [number, number][], items: Map<number, ItemInfo>): [number, number][] {
  const strongest = [...army].sort((a, b) => (items.get(b[0])?.attack ?? 0) - (items.get(a[0])?.attack ?? 0));
  const out: [number, number][] = [];
  let left = ARMY_SIZE;
  for (const [id, n] of strongest) {
    if (left <= 0) {
      break;
    }
    const take = Math.min(n, left);
    out.push([id, take]);
    left -= take;
  }
  return out;
}

/** What the bar says: a wave or a boss is coming, by its number. */
export type SurvivalNews = { kind: "wave" | "boss"; number: number };

/**
 * One stand in the arena: the waves, as the Flash client times them, and
 * the enemies' minds (IASurvival there): each heads for the relic and
 * attacks it. The original let one turn on whoever hit it, but its next
 * thought sent it back to the relic at once, so in play they all keep at
 * the relic. Call `step` every frame.
 */
export class Survival {
  readonly map: SurvivalMap;
  private readonly battle: Battle;
  readonly relic: Fighter;
  private readonly items: Map<number, ItemInfo>;
  private readonly random: () => number;
  private readonly news: (news: SurvivalNews) => void;
  /** Frames held (counted while the battle runs). */
  frames = 0;
  killed = 0;
  private spawn = 0;
  private wave = 0;
  private waitingForBoss = false;
  private bossWaves = 0;
  private bossesKilled: number[] = [];
  private alive = new Set<Fighter>();
  readonly bosses = new Set<Fighter>();
  private lastPoint = 0;
  /** The frame the next wave comes on, or null while none is due. */
  private nextAt: number | null = null;

  constructor(parts: { map: SurvivalMap; battle: Battle; relic: Fighter; items: Map<number, ItemInfo>; random: () => number;
    news: (news: SurvivalNews) => void; }) {
    this.map = parts.map;
    this.battle = parts.battle;
    this.relic = parts.relic;
    this.items = parts.items;
    this.random = parts.random;
    this.news = parts.news;
  }

  get seconds(): number {
    return Math.floor(this.frames / FPS);
  }

  /** The first wave. */
  start(): void {
    this.spawnWave();
  }

  /** Every frame: the clock, the waves when due, and the enemies' minds. */
  step(): void {
    if (this.relic.dead) {
      return;
    }
    this.frames++;
    if (this.nextAt !== null && this.battle.frame >= this.nextAt) {
      this.nextAt = null;
      this.spawnWave();
    }
    if (this.battle.frame % 15 === 0) {
      this.think();
    }
  }

  /** An enemy fell (the battle's onDeath): the count, a boss's fall, or the next wave at once when the field is clear. */
  killedOne(fighter: Fighter): void {
    if (!this.alive.delete(fighter)) {
      return;
    }
    this.killed++;
    let bossDown = false;
    if (this.waitingForBoss) {
      const bossWave = this.map.waves[this.wave];
      if (bossWave.units.includes(fighter.item.id)) {
        this.bossesKilled.push(fighter.item.id);
      }
      if (this.bossesKilled.length === bossWave.units.length) {
        this.waitingForBoss = false;
        this.nextAt = this.battle.frame + AFTER_BOSS * FPS;
        bossDown = true;
      }
    }
    const last = this.wave >= this.map.waves.length - 1;
    if ((this.alive.size === 0 || (last && this.alive.size < GO_ON_BELOW)) && !bossDown) {
      this.nextAt = null;
      this.spawnWave();
    }
  }

  get enemies(): number {
    return this.alive.size;
  }

  private spawnWave(): void {
    const last = this.wave >= this.map.waves.length - 1;
    if (this.relic.dead || (this.waitingForBoss && this.bossWaves === BOSS_WAVES) || (last && this.alive.size >= MOST_ENEMIES)) {
      return;  // until a kill brings the next
    }
    const wasWaiting = this.waitingForBoss;
    const { ids, delay } = this.nextIds();
    const everywhere = wasWaiting || this.wave >= this.map.waves.length - 1;
    let point = this.randomPoint();
    for (let p = 0; p < (everywhere ? SPAWN_POINTS.length : 1); p++) {
      if (everywhere) {
        point = SPAWN_POINTS[p];
      }
      for (const id of ids) {
        const boss = !wasWaiting && this.waitingForBoss;
        if (boss) {
          point = this.randomPoint();
        }
        const item = this.items.get(id);
        const tile = this.battle.freeTileNear(point, true);
        if (!item || !tile) {
          continue;
        }
        const enemy = this.battle.add(item, tile.x, tile.y, ENEMY, { noConvert: true });
        if (boss) {
          enemy.steadfast = true;
          this.bosses.add(enemy);
        }
        this.alive.add(enemy);
      }
    }
    this.nextAt = this.battle.frame + delay * FPS;
  }

  /** Which units come next, and the seconds to the wave after, as the Flash client picks them. */
  private nextIds(): { ids: number[]; delay: number } {
    const waves = this.map.waves;
    if (!this.waitingForBoss) {
      this.spawn++;
    }
    let index = -1;
    let from = 0;
    for (let i = 0; i < waves.length; i++) {
      if (this.spawn >= from && this.spawn <= from + waves[i].spawns) {
        index = i;
        break;
      }
      from += waves[i].spawns;
    }
    const found = index >= 0;
    if (!found) {
      index = waves.length - 1;
    }
    const delay = this.waitingForBoss ? waves[index].bossSeconds ?? waves[index].seconds : waves[index].seconds;
    if (this.waitingForBoss) {
      index--;
      this.bossWaves++;
    } else {
      this.wave = index;
    }
    const wave = waves[Math.max(index, 0)];
    let ids: number[];
    if (wave.boss) {
      ids = [...wave.units];
      this.waitingForBoss = true;
      this.bossesKilled = [];
      this.bossWaves = 0;
    } else {
      const n = this.waitingForBoss ? UNITS_WHILE_BOSS : wave.count;
      ids = Array.from({ length: n }, () => wave.units[Math.floor(this.random() * wave.units.length)]);
    }
    if (found && (!this.waitingForBoss || this.bossWaves === 0)) {
      const pairs = Math.floor((this.wave + 1) / 2);
      this.news(this.waitingForBoss ? { kind: "boss", number: pairs } : { kind: "wave", number: this.spawn - pairs });
    }
    return { ids, delay };
  }

  /** One of the eight points, never the last one used. */
  private randomPoint(): Point {
    let i = Math.floor(this.random() * SPAWN_POINTS.length);
    while (i === this.lastPoint) {
      i = Math.floor(this.random() * SPAWN_POINTS.length);
    }
    this.lastPoint = i;
    return SPAWN_POINTS[i];
  }

  /** The enemies' minds: at the relic, whoever hits them. */
  private think(): void {
    for (const enemy of this.alive) {
      if (!enemy.dead && enemy.target !== this.relic) {
        this.battle.attackWith([enemy], this.relic);
        enemy.forced = true;
      }
    }
  }
}
