// Special moves (CLIENT.md, "Special moves"), as the Flash client plays
// them: the heroes' and other units' moves that come by themselves while
// they fight, the buttons of the special units (dragons, gods, colossi,
// titans...) with their shared cooldown, and the LIMIT bar that fills as
// they fight. The moves themselves are in rules/specials-table.json, one
// of a few kinds each, with their numbers; our notes in words are in
// rules/specials.json, which the game doesn't load.
//
// Times are battle frames, 30 a second. A move's damage is `factor` times
// the unit's attack, or, when the factor is negative, that many points;
// either way it goes through the normal damage formula.

import { NEUTRAL, SUBCAT, type Battle, type Fighter } from "./battle.ts";
import type { ItemInfo } from "./config.ts";
import { unitPoint, type Point } from "./geometry.ts";

export type Around = "self" | "target";

export type Move =
  | { kind: "volley"; shots: number; every: number; factor: number; projectile: number | null }
  | { kind: "storm"; count: number; radius: number; factor: number; minDelay: number; maxDelay: number; around: Around; fx: string | null }
  | { kind: "whirl"; radius: number; max: number; factor: number; every: number; duration: number; around: Around; push: number; stun: boolean;
    poison: { damage: number; ticks: number } | null; fx: string | null }
  | { kind: "blast"; radius: number; max: number; factor: number; around: Around; push: number; stun: boolean; fx: string | null; skipCross?: boolean }
  | { kind: "line"; length: number; factor: number; push: number; stun: boolean; fx: string | null }
  | { kind: "diagonal"; factor: number }
  | { kind: "hit"; factor: number; push: number; stun: boolean; fx: string | null }
  | { kind: "heal"; who: "self" | "allies" | "target"; radius: number; max: number; amount: number; factor: number }
  /** maxAlive 0: no limit (the bosses' small yetis and golems). */
  | { kind: "spawn"; minion: number; count: number; maxAlive: number; egg: boolean }
  | { kind: "swallow"; radius: number; max: number; around: Around; maxLife: number }
  | { kind: "freeze"; radius: number; max: number; frames: number; around: Around }
  | { kind: "poison"; radius: number; max: number; damage: number; ticks: number; around: Around }
  | { kind: "grow"; frames: number; attack: number; speed: number }
  | { kind: "haste"; radius: number; max: number; cut: number; frames: number }
  | { kind: "beams"; count: number; every: number; factor: number }
  | { kind: "healBeams"; count: number; every: number; factor: number }
  | { kind: "smash"; max: number; factor: number }
  | { kind: "duplicate" }
  | { kind: "other"; note: string };

/** `animations`: each move its own (the bosses' three), else `animation` for all. */
export interface AutoEntry { ids: number[]; name: string; interval: number; length: number; animation: number; animations?: number[]; moves: Move[] }
export interface Button { slot: number; name: string; picture: string; animation: number; needsTarget: boolean; move: Move }
export interface Limit { max: number; fill: "damage" | "heal"; name: string; animation: number; move: Move }
export interface UnitEntry { ids: number[]; name: string; cooldown: number; buttons: Button[]; limit: Limit | null; giant: boolean }
export interface SpecialsTable { auto: AutoEntry[]; units: UnitEntry[] }

/** The LIMIT bar fills at most once a second, and twice as fast beside a Limit Wizard of its side. */
const LIMIT_FILL_EVERY = 30;
const LIMIT_ADDERS = new Set([883]);
const LIMIT_ADDER_RANGE = 10;
/** A button's move starts on the unit's next whole-second tick. */
const TICK = 30;
/** Knocked down: up for half a second, down for half, then 1.5 seconds helpless. */
const STUN_FRAMES = 75;
/** Units this big (population) stand a knock-down. */
const BIG_POPULATION = 4;
/** An egg is laid this far ahead (4 to 8 tiles), and hatches after this long. */
const EGG_NEAR = 4;
const EGG_FAR = 8;
const HATCH_FRAMES = 45;
/** A special animation shows at least this long. */
const SHOW_AT_LEAST = 45;

