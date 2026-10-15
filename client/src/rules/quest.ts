// Quest islands, as the Flash client plays them (our notes, our words;
// CLIENT.md, "Quests"): which army sails, how the island is laid out, what
// each kill pays, what wins and what loses, which fallen units come home,
// and the report the server gets at the end. The fighting itself is
// rules/battle.ts. No drawing here.

import { Battle, ENEMY, NEUTRAL, SELF, SUBCAT, type Fighter } from "./battle.ts";
import { BossIsland, bossPlayedHere, type BossSetup } from "./bosses.ts";
import type { ItemInfo } from "./config.ts";
import { BLOCK_TILES, BLOCKS, MAP_TILES, type Point } from "./geometry.ts";
import type { SaveItem, Town } from "./town.ts";
import type { WalkGrid } from "./walking.ts";

/** One island, as rules/islands.json describes it. */
export interface Island {
  quest: number;
  /** The island's item in the config: its name. */
  item: number;
  kind: "trolls" | "civilization" | "heroes" | "boss" | "hardcore" | "god";
  /** What wins: the chest (lit when every enemy unit is dead), the town hall, every enemy unit, or the boss. */
  win: "chest" | "townhall" | "units" | "boss";
  /** The ground's item and, for each of the 25 blocks of 20 x 20 tiles, which of its pictures; `water` is the sea. */
  terrain: number;
  shape: number[];
  water: number;
  /** Where the army lands. */
  landing: [number, number];
  /** Units on the island that fight for the player: [item id, how many]. */
  free: [number, number][];
  /** Gold for winning at 1, 2 and 3 stars; the experience is a tenth. */
  bonus: [number, number, number];
  /** What each kill's gold is multiplied by. */
  goldMultiplier: number;
  /** Percent of the fallen units that come home. */
  recovered: number;
  goldCap: number;
  xpCap: number;
  /** Stars: copies of the enemy units, or a stronger boss. */
  difficulty: "copies" | "boss";
  skipAnimalsWhenCopying: boolean;
  /** Seconds between the end and the results. */
  endDelay: number;
  /** A team of 20 is picked instead of the whole army sailing; god islands need some gods or colossi in it. */
  team?: boolean;
  teamRule?: { groups: string[]; atLeast: number };
  minLevel?: number;
  alwaysOpen?: boolean;
  itemRewards?: Record<string, number[]>;
  /** Sides: subcategories that are nobody's here; or every building but these is nobody's; item ids that fight for the player. */
  neutral: number[];
  neutralBuildingsExcept?: number[];
  friendlyItems?: number[];
  /** The Hero Isle: its parts as [x1, y1, x2, y2] (inclusive), each with a door that opens once its units are dead. */
  doorZones?: [number, number, number, number][];
  /** A boss island: its guards, keys, gate and boss (rules/bosses.ts). */
  boss?: BossSetup;
  notes?: string;
}

/** Refuges are nobody's on any island. */
const REFUGE = 1311;
/** The Hero Isle's doors. */
const WALL_DOOR = 37;

/** A row of the report's units: [unit id, sent, killed, recovered]. */
export type UnitRow = [number, number, number, number];
const ID = 0, KILLED = 2, RECOVERED = 3;

/** Seconds an island waits before it can be attacked again. */
export const QUEST_PERIOD = 4 * 3600;
/** The level the quests open at. */
export const MIN_LEVEL_QUESTS = 6;

/** Units that stay home: villagers, farm animals, settlers, carts (and anything summoned). */
const STAY_HOME = new Set<number>([SUBCAT.peasant, SUBCAT.cow, SUBCAT.sheep, SUBCAT.horse, SUBCAT.settler, SUBCAT.boar, SUBCAT.cart]);
const ANIMALS = new Set<number>([SUBCAT.boar, SUBCAT.cow, SUBCAT.sheep, SUBCAT.horse]);

/**
 * The army that sails: every unit of the player's standing in town, but
 * villagers, farm animals, settlers and carts. [unit id, how many], in the
 * order first met in the town, as the Flash client counts them.
 */
