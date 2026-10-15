// Battles, as the Flash client fights them (our notes, our words; CLIENT.md,
// "Battles"): who attacks whom, how hard, how often, how units walk to
// their spot and how shots fly. No drawing here: the view reads the
// fighters and the events this leaves, and draws them.
//
// Everything is counted in frames of the Flash client, 30 a second, on one
// clock, as the original does: a swordsman's attack_interval of 35 means a
// hit every 35 frames. The view steps the battle 30 times a second (more to
// play it faster). Chance comes from a random function given in, so a test
// (or one day the server) can play the same battle twice and get the same
// result.

import type { ItemInfo } from "./config.ts";
import { MAP_TILES, TILE_HEIGHT, buildingPoint, tileUnder, unitPoint, type Point } from "./geometry.ts";
import { findPath, headingTo, isWalkable, type WalkGrid } from "./walking.ts";

/** Frames a second, as the Flash client counts them. */
export const FPS = 30;
/** A unit's mind works every 61 frames (about 2 seconds): looking for enemies, turning. */
export const THINK_EVERY = 61;
/** How far a unit looks for enemies, in tiles. */
export const AGGRO_RANGE = 10;
/** A unit looks at its attack every 5 frames; hits land on its attack_interval's beat. */
const ATTACK_CHECK_EVERY = 5;
/** Allies this many tiles around something hit come to help. */
const HELP_RINGS = 4;
/** A dead unit lies 4 seconds, then fades for 1, then is gone. */
export const DEAD_FRAMES = 5 * FPS;
/** Re-planning a chase waits at least 300 ms. */
const REPLAN_FRAMES = 9;
/** Swallowed things sink, and summoned ones fade, for half a second. */
const SINK_FRAMES = 15;
/** A thrown unit lies helpless this long. */
const THROWN_FRAMES = 30;
/** Poison bites every 3 seconds. */
const POISON_EVERY = 90;
/** An enlarged unit's hits. */
const ENLARGED_HIT = 1.5;
/** A shot hurts its target only if the target is within 100 pixels of where it lands. */
const BLAST_PIXELS = 100;
/** A wandering defender goes home past 20 tiles (across plus down). */
const DEFENSIVE_LEASH = 20;
/** Damage: plus or minus 4 at random; 1 hit in 10 is a critical, half again. */
const VARIANCE = 8;
const CRIT_PERCENT = 10;
const CRIT_MULTIPLIER = 1.5;

export const SUBCAT = {
  peasant: 71, cleric: 72, settler: 73, cow: 74, sheep: 75, cart: 76, special: 77, footman: 78, mounted: 79,
  archer: 80, siege: 81, animal: 82, boss: 84, bossAdd: 85, eagle: 86, pet: 87, horse: 88, kamikaze: 89, boar: 90,
  farm: 122, townHall: 135, healing: 137, tower: 211, wall: 221, door: 222, castle: 231, deco: 411,
  treasure: 811, activator: 812, atrezzo: 1011, dragonKiller: 1711,
} as const;

export const SELF = 1;
export const ENEMY = 2;
export const NEUTRAL = 3;
export type Side = typeof SELF | typeof ENEMY | typeof NEUTRAL;

/**
 * How a unit behaves on its own: aggressive ones look for enemies; defensive
 * ones too, but go home if they stray; passive ones only do as told; the
 * ones that survive (villagers, animals, healers) run when hit.
 */
export type Condition = "aggressive" | "defensive" | "passive" | "survive";

/** The units that heal their own side instead of attacking. */
const HEALERS = new Set([502, 590, 866, 886]);
/** Units with range that still hit up close (bosses, the Juggernaut, the Angel Mecha). */
const RANGED_MELEE = new Set([538, 545, 650, 702]);
/** The level 1 town hall never shoots (its attack is 0 anyway). */
const TOWN_HALL_1 = 26;
const ICE_TOWER = 384;
/** The kamikaze blows up instead of hitting: 500 to itself and to everything in the 5 x 5 tiles around. */
const KAMIKAZE = 575;
/**
 * The monk turns an enemy unit within 10 tiles to its side, instead of
 * hitting: one at a time (24 seconds apart), 4 in all, and none with 500
 * life or more, no boss, boss guard or eagle.
 */
const MONK = 569;
/** A boss getting away: 2 seconds, then 1.5 to fade. */
const FLEE_FRAMES = 105;
/** The golden dragons fire twice a beat, the second shot half a second later. */
const DOUBLE_SHOT = new Set([739]);
const SECOND_SHOT = 15;
/** The bosses' small golems and yetis have their own life, whatever the config says (the boss mind sets it). */
const LIFE_OF = new Map([[537, 100], [544, 120]]);
const CONVERT_RANGE = 10;
const CONVERT_LIMIT = 4;
const CONVERT_EVERY = 720;
const CONVERT_MAX_LIFE = 500;
const BLAST = 500;

