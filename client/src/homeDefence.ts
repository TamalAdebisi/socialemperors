// Raids on the player's own town (CLIENT.md, "Defending the town"): when
// the town opens, the raids of this visit are rolled (rules/raids.ts), and
// when one comes, the town becomes a battlefield until it's over. The
// battle (rules/battle.ts, the town's things as fighters) is drawn by the
// battle's view over the town's ground, the player commands as on an
// island (battleControls.ts), and building waits. Buildings burn rather
// than fall; when the raid is over, the town is the player's again, its
// units where the fight left them and its burnt buildings waiting for
// villagers to repair them.
//
// The server hears what the Flash client tells it: `sell` ... "KILL" for
// each of the player's units killed, `kill` for each raider killed,
// `pop_unit` for workers thrown out of a burnt building. The raids
// themselves are never saved, as in the original.

import type { Container } from "pixi.js";

import { BattleControls } from "./battleControls.ts";
import type { TownEditor } from "./editor.ts";
import type { CommandSender } from "./net/commands.ts";
import type { PageSettings } from "./net/server.ts";
import { Battle, ENEMY, FPS, NEUTRAL, SELF, SUBCAT, distance, type Fighter, type Side } from "./rules/battle.ts";
import type { GameConfig, ItemInfo } from "./rules/config.ts";
import { MAP_TILES } from "./rules/geometry.ts";
import { isTheirs } from "./rules/editing.ts";
import { Raid, planRaids, type RaidPlan } from "./rules/raids.ts";
import { Specials, type SpecialsTable } from "./rules/specials.ts";
import specialsTable from "./rules/specials-table.json" with { type: "json" };
import type { PlacedItem, Town } from "./rules/town.ts";
import { letAllOut } from "./rules/work.ts";
import type { Sound } from "./sound.ts";
import { showMessage } from "./ui/hud.ts";
import type { ArtLibrary } from "./view/art.ts";
import { BattleView } from "./view/battleView.ts";
import type { Camera } from "./view/camera.ts";
import type { TownView } from "./view/townView.ts";

/** A villager's repair in battle, as at home: 25 life every 61 frames. */
const REPAIR_LIFE = 25;
const REPAIR_EVERY = 61;
/** What a raider killed at home is worth: 5 gold, and its experience (collect_xp). */
const KILL_GOLD = 5;
/** Heroes and villagers (500, 501) don't go to the graveyard when they fall at home; heroes are counted apart. */
const NOT_BURIED = new Set([500, 501, 533, 534, 535, 550, 554, 555, 556, 557]);

export interface DefenceParts {
  town: Town;
  items: Map<number, ItemInfo>;
  config: GameConfig;
  privateState: Record<string, unknown> | undefined;
  settings: PageSettings;
  commands: CommandSender;
  sound: Sound;
  art: ArtLibrary;
  view: TownView;
  world: Container;
  camera: Camera;
  editor: TownEditor;
  random?: () => number;
}

export class HomeDefence {
  private readonly parts: DefenceParts;
  private readonly random: () => number;
  /** Raids still to come, by when (frames since the town opened). */
  private readonly due: RaidPlan[];
  /** Frames since the town opened, at 30 a second. */
  private clock = 0;
  private owed = 0;
  private fight: Fight | null = null;
  private readonly lines: Map<number, string>;
  /** Raiders killed this visit. */
  kills = 0;
  /** How many battle frames a frame of the clock: 1, more in the browser tests. */
  speed = 1;

  constructor(parts: DefenceParts) {
    this.parts = parts;
    this.random = parts.random ?? Math.random;
    this.due = planRaids(parts.town.level, parts.town.race, this.random).sort((a, b) => a.startsAt - b.startsAt);
    this.lines = new Map(((parts.config.localization_strings ?? []) as { id: number; text: string }[]).map((l) => [Number(l.id), l.text]));
    (window as unknown as Record<string, unknown>).seHome = this;
  }

  /** The raids still to come (for the browser tests). */
  get waiting(): RaidPlan[] {
    return this.due;
  }

  get fighting(): Fight | null {
    return this.fight;
  }

  /** Bring the next raid now (the browser tests use it; the clock jumps to it). */
  hurry(): void {
    if (this.due.length) {
      this.clock = Math.max(this.clock, this.due[0].startsAt);
    }
  }

  /** A raid of a kind now, whatever this visit's roll (the browser tests use it). */
  bring(kind: RaidPlan["kind"]): void {
    const level = kind === "siege" ? 25 : kind === "stampede" ? 30 : kind === "army" ? 35 : this.parts.town.level;
    const plan = planRaids(Math.max(level, this.parts.town.level), this.parts.town.race, () => 0.05).find((p) => p.kind === kind);
    if (plan) {
      this.due.unshift({ ...plan, startsAt: this.clock });
    }
  }