/** What the button bar shows for one button. */
export interface ButtonView {
  slot: number;
  name: string;
  picture: string;
  /** Seconds before it can be pressed again (0: ready, as far as time goes). */
  wait: number;
  /** Why it can't be pressed now, or "". */
  why: string;
  limit: boolean;
}

interface State {
  /** Auto moves: frames fighting since the last special, in the special now (since when), whose turn. */
  counter: number;
  windowFrom: number;
  turn: number;
  /** Buttons: busy (casting or cooling) until this frame. */
  busyUntil: number;
  limit: number;
  lastFill: number;
  limitRunning: boolean;
  duplicated: boolean;
}

export class Specials {
  private readonly battle: Battle;
  private readonly items: Map<number, ItemInfo>;
  private readonly random: () => number;
  private readonly auto = new Map<number, AutoEntry>();
  private readonly units = new Map<number, UnitEntry>();
  private readonly states = new Map<Fighter, State>();
  /** Who laid or summoned each minion, for the "3 alive at most". */
  private readonly owners = new Map<Fighter, Fighter>();
  private readonly hatching = new Set<Fighter>();
  private lastStep = 0;

  constructor(battle: Battle, table: SpecialsTable, items: Map<number, ItemInfo>, random: () => number = Math.random) {
    this.battle = battle;
    this.items = items;
    this.random = random;
    for (const entry of table.auto) {
      for (const id of entry.ids) {
        this.auto.set(id, entry);
      }
    }
    for (const entry of table.units) {
      for (const id of entry.ids) {
        this.units.set(id, entry);
      }
    }
    battle.onBeat = (unit, target) => this.beat(unit, target);
    battle.onDealt = (by, amount, healing) => this.dealt(by, amount, healing);
  }

  /** A fighter's buttons, if it has any. */
  entryOf(f: Fighter): UnitEntry | null {
    return f.isUnit ? this.units.get(f.item.id) ?? null : null;
  }

  private state(f: Fighter): State {
    let state = this.states.get(f);
    if (!state) {
      state = { counter: 0, windowFrom: -1, turn: 0, busyUntil: 0, limit: 0, lastFill: -LIMIT_FILL_EVERY, limitRunning: false, duplicated: false };
      this.states.set(f, state);
      const entry = this.entryOf(f);
      if (entry?.limit) {
        f.limitMax = entry.limit.max;
        f.limit = 0;
      }
      if (entry?.giant) {
        f.giant = true;
      }
    }
    return state;
  }

  /** Once a frame, after the battle's step: the automatic moves' clocks. */
  step(): void {
    const frame = this.battle.frame;
    if (frame === this.lastStep) {
      return;
    }
    this.lastStep = frame;
    for (const f of this.battle.fighters) {
      if (f.dead || !f.isUnit) {
        continue;
      }
      if (this.entryOf(f)) {
        this.state(f);  // sets up its LIMIT bar and size
      }
      const entry = this.auto.get(f.item.id);
      if (!entry || entry.moves.length === 0) {
        continue;
      }
      const state = this.state(f);
      const fighting = f.attacking && f.target !== null && !f.target.dead && !this.battle.isStilled(f);
      if (state.windowFrom >= 0) {
        if (frame - state.windowFrom >= entry.length) {
          state.windowFrom = -1;
          state.counter = 0;
          state.turn = (state.turn + 1) % entry.moves.length;
        }
      } else if (fighting) {
        state.counter++;
        if (state.counter >= entry.interval) {
          state.windowFrom = frame;
          f.special = { animation: entry.animations?.[state.turn % entry.moves.length] ?? entry.animation, until: frame + entry.length };
        }
      }
    }
  }

  /** An attack beat: inside an automatic move's window, the move instead of the hit. */
  private beat(unit: Fighter, target: Fighter): boolean {
    const entry = this.auto.get(unit.item.id);
    if (!entry) {
      return false;
    }
    const state = this.state(unit);
    if (state.windowFrom < 0) {
      return false;
    }
    const move = entry.moves[state.turn % entry.moves.length];
    if (move.kind === "duplicate" && state.duplicated) {
      return false;
    }
    this.play(unit, move, target);
    return true;
  }