export interface Fighter {
  /** A number of its own, in the order fighters were added. */
  readonly key: number;
  /** What it is (a dragon that changes form, or a chameleon, is another thing for a while). */
  item: ItemInfo;
  side: Side;
  readonly isUnit: boolean;
  /** Units: the tile under them, as they walk; buildings: the tile the save names (their last). */
  tx: number;
  ty: number;
  /** Units: where they are on the map, in pixels (their feet). */
  at: Point;
  life: number;
  maxLife: number;
  attack: number;
  /** Reach in tiles: the item's, doubled for a while by 2x Range. */
  range: number;
  /** Frames between hits: the item's, cut for a while by a war cry. */
  interval: number;
  velocity: number;
  flying: boolean;
  /** 0 to 4: spreads the units' attack checks over the 5 frames, as the Flash client does. */
  readonly offset: number;
  condition: Condition;
  target: Fighter | null;
  /** Wants to fight its target (walking to it, or hitting it). */
  attacking: boolean;
  /** Walking where it was told: it ignores enemies until it gets there. */
  forced: boolean;
  /** The tiles still to walk; `next` is the one it's heading for. */
  path: Point[];
  next: Point | null;
  dead: boolean;
  /** The frame it died on. */
  diedAt: number;
  /** Which way it faces (1 to 8, rules/geometry.ts) and what it's doing, for the drawing. */
  facing: number;
  /** The frame its last attack started, for the drawing (-1: none yet). */
  struckAt: number;
  /** Not before this frame may it re-plan a chase. */
  replanAt: number;
  /** Where it started: a defensive unit goes back there. */
  readonly home: Point;
  /** Lent by the island, or summoned by a spell: neither counted as lost nor rewarded. */
  free?: boolean;
  summoned?: boolean;
  /** The island's chest and such: can be collected once lit. */
  collectable?: boolean;
  /** What the battle's owner keeps with it (the town's PlacedItem, for the drawing). */
  tag?: unknown;
  /** Spells (rules/magic.ts). Can't move or attack before this frame: frozen, or knocked down. */
  stilledUntil?: number;
  /** Frozen (drawn blue; the ice tower leaves it alone) until this frame. */
  frozenUntil?: number;
  /** Poisoned: hurt by `damage` every 3 seconds, `left` more times, the next on frame `next`. */
  poison?: { damage: number; left: number; next: number } | null;
  /** Grown big (from frame `grewAt`), hitting half again as hard, until this frame. */
  enlargedUntil?: number;
  grewAt?: number;
  /** Grown by a move of its own (bigger, not stronger by the spell's half), until this frame. */
  grownUntil?: number;
  /** Being swallowed by the ground since this frame: it dies half a second later. */
  sinkingSince?: number;
  /** A summoned unit whose time is up, fading since this frame. */
  fadingSince?: number;
  /** A boss in a rage (the Rockdriller after 5 minutes): drawn redder. */
  enraged?: boolean;
  /** How far it looks for enemies (10 tiles if not set). */
  aggro?: number;
  /** Hits don't hurt it (the Dangerous Isle's black dragon): only its island's own wounds do. */
  invulnerable?: boolean;
  /** Drawn this many times its size. */
  scale?: number;
  /**
   * A camp's boss that gets away instead of dying (the Chinese dragon,
   * Neptune): below this share of its life it can't be hurt, says its line,
   * and is gone (counted as beaten) a few seconds later.
   */
  flee?: { below: number; line: number | null } | null;
  fleeing?: boolean;
  /** A shield of its own (rules/specials.ts): until when, and the share of each hit it still takes. */
  guard?: { until: number; taken: number } | null;
  /** Can't be picked as a target until this frame. */
  hiddenUntil?: number;
  /** Floating helpless under a seal until this frame (drawn higher). */
  liftedUntil?: number;
  /** Another form for a while: what it was, and until when. */
  form?: { base: ItemInfo; until: number; keepShare: boolean } | null;
  /** A werewolf made by a curse: it can't curse again. */
  cursed?: boolean;
  /** At home: a building of the player's burnt out at 0 life (it counts as dead until repaired in full). */
  ruined?: boolean;
  /** Units with a LIMIT move: how full its bar is, and full (heroes and special units). */
  limit?: number;
  limitMax?: number;
  /** Playing one of its special animations (rules/specials.ts): which (6 is the first), until this frame. */
  special?: { animation: number; until: number } | null;
  /** Too big to be thrown or knocked down (giants, gods, the biggest dragons). */
  giant?: boolean;
  /** A door opened (the Hero Isle's): units walk through it. */
  open?: boolean;
  /** A building held on one picture of its animation (a boss island's gate and gems), from 0. */
  still?: number;
  /** Turned to the other side by a monk (and back again, if a monk turns it twice). */
  converted?: boolean;
  /** A monk: how many it has turned, and the frame it can turn the next. */
  conversions?: number;
  convertReadyAt?: number;
  /** Which 2x Speed and 2x Range casts it carries: a newer cast takes over from an older one. */
  boosts?: { speed?: number; range?: number };
}

export type BattleEvent =
  | { kind: "hit"; fighter: Fighter; amount: number; crit: boolean; heal?: boolean; by?: Fighter | null }
  | { kind: "shot"; shot: Shot }
  | { kind: "landed"; shot: Shot }
  | { kind: "died"; fighter: Fighter; by: Fighter | null }
  | { kind: "gone"; fighter: Fighter }
  | { kind: "converted"; fighter: Fighter; by: Fighter }
  | { kind: "effect"; effect: Effect };

/**
 * A spell's picture on the field (one of the game's magic_* animations),
 * played from frame `start` of the battle, one picture a frame. Without
 * `until` it plays once; with it, it stays until then, going round its last
 * part (the shield, the black hole), then fades.
 */
export interface Effect {
  art: string;
  at: Point;
  start: number;
  until?: number;
  scale?: number;
  alpha?: number;
  /** In front of everything (falling fireballs, rocks, rain), or on the ground. */
  above?: boolean;
}

/** An Ether Shield's zone: hits on fighters standing in it are cut to `factor`. */
interface Shield {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  factor: number;
  until: number;
}

/** A projectile on its way. */
export interface Shot {
  readonly from: Point;
  /** Where it will land: where the target stood when it was fired. */
  readonly to: Point;
  readonly target: Fighter;
  readonly by: Fighter;
  /** The picture: the game's projectile number (1 arrow, 3 cannonball...). */
  readonly type: number;
  /** How high it arcs, relative to its flight. */
  readonly arc: number;
  readonly frames: number;
  frame: number;
  /** What it does when it lands, if not the shooter's attack: a special move's share. */
  readonly damage?: number;
}

export interface BattleOptions {
  /** Which tiles can be walked on (rules/walking.ts); buildings are added by the battle. */
  ground: WalkGrid;
  random?: () => number;
  /** Told of each death, before units look for new targets (the quest counts and pays). */
  onDeath?: (fighter: Fighter, by: Fighter | null) => void;
  /**
   * The player's own town: their buildings are never destroyed there. At
   * 0 life one burns out and stays (`ruined`): it can't be hit, doesn't
   * shoot, and stays out of the fight until villagers repair it in full.
   */
  home?: boolean;
}

export class Battle {
  frame = 0;
  readonly fighters: Fighter[] = [];
  readonly shots: Shot[] = [];
  /** What happened since the view last looked: it takes them with takeEvents(). */
  private events: BattleEvent[] = [];
  /** The battle's chance: everything random in it comes from here (rules/raids.ts too). */
  readonly random: () => number;
  /** Told of each death, before units look for new targets (the quest counts and pays; a raid counts). */
  onDeath: (fighter: Fighter, by: Fighter | null) => void;
  /** Ground the battle can walk on, without buildings. */
  private readonly ground: WalkGrid;
  /** The same with the standing buildings' footprints taken out. */
  private grid: WalkGrid;
  private gridStale = true;
  private nextKey = 1;
  private readonly home: boolean;
  /** Things due on a later frame (a kamikaze set off by another, a spell's effects). */
  private later: { frame: number; run: () => void }[] = [];
  private shields: Shield[] = [];
  /**
   * Special moves (rules/specials.ts) listen here. `onBeat` hears a unit's
   * attack beat first and returns true when a special move takes it
   * instead of the normal hit; `onDealt` hears the damage (or healing) a
   * fighter deals, for its LIMIT bar.
   */
  onBeat: (unit: Fighter, target: Fighter) => boolean = () => false;
  onDealt: (by: Fighter, amount: number, healing: boolean) => void = () => {};
  /**
   * Told when a monk turns a unit, while it's still on its old side (a
   * quest counts it as fallen there). Monks only turn units when someone
   * listens: on the islands and at home (homeDefence.ts).
   */
  onConvert: ((unit: Fighter, by: Fighter) => void) | null = null;
  /**
   * The bosses with a mind of their own (rules/bossMinds.ts): the battle
   * moves them and fires their shots, but leaves the choosing to them.
   * They hear every hit, and every shot that lands.
   */
  readonly ownMind = new WeakSet<Fighter>();
  readonly onHurt: ((target: Fighter, damage: number, by: Fighter | null) => void)[] = [];
  readonly onLanded: ((shot: Shot, hit: boolean) => void)[] = [];

  constructor(options: BattleOptions) {
    this.ground = options.ground;
    this.grid = options.ground;
    this.random = options.random ?? Math.random;
    this.onDeath = options.onDeath ?? (() => {});
    this.home = options.home ?? false;
  }