export function armyOf(town: Town): [number, number][] {
  const counts = new Map<number, number>();
  for (const placed of town.items) {
    const item = placed.item;
    if (!item.isUnit || STAY_HOME.has(item.subcategory) || !(item.race === town.race || item.race === "a")) {
      continue;
    }
    counts.set(item.id, (counts.get(item.id) ?? 0) + 1);
  }
  return [...counts];
}

/** Which island blocks are land: every tile of a sea block is out of reach. */
export function islandGround(island: Island): WalkGrid {
  const grid = new Uint8Array(MAP_TILES * MAP_TILES);
  for (let y = 0; y < MAP_TILES; y++) {
    for (let x = 0; x < MAP_TILES; x++) {
      const block = Math.floor(y / BLOCK_TILES) * BLOCKS + Math.floor(x / BLOCK_TILES);
      grid[y * MAP_TILES + x] = island.shape[block] === island.water ? 0 : 1;
    }
  }
  return grid;
}

/** How a quest stands. */
export type QuestState = "fighting" | "won" | "lost";

export interface QuestParts {
  island: Island;
  battle: Battle;
  items: Map<number, ItemInfo>;
  /** The island's save rows (its map.items). */
  layout: SaveItem[];
  /** The player's level: a boss's life comes from it. */
  level?: number;
  random?: () => number;
}

export class Quest {
  readonly island: Island;
  /** 1 to 3 stars: chosen when the battle starts. */
  difficulty = 1;
  readonly battle: Battle;
  gold = 0;
  xp = 0;
  /** The report's units: one row per kind sent, and any lent unit that fell. */
  units: UnitRow[] = [];
  /** Enemies still to beat for the counter: units, or town halls. */
  remaining = 0;
  /** The player's units still standing (lent ones included). */
  playerUnits = 0;
  state: QuestState = "fighting";
  /** Left by the player (counts as lost). */
  voluntary = false;
  /** The frame the results are due, once the quest is decided. */
  endsAt: number | null = null;
  /** The chest: lit (collectable) once every enemy unit is dead. */
  chest: Fighter | null = null;
  /** The Hero Isle: enemies left in each part, each part's door, and the part each enemy was in. */
  zoneLeft: number[] = [];
  doors: (Fighter | null)[] = [];
  private readonly zoneOf = new Map<Fighter, number>();
  private readonly countedOut = new WeakSet<Fighter>();
  /** Units on the player's side that aren't the player's to lose: a boss island's penguins. */
  private readonly notOwned = new WeakSet<Fighter>();
  /** A boss island's own rules. */
  readonly boss: BossIsland | null = null;
  private readonly random: () => number;
  private recoveredDone = false;

  private readonly items: Map<number, ItemInfo>;

  /** The island as its file lays it out: its things on their sides. The battle begins with begin(). */
  constructor(parts: QuestParts) {
    this.island = parts.island;
    this.battle = parts.battle;
    this.items = parts.items;
    this.random = parts.random ?? Math.random;
    this.setUp(parts.items, parts.layout);
    if (this.island.boss && bossPlayedHere(this.island.quest)) {
      this.boss = new BossIsland(this.battle, this.island.boss, parts.items, parts.level ?? 1);
      this.boss.onWin = (capped) => this.win(this.island.endDelay, capped);
      this.remaining = this.boss.keysLeft;
    }
    this.battle.onConvert = (unit) => this.converted(unit);
  }

  /**
   * A monk turned a unit: as in the original, it has fallen on its old
   * side (an enemy pays and counts; one of the player's is lost), and now
   * fights on the other.
   */
  converted(unit: Fighter): { gold: number; xp: number } {
    if (this.state !== "fighting") {
      return { gold: 0, xp: 0 };
    }
    const enemy = unit.side === ENEMY;
    const paid = this.killed(unit);
    if (enemy && this.state === "fighting") {
      this.playerUnits++;
    }
    return paid;
  }

