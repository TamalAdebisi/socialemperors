// Bosses with a mind of their own (CLIENT.md, "Quests"), as the Flash
// client plays them. The battle (rules/battle.ts) moves them and fires
// their shots; here they choose: the Rockdriller and its Sanddrillers,
// and the Crimson Scale dragon. Times are battle frames, 30 a second.
//
// Their way of choosing: a grudge list. Every hit a boss takes adds the
// damage to the grudge it holds against whoever dealt it (half again for
// the one it's already after), and on each of its turns it goes for the
// biggest grudge still standing. With no grudge it takes the nearest of
// the player's things within 3 tiles, until it has fought once; after
// that the nearest anywhere.

import { SELF, THINK_EVERY, distance, type Battle, type Fighter } from "./battle.ts";
import type { ItemInfo } from "./config.ts";
import { unitPoint } from "./geometry.ts";

const FOCUS = 1.5;
const ENGAGE_RANGE = 3;

/** The Rockdriller's numbers (our notes on the original's IARockdriller). */
export const ROCKDRILLER = {
  id: 566,
  life: 25000,
  attack: 22,
  interval: 20,
  range: 20,
  /** Up and burrowed in turns, this long each, once it has fought. */
  phase: 450,
  /** In a rage after this long: up for good, 100 every 5 frames. */
  rage: 9000,
  rageAttack: 100,
  rageInterval: 5,
  burrowedSpeed: 12,
  /** Where it wanders burrowed, and goes home to when it gives up. */
  box: [40, 40, 59, 59] as const,
  home: { x: 49, y: 49 },
  /** Its target this far away: it gives up, whole again. */
  giveUpBeyond: 20,
  /** Each shot that lands leaves slime on the tile this long; a Sanddriller there dies. */
  slime: 1200,
};

export const SANDDRILLER = { id: 567, life: 10000, attack: 100, interval: 20, range: 1, velocity: 2 };

/** A grudge list: who has hurt this boss, and how much. */
class Grudges {
  private readonly list = new Map<Fighter, number>();

  add(by: Fighter, damage: number, current: Fighter | null): void {
    this.list.set(by, (this.list.get(by) ?? 0) + damage * (by === current ? FOCUS : 1));
  }

  top(): Fighter | null {
    let best: Fighter | null = null;
    let most = -1;
    for (const [f, grudge] of this.list) {
      if (f.dead) {
        this.list.delete(f);
      } else if (grudge > most) {
        best = f;
        most = grudge;
      }
    }
    return best;
  }

  clear(): void {
    this.list.clear();
  }
}

/** A boss's choosing, on its turns. */
abstract class Mind {
  readonly unit: Fighter;
  protected readonly battle: Battle;
  protected readonly grudges = new Grudges();
  engaged = false;

  constructor(battle: Battle, unit: Fighter) {
    this.battle = battle;
    this.unit = unit;
    battle.ownMind.add(unit);
  }

  /** It was hurt. */
  hurt(by: Fighter | null, damage: number): void {
    if (by && by.side !== this.unit.side) {
      this.grudges.add(by, damage, this.unit.target);
    }
  }

  /** Who to go for now: the biggest grudge, else the nearest (within 3 tiles before it has fought). */
  protected choose(): Fighter | null {
    const unit = this.unit;
    return this.grudges.top()
      ?? this.battle.nearestEnemy(unit, { x: unit.tx, y: unit.ty }, this.engaged ? 200 : ENGAGE_RANGE);
  }

  protected go(target: Fighter | null): void {
    const unit = this.unit;
    if (!target) {
      return;
    }
    if (!this.engaged) {
      this.engaged = true;
      this.engage();
    }
    unit.target = target;
    unit.attacking = true;
    if (distance(unit, target) > unit.range && unit.velocity > 0) {
      this.battle.attackWith([unit], target);
      unit.forced = false;
    }
  }

  /** The first time it goes for someone. */
  protected engage(): void {}

  abstract step(frame: number): void;
}

export class Rockdriller extends Mind {
  burrowed = false;
  enraged = false;
  private engagedAt = 0;
  private phaseAt = 0;
  private goingHome = false;
  readonly sanddrillers: Sanddriller[] = [];
  /** Slimed tiles, and until when. */
  readonly slime = new Map<string, number>();
  private readonly items: Map<number, ItemInfo>;

  constructor(battle: Battle, unit: Fighter, items: Map<number, ItemInfo>) {
    super(battle, unit);
    this.items = items;
    this.surface();
  }

  /** Up: it stands where it is and shoots. */
  private surface(): void {
    const unit = this.unit;
    this.burrowed = false;
    unit.velocity = 0;
    unit.condition = "aggressive";
    this.battle.stop(unit);
  }