  /** Put an item on the field: a unit on its tile, a building on its footprint. */
  add(item: ItemInfo, tx: number, ty: number, side: Side, extra: Partial<Fighter> = {}): Fighter {
    const fighter: Fighter = {
      key: this.nextKey++,
      item, side, isUnit: item.isUnit, tx, ty,
      at: item.isUnit ? unitPoint(tx, ty) : buildingPoint(tx, ty),
      life: item.life, maxLife: item.life, attack: item.attack,
      range: item.attackRange, interval: item.attackInterval, velocity: item.velocity, flying: item.flying,
      offset: Math.floor(this.random() * 5),
      condition: conditionOf(item),
      target: null, attacking: false, forced: false, path: [], next: null,
      dead: false, diedAt: -1, facing: [4, 5, 8][Math.floor(this.random() * 3)], struckAt: -1, replanAt: 0,
      home: { x: tx, y: ty },
      ...extra,
    };
    const life = LIFE_OF.get(item.id);
    if (life !== undefined && extra.life === undefined) {
      fighter.life = fighter.maxLife = life;
    }
    this.fighters.push(fighter);
    if (!fighter.isUnit) {
      this.gridStale = true;
    }
    return fighter;
  }

  /** The events since the last call, oldest first. */
  takeEvents(): BattleEvent[] {
    const events = this.events;
    this.events = [];
    return events;
  }

  /** One frame of the battle. */
  step(): void {
    this.frame++;
    const frame = this.frame;
    for (const fighter of [...this.fighters]) {
      if (fighter.dead) {
        if (frame - fighter.diedAt >= DEAD_FRAMES && fighter.isUnit) {
          this.fighters.splice(this.fighters.indexOf(fighter), 1);
          this.events.push({ kind: "gone", fighter });
        }
        continue;
      }
      if (fighter.sinkingSince !== undefined) {
        if (frame - fighter.sinkingSince >= SINK_FRAMES) {
          this.kill(fighter, null);
        }
        continue;
      }
      if (fighter.fadingSince !== undefined) {
        if (frame - fighter.fadingSince >= SINK_FRAMES) {
          this.remove(fighter);
        }
        continue;
      }
      if (fighter.isUnit) {
        this.stepUnit(fighter, frame);
      } else {
        this.stepBuilding(fighter, frame);
      }
    }
    for (const due of this.later.filter((d) => d.frame <= frame)) {
      this.later.splice(this.later.indexOf(due), 1);
      due.run();
    }
    this.shields = this.shields.filter((shield) => shield.until > frame);
    for (const shot of [...this.shots]) {
      shot.frame++;
      if (shot.frame >= shot.frames) {
        this.shots.splice(this.shots.indexOf(shot), 1);
        this.land(shot);
      }
    }
  }

  // --- Orders from the player -------------------------------------------

  /** Send units to a tile, spread out around it; they ignore enemies on the way. */
  moveTo(units: Fighter[], tile: Point): void {
    const spots = this.spotsAround(tile, units.length);
    units.forEach((unit, i) => {
      unit.target = null;
      unit.attacking = false;
      const spot = spots[i] ?? tile;
      if (this.walk(unit, spot)) {
        unit.forced = true;
      }
    });
  }

  /** Send units to attack something: each to its own spot at its range from it. */
  attackWith(units: Fighter[], target: Fighter): void {
    // The longest reach first, as the Flash client shares out the spots.
    const order = [...units].sort((a, b) => b.range - a.range);
    const taken = new Set<number>();
    for (const unit of order) {
      if (unit.dead || target.dead || target.side === unit.side) {
        continue;
      }
      unit.target = target;
      unit.attacking = true;
      if (distance(unit, target) <= unit.range) {
        this.stop(unit);
        continue;
      }
      const spot = this.attackSpot(unit, target, taken);
      if (spot && this.walk(unit, spot)) {
        unit.forced = true;
        taken.add(spot.y * MAP_TILES + spot.x);
      } else {
        unit.target = null;
        unit.attacking = false;
      }
    }
  }

  // --- Units ------------------------------------------------------------

  private stepUnit(unit: Fighter, frame: number): void {
    if (unit.poison && frame >= unit.poison.next) {
      const poison = unit.poison;
      poison.left--;
      poison.next = frame + POISON_EVERY;
      if (poison.left <= 0) {
        unit.poison = null;
      }
      this.hurt(unit, poison.damage, null);
      if (unit.dead) {
        return;
      }
    }
    if (this.isStilled(unit)) {
      return;
    }
    if (frame % THINK_EVERY === 0 && !this.ownMind.has(unit)) {
      this.tidy(unit);
      this.think(unit);
    }
    if (unit.attacking && (frame + unit.offset) % ATTACK_CHECK_EVERY === 0) {
      this.updateAttack(unit, frame);
    }
    this.stepWalk(unit);
  }

  /** Every 61 frames, before thinking: forget dead targets; take up a fight with a living one. */
  private tidy(unit: Fighter): void {
    if (unit.target && (unit.target.dead || !this.fighters.includes(unit.target))) {
      unit.target = null;
    }
    if (unit.target && unit.target.side !== unit.side && unit.target.side !== NEUTRAL) {
      unit.attacking = true;
    }
    // Two units standing on one tile: this one steps aside.
    if (!this.isMoving(unit) && !unit.flying) {
      const other = this.fighters.find((f) => f !== unit && f.isUnit && !f.dead && !this.isMoving(f) && f.tx === unit.tx && f.ty === unit.ty);
      if (other && !(unit.side === ENEMY && other.side === SELF)) {
        const free = this.freeTileNear({ x: unit.tx, y: unit.ty }, true);
        if (free && this.walk(unit, free)) {
          unit.forced = true;
        }
      }
    }
  }

  private think(unit: Fighter): void {
    if (!this.isMoving(unit) && !unit.attacking && this.random() < 0.04) {
      // Looking around now and then.
      const dx = Math.round(this.random() * 2) - 1;
      const dy = Math.round(this.random() * 2) - 1;
      unit.facing = headingTo(unitPoint(unit.tx, unit.ty), unitPoint(unit.tx + dx, unit.ty + dy), unit.facing);
    }
    if (unit.condition === "defensive" && Math.abs(unit.home.x - unit.tx) + Math.abs(unit.home.y - unit.ty) > DEFENSIVE_LEASH) {
      unit.target = null;
      unit.attacking = false;
      if (this.walk(unit, unit.home)) {
        unit.forced = true;
      }
    }
    if ((unit.condition === "aggressive" || unit.condition === "defensive") && !unit.target && !unit.forced && !HEALERS.has(unit.item.id)) {
      // A monk looks only for units it can turn.
      const target = unit.item.id === MONK
        ? (this.canConvert(unit) ? this.nearestEnemy(unit, { x: unit.tx, y: unit.ty }, CONVERT_RANGE, (f) => this.convertible(f)) : null)
        : this.nearestEnemy(unit, { x: unit.tx, y: unit.ty }, unit.aggro ?? AGGRO_RANGE);
      if (target) {
        this.attack(unit, target);
      }
    }
    if (HEALERS.has(unit.item.id)) {
      this.thinkHealer(unit);
    }
  }

