// The boss islands' own rules (CLIENT.md, "Quests"), as the Flash client
// plays them: the island's guards in four groups, a key that lights up
// once its group is beaten, the keys collected with a tap, a gate (or an
// altar) that goes when the last is in, and the boss behind it, whose
// life comes from the player's level. The fighting is rules/battle.ts; the
// counting and paying rules/quest.ts. No drawing here.
//
// Done so far: the Arctic Isle (the Giant Yeti) and the Desert Isle (the
// Stone Golem). The others are played in the classic game for now.

import { ENEMY, SELF, SUBCAT, type Battle, type Fighter } from "./battle.ts";
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
  lifeMult: number[];
  attackMult: number[];
  /** A second boss at 3 stars, near the first boss's tile (or the door's) plus this. */
  secondBossAt3?: boolean;
  secondBossOffset?: [number, number];
  secondBossFrom?: "boss" | "door";
  /** The boss comes only when the door goes, on its tile. */
  appearsAtDoor?: boolean;
  /** The gate is held on its first picture, and steps one on for each key but the last. */
  doorSteps?: boolean;
  /** Units that join the player for each key: which, and where (near the key plus each offset). */
  penguin?: number;
  penguinOffsets?: [number, number][];
}

/** Every boss island played here so far. */
const PLAYED = new Set([100000002, 100000003]);

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
  private readonly battle: Battle;
  private readonly items: Map<number, ItemInfo>;
  private readonly level: number;
  private stars = 1;

  constructor(battle: Battle, setup: BossSetup, items: Map<number, ItemInfo>, level: number) {
    this.battle = battle;
    this.setup = setup;
    this.items = items;
    this.level = level;
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
      } else if (f.isUnit && f.side === ENEMY && f.item.subcategory !== SUBCAT.boss) {
        this.groups[group].add(f);
      }
    }
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
    }
    this.bosses.push(boss);
  }

  private strengthen(boss: Fighter): void {
    const life = this.setup.lifeMult[this.stars - 1] ?? 1;
    boss.life = boss.maxLife = Math.round(boss.maxLife * life);
    boss.attack = Math.round(boss.attack * (this.setup.attackMult[this.stars - 1] ?? 1));
  }

  /** The stars are chosen: the boss grows; at 3 a second joins it (now, or when it comes). */
  begin(stars: number): void {
    this.stars = stars;
    for (const boss of [...this.bosses]) {
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

  /** An enemy fell: one fewer in its group, and the group's key lights up when none are left. */
  fell(f: Fighter): void {
    this.groups.forEach((group, i) => {
      if (group.delete(f) && group.size === 0 && this.keys[i]) {
        this.keys[i]!.collectable = true;
      }
    });
  }

  /** Every boss is dead (and the last has come). */
  beaten(): boolean {
    return this.bosses.length > 0 && this.bosses.every((boss) => boss.dead) && !(this.setup.appearsAtDoor && this.keysLeft > 0);
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
    const door = this.door;
    if (door && this.keysLeft > 0 && this.setup.doorSteps) {
      door.still = (door.still ?? 0) + 1;
    }
    if (door && this.keysLeft === 0) {
      this.door = null;
      this.battle.remove(door);
      const boss = this.items.get(this.setup.boss);
      if (this.setup.appearsAtDoor && boss) {
        const tile = this.battle.freeTileNear({ x: door.tx, y: door.ty }, false) ?? { x: door.tx, y: door.ty };
        const made = this.battle.add(boss, tile.x, tile.y, ENEMY);
        this.makeBoss(made);
        this.strengthen(made);
        this.second({ x: door.tx, y: door.ty });
      }
    }
    return joined;
  }
}