  /** Down: everyone aiming at it forgets it; it wanders, and a Sanddriller comes up. */
  private burrow(): void {
    const unit = this.unit;
    this.burrowed = true;
    this.grudges.clear();
    unit.target = null;
    unit.attacking = false;
    unit.condition = "passive";
    unit.velocity = ROCKDRILLER.burrowedSpeed;
    for (const f of this.battle.fighters) {
      if (f.target === unit) {
        f.target = null;
        f.attacking = false;
      }
    }
    const item = this.items.get(SANDDRILLER.id);
    const tile = this.battle.freeTileNear({ x: unit.tx, y: unit.ty }, true);
    if (item && tile) {
      const added = this.battle.add(item, tile.x, tile.y, unit.side, {
        summoned: true, life: SANDDRILLER.life, maxLife: SANDDRILLER.life, attack: SANDDRILLER.attack,
        interval: SANDDRILLER.interval, range: SANDDRILLER.range, velocity: SANDDRILLER.velocity,
      });
      this.sanddrillers.push(new Sanddriller(this.battle, added, this));
    }
  }

  protected engage(): void {
    this.engagedAt = this.phaseAt = this.battle.frame;
  }

  /**
   * Its target ran too far: back to 25,000 life (whatever the stars, as in
   * the original), its Sanddrillers gone, home to the middle, as if new.
   */
  private giveUp(): void {
    const unit = this.unit;
    unit.life = ROCKDRILLER.life;
    unit.maxLife = Math.max(unit.maxLife, unit.life);
    this.dropSanddrillers();
    this.engaged = false;
    this.calm();
    this.grudges.clear();
    unit.target = null;
    unit.attacking = false;
    this.burrowed = false;
    unit.condition = "passive";
    unit.velocity = ROCKDRILLER.burrowedSpeed;
    this.goingHome = this.battle.walk(unit, ROCKDRILLER.home);
    if (!this.goingHome) {
      this.surface();
    }
  }

  private rage(): void {
    this.enraged = this.unit.enraged = true;
    this.unit.attack = ROCKDRILLER.rageAttack;
    this.unit.interval = ROCKDRILLER.rageInterval;
    if (this.burrowed) {
      this.surface();
    }
  }

  private calm(): void {
    this.enraged = this.unit.enraged = false;
    this.unit.attack = ROCKDRILLER.attack;
    this.unit.interval = ROCKDRILLER.interval;
  }

  dropSanddrillers(): void {
    for (const s of this.sanddrillers.splice(0)) {
      this.battle.remove(s.unit);
    }
  }

  /** One of its shots landed: slime on the tile. */
  landed(target: Fighter): void {
    this.slime.set(`${target.tx},${target.ty}`, this.battle.frame + ROCKDRILLER.slime);
  }

  slimed(x: number, y: number): boolean {
    return (this.slime.get(`${x},${y}`) ?? -1) > this.battle.frame;
  }

  step(frame: number): void {
    const unit = this.unit;
    if (unit.dead) {
      this.dropSanddrillers();
      return;
    }
    for (const s of [...this.sanddrillers]) {
      s.step(frame);
    }
    if (this.goingHome) {
      if (this.battle.isMoving(unit)) {
        return;
      }
      this.goingHome = false;
      this.surface();
    }
    if (this.engaged && !this.enraged && frame - this.engagedAt >= ROCKDRILLER.rage) {
      this.rage();
    } else if (this.engaged && !this.enraged && frame - this.phaseAt >= ROCKDRILLER.phase) {
      this.phaseAt = frame;
      if (this.burrowed) {
        this.surface();
      } else {
        this.burrow();
      }
    }
    if (frame % THINK_EVERY !== 0) {
      return;
    }
    if (this.burrowed) {
      if (!this.battle.isMoving(unit)) {
        const [x0, y0, x1, y1] = ROCKDRILLER.box;
        const random = this.battle.random;
        this.battle.walk(unit, { x: x0 + Math.floor(random() * (x1 - x0 + 1)), y: y0 + Math.floor(random() * (y1 - y0 + 1)) });
      }
      return;
    }
    // Whoever it's after (or would go for) too far away: it gives up.
    const target = unit.target && !unit.target.dead ? unit.target : this.choose();
    if (target && distance(unit, target) > ROCKDRILLER.giveUpBeyond) {
      this.giveUp();
      return;
    }
    this.go(this.choose());
  }
}

/** The Rockdriller's worm: a grudge list like its master's, and slime kills it. */
export class Sanddriller extends Mind {
  private readonly master: Rockdriller;