  /** A healer drops a target that's whole or not its side's, and picks the most hurt nearby. */
  private thinkHealer(unit: Fighter): void {
    if (unit.target && (unit.target.side !== unit.side || unit.target.life >= unit.target.maxLife)) {
      unit.target = null;
      unit.attacking = false;
    }
    if (unit.forced) {
      return;
    }
    if (!unit.target) {
      const near = this.nearby(unit, unit.range, 30, (f) => f.isUnit && f.side === unit.side && f !== unit
        && f.life < f.maxLife && f.item.subcategory !== SUBCAT.siege);
      let weakest: Fighter | null = null;
      for (const f of near) {
        if (!weakest || f.life < weakest.life) {
          weakest = f;
        }
      }
      if (weakest) {
        unit.target = weakest;
        this.chase(unit, weakest);
      }
    } else if (!this.isMoving(unit) && !unit.attacking) {
      this.chase(unit, unit.target);
    }
  }

  /** Whether a monk can turn a unit now: someone listens, it has turned fewer than 4, and its last turning is over. */
  private canConvert(monk: Fighter): boolean {
    return this.onConvert !== null && (monk.conversions ?? 0) < CONVERT_LIMIT && this.frame >= (monk.convertReadyAt ?? 0);
  }

  /** Units a monk can turn: under 500 life, and no boss, boss guard, eagle or giant. */
  private convertible(f: Fighter): boolean {
    const sub = f.item.subcategory;
    return f.isUnit && !f.dead && f.item.life < CONVERT_MAX_LIFE && !f.giant
      && sub !== SUBCAT.boss && sub !== SUBCAT.bossAdd && sub !== SUBCAT.eagle;
  }

  /** A monk turns a unit to its side: it forgets its fight and looks for a new one. */
  private convert(monk: Fighter, unit: Fighter): void {
    monk.conversions = (monk.conversions ?? 0) + 1;
    monk.convertReadyAt = this.frame + CONVERT_EVERY;
    monk.target = null;
    monk.attacking = false;
    monk.special = { animation: 6, until: this.frame + 60 };
    this.onConvert?.(unit, monk);
    unit.side = monk.side;
    unit.converted = !unit.converted;
    unit.condition = "aggressive";
    unit.target = null;
    unit.attacking = false;
    unit.forced = false;
    this.events.push({ kind: "converted", fighter: unit, by: monk });
  }

  /** Go and fight something (the Flash client's IA_Attack). */
  private attack(unit: Fighter, target: Fighter): void {
    if (unit.dead) {
      return;
    }
    unit.target = target;
    unit.attacking = true;
    if (distance(unit, target) > unit.range) {
      const spot = this.attackSpot(unit, target, new Set());
      if (!spot || !this.walk(unit, spot)) {
        unit.target = null;
      }
    }
  }

  /** A healer goes to its patient the same way. */
  private chase(unit: Fighter, target: Fighter): void {
    unit.attacking = true;
    if (distance(unit, target) > unit.range) {
      const spot = this.attackSpot(unit, target, new Set());
      if (!spot || !this.walk(unit, spot)) {
        unit.target = null;
        unit.attacking = false;
      }
    }
  }

  private updateAttack(unit: Fighter, frame: number): void {
    const target = unit.target;
    const healer = HEALERS.has(unit.item.id);
    if (!target) {
      unit.attacking = false;
      return;
    }
    if (!healer && target.side === unit.side) {
      unit.target = null;
      unit.attacking = false;
      return;
    }
    if (target.dead) {
      unit.target = null;
      unit.attacking = false;
      return;
    }
    const inRange = distance(unit, target) <= unit.range;
    const standing = !this.isMoving(unit) || this.atTileMiddle(unit);
    if (inRange && (unit.range >= 2 || standing)) {
      // In reach: stop at the next tile, and hit on the beat.
      unit.path = [];
      if ((frame + unit.offset) % unit.interval === 0) {
        unit.facing = headingTo(unit.at, pointOf(target), unit.facing);
        unit.struckAt = frame;
        if (this.onBeat(unit, target)) {
          // A special move instead of the hit.
        } else if (healer) {
          this.heal(target, unit.attack, unit);
        } else if (unit.item.id === MONK) {
          if (this.canConvert(unit) && this.convertible(target)) {
            this.convert(unit, target);
          }
        } else if (unit.item.subcategory === SUBCAT.cleric) {
          // The engineer has work of its own (repairing siege units), not done here yet.
        } else if (unit.range > 1 && !RANGED_MELEE.has(unit.item.id)) {
          this.shoot(unit, target);
          if (DOUBLE_SHOT.has(unit.item.id)) {
            // A second shot from its second mouth.
            this.after(SECOND_SHOT, () => {
              if (!unit.dead && !target.dead) {
                this.shootAt(unit, target);
              }
            });
          }
        } else if (unit.item.id === KAMIKAZE) {
          this.explode(unit);
        } else {
          this.hurt(target, unit.attack, unit);
        }
      }
      return;
    }
    // Out of reach: plan again, at most every 300 ms.
    if (frame >= unit.replanAt && (!this.isMoving(unit) || (target.isUnit && this.isMoving(target)))) {
      unit.replanAt = frame + REPLAN_FRAMES;
      if (healer) {
        this.chase(unit, target);
      } else {
        this.attack(unit, target);
      }
    }
  }

  // --- Buildings --------------------------------------------------------

  private stepBuilding(building: Fighter, frame: number): void {
    if (building.side === NEUTRAL || building.interval <= 0 || frame % building.interval !== 0) {
      return;
    }
    const sub = building.item.subcategory;
    if (sub === SUBCAT.healing) {
      const hurt = this.nearestOf(building, building.range, (f) => f.isUnit && f.side === building.side && f.life < f.maxLife);
      if (hurt) {
        this.heal(hurt, building.attack);
      }
      return;
    }
    const shoots = (sub === SUBCAT.tower || sub === SUBCAT.castle || sub === SUBCAT.dragonKiller || sub === SUBCAT.townHall)
      && building.item.id !== TOWN_HALL_1 && building.attack > 0;
    if (!shoots) {
      return;
    }
    // It keeps a target only while it's within half its range.
    if (building.target && (building.target.dead || distance(building, building.target) > building.range / 2)) {
      building.target = null;
    }
    if (building.target && building.item.id === ICE_TOWER && building.target.isUnit && this.isFrozen(building.target)) {
      building.target = null;
    }
    if (!building.target) {
      building.target = this.nearestEnemy(building, { x: building.tx, y: building.ty }, building.range,
        building.item.id === ICE_TOWER ? (f) => !this.isFrozen(f) : undefined);
    }
    if (building.target) {
      building.struckAt = frame;
      this.shoot(building, building.target);
    }
  }

  isFrozen(fighter: Fighter): boolean {
    return this.frame < (fighter.frozenUntil ?? 0);
  }

  /** Frozen or knocked down: it can't walk or fight. */
  isStilled(fighter: Fighter): boolean {
    return this.frame < (fighter.stilledUntil ?? 0);
  }

