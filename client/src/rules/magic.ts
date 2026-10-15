// Spells (CLIENT.md, "Spells"): the fifteen the Wizard teaches, as the
// Flash client casts them in battle. The names, mana, levels, prices and
// areas come from the game config's "magics" table, as the server reads
// them (magic.py); what each spell does, and how much, is written here from
// our notes on the original (rules/spells-notes.json). Times are frames of
// the battle, 30 a second, counted from the tap that casts.
//
// The tapped tile is the bottom corner of the spell's square, not its middle:
// the square is the A x A tiles up and to the left of it, A being the
// spell's area at its rank.

import { ENEMY, SELF, SUBCAT, type Battle, type Fighter } from "./battle.ts";
import type { GameConfig, ItemInfo } from "./config.ts";
import { unitPoint, type Point } from "./geometry.ts";
import { isWalkable } from "./walking.ts";

/** Spells start at this level: the Wizardry building comes then. */
export const MAGIC_LEVEL = 35;
/** A spell grows stronger after this many casts, and again after the second. */
const RANK_2_CASTS = 25;
const RANK_3_CASTS = 50;

export interface SpellInfo {
  id: number;
  name: string;
  description: string;
  /** Mana a cast takes. */
  mana: number;
  /** The level it can be learnt from, and its price in gold or cash. */
  level: number;
  gold: number;
  cash: number;
  /** Its picture (images_new/<art>.jpg) and its animation on the field (the sheet <art>). */
  art: string;
  /** Who's lit up while aiming: 2 enemies, 1 the player's own, 0 nobody. */
  target: number;
  /** The side of its square at ranks 1, 2 and 3. */
  areas: [number, number, number];
}

/** The config's magics table. */
export function readSpells(config: GameConfig): SpellInfo[] {
  const rows = (config.magics ?? []) as Record<string, unknown>[];
  return rows.map((row): SpellInfo => {
    let areas: number[] = [5, 7, 9];
    try {
      areas = JSON.parse(String(row.area)) as number[];
    } catch {
      // The usual 5, 7, 9.
    }
    return {
      id: Number(row.id),
      name: String(row.name ?? ""),
      description: String(row.description ?? ""),
      mana: Number(row.mana) || 0,
      level: Number(row.level) || 0,
      gold: Number(row.gold) || 0,
      cash: Number(row.cash) || 0,
      art: String(row.img_name ?? ""),
      target: Number(row.target) || 0,
      areas: [Number(areas[0]) || 1, Number(areas[1] ?? areas[0]) || 1, Number(areas[2] ?? areas[0]) || 1],
    };
  }).filter((spell) => SPELLS.has(spell.id)).sort((a, b) => a.level - b.level || a.id - b.id);
}

/** A spell's rank after this many casts: 1, then 2 from 25, 3 from 50. */
export function rankOf(casts: number): 1 | 2 | 3 {
  return casts >= RANK_3_CASTS ? 3 : casts >= RANK_2_CASTS ? 2 : 1;
}

/**
 * The rank a cast works at: the Flash client counts the cast before
 * working out its numbers, so the 25th cast is already a rank 2 one.
 */
export function castRank(castsBefore: number): 1 | 2 | 3 {
  return rankOf(castsBefore + 1);
}

export function areaOf(spell: SpellInfo, rank: number): number {
  return spell.areas[Math.min(3, Math.max(1, rank)) - 1];
}

/** The tiles a spell's marker covers: x and y from tile - A + 1 to tile. */
export function markedSquare(spell: SpellInfo, rank: number, tile: Point): { x0: number; y0: number; x1: number; y1: number } {
  const a = areaOf(spell, rank);
  return { x0: tile.x - a + 1, y0: tile.y - a + 1, x1: tile.x, y1: tile.y };
}

/** The middle of the marker's square. */
export function markedMiddle(spell: SpellInfo, rank: number, tile: Point): Point {
  const a = areaOf(spell, rank);
  return { x: tile.x - Math.floor(a / 2), y: tile.y - Math.floor(a / 2) };
}