  /** Every screen frame: the clock, the raids that come, the battle. */
  tick(ms: number): void {
    this.owed += Math.min(ms, 250) * this.speed;
    const step = 1000 / FPS;
    while (this.owed >= step) {
      this.owed -= step;
      this.clock++;
      while (this.due.length && this.due[0].startsAt <= this.clock) {
        this.begin(this.due.shift()!);
      }
      if (this.fight) {
        this.fight.step();
        if (this.fight.over) {
          this.fight.end();
          this.fight = null;
        }
      }
    }
    this.fight?.update(ms);
  }

  private begin(plan: RaidPlan): void {
    if (!this.fight) {
      this.fight = new Fight(this.parts, this.random, (line) => this.lines.get(line) ?? "", () => this.kills++);
    }
    this.fight.add(plan);
  }
}

/** The town as a battlefield, while raiders are in it. */
class Fight {
  private readonly parts: DefenceParts;
  readonly battle: Battle;
  readonly view: BattleView;
  private readonly specials: Specials;
  readonly controls: BattleControls;
  readonly raids: Raid[] = [];
  private readonly line: (id: number) => string;
  private readonly killedOne: () => void;
  /** The town's things on the battlefield, and back. */
  private readonly placedOf = new Map<Fighter, PlacedItem>();
  /** Villagers repairing: which building, and their last repair's frame. */
  private readonly repairs = new Map<Fighter, { building: Fighter; last: number }>();

  constructor(parts: DefenceParts, random: () => number, line: (id: number) => string, killedOne: () => void) {
    this.parts = parts;
    this.line = line;
    this.killedOne = killedOne;
    const { town, items } = parts;
    this.battle = new Battle({ ground: new Uint8Array(MAP_TILES * MAP_TILES).fill(1), random, home: true,
      onDeath: (fighter) => this.died(fighter) });
    for (const placed of town.items) {
      const side = sideOf(town, placed.item);
      const fighter = this.battle.add(placed.item, placed.tx, placed.ty, side, { tag: placed });
      if (!placed.item.isUnit) {
        fighter.facing = placed.orientation;
        if (placed.health !== undefined) {
          fighter.life = placed.health;
        }
        if (placed.ruined) {
          // Burnt out in an earlier raid and not yet repaired in full: still out of the fight.
          fighter.dead = true;
          fighter.ruined = true;
        }
      } else if (side === SELF && placed.item.attack === 0) {
        fighter.condition = "survive";
      }
      this.placedOf.set(fighter, placed);
    }
    parts.editor.remember(town.items.filter((p) => p.item.isUnit));
    parts.editor.pause("Raiders! Your town is under attack: building waits until they're beaten or gone.");
    parts.view.setFighting(true);
    this.view = new BattleView(parts.art, this.battle, (effect) => parts.sound.play(effect));
    this.view.skin = town.skin;
    parts.world.addChild(this.view.root);
    void this.view.load(() => {});
    this.specials = new Specials(this.battle, specialsTable as unknown as SpecialsTable, items, random);
    this.controls = new BattleControls({
      battle: this.battle, view: this.view, camera: parts.camera, world: parts.world, items, town, config: parts.config,
      privateState: parts.privateState, settings: parts.settings, commands: parts.commands, sound: parts.sound,
      specials: this.specials, random,
      tapFirst: (tapped, _tile, selected) => this.tapFirst(tapped, selected),
      changed: () => parts.editor.gained(),
    });
    showMessage("Raiders are coming!");
    setTimeout(() => showMessage(""), 3000);
  }

  add(plan: RaidPlan): void {
    const voice = { say: (fighter: Fighter, id: number) => {
      const text = this.line(id);
      if (text && !fighter.dead) {
        this.view.rise(fighter, [{ text, colour: 0xffffff }]);
      }
    } };
    this.raids.push(new Raid(this.battle, plan, this.parts.items, this.parts.town.level, this.parts.town.race, voice));
    void this.view.load(() => {});
  }

  get over(): boolean {
    return this.raids.every((raid) => raid.done);
  }

  step(): void {
    this.battle.step();
    this.specials.step();
    for (const raid of this.raids) {
      raid.step();
    }
    this.stepRepairs();
  }

  /** Every screen frame: the drawing, and the buttons. */
  update(ms: number): void {
    this.view.update(ms, this.parts.camera.scale);
    this.controls.update();
  }