  isEnlarged(fighter: Fighter): boolean {
    return this.frame < (fighter.enlargedUntil ?? 0);
  }

  // --- Spells' doings (rules/magic.ts decides when and to whom) -----------

  /** Run something `frames` from now. */
  after(frames: number, run: () => void): void {
    this.later.push({ frame: this.frame + Math.max(0, Math.round(frames)), run });
  }

  /** Show a spell's picture. */
  show(effect: Omit<Effect, "start"> & { start?: number }): void {
    this.events.push({ kind: "effect", effect: { ...effect, start: effect.start ?? this.frame } });
  }

  /** Stop a unit where it is, unable to act for `frames`. */
  still(unit: Fighter, frames: number, frozen = false): void {
    unit.stilledUntil = Math.max(unit.stilledUntil ?? 0, this.frame + frames);
    if (frozen) {
      unit.frozenUntil = Math.max(unit.frozenUntil ?? 0, this.frame + frames);
    }
    unit.path = [];
  }

  /** The ground takes it: it sinks for half a second, then dies (no damage, so nothing protects it). */
  swallow(fighter: Fighter): void {
    if (fighter.dead || fighter.sinkingSince !== undefined) {
      return;
    }
    fighter.sinkingSince = this.frame;
    fighter.path = [];
    fighter.next = null;
    fighter.target = null;
    fighter.attacking = false;
  }

  /** A summoned unit whose time is up: it fades for half a second and is gone, without dying. */
  fade(fighter: Fighter): void {
    if (!fighter.dead && fighter.fadingSince === undefined && this.fighters.includes(fighter)) {
      fighter.fadingSince = this.frame;
      fighter.path = [];
      fighter.next = null;
      fighter.attacking = false;
    }
  }

  /** Heard when a boss gets away (it says its line). */
  readonly onFlee: ((fighter: Fighter) => void)[] = [];

  /** A boss getting away: it can't be hurt any more, stops, and falls (beaten) 3.5 seconds later. */
  private getAway(fighter: Fighter): void {
    fighter.life = Math.max(1, fighter.life);
    if (fighter.fleeing) {
      return;
    }
    fighter.fleeing = true;
    fighter.invulnerable = true;
    fighter.target = null;
    fighter.attacking = false;
    fighter.path = [];
    fighter.stilledUntil = this.frame + FLEE_FRAMES;
    for (const listen of this.onFlee) {
      listen(fighter);
    }
    this.after(FLEE_FRAMES, () => {
      fighter.invulnerable = false;
      fighter.flee = null;
      this.kill(fighter, null);
    });
  }

  /** Take something off the field without a death. */
  remove(fighter: Fighter): void {
    const at = this.fighters.indexOf(fighter);
    if (at < 0) {
      return;
    }
    this.fighters.splice(at, 1);
    fighter.dead = true;
    for (const other of this.fighters) {
      if (other.target === fighter) {
        other.target = null;
        other.attacking = false;
      }
    }
    if (!fighter.isUnit) {
      this.gridStale = true;
    }
    this.events.push({ kind: "gone", fighter });
  }

  /** An Ether Shield over the tiles x0..x1, y0..y1 for `frames`. */
  addShield(x0: number, y0: number, x1: number, y1: number, factor: number, frames: number): void {
    this.shields.push({ x0, y0, x1, y1, factor, until: this.frame + frames });
  }

  /** What a hit on a fighter is cut to: the first shield over its tile, or 1. */
  shieldFactor(fighter: Fighter): number {
    const shield = this.shields.find((s) => fighter.tx >= s.x0 && fighter.tx <= s.x1 && fighter.ty >= s.y0 && fighter.ty <= s.y1);
    return shield ? shield.factor : 1;
  }

  /** Living fighters whose tile is within `radius` of a tile, nearest first, at most `count`. */
  within(tile: Point, radius: number, count: number, which: (f: Fighter) => boolean): Fighter[] {
    const squared = (f: Fighter) => (f.tx - tile.x) ** 2 + (f.ty - tile.y) ** 2;
    return this.fighters
      .filter((f) => !f.dead && f.sinkingSince === undefined && f.fadingSince === undefined && which(f) && squared(f) <= radius * radius)
      .sort((a, b) => squared(a) - squared(b))
      .slice(0, count);
  }

  // --- Hits -------------------------------------------------------------

  /** Fire at a target: the shot flies, and hurts it when it lands if it's still there. */
  private shoot(by: Fighter, target: Fighter): void {
    if (distance(by, target) > by.range) {
      return;
    }
    this.shootAt(by, target);
  }

  /** A shot whatever the reach: `type` the picture (the shooter's own if null), `damage` what it does (its attack if not given). */
  shootAt(by: Fighter, target: Fighter, type: number | null = null, damage?: number): void {
    const kind = type === null ? projectileOf(by.item) : { type, ...(SHOT_FLIGHT.get(type) ?? { speed: 33, arc: 0.2 }) };
    const from = muzzleOf(by);
    const to = pointOf(target);
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    // A random head start of up to one frame's flight, as the Flash client gives each shot.
    const frames = Math.max(1, Math.ceil(length / kind.speed - this.random()));
    const shot: Shot = { from, to, target, by, type: kind.type, arc: kind.arc, frames, frame: 0, damage };
    this.shots.push(shot);
    this.events.push({ kind: "shot", shot });
  }

  private land(shot: Shot): void {
    this.events.push({ kind: "landed", shot });
    const target = shot.target;
    if (target.dead) {
      return;
    }
    const where = pointOf(target);
    const hit = Math.hypot(where.x - shot.to.x, where.y - shot.to.y) <= BLAST_PIXELS;
    if (hit) {
      this.hurt(target, shot.damage ?? shot.by.attack, shot.by);
    }
    for (const listen of this.onLanded) {
      listen(shot, hit);
    }
  }

  /** Damage, as the Flash client works it out (CLIENT.md, "Battles"). */
  hurt(target: Fighter, attack: number, by: Fighter | null, force = false): void {
    if (target.dead || !attack || (target.invulnerable && !force)) {
      return;
    }
    let amount = attack;
    // Grown by Age of Colossus: half again.
    if (by && this.isEnlarged(by)) {
      amount *= ENLARGED_HIT;
    }
    // Siege engines do half to units; units do a quarter more to siege engines.
    if (by && target.isUnit && by.isUnit && by.item.subcategory === SUBCAT.siege) {
      amount = Math.ceil(amount / 2);
    }
    if (by && target.isUnit && by.isUnit && target.item.subcategory === SUBCAT.siege) {
      amount = Math.ceil(amount * 1.25);
    }
    const crit = this.random() * 100 < CRIT_PERCENT;
    const variance = this.random() * VARIANCE - VARIANCE / 2;
    let dealt = crit ? (amount + Math.abs(variance)) * CRIT_MULTIPLIER : amount + variance;
    // An Ether Shield over it takes its share.
    dealt -= Math.round(dealt - dealt * this.shieldFactor(target));
    let damage = Math.max(1, Math.round(dealt - target.item.defense));
    // A shield of its own takes its share, or all of it.
    if (target.guard && this.frame < target.guard.until) {
      damage = Math.round(damage * target.guard.taken);
      if (damage <= 0) {
        return;
      }
    }
    target.life = Math.max(0, target.life - damage);
    this.events.push({ kind: "hit", fighter: target, amount: damage, crit, by });
    if (by) {
      this.onDealt(by, damage, false);
    }
    for (const listen of this.onHurt) {
      listen(target, damage, by);
    }
    if (target.flee && target.life < target.maxLife * target.flee.below) {
      this.getAway(target);
      return;
    }
    if (target.life <= 0) {
      this.kill(target, by);
      return;
    }
    if (!by) {
      return;
    }
    if (target.isUnit && !this.ownMind.has(target)) {
      this.beingAttacked(target, by);
    } else if (target.attack > 0 && (!target.target || target.target.attack === 0)) {
      target.target = by;
    }
    this.callForHelp(target, by);
  }