  /** Damage (or healing) dealt fills the LIMIT bar, at most once a second. */
  private dealt(by: Fighter, amount: number, healing: boolean): void {
    const entry = this.entryOf(by);
    if (!entry?.limit || (entry.limit.fill === "heal") !== healing) {
      return;
    }
    const state = this.state(by);
    const frame = this.battle.frame;
    if (state.limitRunning || frame - state.lastFill < LIMIT_FILL_EVERY) {
      return;
    }
    state.lastFill = frame;
    const doubled = this.battle.fighters.some((f) => !f.dead && f.side === by.side && LIMIT_ADDERS.has(f.item.id)
      && (f.tx - by.tx) ** 2 + (f.ty - by.ty) ** 2 <= LIMIT_ADDER_RANGE ** 2);
    by.limit = Math.min(entry.limit.max, (by.limit ?? 0) + amount * (doubled ? 2 : 1));
  }

  /** What a unit's buttons show now. */
  buttons(f: Fighter): ButtonView[] {
    const entry = this.entryOf(f);
    if (!entry || f.dead) {
      return [];
    }
    const state = this.state(f);
    const wait = Math.max(0, Math.ceil((state.busyUntil - this.battle.frame) / 30));
    const views: ButtonView[] = entry.buttons.filter((b) => b.move.kind !== "other").map((b) => ({
      slot: b.slot, name: b.name, picture: b.picture, wait, limit: false, why: wait ? "" : this.problem(f, b),
    }));
    if (entry.limit && entry.limit.move.kind !== "other") {
      const full = (f.limit ?? 0) >= entry.limit.max;
      views.push({ slot: 4, name: entry.limit.name || "LIMIT", picture: "", wait: 0, limit: true,
        why: state.limitRunning ? "Under way" : full ? "" : "The LIMIT bar fills as it fights" });
    }
    return views;
  }

  /** Why a button can't be pressed (besides waiting), or "". */
  private problem(f: Fighter, button: Button): string {
    if (this.battle.isStilled(f)) {
      return "It can't move right now";
    }
    if (button.needsTarget && !this.targetOf(f)) {
      return "No enemy in reach";
    }
    if (button.move.kind === "spawn" && button.move.maxAlive > 0 && this.minions(f).length >= button.move.maxAlive) {
      return `${button.move.maxAlive} at most at once`;
    }
    return "";
  }

  /** Press a button (slot 4: the LIMIT). Returns why not, or "" when it's under way. */
  press(f: Fighter, slot: number): string {
    const entry = this.entryOf(f);
    if (!entry || f.dead) {
      return "No such move";
    }
    const state = this.state(f);
    const frame = this.battle.frame;
    // The move starts on the next whole-second tick.
    const start = TICK - (frame % TICK);
    if (slot === 4) {
      const limit = entry.limit;
      if (!limit || limit.move.kind === "other") {
        return "No such move";
      }
      if (state.limitRunning || (f.limit ?? 0) < limit.max) {
        return "The LIMIT bar isn't full yet";
      }
      state.limitRunning = true;
      const ends = start + lasting(limit.move);
      f.special = { animation: limit.animation, until: frame + Math.max(ends, SHOW_AT_LEAST) };
      this.battle.after(start, () => this.play(f, limit.move, this.targetOf(f)));
      this.battle.after(ends, () => {
        state.limitRunning = false;
        f.limit = 0;
      });
      return "";
    }
    const button = entry.buttons.find((b) => b.slot === slot);
    if (!button || button.move.kind === "other") {
      return "No such move";
    }
    if (frame < state.busyUntil) {
      return `Ready in ${Math.ceil((state.busyUntil - frame) / 30)} s`;
    }
    const why = this.problem(f, button);
    if (why) {
      return why;
    }
    const target = this.targetOf(f);
    state.busyUntil = frame + start + lasting(button.move) + entry.cooldown * 30;
    f.special = { animation: button.animation, until: frame + Math.max(start + lasting(button.move), SHOW_AT_LEAST) };
    this.battle.after(start, () => this.play(f, button.move, target && !target.dead ? target : this.targetOf(f)));
    return "";
  }

