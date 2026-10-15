// Raids on the player's town (CLIENT.md, "Defending the town"), as the
// Flash client sends them: bandits from level 10, and from level 25 now and
// then a siege. All of it is rolled afresh each time the town is opened, and
// nothing of it is saved (the original saved nothing either): a band waits
// at the map's edge, attacks after 7 minutes (14 and 21 for the second and
// third bands), and leaves once it has burnt out enough buildings and killed
// enough units. A siege lines up at the bottom of the map, its captain
// calling out, and comes in stages.
//
// The plans are worked out here (planRaids), and each raid's mind (Raid)
// runs on the battle (rules/battle.ts), frame by frame.

import { ENEMY, SELF, type Battle, type Fighter } from "./battle.ts";
import type { ItemInfo } from "./config.ts";
import type { Point } from "./geometry.ts";

/** Frames a minute. */
const MINUTE = 1800;
/** Bands from these levels, attacking this many minutes after the town opens. */
const BANDS: [level: number, minutes: number][] = [[10, 7], [15, 14], [20, 21]];
/** Sieges: one a visit at most, 1 chance in 10, by the level's band. */
const SIEGE_CHANCE = 0.1;
const SIEGE_LEVEL = 25;
const STAMPEDE_LEVEL = 30;
const ARMY_LEVEL = 35;
/** A band leaves once it has burnt out this many buildings and killed this many units, by level. */
function quota(level: number): number {
  return level <= 5 ? 1 : level <= 10 ? 2 : level <= 15 ? 3 : 4;
}
const MAP = 100;

export type RaidKind = "bandits" | "siege" | "stampede" | "army";
export type Squad = "band" | "first" | "second" | "engines" | "captain" | "crier";

export interface RaidUnit {
  id: number;
  x: number;
  y: number;
  squad: Squad;
  /** The crier is one of the player's own villagers, running to warn the town. */
  side?: typeof SELF | typeof ENEMY;
}

export interface RaidPlan {
  kind: RaidKind;
  /** Frames after the town opens that it starts (bandits wait unseen until then). */
  startsAt: number;
  /** Where it comes from, and goes back to. */
  spawn: Point;
  units: RaidUnit[];
}

/**
 * The enemy race's soldiers by the player's level, as the Flash client
 * lists them for bandits and the army: trolls for a human empire, humans
 * for a troll one.
 */
export function enemyIds(level: number, race: string): number[] {
  const steps: [number, number[]][] = race === "t"
    ? [[1, [509, 516, 512]], [6, [510, 517, 513]], [12, [511, 518, 514]], [18, [539, 540, 541]], [30, [502, 569]]]
    : [[1, [525]], [4, [526]], [8, [527]], [12, [530]], [16, [531]], [20, [528, 529]], [26, [547]], [28, [601]], [30, [590]]];
  return steps.filter(([from]) => level >= from).flatMap(([, ids]) => ids);
}

/**
 * A random pick from a list, as the original picks: round(random x (n - 1)),
 * so the first and the last come up half as often as the others.
 */
function pick<T>(list: T[], random: () => number): T {
  return list[Math.round(random() * (list.length - 1))];
}

/** What comes this visit, by level and race. */
export function planRaids(level: number, race: string, random: () => number): RaidPlan[] {
  const plans: RaidPlan[] = [];
  const troll = race === "t";
  // A siege first: only the level's own kind, 1 time in 10.
  if (level >= ARMY_LEVEL) {
    if (random() <= SIEGE_CHANCE) {
      plans.push(army(level, race, random));
    }
  } else if (level >= STAMPEDE_LEVEL) {
    if (random() <= SIEGE_CHANCE) {
      plans.push(stampede(troll));
    }
  } else if (level >= SIEGE_LEVEL) {
    if (random() <= SIEGE_CHANCE) {
      plans.push(siege(troll, random));
    }
  }
  // Then the bandits, always, one band for each step of level reached.
  const ids = enemyIds(level, race);
  for (const [from, minutes] of BANDS) {
    if (level < from) {
      continue;
    }
    const edge = Math.floor(random() * 4);
    const along = Math.floor(random() * MAP);
    const spawn = edge === 0 ? { x: 0, y: along } : edge === 1 ? { x: MAP - 1, y: along }
      : edge === 2 ? { x: along, y: 0 } : { x: along, y: MAP - 1 };
    const count = Math.max(Math.ceil(level / (troll ? 2 : 4)), 1);
    plans.push({
      kind: "bandits", startsAt: minutes * MINUTE, spawn,
      units: Array.from({ length: count }, () => ({ id: pick(ids, random), x: spawn.x, y: spawn.y, squad: "band" as Squad })),
    });
  }
  return plans;
}