/** What the marker lights up while aiming: the spell's target side, on its square. */
export function marked(battle: Battle, spell: SpellInfo, rank: number, tile: Point): Fighter[] {
  if (spell.target === 0) {
    return [];
  }
  const side = spell.target === 1 ? SELF : ENEMY;
  const square = markedSquare(spell, rank, tile);
  return battle.fighters.filter((f) => !f.dead && f.side === side && covers(f, square));
}

function covers(f: Fighter, s: { x0: number; y0: number; x1: number; y1: number }): boolean {
  if (f.isUnit) {
    return f.tx >= s.x0 && f.tx <= s.x1 && f.ty >= s.y0 && f.ty <= s.y1;
  }
  // A building: any of its tiles.
  return f.tx >= s.x0 && f.tx - f.item.width + 1 <= s.x1 && f.ty >= s.y0 && f.ty - f.item.height + 1 <= s.y1;
}

/** Bosses, town halls, chests and keys: spared by the spells that swallow or crush. */
const BOSS = SUBCAT.boss;
const SPARED_BY_SWALLOWING = new Set<number>([SUBCAT.boss, SUBCAT.townHall, SUBCAT.treasure, SUBCAT.activator]);
const SPARED_BY_HAIL = new Set<number>([SUBCAT.townHall, SUBCAT.treasure, SUBCAT.activator]);
/** Units this strong when they came can't be swallowed. */
const UNSWALLOWABLE_LIFE = 500;
/** Ultimate Hail knocks a unit down this long; big units (this much population or more) stand. */
const KNOCKED_DOWN = 75;
const BIG_POPULATION = 4;
/** The summoned units: the golem, the yeti, and the five dragons one of which comes. */
const GOLEM = 630;
const YETI = 631;
const DRAGONS = [862, 853, 875, 891, 846];
/** A summoned unit finds a free tile at most this many rings from the tapped one. */
const SUMMON_RINGS = 4;

interface Numbers {
  [name: string]: number;
}

/** What each spell does at ranks 1, 2 and 3. */
const SPELLS = new Map<number, Numbers[]>([
  [2, [{ damage: 150 }, { damage: 200 }, { damage: 250 }]],                    // Fire Havoc
  [3, [{ damage: 800 }, { damage: 1000 }, { damage: 1500 }]],                  // Ultimate Hail
  [4, [{ frames: 450 }, { frames: 600 }, { frames: 900 }]],                    // Deadly Frostbite
  [5, [{ seconds: 0 }, { seconds: 5 }, { seconds: 10 }]],                      // Sacred Rain
  [6, [{ life: 4000 }, { life: 5000 }, { life: 7000 }]],                       // Golem's Wrath
  [7, [{}, {}, {}]],                                                           // Hell Abyss
  [8, [{ damage: 15, ticks: 5 }, { damage: 20, ticks: 7 }, { damage: 25, ticks: 10 }]],  // Poisonous Flood
  [9, [{ factor: 0.7, frames: 600 }, { factor: 0.55, frames: 900 }, { factor: 0.4, frames: 1200 }]],  // Ether Shield
  [10, [{ life: 4000 }, { life: 5000 }, { life: 7000 }]],                      // Yeti's Trail
  [11, [{ frames: 900 }, { frames: 1350 }, { frames: 1800 }]],                 // Age of Colossus
  [12, [{ life: 4000, lasts: 900 }, { life: 5000, lasts: 1800 }, { life: 7000, lasts: 0 }]],  // Summon Dragon
  [13, [{}, {}, {}]],                                                          // Instant Limit
  [14, [{ frames: 450 }, { frames: 900 }, { frames: 1350 }]],                  // 2x Speed
  [15, [{ frames: 450 }, { frames: 900 }, { frames: 1350 }]],                  // 2x Range
  [16, [{ swallows: 16 }, { swallows: 21 }, { swallows: 31 }]],                // Black Hole
]);

export interface CastOptions {
  items: Map<number, ItemInfo>;
  random?: () => number;
}

/**
 * Cast a spell on a tile at a rank: its pictures and its effects follow on
 * their frames. Nothing checks there's anything there: a cast on empty
 * ground still costs its mana and counts.
 */
