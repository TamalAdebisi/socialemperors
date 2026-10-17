// The tournament match's original army placement, opponent and score.
// These armies are copies: no town losses or rewards are calculated here.
import { FPS, SELF, type Battle, type Fighter, type Side } from "./battle.ts";
import type { Point } from "./geometry.ts";
import type { TournamentMatch, TournamentPlayer, TournamentRoom } from "./tournaments.ts";

const HEALERS = new Set([502, 590, 866, 886]);
const ENGINEER = 570;
const WAIT_FRAMES = 10 * FPS;
const POSITION_FRAMES = 10 * FPS;
export const TOURNAMENT_END_DELAY = 3 * FPS;

/** The original book shows these spells, but disables them in a tournament. */
export function tournamentSpellAllowed(id: number): boolean {
  return id !== 7 && id !== 16;
}

/** Only an unfinished match belonging to this entrant can be started.
 * Re-read the room before Start: legacy start replies also say OK for stale requests. */
export function tournamentBout(room: TournamentRoom | null, userId: string, victimId: string):
  { player: TournamentPlayer; enemy: TournamentPlayer; match: TournamentMatch } | null {
  if (!room || room.date_ready === null || room.date_finished !== null || userId === victimId) return null;
  const player = room.players.find((seat) => seat.user_id === userId);
  const enemy = room.players.find((seat) => seat.user_id === victimId);
  const match = player?.matches.find((match) => match.attacker_id === userId && match.victim_id === victimId && !match.finished);
  return player && !Number(player.abandonned) && enemy && match ? { player, enemy, match } : null;
}

/** Two columns, each with ten places; zero slots do not leave gaps on the field. */
export function tournamentPositions(team: number[], side: Side): { id: number; tile: Point }[] {
  return team.filter((id) => id > 0).slice(0, 20).map((id, index) => ({ id, tile: {
    x: side === SELF ? 10 + 4 * Math.floor(index / 10) : 90 - 4 * Math.floor(index / 10),
    y: 59 - 2 * (index % 10),
  } }));
}

export interface TournamentScore {
  won: boolean;
  pointType: number;
  playerSlots: number;
  enemySlots: number;
  playerLeft: number;
  enemyLeft: number;
  playerLife: number;
  enemyLife: number;
  playerDamage: number;
  enemyDamage: number;
}

/** Damage is accumulated, including overkill and damage later healed. It is
 * deliberately not the remaining health shown by the bars. Old point_type0
 * uses the full saved array lengths, including their empty places. */
export function tournamentScore(s: TournamentScore): number {
  let points: number;
  if (s.pointType === 0) {
    points = Math.round((s.won ? 50 : 0) + 25 * s.playerLeft / Math.max(1, s.playerSlots)
      + 25 * (s.enemySlots - s.enemyLeft) / Math.max(1, s.enemySlots));
  } else if (s.playerDamage === 0) {
    points = 100;
  } else if (s.enemyDamage === 0) {
    points = 0;
  } else {
    const inflicted = Math.min(20, 20 * s.enemyDamage / Math.max(1, s.enemyLife));
    const preserved = s.won ? Math.min(80, 80 * (s.playerLife - s.playerDamage) / Math.max(1, s.playerLife)) : 0;
    points = inflicted + preserved;
  }
  return Math.max(0, Math.min(100, points));
}

export interface TournamentBattleOptions {
  weekly: boolean;
  pointType: number;
  playerSlots: number;
  enemySlots: number;
}
export interface TournamentBattleResult { won: boolean; points: number; surrendered: boolean }
export type TournamentBattleState = "ready" | "forming" | "waiting" | "fighting" | "finished";

export class TournamentBattle {
  readonly battle: Battle;
  readonly player: Fighter[];
  readonly enemy: Fighter[];
  readonly options: TournamentBattleOptions;
  state: TournamentBattleState = "ready";
  result: TournamentBattleResult | null = null;
  endedAt: number | null = null;
  private readonly playerSet: Set<Fighter>;
  private readonly enemySet: Set<Fighter>;
  private readonly targetOrder: Fighter[];
  private readonly originalSpeed = new Map<Fighter, number>();
  private readonly initialPlayerLife: number;
  private readonly initialEnemyLife: number;
  private playerDamage = 0;
  private enemyDamage = 0;
  private waitingSince = 0;
  private lastPosition = 0;
  private startedAt = 0;
  private marching = false;

  constructor(battle: Battle, player: Fighter[], enemy: Fighter[], options: TournamentBattleOptions) {
    this.battle = battle;
    this.player = [...player];
    this.enemy = [...enemy];
    this.options = options;
    this.playerSet = new Set(player);
    this.enemySet = new Set(enemy);
    this.targetOrder = [...player].sort((a, b) => a.life - b.life);
    this.initialPlayerLife = player.reduce((sum, unit) => sum + unit.life, 0);
    this.initialEnemyLife = enemy.reduce((sum, unit) => sum + unit.life, 0);
    for (const unit of enemy) {
      this.originalSpeed.set(unit, unit.velocity);
      // The original collective mind still lets each unit defend itself.
      unit.condition = "defensive";
    }
    battle.onHurt.push((unit, damage, by) => {
      if (this.state === "ready" || this.result) return;
      if (this.playerSet.has(unit)) this.playerDamage += damage;
      if (this.enemySet.has(unit)) {
        this.enemyDamage += damage;
        if (by) {
          this.breakMarch();
          this.engage();
          this.requestHealers(unit);
        }
      }
    });
    battle.onKilled.push((unit) => {
      if (this.state === "ready" || this.result) return;
      if (this.playerSet.has(unit)) this.assignTargets(true);
      this.checkEnd();
    });
  }