/**
 * Levels 25 to 29: the village siege from the bottom of the map. As in the
 * original, the soldiers are of the player's own race.
 */
function siege(troll: boolean, random: () => number): RaidPlan {
  const units: RaidUnit[] = [];
  const front = troll ? () => pick([525, 526, 527, 528, 529, 530, 531, 547, 600], random) : () => 510;
  const back = troll ? () => pick([598, 589], random) : () => 517;
  const engine = troll ? pick([585, 586, 587, 588], random) : 520;
  for (let x = 47; x <= 57; x++) {
    if (x === 52) {
      continue;
    }
    const squad: Squad = x < 52 ? "first" : "second";
    units.push({ id: front(), x, y: 96, squad }, { id: back(), x, y: 97, squad });
  }
  for (let x = 50; x <= 54; x++) {
    units.push({ id: engine, x, y: 99, squad: "engines" });
  }
  units.push({ id: troll ? 601 : 513, x: 52, y: 94, squad: "captain" });
  return { kind: "siege", startsAt: 0, spawn: { x: 47, y: 96 }, units };
}

/** Levels 30 to 34: a stampede of big mounts, the enemy race's. */
function stampede(troll: boolean): RaidPlan {
  const mount = troll ? 603 : 601;
  const tiles: Point[] = [{ x: 47, y: 96 }, { x: 48, y: 96 }, { x: 49, y: 96 }, { x: 47, y: 96 }, { x: 48, y: 97 }, { x: 49, y: 97 }];
  const units: RaidUnit[] = tiles.map((t, i) => ({ id: mount, x: t.x, y: t.y, squad: i < 3 ? "first" : "second" }));
  units.push({ id: troll ? 541 : 597, x: 49, y: 94, squad: "captain" });
  return { kind: "stampede", startsAt: 0, spawn: { x: 47, y: 96 }, units };
}

/** Level 35 and up: an army from the left edge, and one of the player's villagers running to warn the town. */
function army(level: number, race: string, random: () => number): RaidPlan {
  const troll = race === "t";
  const ids = enemyIds(level, race);
  const units: RaidUnit[] = [];
  for (let y = 41; y <= 51; y++) {
    if (y === 46) {
      continue;
    }
    const squad: Squad = y < 46 ? "engines" : "first";
    units.push({ id: pick(troll ? [521, 520] : [585, 586], random), x: 5, y, squad });
    units.push({ id: pick(ids, random), x: 4, y, squad }, { id: pick(ids, random), x: 3, y, squad });
  }
  units.push({ id: troll ? 581 : 501, x: 17, y: 41, squad: "crier", side: SELF });
  return { kind: "army", startsAt: 0, spawn: { x: 5, y: 41 }, units };
}

/** What a raid's mind can ask of the page: a line over a unit's head (the game's own words, by id). */
export interface RaidVoice {
  say: (fighter: Fighter, line: number) => void;
}

/**
 * A raid on the field: its units, and the mind that moves them. `step`
 * runs every frame; `done` once they're all dead or gone.
 */
export class Raid {
  readonly plan: RaidPlan;
  readonly fighters: Fighter[] = [];
  private readonly squads = new Map<Fighter, Squad>();
  private readonly battle: Battle;
  private readonly voice: RaidVoice;
  private readonly troll: boolean;
  private readonly quota: number;
  private stage = 0;
  private stageFrom = 0;
  /** Buildings burnt out and units killed by the band (counted once for each bandit after it). */
  burnt = 0;
  killed = 0;
  private retreating = false;
  private pace = 0;
  private cried = 0;
  /** Stampede: re-sending the mounts at the town's units each time one of their targets falls. */
  private breaking = false;

  constructor(battle: Battle, plan: RaidPlan, items: Map<number, ItemInfo>, level: number, race: string, voice: RaidVoice) {
    this.battle = battle;
    this.plan = plan;
    this.voice = voice;
    this.troll = race === "t";
    this.quota = quota(level);
    this.stageFrom = battle.frame;
    for (const unit of plan.units) {
      const item = items.get(unit.id);
      const tile = item && battle.freeTileNear({ x: unit.x, y: unit.y }, false);
      if (!item || !tile) {
        continue;
      }
      const side = unit.side ?? ENEMY;
      const fighter = battle.add(item, tile.x, tile.y, side, { summoned: side === SELF });
      // Waiting, they only fight what comes within reach.
      fighter.condition = unit.squad === "crier" ? "passive" : "aggressive";
      this.fighters.push(fighter);
      this.squads.set(fighter, unit.squad);
    }
  }