  /**
   * Start battle, as the Flash client does it once the island is shown:
   * the stars chosen (2 and 3 add copies of the enemy units), then the
   * army lands.
   */
  begin(difficulty: number, army: [number, number][]): void {
    this.difficulty = Math.min(3, Math.max(1, difficulty));
    this.units = [...army.map(([id, count]): UnitRow => [id, count, 0, 0]), ...this.units];
    if (this.difficulty > 1 && this.island.difficulty === "copies") {
      this.copyEnemies(this.items);
    }
    this.boss?.begin(this.difficulty);
    this.land(this.items, army);
  }

  /** The island's things as enemies (scenery as nobody's), the lent units the player's. */
  private setUp(items: Map<number, ItemInfo>, layout: SaveItem[]): void {
    const free = this.island.free.map(([id, count]) => [id, count]);
    for (const row of layout) {
      const item = items.get(Number(row[0]));
      if (!item) {
        continue;
      }
      const [x, y, orientation] = [Number(row[1]), Number(row[2]), Number(row[3]) || 0];
      const sub = item.subcategory;
      const side = this.sideOf(item);
      const lent = free.find(([id, count]) => id === item.id && count > 0);
      if (lent) {
        lent[1]--;
      }
      const fighter = this.battle.add(item, x, y, lent ? SELF : side, { tag: { orientation } });
      if (!item.isUnit) {
        fighter.facing = orientation;  // a building's way of facing: its picture
      }
      if (lent) {
        fighter.free = true;
        this.playerUnits++;
      }
      if (sub === SUBCAT.treasure && !this.chest) {
        this.chest = fighter;
      }
    }
    this.countRemaining();
    this.setUpZones();
  }

  /**
   * The Hero Isle's parts: each enemy unit, and each door, belongs to the
   * first part holding its tile. Done before the copies, which belong to none.
   */
  private setUpZones(): void {
    const zones = this.island.doorZones;
    if (!zones) {
      return;
    }
    const zoneAt = (x: number, y: number) => zones.findIndex(([x1, y1, x2, y2]) => x >= x1 && x <= x2 && y >= y1 && y <= y2);
    this.zoneLeft = zones.map(() => 0);
    this.doors = zones.map(() => null);
    for (const f of this.battle.fighters) {
      const zone = zoneAt(f.tx, f.ty);
      if (zone < 0) {
        continue;
      }
      if (f.isUnit && f.side === ENEMY) {
        this.zoneOf.set(f, zone);
        this.zoneLeft[zone]++;
      } else if (f.item.id === WALL_DOOR && !this.doors[zone]) {
        this.doors[zone] = f;
      }
    }
  }

  /**
   * An enemy died on the Hero Isle: one fewer in its part, and the part's
   * door opens when none are left. As in the original, an enemy in no part
   * (a copy, or one of the few standing outside them) counts against the
   * first part, so its door can open early (DECISIONS.md, "Hero Isle").
   */
  private zoneKill(fighter: Fighter): void {
    if (!this.island.doorZones) {
      return;
    }
    const zone = this.zoneOf.get(fighter) ?? 0;
    this.zoneLeft[zone]--;
    const door = this.doors[zone];
    if (this.zoneLeft[zone] === 0 && door) {
      this.battle.openDoor(door);
    }
  }

  /** Whose a thing on the island is, by the island's rules (rules/islands.json, "sides"). */
  private sideOf(item: ItemInfo): typeof SELF | typeof ENEMY | typeof NEUTRAL {
    const sub = item.subcategory;
    if (this.island.friendlyItems?.includes(item.id)) {
      return SELF;
    }
    if (item.race === "n" || sub === REFUGE || this.island.neutral.includes(sub)) {
      return NEUTRAL;
    }
    if (!item.isUnit && this.island.neutralBuildingsExcept && !this.island.neutralBuildingsExcept.includes(sub)) {
      return NEUTRAL;
    }
    return ENEMY;
  }

  private countRemaining(): void {
    this.remaining = this.battle.fighters.filter((f) => !f.dead && this.counts(f)).length;
  }

  /** What the counter counts: town halls on civilization islands, enemy units elsewhere. */
  private counts(f: Fighter): boolean {
    if (f.side !== ENEMY) {
      return false;
    }
    return this.island.win === "townhall" ? f.item.subcategory === SUBCAT.townHall : f.isUnit;
  }

