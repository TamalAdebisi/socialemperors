// Saved darts rounds: original schedule, seeded shuffle, free days and prizes.
import type { Command } from "../net/commands.ts";
import type { Town } from "./town.ts";

export interface DartsRound { id: number; start_date: string; items: number[]; extra_item: number }

/** The original schedule uses the date in the player's local calendar. */
export function roundStart(date: string): number {
  const [year, month, day] = date.slice(0,10).split("-").map(Number);
  return new Date(year, month-1, day).getTime()/1000;
}

export function dartsRound(rounds: DartsRound[], now: number): { current: DartsRound | null; next: DartsRound | null } {
  let current: DartsRound | null = null, next: DartsRound | null = null;
  for (const round of rounds) {
    if (roundStart(round.start_date) > now) { next = round; break; }
    current = round;
  }
  return { current: current?.items.length === 6 ? current : null, next };
}

/** Park–Miller and removal shuffle, matching the classic saved seed. */
export function balloonPrizes(seed: number): number[] {
  const pool = [0, 1, 2,3,2,3,2,3,2,3, ...Array<number>(7).fill(4), ...Array<number>(8).fill(5)];
  const result: number[] = [];
  seed = seed >>> 0;
  while (pool.length) {
    seed = (seed * 16807) % 2147483647;
    result.push(pool.splice(Math.floor(seed / 2147483647 * pool.length), 1)[0]);
  }
  return result;
}

export class DartsGame {
  private readonly rounds: DartsRound[];
  private readonly saved: Record<string, unknown>;
  readonly cashCost: number;

  constructor(rounds: DartsRound[], saved: Record<string, unknown>, cost: number) {
    this.rounds = rounds; this.saved = saved; this.cashCost = cost;
  }

  schedule(now: number): ReturnType<typeof dartsRound> { return dartsRound(this.rounds, now); }
  get shot(): number[] { return Array.isArray(this.saved.dartsBalloonsShot) ? this.saved.dartsBalloonsShot.map(Number) : []; }
  get free(): boolean { return Boolean(this.saved.dartsHasFree); }
  get extra(): boolean { return Boolean(this.saved.dartsGotExtra); }
  get prizes(): number[] { return balloonPrizes(Number(this.saved.dartsRandomSeed) || 0); }
  get discovered(): Set<number> { return new Set(this.shot.map((index) => this.prizes[index])); }

  opening(now: number, seed: number): Command[] {
    const { current } = this.schedule(now);
    if (!current) return [];
    if ((Number(this.saved.timeStampDartsReset) || 0) < roundStart(current.start_date)) {
      Object.assign(this.saved, { dartsRandomSeed: seed >>> 0, dartsBalloonsShot: [],
        timeStampDartsReset: now, timeStampDartsNewFree: now, dartsHasFree: true, dartsGotExtra: false });
      return [{ cmd: "darts_reset", args: [seed >>> 0] }];
    }
    const day = (value: number) => new Date(value*1000).toDateString();
    if (this.shot.length < 25 && day(Number(this.saved.timeStampDartsNewFree) || 0) !== day(now)) {
      this.saved.timeStampDartsNewFree = now; this.saved.dartsHasFree = true;
      return [{ cmd: "darts_new_free", args: [] }];
    }
    return [];
  }

  shoot(town: Town, index: number, now: number): { commands: Command[]; won: number; bonus: number | null } | null {
    const { current } = this.schedule(now);
    if (!current || (Number(this.saved.timeStampDartsReset) || 0) < roundStart(current.start_date) || !Number.isInteger(index) || index < 0 || index >= 25 || this.shot.includes(index)) return null;
    const paid = !this.free;
    if (paid && town.cash < this.cashCost) return null;
    if (paid) town.cash -= this.cashCost;
    this.saved.dartsBalloonsShot = [...this.shot, index];
    const won = current.items[this.prizes[index]];
    const bonus = !this.extra && this.discovered.size === 6 ? current.extra_item : null;
    const rewards = bonus === null ? [won] : [won,bonus];
    rewards.forEach((id) => town.store.set(id, (town.store.get(id) ?? 0) + 1));
    this.saved.dartsHasFree = false;
    if (bonus !== null) this.saved.dartsGotExtra = true;
    return { won, bonus, commands: [
      ...rewards.map((id) => ({ cmd: "store_add_items", args: [JSON.stringify([id])] })),
      { cmd: "darts_shoot_balloon", args: [index, paid ? 1 : 0, bonus === null ? 0 : 1] },
    ] };
  }
}