  get seconds(): number { return Math.floor((this.battle.frame - this.startedAt) / FPS); }
  get playerLeft(): number { return this.living(this.player).length; }
  get enemyLeft(): number { return this.living(this.enemy).length; }
  get playerHealth(): number { return this.health(this.player, this.initialPlayerLife); }
  get enemyHealth(): number { return this.health(this.enemy, this.initialEnemyLife); }

  start(): void {
    if (this.state !== "ready") return;
    this.state = "forming";
    this.marching = true;
    this.startedAt = this.lastPosition = this.battle.frame;
    const slowest = Math.min(69, ...this.enemy.map((unit) => unit.velocity));
    for (const unit of [...this.player, ...this.enemy]) {
      const x = unit.tx + (this.playerSet.has(unit) ? 10 : -20);
      unit.home.x = x;
      this.battle.moveTo([unit], { x, y: unit.ty });
      if (this.enemySet.has(unit)) unit.velocity = slowest;
    }
    this.checkEnd();
  }

  /** Called after Battle and Specials on the same 30-frame game clock. */
  step(): void {
    if (this.state === "ready" || this.result) return;
    this.checkEnd();
    if (this.result) return;
    if (this.state === "forming" && this.living(this.enemy).every((unit) => !this.battle.isMoving(unit))) {
      this.state = "waiting";
      this.waitingSince = this.battle.frame;
    }
    if (this.state === "waiting" && this.options.weekly && this.battle.frame - this.waitingSince >= WAIT_FRAMES) this.engage();
    if (this.state === "fighting") this.assignTargets(false);
    if (this.state !== "forming" && this.battle.frame - this.lastPosition >= POSITION_FRAMES) {
      this.lastPosition = this.battle.frame;
      for (const unit of this.living([...this.player, ...this.enemy])) {
        if (unit.tx < 20 || unit.tx >= 80 || unit.ty < 20 || unit.ty >= 80) {
          const tile = this.battle.freeTileNear({ x: Math.max(20, Math.min(80, unit.tx)), y: Math.max(20, Math.min(80, unit.ty)) }, true);
          if (tile) this.battle.moveTo([unit], tile);
        }
      }
    }
  }

  surrender(): void {
    if (this.state !== "ready" && !this.result) this.finish(false, true);
  }

  private living(army: Fighter[]): Fighter[] {
    return army.filter((unit) => !unit.dead && this.battle.fighters.includes(unit));
  }

  private health(army: Fighter[], initial: number): number {
    return Math.max(0, Math.min(1, this.living(army).reduce((sum, unit) => sum + unit.life, 0) / Math.max(1, initial)));
  }

  private engage(): void {
    if (this.result || this.state === "ready") return;
    if (this.state !== "fighting") {
      this.state = "fighting";
      for (const unit of this.enemy) {
        unit.condition = HEALERS.has(unit.item.id) ? "survive" : "aggressive";
        unit.forced = false;
      }
      const patient = this.living(this.enemy).find((unit) => !HEALERS.has(unit.item.id));
      if (patient) this.requestHealers(patient);
      this.assignTargets(true);
    }
  }

  private breakMarch(): void {
    if (!this.marching) return;
    this.marching = false;
    for (const unit of this.enemy) unit.velocity = this.originalSpeed.get(unit)!;
  }

  private requestHealers(patient: Fighter): void {
    if (patient.dead) return;
    for (const unit of this.living(this.enemy)) {
      if (!HEALERS.has(unit.item.id)) continue;
      if (!unit.target || unit.target.dead || patient.life < unit.target.life) {
        unit.target = patient;
        unit.attacking = true;
        unit.forced = false;
      }
    }
  }

  private assignTargets(refresh: boolean): void {
    const foes = this.living(this.targetOrder);
    for (const unit of this.living(this.enemy)) {
      // The original collective healer list excludes engineers. Their own
      // mind repairs friendly siege; repeated enemy orders would override it
      // between the ordinary mind's less frequent updates.
      if (unit.item.id === ENGINEER) continue;
      if (HEALERS.has(unit.item.id)) {
        if (!unit.target || unit.target.dead) {
          const patient = this.living(this.enemy).find((other) => !HEALERS.has(other.item.id));
          if (patient) this.requestHealers(patient);
        }
        continue;
      }
      if (unit.target?.dead) unit.target = null;
      if (unit.forced && !unit.attacking) continue;
      if (!refresh && unit.target) continue;
      // This collective mind uses floored straight-line tile distance,
      // unlike the normal hit reach's square tile distance.
      const near = foes.find((foe) => Math.floor(Math.hypot(unit.tx - foe.tx, unit.ty - foe.ty)) <= unit.range + 2);
      const target = near ?? unit.target ?? foes[0];
      if (target) this.battle.attackWith([unit], target);
    }
  }

  private checkEnd(): void {
    if (this.result) return;
    // The original recount checks the defending army first if both disappear.
    if (this.enemyLeft === 0) this.finish(true, false);
    else if (this.playerLeft === 0) this.finish(false, false);
  }

  private finish(won: boolean, surrendered: boolean): void {
    this.result = { won, surrendered, points: surrendered ? 0 : tournamentScore({
      won, pointType: this.options.pointType, playerSlots: this.options.playerSlots, enemySlots: this.options.enemySlots,
      playerLeft: this.playerLeft, enemyLeft: this.enemyLeft, playerLife: this.initialPlayerLife, enemyLife: this.initialEnemyLife,
      playerDamage: this.playerDamage, enemyDamage: this.enemyDamage,
    }) };
    this.state = "finished";
    this.endedAt = this.battle.frame;
  }
}