  /** The raid's enemies still in the fight. */
  get alive(): Fighter[] {
    return this.fighters.filter((f) => !f.dead && f.side === ENEMY && this.battle.fighters.includes(f));
  }

  get done(): boolean {
    return this.alive.length === 0;
  }

  private squad(name: Squad): Fighter[] {
    return this.alive.filter((f) => this.squads.get(f) === name);
  }

  private get captain(): Fighter | null {
    return this.squad("captain")[0] ?? null;
  }

  /** Something of the player's fell: a band counts it once for each of its bandits that was after it. */
  fell(fighter: Fighter): void {
    if (fighter.side !== SELF) {
      return;
    }
    const after = this.alive.filter((f) => f.target === fighter).length;
    if (fighter.isUnit) {
      this.killed += after;
    } else {
      this.burnt += after;
    }
    if (this.breaking && after > 0) {
      this.charge();
    }
  }

  step(): void {
    const frame = this.battle.frame - this.stageFrom;
    switch (this.plan.kind) {
      case "bandits":
        this.stepBandits();
        break;
      case "siege":
        this.stepSiege(frame);
        break;
      case "stampede":
        this.stepStampede(frame);
        break;
      case "army":
        this.stepArmy(frame);
        break;
    }
    this.leave();
  }

  private next(): void {
    this.stage++;
    this.stageFrom = this.battle.frame;
  }

  /** The band: each bandit without a target picks the nearest building or unit of the player's, until the quotas are met. */
  private stepBandits(): void {
    if (this.retreating) {
      return;
    }
    if (this.burnt >= this.quota && this.killed >= this.quota) {
      this.retreat();
      return;
    }
    for (const bandit of this.alive) {
      if (bandit.target && !bandit.target.dead) {
        continue;
      }
      const needBuildings = this.burnt < this.quota;
      const needUnits = this.killed < this.quota;
      const building = needBuildings && (!needUnits || this.battle.random() < 0.5);
      const target = this.nearestOfPlayer(bandit, building ? "building" : "unit")
        ?? this.nearestOfPlayer(bandit, building ? "unit" : "building");
      if (target) {
        this.battle.attackWith([bandit], target);
        bandit.forced = false;
      }
    }
  }

  /** The siege: wait a minute (the captain pacing), then the engines, the first squad, the second with the captain, and away. */
  private stepSiege(frame: number): void {
    const lines = this.troll ? 1 : 0;
    const captain = this.captain;
    switch (this.stage) {
      case 0:
        this.paceCaptain(lines, 94);
        if (frame >= MINUTE) {
          if (captain) {
            this.voice.say(captain, 582 + lines);
            this.battle.moveTo([captain], { x: 52, y: 94 });
          }
          const target = this.nearestToSpawn("building");
          if (target) {
            this.battle.attackWith(this.squad("engines"), target);
          }
          this.next();
        }
        break;
      case 1:
        if (frame >= 150) {
          if (captain) {
            this.voice.say(captain, 584 + lines);
          }
          const target = this.squad("engines").map((f) => f.target).find((t) => t && !t.dead) ?? this.nearestToSpawn("building");
          if (target) {
            const spot = this.battle.freeTileNear({ x: target.tx, y: target.ty }, true);
            if (spot) {
              this.battle.moveTo(this.squad("first"), spot);
            }
          }
          this.next();
        }
        break;
      case 2:
        if (frame >= 450) {
          if (captain) {
            this.voice.say(captain, 586 + lines);
          }
          const target = this.nearestToSpawn("any");
          if (target) {
            this.battle.attackWith([...this.squad("second"), ...(captain ? [captain] : [])], target);
          }
          this.next();
        }
        break;
      case 3:
        if (frame >= 3600) {
          if (captain) {
            this.voice.say(captain, 588 + lines);
          }
          this.retreat();
          this.next();
        }
        break;
    }
  }

