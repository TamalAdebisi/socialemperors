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
import { BattleLoot } from "./battleLoot.ts";
import type { TownEditor } from "./editor.ts";
import type { CommandSender } from "./net/commands.ts";
import type { PageSettings } from "./net/server.ts";
import { Battle, ENEMY, FPS, NEUTRAL, SELF, SUBCAT, distance, type Fighter, type Side } from "./rules/battle.ts";
import type { GameConfig, ItemInfo } from "./rules/config.ts";
import { inConstruction } from "./rules/construction.ts";
import { MAP_TILES, unitPoint } from "./rules/geometry.ts";
import { CAMP_PERIOD, sideAtHome } from "./rules/camps.ts";
import { Camps } from "./homeCamps.ts";
import { Raid, planBand, planRaids, raidRecovery, type RaidPlan } from "./rules/raids.ts";
import { Specials, type SpecialsTable } from "./rules/specials.ts";
import specialsTable from "./rules/specials-table.json" with { type: "json" };
import { savedTile, type PlacedItem, type Town } from "./rules/town.ts";
import { letAllOut } from "./rules/work.ts";
import type { Sound } from "./sound.ts";
import { showMessage } from "./ui/hud.ts";
import { attackAlert } from "./ui/notice.ts";
import { CURSORS } from "./ui/icons.ts";
import type { ArtLibrary } from "./view/art.ts";
import { BattleView } from "./view/battleView.ts";
import type { Camera } from "./view/camera.ts";
import type { TownView } from "./view/townView.ts";

