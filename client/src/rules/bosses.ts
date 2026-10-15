// The boss islands' own rules (CLIENT.md, "Quests"), as the Flash client
// plays them: the island's guards in four groups, a key that lights up
// once its group is beaten, the keys collected with a tap, a gate (or an
// altar) that goes when the last is in, and the boss behind it, whose
// life comes from the player's level. The fighting is rules/battle.ts; the
// counting and paying rules/quest.ts. No drawing here.
//
// The Nest Isle and the Dangerous Isle have no keys: there an egg
// (eggs) and the dragons make the story.

import { ENEMY, NEUTRAL, SELF, SUBCAT, type Battle, type Fighter } from "./battle.ts";
import { BossMinds } from "./bossMinds.ts";
import type { ItemInfo } from "./config.ts";

/** A boss island's setup, as rules/islands.json gives it. */
export interface BossSetup {
  /** The guards join the group of the nearest of these points (the first wins a tie)... */
  groupCentres?: [number, number][];
  /** ...or of their quarter of the map: x and y up to these (or below them, `inclusive` false). */
  quarters?: { x: number; y: number; inclusive: boolean };
  /** The key's item (keys, power gems), the gate's or altar's, the boss's. */
  key: number;
  door?: number;
  boss: number;
  /** The boss's life by the player's level, from each level on: [level, life]. */
  lifeByLevel?: [number, number][];
  /** Its life and attack by the stars: times these. */
  lifeMult?: number[];
  attackMult?: number[];
  /** A second boss at 3 stars, near the first boss's tile (or the door's) plus this. */
  secondBossAt3?: boolean;
  secondBossOffset?: [number, number];
  secondBossFrom?: "boss" | "door";
  /** The boss comes only when the door goes, on its tile; or when the last key is in, near this tile. */
  appearsAtDoor?: boolean;
  bossNear?: [number, number];
  /** Its life before the stars, whatever the level (the Rockdriller's). */
  lifeBase?: number;
  /** The guards are everything of these races, buildings too, and the boss's helpers (else the enemy units). */
  groupRaces?: string[];
  /** The Nest Isle: its egg; once it's broken, rocks close the way back one by one, then the dragon comes. */
  egg?: number;
  rock?: number;
  rockX?: number;
  rockYFrom?: number;
  rockYStop?: number;
  /** The dragon's life, attack and speed by the stars. */
  life?: number[];
  attack?: number[];
  speed?: number[];
  /** The Dangerous Isle: its dragons [id, x, y], the eggs' places and life, the rocks closing a path. */
  dragons?: [number, number, number][];
  eggs?: [number, number][];
  eggLife?: number[];
  rocks?: [number, number][];
  goldenLife?: number[];
  goldenAttack?: number[];
  goldenSpeed?: number[];
  blackLife?: number;
  blackAttack?: number[];
  blackSpeed?: number[];
  /** What each egg broken takes off the black dragon (rolled, as a hit). */
  eggWound?: number;
  /** The gate is held on its first picture, and steps one on for each key but the last. */
  doorSteps?: boolean;
  /** Units that join the player for each key: which, and where (near the key plus each offset). */
  penguin?: number;
  penguinOffsets?: [number, number][];
}

/** Every boss island played here so far. */
const PLAYED = new Set([100000002, 100000003, 100000011, 100000028, 100000033]);
const GOLDEN = 739;
const BLACK = 740;
/** The Nest Isle: a rock every half second once the egg breaks, the dragon 15 frames after the last. */
const ROCK_EVERY = 15;
/** The Dangerous Isle: the dragons see 20 tiles; the path opens 45 + 60 frames after the second golden dragon. */
const DRAGON_AGGRO = 20;
const PATH_LOOK = 45;
const PATH_OPENS = 105;
const PATH_AT = { x: 30, y: 45 };
/** An egg hit calls the black dragon onto whoever hit it, at most once in 20 seconds. */
const EGG_CALL_EVERY = 600;
/** The eighth egg: the black dragon dies 45 frames later. */
const BLACK_DIES = 45;

export function bossPlayedHere(quest: number): boolean {
  return PLAYED.has(quest);
}

/** The boss's life for the player's level. */
export function bossLife(table: [number, number][], level: number): number {
  let life = table[0]?.[1] ?? 0;
  for (const [from, value] of table) {
    if (level >= from) {
      life = value;
    }
  }
  return life;
}