  /**
   * A kamikaze goes off: 500 to itself, and 500 to whatever stands on each
   * of the 25 tiles around it, friend or foe (a building once for each of
   * its tiles there). Other kamikazes there go off too, within half a second.
   */
  explode(unit: Fighter): void {
    if (unit.dead) {
      return;
    }
    this.hurt(unit, BLAST, unit);
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const x = unit.tx + dx;
        const y = unit.ty + dy;
        const there = this.standingAt(x, y, unit);
        if (!there || there.dead) {
          continue;
        }
        if (there.isUnit && there.item.id === KAMIKAZE) {
          this.later.push({ frame: this.frame + Math.floor(this.random() * 15), run: () => this.explode(there) });
        } else {
          this.hurt(there, BLAST, unit);
        }
      }
    }
  }

  /** What stands on a tile: a unit there, or a building covering it. */
  standingAt(x: number, y: number, except: Fighter | null = null): Fighter | null {
    for (const f of this.fighters) {
      if (f === except || f.dead || f.sinkingSince !== undefined || f.fadingSince !== undefined) {
        continue;
      }
      if (f.isUnit ? f.tx === x && f.ty === y
        : x > f.tx - f.item.width && x <= f.tx && y > f.ty - f.item.height && y <= f.ty) {
        return f;
      }
    }
    return null;
  }

  heal(target: Fighter, amount: number, by: Fighter | null = null): void {
    if (target.dead || amount <= 0) {
      return;
    }
    const healed = Math.min(Math.round(amount), target.maxLife - target.life);
    target.life += healed;
    this.events.push({ kind: "hit", fighter: target, amount: healed, crit: false, heal: true });
    if (by) {
      this.onDealt(by, healed, true);
    }
  }

  /**
   * A villager's repair at home: life back to a building, and a burnt-out
   * one back in the fight once it's whole again.
   */
  repair(building: Fighter, amount: number): void {
    if (building.isUnit || building.life >= building.maxLife) {
      return;
    }
    building.life = Math.min(building.maxLife, building.life + amount);
    this.events.push({ kind: "hit", fighter: building, amount, crit: false, heal: true });
    if (building.ruined && building.life >= building.maxLife) {
      building.ruined = false;
      building.dead = false;
      building.diedAt = -1;
    }
  }

  /**
   * Thrown: a unit flies about half of `tiles` away from a point, to the
   * nearest free tile there, and lies helpless for a second. Giants,
   * bosses and the already helpless stay put.
   */
  knock(unit: Fighter, from: Point, tiles: number): void {
    if (!unit.isUnit || unit.dead || unit.giant || unit.item.subcategory === SUBCAT.boss || this.isStilled(unit)
      || unit.sinkingSince !== undefined || this.isEnlarged(unit)) {
      return;
    }
    const dx = unit.tx - from.x;
    const dy = unit.ty - from.y;
    const length = Math.hypot(dx, dy) || 1;
    const far = Math.max(1, Math.round(tiles / 2));
    const to = this.freeTileNear({ x: Math.round(unit.tx + (far * dx) / length), y: Math.round(unit.ty + (far * dy) / length) }, false);
    if (to) {
      unit.path = [];
      unit.next = null;
      unit.tx = to.x;
      unit.ty = to.y;
      unit.at = unitPoint(to.x, to.y);
    }
    this.still(unit, THROWN_FRAMES);
  }

  /** Hit back: a unit turns on whoever hit it, unless it's busy with a closer fight. */
  private beingAttacked(unit: Fighter, by: Fighter): void {
    if (unit.condition === "survive") {
      // Run 5 tiles towards the middle of the map.
      const dx = MAP_TILES / 2 - unit.tx;
      const dy = MAP_TILES / 2 - unit.ty;
      const length = Math.hypot(dx, dy) || 1;
      const to = { x: Math.round(unit.tx + (5 * dx) / length), y: Math.round(unit.ty + (5 * dy) / length) };
      unit.target = null;
      unit.attacking = false;
      const free = this.freeTileNear(to, false);
      if (free) {
        this.walk(unit, free);
      }
      return;
    }
    if (unit.condition === "passive" || unit.forced || HEALERS.has(unit.item.id)) {
      return;
    }
    const current = unit.target;
    if (!current || current.attack === 0 || 2 * distance(unit, by) < distance(unit, current)) {
      this.attack(unit, by);
    }
  }

  /** Allies on the 4 rings of tiles around something hit, with nothing to do, join in. */
  private callForHelp(hit: Fighter, by: Fighter): void {
    for (const ally of this.fighters) {
      if (ally === hit || ally.dead || !ally.isUnit || ally.side !== hit.side) {
        continue;
      }
      const ring = Math.max(Math.abs(ally.tx - hit.tx), Math.abs(ally.ty - hit.ty));
      if (ring < 1 || ring > HELP_RINGS || ally.target || ally.forced) {
        continue;
      }
      if (ally.condition === "aggressive" || ally.condition === "defensive") {
        if (!HEALERS.has(ally.item.id)) {
          this.attack(ally, by);
        }
      }
    }
  }

  /** Something's life ran out. */
  kill(fighter: Fighter, by: Fighter | null): void {
    if (fighter.dead) {
      return;
    }
    fighter.life = 0;
    fighter.dead = true;
    fighter.diedAt = this.frame;
    fighter.path = [];
    fighter.next = null;
    fighter.target = null;
    fighter.attacking = false;
    if (!fighter.isUnit && this.home && fighter.side === SELF) {
      // At home it burns out and stays where it is.
      fighter.ruined = true;
    } else if (!fighter.isUnit) {
      // A building is gone at once (the view takes it away); its ground is free.
      this.fighters.splice(this.fighters.indexOf(fighter), 1);
      this.gridStale = true;
    }
    this.events.push({ kind: "died", fighter, by });
    this.onDeath(fighter, by);
    // Whoever was after it looks around where it fell.
    for (const hunter of this.fighters) {
      if (hunter.target !== fighter) {
        continue;
      }
      hunter.target = null;
      if (!hunter.isUnit) {
        continue;
      }
      hunter.attacking = false;
      if (hunter.condition === "aggressive" && !hunter.forced && !HEALERS.has(hunter.item.id)) {
        const next = this.nearestEnemy(hunter, { x: fighter.tx, y: fighter.ty }, AGGRO_RANGE);
        if (next) {
          this.attack(hunter, next);
        }
      }
    }
  }

  // --- Looking for things -----------------------------------------------

  /**
   * The nearest living enemy within `range` tiles of a tile, as the Flash
   * client looks: by the straight-line distance between the tiles the save
   * names, things that can't fight counted a little further (fighters
   * first). Units inside buildings and neutral things don't count.
   */
  nearestEnemy(of: Fighter, from: Point, range: number, also?: (f: Fighter) => boolean): Fighter | null {
    const other = of.side === SELF ? ENEMY : SELF;
    let best: Fighter | null = null;
    let bestSort = Infinity;
    for (const f of this.fighters) {
      if (f.dead || f.side !== other || f.sinkingSince !== undefined || f.fadingSince !== undefined || this.frame < (f.hiddenUntil ?? 0)
        || (also && !also(f))) {
        continue;
      }
      const squared = (f.tx - from.x) ** 2 + (f.ty - from.y) ** 2;
      if (squared > range * range) {
        continue;
      }
      const sort = squared + (f.item.attack === 0 ? AGGRO_RANGE : 0);
      if (sort < bestSort) {
        best = f;
        bestSort = sort;
      }
    }
    return best;
  }

  private nearestOf(of: Fighter, range: number, which: (f: Fighter) => boolean): Fighter | null {
    return this.nearby(of, range, 1, which)[0] ?? null;
  }

  /** Up to `count` living fighters within `range` tiles that pass `which`, nearest first. */
  private nearby(of: Fighter, range: number, count: number, which: (f: Fighter) => boolean): Fighter[] {
    return this.fighters
      .filter((f) => !f.dead && which(f) && (f.tx - of.tx) ** 2 + (f.ty - of.ty) ** 2 <= range * range)
      .sort((a, b) => ((a.tx - of.tx) ** 2 + (a.ty - of.ty) ** 2) - ((b.tx - of.tx) ** 2 + (b.ty - of.ty) ** 2))
      .slice(0, count);
  }

  /**
   * Where a unit goes to attack something: the free tile nearest the unit on
   * the square ring at its range around the target's middle; when that ring
   * has none, the next ring out.
   */
  attackSpot(unit: Fighter, target: Fighter, taken: Set<number>): Point | null {
    const w = target.isUnit ? 1 : target.item.width;
    const h = target.isUnit ? 1 : target.item.height;
    const even = w % 2 === 0;
    const cx = target.tx - Math.floor(w / 2);
    const cy = target.ty - Math.floor(h / 2);
    const grid = this.walkGrid();
    for (let ring = Math.max(1, unit.range) + Math.floor(w / 2); ring < MAP_TILES; ring++) {
      let best: Point | null = null;
      let bestDistance = Infinity;
      const low = even ? 1 : 0;
      for (let x = cx - ring + low; x <= cx + ring; x++) {
        for (let y = cy - ring + low; y <= cy + ring; y++) {
          const onRing = x === cx - ring + low || x === cx + ring || y === cy - ring + low || y === cy + ring;
          if (!onRing || taken.has(y * MAP_TILES + x)) {
            continue;
          }
          if (!(unit.flying ? inMap(x, y) : isWalkable(grid, x, y)) || this.standingOn(x, y, unit)) {
            continue;
          }
          const d = (x - unit.tx) ** 2 + (y - unit.ty) ** 2;
          if (d < bestDistance) {
            best = { x, y };
            bestDistance = d;
          }
        }
      }
      if (best) {
        return best;
      }
      if (ring > Math.max(1, unit.range) + Math.floor(w / 2) + 10) {
        return null;
      }
    }
    return null;
  }

  /** Free tiles around a tile for a group to stand on: the tile itself, then outwards. */
  spotsAround(tile: Point, count: number): Point[] {
    const grid = this.walkGrid();
    const spots: Point[] = [];
    for (let ring = 0; ring < 12 && spots.length < count; ring++) {
      for (let x = tile.x - ring; x <= tile.x + ring && spots.length < count; x++) {
        for (let y = tile.y - ring; y <= tile.y + ring && spots.length < count; y++) {
          const onRing = Math.max(Math.abs(x - tile.x), Math.abs(y - tile.y)) === ring;
          if (onRing && isWalkable(grid, x, y) && !this.standingOn(x, y, null)) {
            spots.push({ x, y });
          }
        }
      }
    }
    return spots;
  }

  /** The nearest walkable tile with nobody standing on it; `around` skips the tile itself. */
  freeTileNear(tile: Point, around: boolean): Point | null {
    const grid = this.walkGrid();
    for (let ring = around ? 1 : 0; ring < 20; ring++) {
      const options: Point[] = [];
      for (let x = tile.x - ring; x <= tile.x + ring; x++) {
        for (let y = tile.y - ring; y <= tile.y + ring; y++) {
          if (Math.max(Math.abs(x - tile.x), Math.abs(y - tile.y)) === ring && isWalkable(grid, x, y) && !this.standingOn(x, y, null)) {
            options.push({ x, y });
          }
        }
      }
      if (options.length) {
        return options[Math.floor(this.random() * options.length)];
      }
    }
    return null;
  }

  /** Whether a unit other than `except` stands still on a tile. */
  private standingOn(x: number, y: number, except: Fighter | null): boolean {
    return this.fighters.some((f) => f !== except && f.isUnit && !f.dead && f.tx === x && f.ty === y && !this.isMoving(f));
  }

  // --- Walking ----------------------------------------------------------

  /** Where units can walk now: the ground, less the standing buildings (fields and open doors aside). */
  walkGrid(): WalkGrid {
    if (this.gridStale) {
      const grid = new Uint8Array(this.ground);
      for (const f of this.fighters) {
        if (f.isUnit || (f.dead && !f.ruined) || f.open || f.item.elevation === 0 || f.item.subcategory === SUBCAT.farm) {
          continue;
        }
        for (let x = f.tx - f.item.width + 1; x <= f.tx; x++) {
          for (let y = f.ty - f.item.height + 1; y <= f.ty; y++) {
            if (inMap(x, y)) {
              grid[y * MAP_TILES + x] = 0;
            }
          }
        }
      }
      this.grid = grid;
      this.gridStale = false;
    }
    return this.grid;
  }

  /**
   * A door opens: its picture moves two on (a door's pictures are its two
   * closed facings, then the same two open) and units walk through it.
   */
  openDoor(door: Fighter): void {
    if (door.open) {
      return;
    }
    door.open = true;
    door.facing += 2;
    this.gridStale = true;
  }

  /** Start a unit walking to a tile; false when there's no way. */
  walk(unit: Fighter, to: Point): boolean {
    if (unit.dead || unit.velocity <= 0) {
      return false;
    }
    const from = { x: unit.tx, y: unit.ty };
    const path = findPath(this.walkGrid(), from, to, unit.flying);
    if (path === null) {
      return false;
    }
    if (path.length === 0) {
      return true;
    }
    unit.path = path;
    if (!unit.next) {
      this.nextTile(unit);
    }
    return true;
  }

  stop(unit: Fighter): void {
    unit.path = [];
  }

  isMoving(unit: Fighter): boolean {
    return unit.next !== null;
  }

  private atTileMiddle(unit: Fighter): boolean {
    const middle = unitPoint(unit.tx, unit.ty);
    return unit.at.x === middle.x && unit.at.y === middle.y;
  }

  private nextTile(unit: Fighter): void {
    const tile = unit.path.shift() ?? null;
    unit.next = tile;
    if (!tile) {
      // Arrived.
      unit.forced = false;
      return;
    }
    // A ground unit stepping onto a building stops where it is.
    if (!unit.flying && !isWalkable(this.walkGrid(), tile.x, tile.y)) {
      unit.path = [];
      unit.next = null;
      unit.forced = false;
      return;
    }
    unit.facing = headingTo(unit.at, unitPoint(tile.x, tile.y), unit.facing);
  }

  private stepWalk(unit: Fighter): void {
    if (!unit.next) {
      return;
    }
    const to = unitPoint(unit.next.x, unit.next.y);
    const speed = unit.velocity;
    const dx = to.x - unit.at.x;
    const dy = to.y - unit.at.y;
    const longest = Math.max(Math.abs(dx), Math.abs(dy));
    unit.at = longest <= speed ? to : { x: unit.at.x + (dx * speed) / longest, y: unit.at.y + (dy * speed) / longest };
    const under = tileUnder(unit.at);
    unit.tx = under.x;
    unit.ty = under.y;
    if (unit.at.x === to.x && unit.at.y === to.y) {
      unit.tx = unit.next.x;
      unit.ty = unit.next.y;
      this.nextTile(unit);
    }
  }
}