  /** A villager selected and a building of the player's tapped that burns: they go and repair it. */
  private tapFirst(tapped: Fighter | null, selected: Fighter[]): boolean {
    // New orders end a repair.
    for (const unit of selected) {
      this.repairs.delete(unit);
    }
    const villagers = selected.filter((f) => f.item.subcategory === SUBCAT.peasant);
    if (!tapped || tapped.isUnit || tapped.side !== SELF || tapped.life >= tapped.maxLife || villagers.length === 0) {
      return false;
    }
    for (const villager of villagers) {
      this.repairs.set(villager, { building: tapped, last: this.battle.frame });
      const spot = this.battle.freeTileNear({ x: tapped.tx, y: tapped.ty }, true);
      if (spot) {
        this.battle.moveTo([villager], spot);
      }
    }
    this.parts.sound.play("place");
    return true;
  }

  private stepRepairs(): void {
    for (const [villager, repair] of this.repairs) {
      const building = repair.building;
      if (villager.dead || building.life >= building.maxLife) {
        this.repairs.delete(villager);
        continue;
      }
      if (this.battle.isMoving(villager) || distance(villager, building) > 1) {
        continue;
      }
      if (this.battle.frame - repair.last >= REPAIR_EVERY) {
        repair.last = this.battle.frame;
        this.battle.repair(building, REPAIR_LIFE);
        villager.special = { animation: 5, until: this.battle.frame + REPAIR_EVERY };
      }
    }
  }

  /** Something fell: the raids count it, the server hears, the raider pays. */
  private died(fighter: Fighter): void {
    const { town, commands, items } = this.parts;
    for (const raid of this.raids) {
      raid.fell(fighter);
    }
    const placed = this.placedOf.get(fighter);
    if (fighter.side === SELF && fighter.isUnit && placed) {
      // As the Flash client: sold as killed, where the server last had it; to the graveyard but for villagers and heroes.
      const from = this.saved(placed);
      commands.add("sell", from.x, from.y, placed.item.id, town.id, 1, "KILL", NOT_BURIED.has(placed.item.id) ? 0 : 1);
      town.items.splice(town.items.indexOf(placed), 1);
      this.placedOf.delete(fighter);
      this.parts.view.remove(placed);
    } else if (fighter.side === SELF && !fighter.isUnit && placed && fighter.ruined) {
      // Burnt out: its workers are thrown out, as the server hears.
      for (const out of letAllOut(town, placed, items)) {
        for (const command of out.commands) {
          commands.add(command.cmd, ...command.args);
        }
        const thrown = this.battle.add(out.unit.item, out.unit.tx, out.unit.ty, SELF, { tag: out.unit });
        if (out.unit.item.attack === 0) {
          thrown.condition = "survive";
        }
        this.placedOf.set(thrown, out.unit);
        this.parts.editor.remember([out.unit]);
      }
    } else if (fighter.side === ENEMY && fighter.isUnit) {
      commands.add("kill", fighter.tx, fighter.ty, fighter.item.id, town.id, "u");
      this.killedOne();
      const xp = fighter.item.collectXp;
      town.gold += KILL_GOLD;
      town.xp += xp;
      this.view.rise(fighter, [{ text: `+${KILL_GOLD}`, colour: 0xf2c14e }, ...(xp ? [{ text: `+${xp} XP`, colour: 0x7fb2ff }] : [])]);
      this.parts.editor.gained();
    }
  }

  /** Where the server has a unit: where it stood when the fight began. */
  private saved(placed: PlacedItem): { x: number; y: number } {
    return { x: placed.tx, y: placed.ty };
  }

  /** The raid is over: the town is the player's again. */
  end(): void {
    const { view, world, editor } = this.parts;
    this.controls.stop();
    const moved: PlacedItem[] = [];
    for (const [fighter, placed] of this.placedOf) {
      if (fighter.side !== SELF && fighter.side !== NEUTRAL) {
        continue;
      }
      if (placed.item.isUnit) {
        if (fighter.dead) {
          continue;
        }
        placed.tx = fighter.tx;
        placed.ty = fighter.ty;
        moved.push(placed);
      } else if (fighter.side === SELF) {
        placed.health = fighter.life < fighter.maxLife ? Math.max(0, Math.round(fighter.life)) : undefined;
        placed.ruined = fighter.ruined || undefined;
      }
    }
    world.removeChild(this.view.root);
    this.view.root.destroy({ children: true });
    view.setFighting(false);
    for (const placed of this.placedOf.values()) {
      void view.redraw(placed);
    }
    editor.resume(moved);
    showMessage("The raid is over.");
    setTimeout(() => showMessage(""), 3000);
  }
}

/** Whose a thing in the town is in a fight: the player's, or nobody's (trees, rocks, scenery that can't be hit). */
function sideOf(town: Town, item: ItemInfo): Side {
  if (!isTheirs(town, item) || item.life <= 0) {
    return NEUTRAL;
  }
  return SELF;
}