export class BossIsland {
  readonly setup: BossSetup;
  /** Each group's guards still standing, and its key. */
  readonly groups: Set<Fighter>[] = [new Set(), new Set(), new Set(), new Set()];
  readonly keys: (Fighter | null)[] = [null, null, null, null];
  keysLeft = 0;
  door: Fighter | null = null;
  readonly bosses: Fighter[] = [];
  /** The bosses that choose for themselves (the Rockdriller, the Crimson Scale). */
  readonly minds: BossMinds;
  /** Told when the island is won: whether the caps cut the prize. */
  onWin: (capped: boolean) => void = () => {};
  /** Told when the original moves the camera to show something. */
  onLook: (tile: { x: number; y: number }) => void = () => {};
  /** A boss still to come (after the keys, or the egg). */
  private due = false;
  private nestEgg: Fighter | null = null;
  /** The Dangerous Isle's eggs left, its black dragon, its rocks, when an egg last called the dragon. */
  readonly eggs = new Set<Fighter>();
  black: Fighter | null = null;
  private rocks: Fighter[] = [];
  private lastCall = -Infinity;
  private won = false;
  private readonly battle: Battle;
  private readonly items: Map<number, ItemInfo>;
  private readonly level: number;
  private stars = 1;

  constructor(battle: Battle, setup: BossSetup, items: Map<number, ItemInfo>, level: number) {
    this.battle = battle;
    this.setup = setup;
    this.items = items;
    this.level = level;
    this.minds = new BossMinds(battle, items);
    for (const f of battle.fighters) {
      const group = this.groupOf(f.tx, f.ty);
      if (f.item.id === setup.key) {
        // Each group's key in its own colour (the power gems' pictures).
        f.still = group;
        this.keys[group] = f;
        this.keysLeft++;
      } else if (f.item.id === setup.door) {
        this.door = f;
        if (setup.doorSteps) {
          f.still = 0;
        }
      } else if (f.item.id === setup.boss) {
        this.makeBoss(f);
      } else if (this.guard(f)) {
        this.groups[group].add(f);
      }
    }
    this.due = Boolean(setup.appearsAtDoor || setup.bossNear);
    if (setup.egg && !setup.dragons) {
      // The Nest Isle's egg is the enemy's.
      this.nestEgg = battle.fighters.find((f) => f.item.id === setup.egg) ?? null;
      if (this.nestEgg) {
        this.nestEgg.side = ENEMY;
      }
    }
    if (setup.dragons) {
      // The Dangerous Isle: everything in the file is nobody's; two rocks close a path.
      for (const f of battle.fighters) {
        f.side = NEUTRAL;
      }
      const rock = setup.rock ? items.get(setup.rock) : undefined;
      for (const [x, y] of rock ? setup.rocks ?? [] : []) {
        this.rocks.push(battle.add(rock!, x, y, NEUTRAL));
      }
      battle.onHurt.push((target, _damage, by) => this.eggHit(target, by));
    }
  }

  /** What the island's counter says, or "" when the original hides it. */
  goal(): string {
    if (this.keysLeft > 0) {
      const name = this.items.get(this.setup.key)?.name.toLowerCase() ?? "key";
      return `${this.keysLeft} ${this.keysLeft === 1 ? name : `${name}s`} to collect`;
    }
    return this.due || this.setup.dragons || this.bosses.length === 0 ? "" : "Beat the boss!";
  }

  private guard(f: Fighter): boolean {
    if (f.side !== ENEMY || f.item.subcategory === SUBCAT.boss) {
      return false;
    }
    const races = this.setup.groupRaces;
    return races ? races.includes(f.item.race) || f.item.subcategory === SUBCAT.bossAdd : f.isUnit;
  }

  /** Which group a tile's things belong to. */
  private groupOf(x: number, y: number): number {
    const { groupCentres, quarters } = this.setup;
    if (groupCentres) {
      let best = 0;
      let bestDistance = Infinity;
      groupCentres.forEach(([cx, cy], i) => {
        const d = (x - cx) ** 2 + (y - cy) ** 2;
        if (d < bestDistance) {
          best = i;
          bestDistance = d;
        }
      });
      return best;
    }
    if (quarters) {
      const right = quarters.inclusive ? x > quarters.x : x >= quarters.x;
      const below = quarters.inclusive ? y > quarters.y : y >= quarters.y;
      return (below ? 2 : 0) + (right ? 1 : 0);
    }
    return 0;
  }