export function castSpell(battle: Battle, spell: SpellInfo, rank: 1 | 2 | 3, tile: Point, options: CastOptions): void {
  const random = options.random ?? Math.random;
  const a = areaOf(spell, rank);
  const numbers = SPELLS.get(spell.id)?.[rank - 1] ?? {};
  const middle = markedMiddle(spell, rank, tile);
  const half = Math.ceil(a / 2);
  const enemy = (f: Fighter) => f.side === ENEMY;
  const mine = (f: Fighter) => f.side === SELF;
  const at = (x: number, y: number) => unitPoint(x, y);
  // The (A+1) x (A+1) tiles some spells fall on, the tapped tile their bottom corner.
  const rain = (each: (x: number, y: number) => void) => {
    for (let y = tile.y - a; y <= tile.y; y++) {
      for (let x = tile.x - a; x <= tile.x; x++) {
        each(x, y);
      }
    }
  };
  const unitOn = (x: number, y: number) => {
    const there = battle.standingAt(x, y);
    return there?.isUnit ? there : null;
  };
  const swallowable = (f: Fighter) => enemy(f) && !SPARED_BY_SWALLOWING.has(f.item.subcategory)
    && !(f.isUnit && f.maxLife >= UNSWALLOWABLE_LIFE);

  switch (spell.id) {
    case 2: {
      // Fire Havoc: 30 fireballs, one every 3 frames, each landing 10 frames
      // after it shows. Every third falls on an enemy fighter in the middle
      // of the square (as they stood at the cast), the others anywhere in it.
      const aimed = battle.within(middle, Math.floor(a / 2), 30, (f) => enemy(f) && f.isUnit && f.attack > 0
        && f.item.subcategory !== SUBCAT.peasant).map((f) => ({ x: f.tx, y: f.ty }));
      const square = markedSquare(spell, rank, tile);
      for (let i = 0; i < 30; i++) {
        battle.after(3 * i, () => {
          const spot = i % 3 === 0 && aimed.length ? aimed[Math.floor(random() * aimed.length)]
            : { x: square.x0 + Math.floor(random() * a), y: square.y0 + Math.floor(random() * a) };
          battle.show({ art: spell.art, at: at(spot.x, spot.y), above: true });
          battle.after(10, () => {
            // Whatever stands there when it lands, the player's own too.
            const there = battle.standingAt(spot.x, spot.y);
            if (there) {
              battle.hurt(there, numbers.damage, null);
            }
          });
        });
      }
      break;
    }
    case 3:
      // Ultimate Hail: a boulder on every tile, each in its own time.
      // Enemy buildings take it all; enemy units are knocked down and take a tenth.
      rain((x, y) => {
        const delay = Math.floor(random() * 100);
        battle.after(delay, () => battle.show({ art: spell.art, at: at(x, y) }));
        battle.after(delay + 18, () => {
          const there = battle.standingAt(x, y);
          if (!there || !enemy(there)) {
            return;
          }
          if (!there.isUnit) {
            if (!SPARED_BY_HAIL.has(there.item.subcategory)) {
              battle.hurt(there, numbers.damage, null);
            }
            return;
          }
          if (!battle.isEnlarged(there) && !battle.isStilled(there) && there.item.subcategory !== BOSS
            && there.item.population < BIG_POPULATION) {
            battle.still(there, KNOCKED_DOWN);
          }
          battle.hurt(there, numbers.damage / 10, null);
        });
      });
      break;
    case 4:
      // Deadly Frostbite: ice on every tile; an enemy unit there (not a boss) freezes.
      rain((x, y) => {
        const delay = Math.floor(random() * 60);
        battle.after(delay, () => battle.show({ art: spell.art, at: at(x, y), scale: 0.5, alpha: 0.7, above: true }));
        battle.after(delay + 1, () => {
          const there = unitOn(x, y);
          if (there && enemy(there) && there.item.subcategory !== BOSS) {
            battle.still(there, numbers.frames, true);
          }
        });
      });
      break;
    case 5:
      // Sacred Rain: 100 life to each of the player's units under a drop;
      // at ranks 2 and 3, 20 more each second for 5 or 10 seconds.
      rain((x, y) => {
        const delay = Math.floor(random() * 30);
        battle.after(delay, () => battle.show({ art: spell.art, at: at(x, y), above: true }));
        battle.after(delay + 30, () => {
          const there = unitOn(x, y);
          if (!there || !mine(there)) {
            return;
          }
          battle.heal(there, 100);
          for (let s = 1; s <= numbers.seconds; s++) {
            battle.after(30 * s, () => battle.heal(there, 20));
          }
        });
      });
      break;
    case 6:
    case 10:
    case 12: {
      // A summoning: the golem, the yeti, or one of five dragons, on the
      // tapped tile or the nearest free one; no room, nothing comes.
      battle.show({ art: spell.art, at: at(tile.x, tile.y) });
      battle.after(57, () => {
        const id = spell.id === 6 ? GOLEM : spell.id === 10 ? YETI : DRAGONS[Math.floor(random() * DRAGONS.length)];
        const item = options.items.get(id);
        const spot = item && summonSpot(battle, tile);
        if (!item || !spot) {
          return;
        }
        const summoned = battle.add(item, spot.x, spot.y, SELF, { life: numbers.life, maxLife: numbers.life, summoned: true });
        if (numbers.lasts) {
          battle.after(numbers.lasts, () => battle.fade(summoned));
        }
      });
      break;
    }
    case 7:
      // Hell Abyss: the ground opens and swallows the enemies in the middle.
      battle.after(10, () => battle.show({ art: spell.art, at: at(tile.x, tile.y), scale: a / 5 }));
      battle.after(28, () => {
        for (const f of battle.within(middle, half, a * a, swallowable)) {
          battle.swallow(f);
        }
      });
      break;
    case 8:
      // Poisonous Flood: enemy units round the tapped tile are poisoned.
      battle.after(10, () => battle.show({ art: spell.art, at: at(tile.x, tile.y), above: true }));
      battle.after(27, () => {
        for (const f of battle.within(tile, a, a * a, (f) => enemy(f) && f.isUnit && f.item.subcategory !== BOSS)) {
          if (!f.poison) {
            f.poison = { damage: numbers.damage, left: numbers.ticks, next: battle.frame + 90 };
          }
        }
      });
      break;
    case 9: {
      // Ether Shield: hits on anyone standing in the square are cut, at once, for a while.
      const square = markedSquare(spell, rank, tile);
      battle.addShield(square.x0, square.y0, square.x1, square.y1, numbers.factor, numbers.frames);
      battle.show({ art: spell.art, at: at(tile.x, tile.y), scale: a / 3, alpha: 0.3, until: battle.frame + numbers.frames });
      break;
    }
    case 11:
      // Age of Colossus: the player's units round the tapped tile grow, and hit half again as hard.
      for (const f of battle.within(tile, a, a * a, (f) => mine(f) && f.isUnit && f.item.subcategory !== BOSS)) {
        battle.after(10, () => battle.show({ art: spell.art, at: at(f.tx, f.ty) }));
        battle.after(20, () => {
          if (!f.dead && !battle.isEnlarged(f)) {
            f.grewAt = battle.frame;
            f.enlargedUntil = battle.frame + numbers.frames;
          }
        });
      }
      break;
    case 13:
    case 14:
    case 15: {
      // Instant Limit, 2x Speed, 2x Range: on up to 20 of the player's units in the middle.
      const chosen = battle.within(middle, half, 20, (f) => mine(f) && f.isUnit
        && (spell.id !== 13 || f.limitMax !== undefined));
      battle.after(10, () => {
        battle.show({ art: spell.art, at: at(tile.x, tile.y), scale: a / 3 });
        for (const f of chosen) {
          battle.show({ art: spell.art, at: at(f.tx, f.ty) });
        }
      });
      battle.after(20, () => {
        for (const f of chosen) {
          if (f.dead) {
            continue;
          }
          if (spell.id === 13) {
            f.limit = f.limitMax;
          } else {
            boost(battle, f, spell.id === 14 ? "speed" : "range", numbers.frames);
          }
        }
      });
      break;
    }
    case 16:
      // Black Hole: a hole that swallows the enemies in the middle, once a second for a while.
      battle.after(10, () => battle.show({ art: spell.art, at: at(tile.x, tile.y), scale: a / 4, alpha: 0.85,
        until: battle.frame + 45 + 30 * (numbers.swallows - 1) + 45 }));
      for (let k = 0; k < numbers.swallows; k++) {
        battle.after(55 + 30 * k, () => {
          for (const f of battle.within(middle, half, a * a, swallowable)) {
            battle.swallow(f);
          }
        });
      }
      break;
  }
}