/** How a unit behaves on its own, by what it is (the Flash client's per-unit mind). */
export function conditionOf(item: ItemInfo): Condition {
  if (!item.isUnit) {
    return "passive";
  }
  switch (item.subcategory) {
    case SUBCAT.peasant: case SUBCAT.cow: case SUBCAT.sheep: case SUBCAT.horse: case SUBCAT.boar: case SUBCAT.cart:
    case SUBCAT.settler: case SUBCAT.pet:
      return "survive";
    case SUBCAT.kamikaze: case SUBCAT.eagle:
      return "passive";
    case SUBCAT.cleric:
      return item.id === 569 ? "aggressive" : "survive";  // the monk converts; the others heal or repair
    default:
      if (item.id === 575 || item.id === 582) {
        return "passive";  // the kamikaze, the boat
      }
      if (item.id === 604 || item.id === 866 || item.id === 886) {
        return "survive";  // the troll drummer, the healers
      }
      return "aggressive";
  }
}

/**
 * How far apart two fighters are for reaching: the most tiles across or
 * down between their nearest footprint tiles (1: next to each other,
 * diagonals too).
 */
export function distance(a: Fighter, b: Fighter): number {
  const [aw, ah] = a.isUnit ? [1, 1] : [a.item.width, a.item.height];
  const [bw, bh] = b.isUnit ? [1, 1] : [b.item.width, b.item.height];
  const gapX = gap(a.tx - aw + 1, a.tx, b.tx - bw + 1, b.tx);
  const gapY = gap(a.ty - ah + 1, a.ty, b.ty - bh + 1, b.ty);
  return Math.max(gapX, gapY);
}