  /** A boss: its life from the player's level (the config's isn't used), then the stars'. */
  private makeBoss(boss: Fighter): void {
    if (this.setup.lifeByLevel) {
      boss.life = boss.maxLife = bossLife(this.setup.lifeByLevel, this.level);
    } else if (this.setup.lifeBase) {
      boss.life = boss.maxLife = this.setup.lifeBase;
    }
    this.bosses.push(boss);
    this.minds.add(boss, this.stars);
  }

  private strengthen(boss: Fighter): void {
    const at = this.stars - 1;
    const { life, attack, speed } = this.setup;
    if (life && attack && speed) {
      // Set by the stars outright (the Crimson Scale).
      boss.life = boss.maxLife = life[at];
      boss.attack = attack[at];
      boss.velocity = speed[at];
      return;
    }
    boss.life = boss.maxLife = Math.round(boss.maxLife * (this.setup.lifeMult?.[at] ?? 1));
    boss.attack = Math.round(boss.attack * (this.setup.attackMult?.[at] ?? 1));
  }

  /** The stars are chosen: the boss grows; at 3 a second joins it (now, or when it comes). */
  begin(stars: number): void {
    this.stars = stars;
    if (this.setup.dragons) {
      this.dragonsCome();
    }
    for (const boss of [...this.bosses]) {
      if (boss.item.id === GOLDEN || boss.item.id === BLACK) {
        continue;
      }
      this.strengthen(boss);
      if (this.setup.secondBossFrom === "boss") {
        this.second({ x: boss.tx, y: boss.ty });
      }
    }
  }

  private second(from: { x: number; y: number }): void {
    const offset = this.setup.secondBossOffset;
    const item = this.items.get(this.setup.boss);
    if (this.stars < 3 || !this.setup.secondBossAt3 || !offset || !item) {
      return;
    }
    const tile = this.battle.freeTileNear({ x: from.x + offset[0], y: from.y + offset[1] }, false);
    if (tile) {
      const boss = this.battle.add(item, tile.x, tile.y, ENEMY);
      this.makeBoss(boss);
      this.strengthen(boss);
    }
  }

  /** Whether an enemy pays when it falls: only the groups' guards do. */
  pays(f: Fighter): boolean {
    return this.groups.some((group) => group.has(f));
  }

  /**
   * An enemy fell: one fewer in its group, and the group's key lights up
   * when none are left. The Nest Isle's egg starts its story; the
   * Dangerous Isle's eggs wound the black dragon. Every boss dead (and
   * none to come) wins, but on the Dangerous Isle, where the eggs do.
   */
  fell(f: Fighter): void {
    this.groups.forEach((group, i) => {
      if (group.delete(f) && group.size === 0 && this.keys[i]) {
        this.keys[i]!.collectable = true;
      }
    });
    if (f === this.nestEgg) {
      this.nestEgg = null;
      this.nest();
    }
    if (this.setup.dragons) {
      this.dangerousFell(f);
    } else if (!this.won && !this.due && this.bosses.length > 0 && this.bosses.every((boss) => boss.dead)) {
      this.won = true;
      this.onWin(true);
    }
  }

  /** The Nest Isle's egg broke: five rocks close the way, one every half second, then the dragon. */
  private nest(): void {
    const { rock, rockX, rockYFrom, rockYStop, bossNear } = this.setup;
    const item = rock ? this.items.get(rock) : undefined;
    let wait = 0;
    for (let y = rockYFrom ?? 0; item && rockX !== undefined && y > (rockYStop ?? 0); y -= 2) {
      wait += ROCK_EVERY;
      const at = y;
      this.battle.after(wait, () => {
        this.battle.add(item, rockX, at, NEUTRAL);
      });
    }
    this.battle.after(wait + ROCK_EVERY, () => this.bring(bossNear ?? [50, 50]));
  }