  /** The stampede: a minute's wait, then the mounts charge the town's units in two waves. It never retreats. */
  private stepStampede(frame: number): void {
    const lines = this.troll ? 1 : 0;
    if (this.stage === 0) {
      this.paceCaptain(lines, 93);
      if (frame >= MINUTE) {
        const captain = this.captain;
        if (captain) {
          this.voice.say(captain, 590 + lines);
          this.battle.moveTo([captain], { x: 52, y: 94 });
        }
        this.charge("first");
        this.next();
      }
    } else if (this.stage === 1 && frame >= 300) {
      this.charge("second");
      this.next();
    }
  }

  /** Mounts at the town's units near the middle; if one can't get there, at the building nearest the captain instead. */
  private charge(which?: Squad): void {
    const mounts = which ? this.squad(which) : [...this.squad("first"), ...this.squad("second")];
    const targets = this.battle.within({ x: 50, y: 50 }, 30, 10, (f) => f.side === SELF && f.isUnit);
    mounts.forEach((mount, i) => {
      const target = targets[i % Math.max(1, targets.length)];
      if (target) {
        this.battle.attackWith([mount], target);
      }
      if (!target || !mount.target) {
        const from = this.captain ?? mount;
        const building = this.battle.within({ x: from.tx, y: from.ty }, 40, 1, (f) => f.side === SELF && !f.isUnit && !f.dead)[0];
        if (building) {
          this.battle.attackWith([mount], building);
          this.breaking = true;
        }
      }
    });
  }

  /** The army: a minute's wait (the villager crying for help), then the engines and their column, then the second column. It never retreats. */
  private stepArmy(frame: number): void {
    if (this.stage === 0) {
      this.cry();
      if (frame >= MINUTE) {
        const target = this.battle.within({ x: 30, y: 30 }, MAP, 1, (f) => f.side === SELF && !f.dead)[0];
        if (target) {
          this.battle.attackWith(this.squad("engines"), target);
        }
        this.next();
      }
    } else if (this.stage === 1 && frame >= 150) {
      const target = this.battle.within({ x: 30, y: 50 }, MAP, 1, (f) => f.side === SELF && !f.dead)[0];
      if (target) {
        this.battle.attackWith(this.squad("first"), target);
      }
      this.next();
    }
  }

  /** The captain rides from side to side calling to get ready. */
  private paceCaptain(lines: number, y: number): void {
    const captain = this.captain;
    if (!captain || this.battle.isMoving(captain) || captain.target) {
      return;
    }
    this.pace++;
    this.voice.say(captain, (this.pace % 2 ? 592 : 594) + lines);
    this.battle.moveTo([captain], { x: this.pace % 2 ? 57 : 47, y });
  }

  /** The villager runs into town crying for help, one line after another. */
  private cry(): void {
    const crier = this.fighters.find((f) => this.squads.get(f) === "crier" && !f.dead);
    if (!crier || this.battle.isMoving(crier)) {
      return;
    }
    this.voice.say(crier, (this.troll ? 600 : 596) + (this.cried++ % 4));
    this.battle.moveTo([crier], { x: 30 + Math.floor(this.battle.random() * 40), y: 30 + Math.floor(this.battle.random() * 40) });
  }

  /** Back to where they came from, fighting no more. */
  private retreat(): void {
    this.retreating = true;
    for (const f of this.alive) {
      f.condition = "passive";
      f.target = null;
      f.attacking = false;
      this.battle.moveTo([f], this.plan.spawn);
    }
  }

  /** Retreating units leave the map at their spawn, without a word to the server. */
  private leave(): void {
    if (!this.retreating) {
      return;
    }
    for (const f of this.alive) {
      if (Math.max(Math.abs(f.tx - this.plan.spawn.x), Math.abs(f.ty - this.plan.spawn.y)) <= 1 && !this.battle.isMoving(f)) {
        this.battle.remove(f);
      } else if (!this.battle.isMoving(f)) {
        this.battle.moveTo([f], this.plan.spawn);
      }
    }
  }

  private nearestOfPlayer(from: Fighter, what: "building" | "unit"): Fighter | null {
    return this.battle.nearestEnemy(from, { x: from.tx, y: from.ty }, MAP * 2,
      (f) => (what === "unit" ? f.isUnit : !f.isUnit) && f.side === SELF) ?? null;
  }

  private nearestToSpawn(what: "building" | "any"): Fighter | null {
    return this.battle.within(this.plan.spawn, MAP * 2, 1, (f) => f.side === SELF && !f.dead
      && (what === "any" || !f.isUnit))[0] ?? null;
  }
}