  /** Its target if it's a living enemy, else the nearest enemy within its reach (at least 6 tiles). */
  private targetOf(f: Fighter): Fighter | null {
    if (f.target && !f.target.dead && this.isEnemy(f, f.target)) {
      return f.target;
    }
    return this.battle.within({ x: f.tx, y: f.ty }, Math.max(f.range, 6), 1, (o) => this.isEnemy(f, o))[0] ?? null;
  }

  private isEnemy(f: Fighter, o: Fighter): boolean {
    return o.side !== f.side && o.side !== NEUTRAL && !o.dead;
  }

  private minions(f: Fighter): Fighter[] {
    // Eggs not hatched yet count too: they aren't on the field.
    return [...this.owners].filter(([minion, owner]) => owner === f && !minion.dead
      && (this.hatching.has(minion) || this.battle.fighters.includes(minion))).map(([minion]) => minion);
  }

  /** How much a move does: its factor of the attack, or a fixed amount. */
  private amount(f: Fighter, factor: number): number {
    return factor < 0 ? -factor : factor * f.attack;
  }

  private knockDown(f: Fighter): void {
    if (f.isUnit && !f.giant && f.item.subcategory !== SUBCAT.boss && f.item.population < BIG_POPULATION
      && !this.battle.isEnlarged(f) && !this.battle.isStilled(f)) {
      this.battle.still(f, STUN_FRAMES);
    }
  }

  /** Hurt an enemy, and throw it or knock it down. */
  private strike(f: Fighter, o: Fighter, factor: number, push: number, stun: boolean, from: Point): void {
    this.battle.hurt(o, this.amount(f, factor), f);
    if (o.dead) {
      return;
    }
    if (push > 0) {
      this.battle.knock(o, from, push);
    } else if (stun) {
      this.knockDown(o);
    }
  }

  private show(fx: string | null, tile: Point, until?: number): void {
    if (fx) {
      this.battle.show({ art: fx, at: unitPoint(tile.x, tile.y), until, above: true });
    }
  }

