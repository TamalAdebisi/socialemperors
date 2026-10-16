// The four defence plans of a town attacked by another player (CLIENT.md,
// "Attacking players"), as the Flash client's collective minds play them:
// chosen at home in the army window and kept in the save
// (privateState.strategy). Defensive units fight what comes within 10
// tiles and walk home past 20; aggressive ones chase. No drawing here.

import { SUBCAT, type Battle, type Fighter, type Side } from "./battle.ts";

/** The plans by the save's number: all stay, archers against siege engines, half go out, all go for the siege engines. */
export const ALL_STAY = 8;
export const RANGED_VERSUS_SIEGE = 9;
export const HALF_OUT = 7;
export const FOCUS_SIEGE = 10;
/** The most units sent at once (plans 9 and 10). */
const MOST_SENT = 25;
/** Where a fallen siege engine was, the next one is looked for this near. */
const NEXT_SIEGE_NEAR = 10;
/** How often the plans think, in frames. */
const THINK_EVERY = 15;

/** A plan number the client doesn't know (or none saved) plays as "half go out", the client's own default. */
export function planOf(saved: unknown): number {
  const plan = Number(saved);
  return [ALL_STAY, RANGED_VERSUS_SIEGE, HALF_OUT, FOCUS_SIEGE].includes(plan) ? plan : HALF_OUT;
}

export class DefencePlan {
  private readonly battle: Battle;
  private readonly side: Side;
  readonly plan: number;
  /** The attacker's army size (plan 7 sends as many). */
  private readonly attackers: number;
  /** Plans 9 and 10: the siege engine being dealt with, and who's on it. */
  private focus: Fighter | null = null;
  private focusGroup: Fighter[] = [];
  /** Plan 7: the first attacker to hit, and the group sent at it (once a battle). */
  private first: Fighter | null = null;
  private firstGroup: Fighter[] = [];
  private firstDone = false;
  /** Plan 10: defenders hunting siege engines. */
  private readonly hunting = new Set<Fighter>();

  constructor(battle: Battle, side: Side, plan: number, attackers: number) {
    this.battle = battle;
    this.side = side;
    this.plan = plan;
    this.attackers = attackers;
    for (const unit of this.defenders()) {
      unit.condition = plan === HALF_OUT ? "aggressive" : "defensive";
    }
    battle.onHurt.push((target, _damage, by) => this.hurt(target, by));
  }

  /** The defender's soldiers: its units with an attack, alive, not villagers. */
  private defenders(): Fighter[] {
    return this.battle.fighters.filter((f) => f.isUnit && !f.dead && f.side === this.side && f.attack > 0
      && f.item.subcategory !== SUBCAT.peasant);
  }

  private isSiege(f: Fighter | null): f is Fighter {
    return f !== null && !f.dead && f.isUnit && f.side !== this.side && f.item.subcategory === SUBCAT.siege;
  }

  /** The nearest of `among` to a fighter. */
  private nearest(among: Fighter[], to: Fighter, count: number): Fighter[] {
    const d = (f: Fighter) => (f.tx - to.tx) ** 2 + (f.ty - to.ty) ** 2;
    return [...among].sort((a, b) => d(a) - d(b)).slice(0, count);
  }

  /** Something of the defender's was hit. */
  private hurt(target: Fighter, by: Fighter | null): void {
    if (!by || by.side === this.side || target.side !== this.side || target.dead) {
      return;
    }
    if (this.plan === HALF_OUT && !this.firstDone) {
      if (!this.first) {
        this.first = by;
        this.firstGroup = this.nearest(this.defenders(), by, this.attackers);
      }
      if (!this.first.dead) {
        this.battle.attackWith(this.firstGroup.filter((f) => !f.dead), this.first);
      }
    } else if ((this.plan === RANGED_VERSUS_SIEGE || this.plan === FOCUS_SIEGE) && this.isSiege(by) && !this.isSiege(this.focus)) {
      const free = this.plan === FOCUS_SIEGE ? MOST_SENT - this.hunting.size : MOST_SENT;
      const able = this.defenders().filter((f) => this.plan === FOCUS_SIEGE || f.item.subcategory === SUBCAT.archer
        || f.item.subcategory === SUBCAT.siege);
      this.focus = by;
      this.focusGroup = this.nearest(able, by, Math.max(free, 0));
      this.battle.attackWith(this.focusGroup, by);
    }
  }

  /** Each frame: the plans' minds, a few times a second. */
  step(): void {
    if (this.battle.frame % THINK_EVERY !== 0) {
      return;
    }
    if (this.plan === HALF_OUT && this.first && this.first.dead && !this.firstDone) {
      // The first attacker is down: those sent at it turn defensive and walk home.
      this.firstDone = true;
      for (const unit of this.firstGroup) {
        unit.condition = "defensive";
        unit.forced = false;
      }
    }
    if ((this.plan === RANGED_VERSUS_SIEGE || this.plan === FOCUS_SIEGE) && this.focus && this.focus.dead) {
      // The next siege engine near where it fell, or home.
      const fell = this.focus;
      const next = this.battle.within({ x: fell.tx, y: fell.ty }, NEXT_SIEGE_NEAR, 1, (f) => this.isSiege(f))[0] ?? null;
      this.focus = next;
      if (next) {
        this.battle.attackWith(this.focusGroup.filter((f) => !f.dead), next);
      } else {
        this.focusGroup = [];
      }
    }
    if (this.plan === FOCUS_SIEGE) {
      for (const unit of [...this.hunting]) {
        if (unit.dead || !unit.target || unit.target.dead) {
          this.hunting.delete(unit);
        }
      }
      const sieges = this.battle.fighters.filter((f) => this.isSiege(f));
      for (const unit of this.defenders()) {
        if (this.hunting.size >= MOST_SENT) {
          break;
        }
        if (unit.target || this.hunting.has(unit)) {
          continue;
        }
        const siege = this.nearest(sieges, unit, 1)[0];
        if (siege) {
          unit.condition = "aggressive";
          this.battle.attackWith([unit], siege);
          this.hunting.add(unit);
        } else {
          unit.condition = "defensive";
        }
      }
    }
  }
}