function gap(aLow: number, aHigh: number, bLow: number, bHigh: number): number {
  if (aHigh < bLow) {
    return bLow - aHigh;
  }
  if (bHigh < aLow) {
    return aLow - bHigh;
  }
  return 0;
}

function inMap(x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < MAP_TILES && y < MAP_TILES;
}

/** Where a fighter is hit: a unit's feet, a building's footprint middle. */
export function pointOf(f: Fighter): Point {
  if (f.isUnit) {
    return f.at;
  }
  const p = buildingPoint(f.tx, f.ty);
  return { x: p.x + 27 * (f.item.height - f.item.width), y: p.y - (TILE_HEIGHT / 4) * (f.item.width + f.item.height) };
}

/** Where a shot leaves from: a little above the shooter's feet. */
function muzzleOf(f: Fighter): Point {
  const p = pointOf(f);
  return { x: p.x, y: p.y - (f.isUnit ? 30 : 60) };
}

/**
 * What a fighter shoots, how fast (pixels a frame) and how high it arcs.
 * The Flash client's newer shots fly at a set speed (arrows 30, axes 20,
 * rocks 18, cannonballs 40); the older ones take a second for 1,000 pixels
 * (about 33 a frame).
 */
export function projectileOf(item: ItemInfo): { type: number; speed: number; arc: number } {
  const type = item.isUnit ? UNIT_SHOTS.get(item.id) ?? 1 : BUILDING_SHOTS.get(item.id) ?? 1;
  return { type, ...(SHOT_FLIGHT.get(type) ?? { speed: 33, arc: 0.2 }) };
}

/** Flight of the newer shots, by projectile number. */
const SHOT_FLIGHT = new Map<number, { speed: number; arc: number }>([
  [1, { speed: 30, arc: 0.3 }], [2, { speed: 30, arc: 0.3 }], [3, { speed: 40, arc: 0.5 }], [4, { speed: 18, arc: 0.6 }],
  [5, { speed: 20, arc: 0.6 }], [13, { speed: 30, arc: 1 }], [17, { speed: 30, arc: 0.3 }], [18, { speed: 30, arc: 0.3 }],
  [20, { speed: 30, arc: 0.3 }],
]);

/** Which projectile each shooting unit fires (the rest fire arrows). */
const UNIT_SHOTS = new Map<number, number>([
  [646, 20], [675, 20], [633, 18], [520, 2], [586, 2], [602, 2], [634, 19], [521, 4], [587, 4], [605, 13],
  [767, 3], [522, 3], [588, 3], [542, 3], [583, 3], [568, 9], [638, 9], [672, 9], [530, 5], [551, 5], [598, 5],
  [607, 11], [657, 23], [566, 10], [637, 10], [696, 10], [548, 6], [624, 6], [546, 7], [693, 8], [550, 8], [692, 8],
  [553, 8], [689, 15], [620, 15], [680, 14], [622, 14], [635, 13], [653, 21], [698, 27], [707, 30], [711, 26],
]);

/** Which projectile each shooting building fires. */
const BUILDING_SHOTS = new Map<number, number>([
  [29, 1], [30, 1], [31, 1], [243, 1], [291, 1], [303, 1], [304, 1], [1318, 72], [1309, 72], [1501, 25],
  [32, 2], [376, 2], [347, 2], [27, 3], [28, 3], [323, 3], [324, 3], [181, 3], [33, 3], [348, 3], [270, 3],
  [1230, 3], [1231, 3], [1234, 3], [1443, 3], [199, 9], [395, 9], [198, 9], [412, 9], [414, 9], [413, 9],
  [474, 9], [1251, 9], [214, 8], [1258, 8], [384, 7], [426, 14], [1238, 41], [1407, 17], [447, 17],
  [1219, 17], [1374, 17], [1426, 1],
]);

/** A small, fast random number generator with a seed: the same seed, the same battle. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