  /** At 2 stars a copy of every enemy unit beside it; at 3, two. */
  private copyEnemies(items: Map<number, ItemInfo>): void {
    const originals = this.battle.fighters.filter((f) => f.isUnit && f.side === ENEMY
      && !(this.island.skipAnimalsWhenCopying && ANIMALS.has(f.item.subcategory)));
    for (const original of originals) {
      for (let copy = 1; copy < this.difficulty; copy++) {
        const tile = this.battle.freeTileNear({ x: original.tx, y: original.ty }, false);
        if (tile) {
          this.battle.add(items.get(original.item.id) ?? original.item, tile.x, tile.y, ENEMY);
        }
      }
    }
    this.countRemaining();
  }

  /** Every unit of the army on the free tile nearest the landing, one after another. */
  private land(items: Map<number, ItemInfo>, army: [number, number][]): void {
    const landing: Point = { x: this.island.landing[0], y: this.island.landing[1] };
    for (const [id, count] of army) {
      const item = items.get(id);
      if (!item) {
        continue;
      }
      for (let i = 0; i < count; i++) {
        const tile = this.battle.freeTileNear(landing, false);
        if (!tile) {
          break;
        }
        this.battle.add(item, tile.x, tile.y, SELF);
        this.playerUnits++;
      }
    }
  }

  /** A fighter fell: count it, and pay for it. Returns what it paid, to show. */
  killed(fighter: Fighter): { gold: number; xp: number } {
    if (this.state !== "fighting") {
      return { gold: 0, xp: 0 };
    }
    let paid = { gold: 0, xp: 0 };
    if (fighter.side === SELF && !fighter.summoned) {
      // Only fighters count (summoned ones never: they're no loss, and don't keep the battle going) (a unit with no attack falling isn't counted, as in the Flash client).
      if (fighter.attack > 0 && fighter.isUnit) {
        // An enemy a monk turned isn't the player's to lose (DECISIONS.md, "Hero Isle").
        if (!fighter.converted && !this.notOwned.has(fighter)) {
          this.addTo(fighter.item.id, KILLED);
        }
        this.playerUnits--;
      }
    } else if (fighter.side === ENEMY && !fighter.summoned && this.boss) {
      // A boss island: only the guards pay; their keys light up; the bosses' fall wins.
      if (this.boss.pays(fighter)) {
        paid = this.pay(fighter);
      }
      this.boss.fell(fighter);
    } else if (fighter.side === ENEMY && !fighter.summoned) {
      paid = this.pay(fighter);
      this.zoneKill(fighter);
      // Each enemy counts once: one a monk turned (and maybe back) was counted when first turned.
      if (this.counts(fighter) && !fighter.converted && !this.countedOut.has(fighter)) {
        this.countedOut.add(fighter);
        this.remaining--;
      }
      if (this.remaining <= 0) {
        this.allBeaten();
      }
    }
    if (this.playerUnits <= 0 && this.state === "fighting") {
      this.finish("lost", 3);
    }
    return paid;
  }

  /** Gold and experience for an enemy: half the price of a fighter bought with gold, a quarter with stone, else 5. */
  private pay(fighter: Fighter): { gold: number; xp: number } {
    const item = fighter.item;
    let gold = 0;
    if (item.attack > 0 && item.costType === "g") {
      gold = Math.floor(item.cost / 2);
    } else if (item.attack > 0 && item.costType === "s") {
      gold = Math.floor(item.cost / 4);
    }
    if (gold === 0) {
      gold = 5;
    }
    gold = Math.floor(gold * this.island.goldMultiplier);
    let xp = Math.ceil(gold * 0.05);
    if (xp === 0 && item.subcategory !== SUBCAT.wall) {
      xp = 1;
    }
    this.gold += gold;
    this.xp += xp;
    // Past the island's caps, nothing more.
    if (this.gold > this.island.goldCap) {
      this.gold = this.island.goldCap;
      gold = 0;
    }
    if (this.xp > this.island.xpCap) {
      this.xp = this.island.xpCap;
      xp = 0;
    }
    return { gold, xp };
  }