  /** A move, played now. */
  play(f: Fighter, move: Move, target: Fighter | null): void {
    if (f.dead) {
      return;
    }
    const battle = this.battle;
    const self = (): Point => ({ x: f.tx, y: f.ty });
    const centreOf = (around: Around): Point => (around === "target" && target ? { x: target.tx, y: target.ty } : self());
    const enemies = (centre: Point, radius: number, max: number, which: (o: Fighter) => boolean = () => true) =>
      battle.within(centre, radius < 0 ? f.range : radius, max, (o) => this.isEnemy(f, o) && which(o));
    switch (move.kind) {
      case "volley":
        for (let i = 0; i < move.shots; i++) {
          battle.after(i * move.every, () => {
            const at = target && !target.dead ? target : this.targetOf(f);
            if (at && !f.dead) {
              battle.shootAt(f, at, move.projectile, this.amount(f, move.factor));
            }
          });
        }
        break;
      case "storm": {
        const centre = centreOf(move.around);
        for (let i = 0; i < move.count; i++) {
          const delay = move.minDelay + Math.floor(this.random() * Math.max(0, move.maxDelay - move.minDelay));
          battle.after(delay, () => {
            const tile = randomTile(centre, move.radius, this.random);
            this.show(move.fx, tile);
            const there = battle.standingAt(tile.x, tile.y);
            if (there && this.isEnemy(f, there)) {
              battle.hurt(there, this.amount(f, move.factor), f);
            }
          });
        }
        break;
      }
      case "whirl": {
        const ticks = Math.max(1, Math.floor(move.duration / Math.max(1, move.every)));
        const poisoned = new Set<Fighter>();
        this.show(move.fx, centreOf(move.around), battle.frame + move.duration);
        for (let k = 0; k < ticks; k++) {
          battle.after(k * move.every, () => {
            if (f.dead) {
              return;
            }
            const centre = centreOf(move.around);
            for (const o of enemies(centre, move.radius, move.max)) {
              this.strike(f, o, move.factor, move.push, move.stun, centre);
              if (move.poison && o.isUnit && !o.dead && !o.poison && !poisoned.has(o)) {
                poisoned.add(o);
                o.poison = { damage: move.poison.damage, left: move.poison.ticks, next: battle.frame + 90 };
              }
            }
          });
        }
        break;
      }
      case "blast": {
        const centre = centreOf(move.around);
        this.show(move.fx, centre);
        // The bosses' pound leaves out the row and column it stands on.
        const off = (o: Fighter) => !move.skipCross || (o.tx !== centre.x && o.ty !== centre.y);
        for (const o of enemies(centre, move.radius, move.max, off)) {
          this.strike(f, o, move.factor, move.push, move.stun, centre);
        }
        break;
      }
      case "line": {
        const to = target ? { x: target.tx, y: target.ty } : self();
        const step = { x: Math.sign(to.x - f.tx), y: Math.sign(to.y - f.ty) };
        if (step.x === 0 && step.y === 0) {
          step.x = 1;
        }
        for (let i = 1; i <= move.length; i++) {
          const tile = { x: f.tx + step.x * i, y: f.ty + step.y * i };
          battle.after(i * 5, () => {
            this.show(move.fx, tile);
            const there = battle.standingAt(tile.x, tile.y);
            if (there && this.isEnemy(f, there)) {
              this.strike(f, there, move.factor, move.push, move.stun, self());
            }
          });
        }
        break;
      }
      case "diagonal":
        for (const [dx, dy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
          const there = battle.standingAt(f.tx + dx, f.ty + dy);
          if (there && this.isEnemy(f, there)) {
            battle.hurt(there, this.amount(f, move.factor), f);
          }
        }
        break;
      case "hit":
        if (target && !target.dead) {
          this.show(move.fx, { x: target.tx, y: target.ty });
          this.strike(f, target, move.factor, move.push, move.stun, self());
        }
        break;
      case "heal": {
        const amount = move.amount + move.factor * f.attack;
        const who = move.who === "self" ? [f]
          : move.who === "target" ? (target && target.side === f.side ? [target] : [])
            : battle.within(self(), move.radius, move.max, (o) => o.side === f.side && o.isUnit && o.life < o.maxLife);
        for (const o of who) {
          battle.heal(o, amount, f);
        }
        break;
      }
      case "spawn": {
        const item = this.items.get(move.minion);
        if (!item) {
          break;
        }
        for (let i = 0; i < move.count; i++) {
          if (move.maxAlive > 0 && this.minions(f).length >= move.maxAlive) {
            break;
          }
          let near = self();
          if (move.egg && target) {
            const dx = target.tx - f.tx;
            const dy = target.ty - f.ty;
            const length = Math.hypot(dx, dy) || 1;
            const far = Math.min(EGG_FAR, Math.max(EGG_NEAR, Math.round(length / 2)));
            near = { x: Math.round(f.tx + (far * dx) / length), y: Math.round(f.ty + (far * dy) / length) };
          }
          const tile = battle.freeTileNear(near, !move.egg);
          if (!tile) {
            break;
          }
          // Counted from now, so the "at most" counts it while it hatches.
          const egg = { dead: false } as Fighter;
          this.owners.set(egg, f);
          this.hatching.add(egg);
          battle.after(move.egg ? HATCH_FRAMES + i * 8 : i * 8, () => {
            this.owners.delete(egg);
            this.hatching.delete(egg);
            const minion = battle.add(item, tile.x, tile.y, f.side, { summoned: true });
            this.owners.set(minion, f);
          });
        }
        break;
      }
      case "swallow":
        for (const o of enemies(centreOf(move.around), move.radius, move.max,
          (o) => o.isUnit && o.item.subcategory !== SUBCAT.boss && (move.maxLife <= 0 || o.maxLife <= move.maxLife))) {
          battle.swallow(o);
        }
        break;
      case "freeze":
        for (const o of enemies(centreOf(move.around), move.radius, move.max, (o) => o.isUnit && o.item.subcategory !== SUBCAT.boss)) {
          battle.still(o, move.frames, true);
        }
        break;
      case "poison":
        for (const o of enemies(centreOf(move.around), move.radius, move.max, (o) => o.isUnit && o.item.subcategory !== SUBCAT.boss)) {
          if (!o.poison) {
            o.poison = { damage: move.damage, left: move.ticks, next: battle.frame + 90 };
          }
        }
        break;
      case "grow": {
        f.attack += move.attack;
        const velocity = f.velocity;
        f.velocity = velocity * move.speed;
        f.grewAt = battle.frame;
        f.grownUntil = battle.frame + move.frames;
        battle.after(move.frames, () => {
          f.attack -= move.attack;
          f.velocity = velocity;
        });
        break;
      }
      case "haste":
        for (const o of battle.within(self(), move.radius, move.max, (o) => o.side === f.side && o.isUnit && o !== f)) {
          o.interval = Math.max(10, o.item.attackInterval - move.cut);
          battle.after(move.frames, () => {
            o.interval = o.item.attackInterval;
          });
        }
        break;
      case "beams":
        for (let i = 0; i < move.count; i++) {
          battle.after(i * move.every, () => {
            const near = enemies(self(), Math.max(f.range, 1) + 1, 50);
            const o = near[Math.floor(this.random() * near.length)];
            if (o && !f.dead) {
              battle.shootAt(f, o, LIGHTNING, this.amount(f, move.factor));
            }
          });
        }
        break;
      case "healBeams":
        for (let i = 0; i < move.count; i++) {
          battle.after(i * move.every, () => {
            const hurt = battle.within(self(), Math.max(f.range, 1) + 1, 50, (o) => o.side === f.side && o.isUnit && o.life < o.maxLife);
            const o = hurt[Math.floor(this.random() * hurt.length)];
            if (o && !f.dead) {
              battle.heal(o, move.factor * f.item.attack, null);
            }
          });
        }
        break;
      case "smash":
        for (const o of enemies(self(), Math.max(f.range, 2), move.max, (o) => o.isUnit)) {
          this.strike(f, o, move.factor, 4, false, self());
        }
        break;
      case "duplicate": {
        const state = this.state(f);
        if (state.duplicated) {
          break;
        }
        state.duplicated = true;
        const tile = battle.freeTileNear(self(), true);
        if (tile) {
          const copy = battle.add(f.item, tile.x, tile.y, f.side, { summoned: true });
          this.states.set(copy, { ...this.state(copy), duplicated: true });
        }
        break;
      }
      case "other":
        break;
    }
  }
}

/** The wizard's lightning bolt: the LIMIT's beams. */
const LIGHTNING = 8;

/** How long a move goes on, in frames (0 for one that happens at once). */
function lasting(move: Move): number {
  switch (move.kind) {
    case "volley":
      return move.shots * move.every;
    case "storm":
      return move.maxDelay;
    case "whirl":
      return move.duration;
    case "beams":
    case "healBeams":
      return move.count * move.every;
    case "line":
      return move.length * 5;
    default:
      return 0;
  }
}

/** A random tile within `radius` of a tile (a circle, as the original picks). */
function randomTile(centre: Point, radius: number, random: () => number): Point {
  for (let tries = 0; tries < 20; tries++) {
    const dx = Math.round((random() * 2 - 1) * radius);
    const dy = Math.round((random() * 2 - 1) * radius);
    if (dx * dx + dy * dy <= radius * radius) {
      return { x: centre.x + dx, y: centre.y + dy };
    }
  }
  return centre;
}