  /** The Dangerous Isle's dragons and eggs, by the stars. */
  private dragonsCome(): void {
    const at = this.stars - 1;
    const s = this.setup;
    for (const [id, x, y] of s.dragons ?? []) {
      const item = this.items.get(id);
      const tile = item && this.battle.freeTileNear({ x, y }, false);
      if (!item || !tile) {
        continue;
      }
      const black = id === BLACK;
      const life = black ? s.blackLife ?? item.life : s.goldenLife?.[at] ?? item.life;
      const dragon = this.battle.add(item, tile.x, tile.y, ENEMY, {
        life, maxLife: life, aggro: DRAGON_AGGRO,
        attack: (black ? s.blackAttack : s.goldenAttack)?.[at] ?? item.attack,
        velocity: (black ? s.blackSpeed : s.goldenSpeed)?.[at] ?? item.velocity,
        ...(black ? { invulnerable: true, scale: 2 } : {}),
      });
      this.bosses.push(dragon);
      if (black) {
        this.black = dragon;
      }
    }
    const egg = s.egg ? this.items.get(s.egg) : undefined;
    for (const [x, y] of egg ? s.eggs ?? [] : []) {
      const tile = this.battle.freeTileNear({ x, y }, false);
      if (tile) {
        const life = s.eggLife?.[at] ?? egg!.life;
        this.eggs.add(this.battle.add(egg!, tile.x, tile.y, ENEMY, { life, maxLife: life }));
      }
    }
  }

  /** An egg hit: the black dragon goes for whoever hit it (at most once in 20 seconds). */
  private eggHit(target: Fighter, by: Fighter | null): void {
    const black = this.black;
    if (!by || !black || black.dead || !this.eggs.has(target) || this.battle.frame - this.lastCall < EGG_CALL_EVERY) {
      return;
    }
    this.lastCall = this.battle.frame;
    black.target = by;
    black.attacking = true;
  }

  private dangerousFell(f: Fighter): void {
    if (f.item.id === GOLDEN && this.bosses.filter((b) => b.item.id === GOLDEN).every((b) => b.dead)) {
      // Both golden dragons dead: the path opens.
      this.battle.after(PATH_LOOK, () => this.onLook(PATH_AT));
      this.battle.after(PATH_OPENS, () => {
        for (const rock of this.rocks.splice(0)) {
          this.battle.remove(rock);
        }
      });
    }
    if (!this.eggs.delete(f)) {
      return;
    }
    const black = this.black;
    if (black && !black.dead) {
      this.battle.hurt(black, this.setup.eggWound ?? 0, null, true);
    }
    if (this.eggs.size === 0 && !this.won) {
      // The eighth egg: the black dragon dies, and the island is won.
      this.won = true;
      if (black) {
        this.onLook({ x: black.tx - 6, y: black.ty - 6 });
      }
      this.battle.after(BLACK_DIES, () => {
        if (black && !black.dead) {
          this.battle.kill(black, null);
        }
        this.onWin(false);
      });
    }
  }

  /**
   * The player taps a lit key: it goes, the counter goes down, the
   * penguins join the player, and the gate's picture steps on; the last
   * key takes the gate away (and brings the boss, when it waits for that).
   * Returns the units that joined the player, or null if it wasn't a lit key.
   */
  collect(key: Fighter): Fighter[] | null {
    if (!key.collectable || !this.keys.includes(key)) {
      return null;
    }
    key.collectable = false;
    this.keys[this.keys.indexOf(key)] = null;
    this.battle.remove(key);
    this.keysLeft--;
    const joined: Fighter[] = [];
    const penguin = this.setup.penguin ? this.items.get(this.setup.penguin) : undefined;
    for (const [dx, dy] of penguin ? this.setup.penguinOffsets ?? [] : []) {
      const tile = this.battle.freeTileNear({ x: key.tx + dx, y: key.ty + dy }, false);
      if (tile) {
        joined.push(this.battle.add(penguin!, tile.x, tile.y, SELF, { free: true }));
      }
    }
    if (this.keysLeft === 0 && this.setup.bossNear) {
      this.bring(this.setup.bossNear);
    }
    const door = this.door;
    if (door && this.keysLeft > 0 && this.setup.doorSteps) {
      door.still = (door.still ?? 0) + 1;
    }
    if (door && this.keysLeft === 0) {
      this.door = null;
      this.battle.remove(door);
      if (this.setup.appearsAtDoor) {
        this.bring([door.tx, door.ty]);
      }
    }
    return joined;
  }

  /** The boss comes, near a tile (and its second, at 3 stars). */
  private bring([x, y]: [number, number]): void {
    const item = this.items.get(this.setup.boss);
    this.due = false;
    if (!item) {
      return;
    }
    const tile = this.battle.freeTileNear({ x, y }, false) ?? { x, y };
    const boss = this.battle.add(item, tile.x, tile.y, ENEMY);
    this.makeBoss(boss);
    this.strengthen(boss);
    this.second(this.setup.secondBossFrom === "door" ? { x, y } : tile);
  }
}