/** A fight with no raid in it ends after this long with nobody fighting. */
const QUIET_FRAMES = 150;
/** A villager's repair in battle, as at home: 25 life every 61 frames. */
const REPAIR_LIFE = 25;
const REPAIR_EVERY = 61;
/** What a raider killed at home is worth: 5 gold, and its experience (collect_xp). */
const KILL_GOLD = 5;
/** Heroes and villagers (500, 501) don't go to the graveyard when they fall at home; heroes are counted apart. */
const NOT_BURIED = new Set([500, 501, 533, 534, 535, 550, 554, 555, 556, 557]);
const VILLAGERS = new Set([500, 501]);

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
  /** The screen's size (the page's Pixi app's screen): for leaving out what's off it. */
  screen: { width: number; height: number };
  editor: TownEditor;
  /** The game's clock (the server's time, seconds), and the save's troll camp (homeCamps.ts). */
  clock: () => number;
  camp: { id: number; last: number; vars?: Record<string, unknown> };
  /** Arthur's lessons are on: camps keep their story to themselves. */
  quiet?: () => boolean;
  /** One of the player's units fell and is counted in the graveyard (heroes too), for the windows. */
  buried?: (id: number) => void;
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
  private forcedRaid = false;
  private readonly status = document.createElement("button");
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
    if ((window as unknown as { seCalm?: boolean }).seCalm) {
      // The browser tests (e2e/lib.mjs) hold back the siege a town may meet as it opens
      // (1 time in 10 from level 25): it would lock the town at random. They bring it when wanted.
      this.due = this.due.filter((plan) => plan.kind === "bandits");
    }
    this.lines = new Map(((parts.config.localization_strings ?? []) as { id: number; text: string }[]).map((l) => [Number(l.id), l.text]));
    this.camps = new Camps({
      town: parts.town, items: parts.items, commands: parts.commands, view: parts.view, editor: parts.editor,
      clock: parts.clock, camp: parts.camp, random: this.random,
      line: (id) => this.lines.get(id) ?? "",
      pictureUrl: (name) => `${parts.settings.assetsUrl}/images_new/${name}`,
      engage: (units, target) => this.engage(units, target),
      fighterOf: (placed) => this.fight?.fighterOf(placed) ?? null,
      battle: () => this.fight?.battle ?? null,
      quiet: parts.quiet,
    });
    this.camps.arrive();
    this.status.type = "button";
    this.status.className = "home-threats button small plain";
    this.status.addEventListener("click", () => {
      const attacker = this.fight?.raids.flatMap((raid) => raid.alive)[0]
        ?? this.fight?.battle.fighters.find((f) => f.side === ENEMY && !f.dead && f.isUnit);
      if (attacker) {
        parts.camera.lookAt(attacker.at);
        return;
      }
      const target = parts.town.items.find((p) => p.item.subcategory === 811)
        ?? parts.town.items.find((p) => this.camps.sideOf(p) === "enemy" && p.item.isUnit);
      if (target) parts.camera.lookAt(unitPoint(target.tx, target.ty));
    });
    document.body.append(this.status);
    this.updateStatus();
    (window as unknown as Record<string, unknown>).seHome = this;
  }

  readonly camps: Camps;

  /** Units of the player's sent at an enemy in town: a fight, if there isn't one, and the order. */
  engage(units: PlacedItem[], target: PlacedItem): void {
    if (!this.fight) {
      this.fight = new Fight(this.parts, this.random, (line) => this.lines.get(line) ?? "", () => this.kills++);
    }
    this.fight.order(units, target);
    this.parts.editor.emit({ kind: "attack" });
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
      this.forcedRaid = true;
    }
  }

  /** A raid of a kind now, whatever this visit's roll (the browser tests use it). */
  bring(kind: RaidPlan["kind"]): void {
    const level = kind === "siege" ? 25 : kind === "stampede" ? 30 : kind === "army" ? 35 : this.parts.town.level;
    const plan = planRaids(Math.max(level, this.parts.town.level), this.parts.town.race, () => 0.05).find((p) => p.kind === kind);
    if (plan) {
      this.due.unshift({ ...plan, startsAt: this.clock });
      this.forcedRaid = true;
    }
  }

  /** Every screen frame: the clock, the raids that come, the battle. */
  tick(ms: number): void {
    this.owed += Math.min(ms, 250) * this.speed;
    const step = 1000 / FPS;
    while (this.owed >= step) {
      this.owed -= step;
      this.clock++;
      const protectedTown = this.parts.quiet?.() || this.parts.camp.last === 0;
      const calm = (window as unknown as { seCalm?: boolean }).seCalm && !this.forcedRaid;
      // No piled-up waves during a camp battle, tutorial or recovery.
      if (this.fight || protectedTown || calm) {
        for (const plan of this.due) plan.startsAt++;
      } else if (this.due.length && this.due[0].startsAt <= this.clock) {
        this.begin(this.due.shift()!);
        this.forcedRaid = false;
      }
      if (this.fight) {
        this.fight.step();
        if (this.fight.over) {
          this.fight.end();
          this.fight = null;
          // Re-plan at the current level. A session never runs out of raids.
          this.due.splice(0, this.due.length,
            planBand(this.parts.town.level, this.parts.town.race, this.random,
              this.clock + raidRecovery(this.parts.town.level)));
          this.camps.watch();
          this.updateStatus();
        }
      }
      // Every second, fight or not: a scripted camp's doors open as soon as their wave falls.
      if (this.clock % 30 === 0) {
        this.camps.watch();
        this.updateStatus();
      }
    }
    this.fight?.update(ms);
  }

  private begin(plan: RaidPlan): void {
    if (!this.fight) {
      this.fight = new Fight(this.parts, this.random, (line) => this.lines.get(line) ?? "", () => this.kills++);
    }
    this.fight.add(plan);
    this.updateStatus();
  }

  private updateStatus(): void {
    this.status.hidden = Boolean(this.parts.quiet?.());
    const remaining = (seconds: number) => {
      const n = Math.max(0, Math.ceil(seconds));
      return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}`;
    };
    const { camp, clock } = this.parts;
    const waiting = camp.last > 0 ? Math.max(0, CAMP_PERIOD - (clock() - camp.last)) : 0;
    const mission = waiting > 0 ? `Next camp ${remaining(waiting)}` : "Camp ready · Show me";
    const raid = this.fight ? "Defend your town" : camp.last === 0 ? "Raids begin after the rescue"
      : `Next raid ${remaining(((this.due[0]?.startsAt ?? this.clock) - this.clock) / FPS)}`;
    this.status.textContent = `${mission} · ${raid}`;
    this.status.title = "Camps bring new missions. Raiders attack your town: build walls and towers, and repair between raids.";
  }
}

/** The town as a battlefield, while raiders are in it. */
/** The battle's tune, while the town is hit; the town's own comes back once no enemy is fighting (checked every 70 frames). */
const BATTLE_TRACK = "BATALLA.mp3";
/** A camp's tower destroyed: a quarter of its stone price, rounded down, times 0.02, rounded up, as the original drops. */
function towerXp(stoneCost: number): number {
  return Math.ceil(Math.floor(stoneCost / 4) * 0.02);
}

/** The town's trolls give up when they outnumber the player's armed things this many times over. */
const OUTNUMBERED = 2;
const MUSIC_CHECK = 70;
/** Damage taken out of sight adds up (in sight takes away); past this the "under attack" alert shows. */
const DAMAGE_TO_ALERT = 50;
/** The original's "Help" (go and look). */
const HELP = 623;

class Fight {
  private readonly parts: DefenceParts;
  readonly battle: Battle;
  readonly view: BattleView;
  /** Collection pieces from the fallen (battleLoot.ts). */
  readonly loot: BattleLoot;
  private readonly specials: Specials;
  readonly controls: BattleControls;
  readonly raids: Raid[] = [];
  private readonly line: (id: number) => string;
  private readonly killedOne: () => void;
  /** The town's things on the battlefield, and back. */
  private readonly placedOf = new Map<Fighter, PlacedItem>();
  /** Frames since anyone last fought: a fight with no raid ends after a while of quiet. */
  private quiet = 0;
  /** Villagers repairing: which building, and their last repair's frame. */
  private readonly repairs = new Map<Fighter, { building: Fighter; last: number }>();
  /** Damage taken out of sight since the last alert. */
  private unseen = 0;

  constructor(parts: DefenceParts, random: () => number, line: (id: number) => string, killedOne: () => void) {
    this.parts = parts;
    this.line = line;
    this.killedOne = killedOne;
    const { town, items } = parts;
    this.battle = new Battle({ ground: new Uint8Array(MAP_TILES * MAP_TILES).fill(1), random, home: true,
      onDeath: (fighter) => this.died(fighter) });
    // Monks turn units at home too. As in the Flash client the server isn't told: a unit turned
    // and then killed dies as an enemy (kill), and a raider turned fights for the player until it's gone.
    this.battle.onConvert = () => {};
    for (const placed of town.items) {
      const side = sideOf(town, placed);
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
        if (inConstruction(placed, Date.now())) {
          fighter.attack = 0;  // a tower still in its scaffolding doesn't shoot (rules/construction.ts)
        }
      } else if (side === SELF && placed.item.attack === 0) {
        fighter.condition = "survive";
      } else if (placed.defensive) {
        fighter.condition = "defensive";
      }
      if (placed.boss) {
        // A scripted camp's boss (homeScripted.ts).
        fighter.flee = placed.boss.flee ?? null;
        fighter.invulnerable = placed.boss.invulnerable;
        fighter.scale = placed.boss.scale;
      }
      this.placedOf.set(fighter, placed);
    }
    parts.editor.remember(town.items.filter((p) => p.item.isUnit));
    parts.editor.pause("Raiders! Your town is under attack: building waits until they're beaten or gone.");
    parts.view.setFighting(true);
    this.view = new BattleView(parts.art, this.battle, (effect) => parts.sound.play(effect));
    this.loot = new BattleLoot({ fight: "home", race: town.race, view: this.view, commands: parts.commands,
      sheet: `${parts.settings.assetsUrl}/images_new/collectibles_new.png`, line, found: (piece) => parts.editor.pieceFound(piece) });
    this.view.skin = town.skin;
    parts.world.addChild(this.view.root);
    void this.view.load(() => {});
    this.specials = new Specials(this.battle, specialsTable as unknown as SpecialsTable, items, random);
    this.controls = new BattleControls({
      battle: this.battle, view: this.view, camera: parts.camera, world: parts.world, items, town, config: parts.config,
      privateState: parts.privateState, settings: parts.settings, commands: parts.commands, sound: parts.sound,
      specials: this.specials, random,
      tapFirst: (tapped, _tile, selected) => this.tapFirst(tapped, selected),
      // The original's bucket over a burning building of the player's, with villagers selected.
      cursorFor: (hovered, selected) => hovered && !hovered.isUnit && hovered.side === SELF && hovered.life < hovered.maxLife
        && selected.some((f) => f.item.subcategory === SUBCAT.peasant) ? CURSORS.repair : "",
      changed: () => parts.editor.gained(),
    });
    this.battle.onHurt.push((target, damage, by) => this.hurt(target, damage, by));
    // A boss getting away says its line.
    this.battle.onFlee.push((fighter) => {
      const line = fighter.flee?.line;
      if (line) {
        this.view.rise(fighter, [{ text: this.line(line), colour: 0xffffff }]);
      }
    });
    showMessage("Raiders are coming!");
    setTimeout(() => showMessage(""), 3000);
  }

  /** One of the player's things hit: the battle's tune, and the alert if it's out of sight. */
  private hurt(target: Fighter, damage: number, by: Fighter | null): void {
    if (target.side !== SELF || !by) {
      return;
    }
    const { sound, world, camera } = this.parts;
    sound.setTrack(BATTLE_TRACK);
    const at = world.toGlobal(target.at);
    const seen = at.x >= 0 && at.y >= 0 && at.x <= window.innerWidth && at.y <= window.innerHeight;
    this.unseen = seen ? Math.max(0, this.unseen - damage) : this.unseen + damage;
    if (this.unseen >= DAMAGE_TO_ALERT) {
      this.unseen = 0;
      const where = { ...target.at };
      attackAlert("Your town is under attack!", this.line(HELP) || "Help", () => camera.lookAt(where));
    }
  }

  add(plan: RaidPlan): void {
    const voice = { say: (fighter: Fighter, id: number) => {
      const text = this.line(id);
      if (text && !fighter.dead) {
        this.view.rise(fighter, [{ text, colour: 0xffffff }]);
      }
    } };
    const { town } = this.parts;
    this.raids.push(new Raid(this.battle, plan, this.parts.items, town.level, town.race, voice, (block) => town.expansions.has(block)));
    void this.view.load(() => {});
  }

  /** The fighting's over: no raid left, and nobody fighting for 5 seconds. */
  get over(): boolean {
    return this.raids.every((raid) => raid.done) && this.quiet >= QUIET_FRAMES;
  }

  /** The fighter standing for a thing of the town, if it's in this fight. */
  fighterOf(placed: PlacedItem): Fighter | null {
    for (const [fighter, p] of this.placedOf) {
      if (p === placed) {
        return fighter;
      }
    }
    return null;
  }

  /** The player's units (from the town) at an enemy (from the town). */
  order(units: PlacedItem[], target: PlacedItem): void {
    const fighterOf = (placed: PlacedItem) => [...this.placedOf].find(([, p]) => p === placed)?.[0];
    const at = fighterOf(target);
    const mine = units.map(fighterOf).filter((f): f is Fighter => Boolean(f) && !f!.dead);
    if (at && mine.length) {
      this.battle.attackWith(mine, at);
      this.controls.select(mine);
      this.parts.sound.play("place");
    }
    this.quiet = 0;
  }

  step(): void {
    const fighting = this.battle.fighters.some((f) => !f.dead && f.side !== NEUTRAL && f.attacking && f.target && !f.target.dead);
    this.quiet = fighting ? 0 : this.quiet + 1;
    this.battle.step();
    this.specials.step();
    for (const raid of this.raids) {
      raid.step();
    }
    this.stepRepairs();
    if (this.battle.frame % MUSIC_CHECK === 0) {
      this.mercy();
    }
    if (this.battle.frame % MUSIC_CHECK === 0 && !this.battle.fighters.some((f) => f.side === ENEMY && !f.dead && f.attacking && f.target && !f.target.dead)) {
      this.parts.sound.setTrack(null);
    }
  }

  /**
   * The original's mercy: when the trolls of the town (a camp's, the
   * border's: not raiders) fighting outnumber the player's armed units and
   * buildings two to one, they give up and walk back to where they stood.
   */
  private mercy(): void {
    const attacking = [...this.placedOf].filter(([f]) => f.side === ENEMY && f.isUnit && !f.dead && f.attacking && f.target && !f.target.dead);
    if (attacking.length === 0) {
      return;
    }
    const armed = this.battle.fighters.filter((f) => f.side === SELF && !f.dead && f.attack > 0 && f.item.subcategory !== SUBCAT.peasant).length;
    if (attacking.length < OUTNUMBERED * armed) {
      return;
    }
    for (const [fighter, placed] of attacking) {
      fighter.target = null;
      fighter.attacking = false;
      if (this.battle.walk(fighter, savedTile(placed))) {
        fighter.forced = true;
      }
    }
  }

  /** Every screen frame: the drawing, and the buttons. */
  update(ms: number): void {
    this.view.update(ms, this.parts.camera.scale);
    this.view.cull(this.parts.screen);
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
    if (fighter.isUnit && fighter.attack > 0) {
      this.parts.editor.emit({ kind: "death", enemy: fighter.side === ENEMY });
    }
    for (const raid of this.raids) {
      raid.fell(fighter);
    }
    const placed = this.placedOf.get(fighter);
    if (fighter.side === SELF && fighter.isUnit && placed) {
      // As the Flash client: sold as killed, where the server last had it; to the graveyard but for villagers and heroes.
      const from = this.saved(placed);
      commands.add("sell", from.x, from.y, placed.item.id, town.id, 1, "KILL", NOT_BURIED.has(placed.item.id) ? 0 : 1);
      if (!VILLAGERS.has(placed.item.id)) {
        this.parts.buried?.(placed.item.id);  // heroes are sent 0 but counted all the same, as in the Flash client
      }
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
    } else if (fighter.side === ENEMY && placed) {
      // An enemy of the save (a camp's, the border's): where the server has it, and gone from the town.
      const at = savedTile(placed);
      commands.add("kill", at.x, at.y, placed.item.id, town.id, placed.item.isUnit ? "u" : "b");
      town.items.splice(town.items.indexOf(placed), 1);
      this.placedOf.delete(fighter);
      this.parts.view.remove(placed);
      if (fighter.isUnit) {
        this.killedOne();
        this.loot.roll(fighter);  // any enemy unit fallen at home, as the Flash client rolls
      }
      // A fighting unit pays 5 gold and its experience; a camp's tower, 5 gold and a little experience (raiders.py).
      const tower = !fighter.isUnit && fighter.item.attack > 0;
      const gold = fighter.item.attack > 0 ? KILL_GOLD : 0;
      const xp = tower ? towerXp(fighter.item.cost) : fighter.item.collectXp;
      town.gold += gold;
      town.xp += xp;
      if (gold || xp) {
        this.view.rise(fighter, [...(gold ? [{ text: `+${gold}`, colour: 0xf2c14e }] : []), ...(xp ? [{ text: `+${xp} XP`, colour: 0x7fb2ff }] : [])]);
      }
      this.parts.editor.gained();
    } else if (fighter.side === ENEMY && fighter.isUnit) {
      commands.add("kill", fighter.tx, fighter.ty, fighter.item.id, town.id, "u");
      this.killedOne();
      this.loot.roll(fighter);
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
    this.parts.sound.setTrack(null);
    const moved: PlacedItem[] = [];
    for (const [fighter, placed] of this.placedOf) {
      if (fighter.side === ENEMY) {
        // Where the fight left them, for now: the server keeps where they were, as in the original.
        if (fighter.isUnit && !fighter.dead) {
          placed.serverAt ??= { x: placed.tx, y: placed.ty };
          placed.tx = fighter.tx;
          placed.ty = fighter.ty;
        }
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
    // The units' whole sheets, which the fight needed: the map has its own smaller copies (ArtLibrary.unit).
    this.parts.art.letGo(new Set([...this.placedOf.keys()].filter((fighter) => fighter.isUnit).map((fighter) => fighter.item.art)));
    view.setFighting(false);
    for (const placed of this.placedOf.values()) {
      void view.redraw(placed);
    }
    editor.resume(moved);
    showMessage("The raid is over.");
    setTimeout(() => showMessage(""), 3000);
  }
}

/**
 * Whose a thing in the town is in a fight: as the original decides when the
 * town loads (rules/camps.ts), with what can't be hit (life 0) nobody's.
 */
function sideOf(town: Town, placed: PlacedItem): Side {
  const side = placed.nobodys ? "nobody" : sideAtHome(town.race, placed.item, placed.tx, placed.ty);
  if (side === "nobody" || placed.item.life <= 0) {
    return NEUTRAL;
  }
  return side === "self" ? SELF : ENEMY;
}