/** Doubled speed or reach for a while; a newer cast takes over (and renews the time) instead of doubling again. */
let boostCount = 0;
function boost(battle: Battle, f: Fighter, what: "speed" | "range", frames: number): void {
  const token = ++boostCount;
  f.boosts = { ...f.boosts, [what]: token };
  if (what === "speed") {
    f.velocity = Math.floor(f.item.velocity * 2);
  } else {
    f.range = Math.floor(f.item.attackRange * 2);
  }
  battle.after(frames, () => {
    if (f.boosts?.[what] !== token) {
      return;
    }
    delete f.boosts[what];
    if (what === "speed") {
      f.velocity = f.item.velocity;
    } else {
      f.range = f.item.attackRange;
    }
  });
}

/** Where a summoned unit comes: the tapped tile if free, else the nearest free tile on the first ring out that has one. */
export function summonSpot(battle: Battle, tile: Point): Point | null {
  const grid = battle.walkGrid();
  const free = (x: number, y: number) => isWalkable(grid, x, y) && !battle.standingAt(x, y);
  for (let ring = 0; ring <= SUMMON_RINGS; ring++) {
    let best: Point | null = null;
    let bestDistance = Infinity;
    for (let y = tile.y - ring; y <= tile.y + ring; y++) {
      for (let x = tile.x - ring; x <= tile.x + ring; x++) {
        if (Math.max(Math.abs(x - tile.x), Math.abs(y - tile.y)) !== ring || !free(x, y)) {
          continue;
        }
        const d = (x - tile.x) ** 2 + (y - tile.y) ** 2;
        if (d < bestDistance) {
          best = { x, y };
          bestDistance = d;
        }
      }
    }
    if (best) {
      return best;
    }
  }
  return null;
}