  constructor(battle: Battle, unit: Fighter, master: Rockdriller) {
    super(battle, unit);
    this.master = master;
  }

  step(frame: number): void {
    const unit = this.unit;
    if (unit.dead || frame % THINK_EVERY !== 0) {
      return;
    }
    if (this.master.slimed(unit.tx, unit.ty)) {
      this.battle.kill(unit, null);
      return;
    }
    this.go(this.choose());
  }
}

/** The Crimson Scale's numbers (our notes on the original's IADragon). */
export const DRAGON = {
  id: 657,
  /** Fighting this long once it has fought, then its bombing runs. */
  fight: 600,
  /** Where its runs start: one of these columns, at one end. */
  columns: [42, 47, 52, 57],
  ends: [20, 59],
  /** Each tile it flies over sets fire to 2 tiles either side; 15 frames later the fire kills. */
  fireHalfWidth: 2,
  fireKills: 15,
  /** Where it lands to lay. */
  rest: [40, 20, 58, 58] as const,
  /** An egg every 15 frames, 2 to 4 tiles off, 2 for each star, turning a quarter each time. */
  eggEvery: 15,
  eggsPerStar: 2,
  draggy: 638,
};

/** The four ways it throws its eggs, in turn: up-right, down-right, up-left, down-left (on the map's tiles). */
const EGG_WAYS = [[0, -1], [1, 0], [-1, 0], [0, 1]] as const;
const FACING_UP_RIGHT = 2;
const FACING_DOWN_LEFT = 8;

type DragonPhase = "fight" | "toRun" | "run" | "toRest" | "lay";

export class Dragon extends Mind {
  phase: DragonPhase = "fight";
  private readonly stars: number;
  private readonly items: Map<number, ItemInfo>;
  private clock = 0;
  private runsLeft = 0;
  private runTo = { x: 0, y: 0 };
  private lastTile = "";
  private eggsLeft = 0;
  private nextEgg = 0;
  private eggWay = 0;
  /** Its draggies, hatched from its eggs. */
  readonly draggies: Fighter[] = [];

  constructor(battle: Battle, unit: Fighter, items: Map<number, ItemInfo>, stars: number) {
    super(battle, unit);
    this.items = items;
    this.stars = stars;
    unit.condition = "aggressive";
  }

  protected engage(): void {
    this.clock = this.battle.frame;
  }

  private forget(): void {
    const unit = this.unit;
    this.grudges.clear();
    unit.target = null;
    unit.attacking = false;
    unit.condition = "passive";
  }

  /** To the start of a bombing run: a column's end, not where it stands. */
  private toRun(): void {
    const random = this.battle.random;
    const unit = this.unit;
    let x = unit.tx;
    let y = unit.ty;
    for (let tries = 0; tries < 10 && x === unit.tx && y === unit.ty; tries++) {
      x = DRAGON.columns[Math.floor(random() * DRAGON.columns.length)];
      y = DRAGON.ends[Math.floor(random() * DRAGON.ends.length)];
    }
    this.phase = "toRun";
    this.runTo = { x, y: y === DRAGON.ends[0] ? DRAGON.ends[1] : DRAGON.ends[0] };
    this.battle.walk(unit, { x, y });
  }

  /** It sets fire to the row it's over: 5 tiles, each killing what stands there 15 frames later. */
  private burn(x: number, y: number): void {
    for (let dx = -DRAGON.fireHalfWidth; dx <= DRAGON.fireHalfWidth; dx++) {
      const tile = { x: x + dx, y };
      this.battle.show({ art: "magic_fire", at: unitPoint(tile.x, tile.y), until: this.battle.frame + DRAGON.fireKills, above: true });
      this.battle.after(DRAGON.fireKills, () => {
        const there = this.battle.standingAt(tile.x, tile.y);
        if (there && there.side === SELF && !there.dead) {
          this.battle.kill(there, this.unit);
        }
      });
    }
  }

  private lay(): void {
    this.phase = "lay";
    this.eggsLeft = DRAGON.eggsPerStar * this.stars;
    this.nextEgg = this.battle.frame + DRAGON.eggEvery;
    this.eggWay = 0;
    this.unit.facing = FACING_UP_RIGHT;
    this.unit.velocity = 0;
  }