  /** Every enemy the island counts is beaten: the chest lights up, or the island is won. */
  private allBeaten(): void {
    if (this.island.win === "chest") {
      if (this.chest) {
        this.chest.collectable = true;
      } else {
        this.win(3, true);
      }
    } else if (this.island.win === "units" || this.island.win === "townhall") {
      // Paid inside the kill, so the caps cut it, as in the Flash client.
      this.win(this.island.endDelay, true);
    }
  }

  /** Whether a tap on this collects it: the lit chest, or a boss island's lit key. */
  canCollect(fighter: Fighter | null): boolean {
    return fighter !== null && Boolean(fighter.collectable) && this.state === "fighting"
      && (fighter === this.chest || Boolean(this.boss?.keys.includes(fighter)));
  }

  /** The player taps the lit chest: the island is won. Or a lit key: one fewer to go. */
  collect(fighter: Fighter): boolean {
    if (this.boss && this.state === "fighting") {
      const joined = this.boss.collect(fighter);
      if (joined) {
        for (const unit of joined) {
          this.notOwned.add(unit);
          this.playerUnits++;
        }
        this.remaining = this.boss.keysLeft;
        return true;
      }
    }
    if (fighter !== this.chest || !fighter.collectable || this.state !== "fighting") {
      return false;
    }
    fighter.collectable = false;
    this.battle.kill(fighter, null);
    // Paid outside a kill: the caps don't cut it.
    this.win(this.island.endDelay, false);
    return true;
  }

  private win(delaySeconds: number, capped: boolean): void {
    const bonus = this.island.bonus[this.difficulty - 1] ?? 0;
    this.gold += bonus;
    this.xp += Math.floor(bonus / 10);
    if (capped) {
      this.gold = Math.min(this.gold, this.island.goldCap);
      this.xp = Math.min(this.xp, this.island.xpCap);
    }
    this.finish("won", delaySeconds);
  }

  private finish(state: QuestState, delaySeconds: number): void {
    this.state = state;
    this.endsAt = this.battle.frame + delaySeconds * 30;
  }

  /** The player goes home before the end: a loss, at once. */
  leave(): void {
    if (this.state === "fighting") {
      this.voluntary = true;
      this.state = "lost";
      this.endsAt = this.battle.frame;
    }
  }

  /** Every frame, after the battle's: the bosses with a mind of their own choose. */
  step(): void {
    this.boss?.minds.step();
  }

  /** Whether the results are due. */
  isOver(): boolean {
    return this.endsAt !== null && this.battle.frame >= this.endsAt;
  }

  /**
   * Which fallen units come home: the island's percent of them, rounded up;
   * the others are picked at random. Lent units always do. Then the
   * experience is cut to half the gold. Done once, at the end.
   */
  settle(): void {
    if (this.recoveredDone) {
      return;
    }
    this.recoveredDone = true;
    if (this.xp > this.gold / 2) {
      this.xp = Math.floor(this.gold / 2);
    }
    let fallen = 0;
    for (const row of this.units) {
      row[RECOVERED] = row[KILLED];
      fallen += row[KILLED];
    }
    const lost = fallen - Math.ceil(fallen * (this.island.recovered / 100));
    for (let taken = 0, tries = 0; taken < lost && tries < 500; tries++) {
      const row = this.units[Math.floor(this.random() * this.units.length)];
      if (row[RECOVERED] > 0) {
        row[RECOVERED]--;
        taken++;
      }
    }
    for (const [id, count] of this.island.free) {
      this.addTo(id, RECOVERED, count);
    }
  }

  /** The units lost for good: [unit id, how many]. */
  lost(): [number, number][] {
    return this.units.filter((row) => row[KILLED] > row[RECOVERED]).map((row) => [row[ID], row[KILLED] - row[RECOVERED]]);
  }