/** What the player has of magic: mana, and each spell learnt with how often it's been cast (privateState). */
export interface MagicState {
  mana: number;
  /** Spell id: times cast. A spell is known once it's here. */
  casts: Record<string, number>;
}

export function readMagic(privateState: Record<string, unknown> | undefined): MagicState {
  const casts = privateState?.magics;
  return {
    mana: Number(privateState?.mana) || 0,
    casts: casts && typeof casts === "object" && !Array.isArray(casts) ? { ...(casts as Record<string, number>) } : {},
  };
}

/**
 * Whether spells are used at all: as in the Flash client, a human empire
 * gets them at level 35 (with the Wizardry Academy), a troll one always.
 */
export function magicOpen(race: string, level: number): boolean {
  return race !== "h" || level >= MAGIC_LEVEL;
}

/**
 * Why a spell can't be learnt, or "" when it can. As in the Flash client,
 * gold needs the spell's level, but cash learns it at any level.
 */
export function learnProblem(spell: SpellInfo, state: MagicState, level: number, money: { gold: number; cash: number },
  withCash: boolean): string {
  if (String(spell.id) in state.casts) {
    return `${spell.name} is already known.`;
  }
  if (withCash) {
    return money.cash < spell.cash ? `Not enough cash: ${spell.name} takes ${spell.cash}.` : "";
  }
  if (level < spell.level) {
    return `${spell.name} can be learnt with gold from level ${spell.level}, or with cash now.`;
  }
  return money.gold < spell.gold ? `Not enough gold: ${spell.name} takes ${spell.gold.toLocaleString("en-US")}.` : "";
}

/** Learning gives the spell's mana once, so the first cast is free. */
export function learn(spell: SpellInfo, state: MagicState): void {
  state.casts[String(spell.id)] = 0;
  state.mana += spell.mana;
}

/** The spells known, in the config's order. */
export function knownSpells(spells: SpellInfo[], state: MagicState): SpellInfo[] {
  return spells.filter((spell) => String(spell.id) in state.casts);
}

/** A cast's cost and count: mana down, one more cast. Returns the rank it works at. */
export function spend(spell: SpellInfo, state: MagicState): 1 | 2 | 3 {
  const before = Number(state.casts[String(spell.id)] ?? 0);
  state.mana -= spell.mana;
  state.casts[String(spell.id)] = before + 1;
  return castRank(before);
}