  /** An egg thrown 2 to 4 tiles the way it faces: a draggy, on its side, after whoever it was fighting. */
  private egg(): void {
    const unit = this.unit;
    const [dx, dy] = EGG_WAYS[this.eggWay % EGG_WAYS.length];
    this.eggWay++;
    const far = 2 + Math.floor(this.battle.random() * 3);
    const item = this.items.get(DRAGON.draggy);
    const tile = this.battle.freeTileNear({ x: unit.tx + dx * far, y: unit.ty + dy * far }, false);
    if (!item || !tile) {
      return;
    }
    const draggy = this.battle.add(item, tile.x, tile.y, unit.side, { summoned: true });
    this.draggies.push(draggy);
    const prey = this.grudges.top() ?? this.battle.nearestEnemy(unit, { x: unit.tx, y: unit.ty }, 200);
    if (prey) {
      this.battle.attackWith([draggy], prey);
    }
  }

  step(frame: number): void {
    const unit = this.unit;
    if (unit.dead) {
      return;
    }
    const moving = this.battle.isMoving(unit);
    switch (this.phase) {
      case "fight":
        if (this.engaged && frame - this.clock >= DRAGON.fight) {
          this.forget();
          this.runsLeft = this.stars;
          this.toRun();
          return;
        }
        if (frame % THINK_EVERY === 0) {
          this.go(this.choose());
        }
        return;
      case "toRun":
        if (!moving) {
          this.phase = "run";
          this.lastTile = "";
          unit.special = { animation: 8, until: Number.MAX_SAFE_INTEGER };
          this.battle.walk(unit, this.runTo);
        }
        return;
      case "run": {
        const here = `${unit.tx},${unit.ty}`;
        if (here !== this.lastTile) {
          this.lastTile = here;
          this.burn(unit.tx, unit.ty);
        }
        unit.facing = this.runTo.y > unit.ty ? FACING_DOWN_LEFT : FACING_UP_RIGHT;
        if (!moving) {
          unit.special = null;
          this.runsLeft--;
          if (this.runsLeft > 0) {
            this.toRun();
          } else {
            this.phase = "toRest";
            const [x0, y0, x1, y1] = DRAGON.rest;
            const random = this.battle.random;
            const spot = this.battle.freeTileNear({ x: x0 + Math.floor(random() * (x1 - x0 + 1)), y: y0 + Math.floor(random() * (y1 - y0 + 1)) }, false);
            if (!spot || !this.battle.walk(unit, spot)) {
              this.lay();
            }
          }
        }
        return;
      }
      case "toRest":
        if (!moving) {
          this.lay();
        }
        return;
      case "lay":
        if (frame >= this.nextEgg) {
          this.egg();
          this.eggsLeft--;
          this.nextEgg = frame + DRAGON.eggEvery;
          unit.facing = [FACING_UP_RIGHT, 4, 6, FACING_DOWN_LEFT][this.eggWay % 4];
          if (this.eggsLeft <= 0) {
            this.phase = "fight";
            this.clock = frame;
            unit.velocity = this.speed;
            unit.condition = "aggressive";
          }
        }
        return;
    }
  }

  /** Its speed, for after it has laid (it stands still while it lays). */
  speed = 0;
}

/** Every boss mind on the field, fed by the battle's hooks. */
export class BossMinds {
  readonly minds: Mind[] = [];
  private readonly battle: Battle;
  private readonly items: Map<number, ItemInfo>;

  constructor(battle: Battle, items: Map<number, ItemInfo>) {
    this.battle = battle;
    this.items = items;
    battle.onHurt.push((target, damage, by) => this.find(target)?.hurt(by, damage));
    battle.onLanded.push((shot, hit) => {
      const mind = this.minds.find((m) => m.unit === shot.by);
      if (hit && mind instanceof Rockdriller) {
        mind.landed(shot.target);
      }
    });
  }

  private find(unit: Fighter): Mind | undefined {
    for (const mind of this.minds) {
      if (mind.unit === unit) {
        return mind;
      }
      if (mind instanceof Rockdriller) {
        const worm = mind.sanddrillers.find((s) => s.unit === unit);
        if (worm) {
          return worm;
        }
      }
    }
    return undefined;
  }

  /** A boss with a mind of its own comes onto the field. */
  add(unit: Fighter, stars = 1): void {
    if (unit.item.id === DRAGON.id) {
      const dragon = new Dragon(this.battle, unit, this.items, stars);
      dragon.speed = unit.velocity;
      this.minds.push(dragon);
    } else if (unit.item.id === ROCKDRILLER.id) {
      unit.attack = ROCKDRILLER.attack;
      unit.interval = ROCKDRILLER.interval;
      unit.range = ROCKDRILLER.range;
      this.minds.push(new Rockdriller(this.battle, unit, this.items));
    }
  }

  /** Every frame, after the battle's. */
  step(): void {
    for (const mind of this.minds) {
      mind.step(this.battle.frame);
    }
  }
}