  /** What `end_quest` sends, as the Flash client builds it. */
  report(town: number, seconds: number, itemRewards: Record<string, number> = {}): Record<string, unknown> {
    const report: Record<string, unknown> = {
      map: town,
      resources: { g: Math.round(this.gold), x: Math.round(this.xp) },
      units: this.units,
      win: this.state === "won" ? 1 : 0,
      duration: Math.round(seconds),
      voluntary_end: this.voluntary ? 1 : 0,
      quest_id: this.island.quest,
      difficulty: this.difficulty,
    };
    if (this.island.kind === "boss") {
      report.item_rewards = this.state === "won" ? itemRewards : {};
    }
    return report;
  }

  private addTo(id: number, field: number, amount = 1): void {
    let row = this.units.find((r) => r[ID] === id);
    if (!row) {
      row = [id, 0, 0, 0];
      this.units.push(row);
    }
    row[field] += amount;
  }
}

/**
 * Islands whose own rules aren't in this client yet (the Rockdriller's and
 * the dragons' islands): played in the classic game for now.
 */
export function playedHere(island: Island): boolean {
  return island.kind !== "boss" || bossPlayedHere(island.quest);
}

/** Whether an island can be sailed to, and why not. */
export function islandLock(island: Island, index: number, unlockedIndex: number, level: number,
  lastAttacked: number | undefined, now: number): { open: boolean; why?: string; until?: number } {
  if (!island.alwaysOpen && index > unlockedIndex) {
    return { open: false, why: "Win the island before it to sail here" };
  }
  if (island.minLevel && level < island.minLevel) {
    return { open: false, why: `From level ${island.minLevel}` };
  }
  if (lastAttacked !== undefined && now - lastAttacked < QUEST_PERIOD) {
    return { open: false, why: "The army is resting", until: lastAttacked + QUEST_PERIOD };
  }
  return { open: true };
}

/** The difficulties the player may pick: 1 always, 2 after winning 1 star, 3 after 2. The default is the best won, at least 1. */
export function difficulties(starsWon: number): { allowed: number[]; chosen: number } {
  const allowed = [1, 2, 3].filter((d) => d === 1 || starsWon >= d - 1);
  return { allowed, chosen: Math.max(1, Math.min(3, starsWon)) };
}

/** How many units a team takes. */
export const TEAM_SLOTS = 20;

/** The units that may join a team: each kind the player has, up to its units_limit when it has one. */
export function teamChoices(army: [number, number][], items: Map<number, ItemInfo>): [number, number][] {
  return army.map(([id, count]) => {
    const limit = items.get(id)?.unitsLimit ?? 0;
    return [id, limit > 0 ? Math.min(count, limit) : count];
  });
}

/**
 * The team the player picked last time (privateState.teams.quest: 20 ids,
 * 0 for an empty place), kept to what they still have.
 */
export function lastTeam(saved: unknown, choices: [number, number][]): number[] {
  const left = new Map(choices);
  const team: number[] = [];
  for (const id of Array.isArray(saved) ? saved.map(Number) : []) {
    if (id > 0 && (left.get(id) ?? 0) > 0 && team.length < TEAM_SLOTS) {
      team.push(id);
      left.set(id, left.get(id)! - 1);
    }
  }
  return team;
}

/** Why a team can't sail, or null when it can: none picked, or not enough gods or colossi for a god island. */
export function teamProblem(team: number[], island: Island, items: Map<number, ItemInfo>): string | null {
  if (team.length === 0) {
    return "Pick the units who sail.";
  }
  const rule = island.teamRule;
  if (rule) {
    const have = team.filter((id) => rule.groups.includes(items.get(id)?.groups ?? "")).length;
    if (have < rule.atLeast) {
      return `This island needs at least ${rule.atLeast} god${rule.atLeast === 1 ? "" : "s"} or colossus${rule.atLeast === 1 ? "" : "es"} in the team.`;
    }
  }
  return null;
}

/** A team as the server keeps it (set_attack_team): 20 ids, 0 for an empty place. */
export function teamSlots(team: number[]): number[] {
  return Array.from({ length: TEAM_SLOTS }, (_, i) => team[i] ?? 0);
}

/** A team as an army: [unit id, how many], in the order picked. */
export function teamArmy(team: number[]): [number, number][] {
  const counts = new Map<number, number>();
  for (const id of team) {
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return [...counts];
}
