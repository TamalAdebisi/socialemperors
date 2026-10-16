// The scripted troll camps in the player's town (CLIENT.md, "Scripted
// camps"), played as the Flash client plays them. The pieces stand in the
// four corners of the map (rules/scripted-camps.json): keys guarded by
// enemy units, a chest, sometimes a wave or a boss. Once a key's guards are
// beaten it lights up; one tap takes it. When the story says, the chest
// lights up; one tap opens it: the level's reward, the camp's prizes and
// the next camp.
//
// Two engines, as in the original. The old one (camps 7 and 13) saves
// nothing of its own: how far a camp has got is read from the pieces still
// standing. The new one (14 to 29) saves its progress with `set_quest_var`
// (started, the keys taken, the bosses beaten), and each time the town
// opens it clears the corners and puts back what isn't done: the guards
// of the keys left come back whole, and so does the boss.
//
// Commands, as the Flash client's: a free `buy` for each piece, `sell` ...
// "CLEAN_<camp>" for what the border loses, `collect_new` for a key, `sell`
// ... "ATRZO" for its scenery and "COLQS" for the key itself, `sell` ...
// "TREAS" and `collect_treasure` for the chest, `store_add_items` for a
// prize that goes to storage.

import type { CampParts, Camps } from "./homeCamps.ts";
import { borderTrolls, campReward, nextCamp, onBorder } from "./rules/camps.ts";
import {
  SCRIPTED_TIPS, guardsBox, oldCampState, scriptedCamp, tilePieces, type ScriptedCamp, type ScriptedTile,
} from "./rules/scripted.ts";
import type { PlacedItem } from "./rules/town.ts";
import { freeTileNear } from "./rules/work.ts";
import { firstThisSession } from "./session.ts";
import { notice } from "./ui/notice.ts";

const TOWN_HALL = 135;
/** The camps whose village starts half burnt, once a session (the Chinese dragon's). */
const BURNT = 23;
/** A boss that gets away below a tenth of its life. */
const FLEE_BELOW = 0.1;

/** A door that opens when its wave has fallen (Neptune's pen, the Ent's). */
interface Door {
  door: PlacedItem;
  wave: PlacedItem[];
}

/** A key and what goes with it: its tile, its guards (captured when the camp is read), its scenery. */
interface Group {
  tile: ScriptedTile;
  key: PlacedItem;
  guards: PlacedItem[];
  scenery: PlacedItem[];
  lit: boolean;
  /** The new engine never lights a key that had no guards when it was read. */
  never: boolean;
}

/** The new engine's saved progress. */
interface Progress {
  spawned: boolean;
  activators: string[];
  boss: number[];
}

/** Whether a tile is in one of the map's corners, where the scripted camps stand. */
export function inCorner(x: number, y: number): boolean {
  return onBorder(x, y) && (x < 20 || x >= 80) && (y < 20 || y >= 80);
}

export class ScriptedCamps {
  private readonly parts: CampParts;
  private readonly camps: Camps;
  private readonly random: () => number;
  /** The camp being played, its keys, chest and what the chest waits for. */
  private id: number | null = null;
  private camp: ScriptedCamp | null = null;
  private groups: Group[] = [];
  private chest: PlacedItem | null = null;
  private chestLit = false;
  /** The wave or the bosses that must fall first; a boss's place among the boss tiles' bosses. */
  private enders: PlacedItem[] = [];
  private endersDue = false;
  private bossIndex = new Map<PlacedItem, number>();
  private progress: Progress = { spawned: false, activators: [], boss: [] };
  /** Where a camp with no chest gives its prizes: the last key taken (or the camp's own spot). */
  private prizeSpot: { x: number; y: number } | null = null;
  private doors: Door[] = [];

  constructor(parts: CampParts, camps: Camps, random: () => number) {
    this.parts = parts;
    this.camps = camps;
    this.random = random;
  }

  /** The town opened with this camp due: put it up afresh, or read back how far it has got. */
  arrive(id: number): void {
    const camp = scriptedCamp(id);
    if (!camp) {
      return;
    }
    this.id = id;
    this.camp = camp;
    if (camp.engine === "new") {
      this.arriveNew(id, camp);
    } else {
      this.arriveOld(id, camp);
    }
    this.watch();
  }

  private keyTiles(camp: ScriptedCamp): ScriptedTile[] {
    return camp.tiles.filter((t) => t.pieces.some((p) => p[4] === "key"));
  }

  // --- The old engine ---------------------------------------------------

  private arriveOld(id: number, camp: ScriptedCamp): void {
    const town = this.parts.town;
    const chests = town.items.filter((p) => p.item.id === camp.chest).length;
    const keys = town.items.filter((p) => p.item.id === camp.activator).length;
    const state = oldCampState(chests, keys, this.keyTiles(camp).length);
    if (state === "none" || state === "error") {
      // Nothing yet (or a muddle): the camp is put up afresh, with its window.
      this.camps.clearBorder(id);
      for (const tile of camp.tiles) {
        this.place(tile);
      }
      this.borderTrolls();
      this.window(id, camp);
    }
    this.readBack(camp);
    if (this.groups.length === 0 && this.chest) {
      this.keysDone(camp, false);
    }
  }

  // --- The new engine ---------------------------------------------------

  private arriveNew(id: number, camp: ScriptedCamp): void {
    const { town, commands } = this.parts;
    const vars = this.parts.camp.vars ?? {};
    const fresh = vars.spawned !== true;
    this.progress = {
      spawned: true,
      activators: fresh ? [] : (Array.isArray(vars.activators) ? vars.activators.map(String) : []),
      boss: fresh ? [] : (Array.isArray(vars.boss) ? vars.boss.map(Number) : []),
    };
    if (fresh) {
      this.camps.clearBorder(id);
      commands.add("set_quest_var", town.id, "spawned", "true");
      this.parts.camp.vars = { spawned: true };
      this.helpers(camp);
    }
    // Every time: the corners cleared, and what isn't done put back.
    this.camps.clearBorder(id, inCorner);
    for (const tile of camp.tiles) {
      if (!tile.key || !this.progress.activators.includes(tile.key)) {
        this.place(tile);
      }
    }
    const keys = this.keyTiles(camp).length;
    if (fresh) {
      this.borderTrolls();
      this.window(id, camp);
    }
    this.readBack(camp);
    if (this.progress.activators.length > keys) {
      // More keys saved than the camp has: it's over.
      this.finish(camp, null);
      return;
    }
    if (this.progress.activators.length >= keys) {
      this.keysDone(camp, true);
    }
  }

  /** The camp's helpers, the player's, by the town hall (DECISIONS.md, "Scripted camps"). */
  private helpers(camp: ScriptedCamp): void {
    const { town } = this.parts;
    const hall = town.items.find((p) => p.item.subcategory === TOWN_HALL && this.camps.sideOf(p) === "self");
    for (const id of camp.helpers) {
      const race = this.parts.items.get(id)?.race;
      if (race !== town.race && race !== "a") {
        continue;  // a troll town isn't sent human helpers (DECISIONS.md, "Scripted camps")
      }
      const tile = hall ? freeTileNear(town, hall) : null;
      if (tile) {
        this.camps.put({ id, x: tile.x, y: tile.y, unit: true });
      }
    }
  }

  private save(key: "activators" | "boss", value: unknown): void {
    const { town, commands } = this.parts;
    commands.add("set_quest_var", town.id, key, JSON.stringify(value));
    this.parts.camp.vars = { ...(this.parts.camp.vars ?? {}), [key]: value };
  }

  // --- Both -------------------------------------------------------------

  private borderTrolls(): void {
    const { town } = this.parts;
    for (const troll of borderTrolls(this.camps.enemiesLeft(), town.level, town.race, this.random, this.camps.ground())) {
      this.camps.put(troll);
    }
  }

  private window(id: number, camp: ScriptedCamp): void {
    const picture = camp.pictures[this.parts.town.race === "t" ? 1 : 0] ?? camp.pictures[0];
    notice(this.camps.title(id, camp.popup[0]), this.parts.line(camp.popup[1]), picture ? this.parts.pictureUrl(picture) : null);
  }

  private place(tile: ScriptedTile): PlacedItem[] {
    const { town, items } = this.parts;
    const placed: PlacedItem[] = [];
    for (const piece of tilePieces(tile, town.level, town.race, this.random)) {
      const item = items.get(piece.id);
      const put = this.camps.put({ id: piece.id, x: piece.x, y: piece.y, unit: Boolean(item?.isUnit) });
      if (put) {
        placed.push(put);
      }
    }
    return placed;
  }

  /** Each key with the enemy units standing in its box now (they must all fall), its scenery; the chest. */
  private readBack(camp: ScriptedCamp): void {
    const town = this.parts.town;
    const at = (id: number, x: number, y: number) => town.items.find((p) => p.item.id === id && p.tx === x && p.ty === y) ?? null;
    this.groups = [];
    for (const tile of camp.tiles) {
      const keyPiece = tile.pieces.find((p) => p[4] === "key");
      const key = keyPiece ? at(keyPiece[0], keyPiece[1], keyPiece[2]) : null;
      if (!key) {
        continue;
      }
      const inBox = guardsBox({ x: key.tx, y: key.ty });
      const guards = town.items.filter((p) => p.item.isUnit && this.camps.sideOf(p) === "enemy" && inBox(p.tx, p.ty));
      const scenery = tile.pieces.filter((p) => p[4] === "scenery").map(([id, x, y]) => at(id, x, y)).filter((p): p is PlacedItem => p !== null);
      this.groups.push({ tile, key, guards, scenery, lit: false, never: camp.engine === "new" && guards.length === 0 });
    }
    this.chest = camp.chest === null ? null : town.items.find((p) => p.item.id === camp.chest) ?? null;
    this.chestLit = false;
    this.enders = [];
    this.endersDue = false;
    this.bossIndex.clear();
    // Tiles whose buildings are nobody's (the festivals), and the pens of the camps with doors.
    for (const tile of camp.tiles) {
      if (tile.side === "neutral" || camp.doors) {
        for (const [id, x, y, , role] of tile.pieces) {
          const piece = role === "unit" ? null : at(id, x, y);
          if (piece && !piece.item.isUnit) {
            piece.nobodys = true;
          }
        }
      }
    }
    this.showSteps(camp);
    if (this.id === BURNT && firstThisSession(`se-burnt-${BURNT}-${this.parts.camp.last}`)) {
      // The Chinese village starts half burnt (once a session, as in the original: it isn't saved).
      for (const tile of camp.tiles) {
        for (const [id, x, y, , role] of tile.pieces) {
          const piece = role === "key" || role === "chest" ? null : at(id, x, y);
          if (piece && !piece.item.isUnit && piece.item.life > 0) {
            piece.health = piece.item.life - (Math.floor(piece.item.life / 2) + 1);
            void this.parts.view.redraw(piece);
          }
        }
      }
    }
    // The doors, each with the wave that opens it: the units of its kind standing now.
    this.doors = [];
    (camp.doors ?? []).forEach((def, i) => {
      const door = at(def.id, def.at[0], def.at[1]);
      if (!door) {
        return;
      }
      if (door.orientation === 0 && (i === 0 || camp.doors!.length === 1)) {
        // Turned to face the pen's way, as the original turns it.
        door.orientation = 1;
        void this.parts.view.redraw(door);
      }
      const kinds = def.opensWhenDead.ids ?? [def.opensWhenDead.id!];
      const wave = town.items.filter((p) => p.item.isUnit && kinds.includes(p.item.id) && this.camps.sideOf(p) === "enemy");
      this.doors.push({ door, wave });
    });
  }

  /** A chest that fills up as the camp goes: one more step for each key taken. */
  private showSteps(camp: ScriptedCamp): void {
    if (camp.steps && this.chest) {
      this.chest.steps = camp.engine === "new" ? this.progress.activators.length : 0;
      void this.parts.view.redraw(this.chest);
    }
  }

  /** Every key taken: the wave or the boss comes, or the chest lights up (or, with no chest, the camp ends). */
  private keysDone(camp: ScriptedCamp, live: boolean): void {
    if (!camp.bossStage) {
      if (camp.chest === null) {
        this.finish(camp, null);
      } else {
        this.chestLit = true;
      }
      return;
    }
    const town = this.parts.town;
    if (live) {
      // The boss tiles put down: in the new engine, all but the bosses already beaten.
      let index = 0;
      for (const tile of camp.bossTiles) {
        const fresh: ScriptedTile = { ...tile, pieces: tile.pieces.filter(([id]) => {
          const boss = this.isBossId(id);
          const keep = !boss || !this.progress.boss.includes(index);
          if (boss) {
            index++;
          }
          return keep;
        }) };
        this.place(fresh);
      }
    }
    // The bosses: the units standing at the boss tiles of the undead's or the bosses' kind.
    const spots = camp.bossTiles.flatMap((t) => t.pieces.filter(([id]) => this.isBossId(id)).map(([, x, y]) => `${x},${y}`));
    this.enders = [];
    spots.forEach((spot, i) => {
      const unit = town.items.find((p) => p.item.isUnit && `${p.tx},${p.ty}` === spot && (p.item.race === "e" || p.item.subcategory === 84 || p.item.subcategory === 85));
      if (unit) {
        this.enders.push(unit);
        this.bossIndex.set(unit, i);
        this.bossRules(camp, unit);
      }
    });
    this.endersDue = true;
    if (this.enders.length === 0) {
      this.bossesDone(camp);
    }
  }

  /** A boss's own rules: the dragon and Neptune get away; the Ent can't be hurt while its door stands. */
  private bossRules(camp: ScriptedCamp, unit: PlacedItem): void {
    if (unit.item.id !== camp.boss) {
      return;
    }
    if (this.id === 23) {
      unit.boss = { flee: { below: FLEE_BELOW, line: camp.bossSay ?? null } };
    } else if (this.id === 24) {
      unit.boss = { flee: { below: FLEE_BELOW, line: null }, scale: 1.2 };
    } else if (this.id === 25) {
      unit.boss = { invulnerable: this.doors.length > 0 };
    }
  }

  /** A wave fallen: its door goes (`sell` ... "ACTIV"); the Ent's going makes the Ent mortal. */
  private openDoor(door: Door): void {
    const { town, commands, view } = this.parts;
    this.doors.splice(this.doors.indexOf(door), 1);
    const placed = door.door;
    if (town.items.includes(placed)) {
      commands.add("sell", placed.tx, placed.ty, placed.item.id, town.id, 1, "ACTIV");
      town.items.splice(town.items.indexOf(placed), 1);
      view.remove(placed);
      const fighter = this.parts.fighterOf?.(placed);
      if (fighter) {
        this.parts.battle?.()?.remove(fighter);
      }
    }
    if (this.doors.length === 0) {
      for (const boss of this.enders) {
        if (boss.boss?.invulnerable) {
          boss.boss.invulnerable = false;
          const fighter = this.parts.fighterOf?.(boss);
          if (fighter) {
            fighter.invulnerable = false;
          }
        }
      }
    }
  }

  private isBossId(id: number): boolean {
    const item = this.parts.items.get(id);
    return Boolean(item?.isUnit && (item.race === "e" || item.subcategory === 84 || item.subcategory === 85));
  }

  private bossesDone(camp: ScriptedCamp): void {
    this.endersDue = false;
    if (camp.chest === null) {
      this.finish(camp, null);
    } else {
      this.chestLit = true;
    }
  }

  /** Every second, and after a fight: keys whose guards are all gone light up; the chest when its turn comes. */
  watch(): void {
    const camp = this.camp;
    if (!camp) {
      return;
    }
    const standing = new Set(this.parts.town.items);
    for (const door of [...this.doors]) {
      if (door.wave.every((u) => !standing.has(u))) {
        this.openDoor(door);
      }
    }
    for (const group of this.groups) {
      if (!group.lit && !group.never && group.guards.every((g) => !standing.has(g))) {
        group.lit = true;
      }
      this.parts.view.sign(group.key, group.lit ? { kind: "ready", resource: "gold" } : null);
    }
    if (this.endersDue) {
      const fallen = this.enders.filter((u) => !standing.has(u));
      if (camp.engine === "new") {
        const beaten = fallen.map((u) => this.bossIndex.get(u)!).filter((i) => !this.progress.boss.includes(i));
        if (beaten.length) {
          this.progress.boss.push(...beaten);
          this.save("boss", this.progress.boss);
        }
      }
      if (fallen.length === this.enders.length) {
        this.bossesDone(camp);
      }
    }
    if (this.chest && this.camp) {
      this.parts.view.sign(this.chest, this.chestLit ? { kind: "ready", resource: "gold" } : null);
    }
  }

  /** A tap on a key or the chest of the camp being played. True when it was one. */
  tap(placed: PlacedItem): boolean {
    const camp = this.camp;
    if (!camp) {
      return false;
    }
    this.watch();
    const group = this.groups.find((g) => g.key === placed);
    if (group) {
      if (group.lit) {
        this.take(camp, group);
      } else {
        const left = group.guards.filter((g) => this.parts.town.items.includes(g)).length;
        this.say(placed, `${left} ${left === 1 ? "enemy guards" : "enemies guard"} it.`);
      }
      return true;
    }
    if (placed === this.chest) {
      if (this.chestLit) {
        this.open(camp, placed);
      } else {
        this.say(placed, this.endersDue ? "Beat the last of them first." : "Take the camp's keys first.");
      }
      return true;
    }
    return false;
  }

  private say(placed: PlacedItem, text: string): void {
    const tip = SCRIPTED_TIPS[placed.item.id];
    this.parts.editor.tell(`${tip ? `${this.parts.line(tip)} ` : ""}${text}`);
  }

  /** A lit key taken: what it pays, its scenery and itself gone; the last brings what comes next. */
  private take(camp: ScriptedCamp, group: Group): void {
    const { town, commands, view, editor } = this.parts;
    const key = group.key;
    commands.add("collect_new", key.tx, key.ty, town.id, key.item.id, 0, 1, 0);
    // What the item pays when collected: its gold (if gold), and its experience.
    if (key.item.collectType === "g") {
      town.gold += key.item.collect;
    }
    town.xp += key.item.collectXp;
    for (const piece of group.scenery) {
      if (town.items.includes(piece)) {
        commands.add("sell", piece.tx, piece.ty, piece.item.id, town.id, 1, "ATRZO");
        town.items.splice(town.items.indexOf(piece), 1);
        view.remove(piece);
      }
    }
    this.prizeSpot = { x: key.tx, y: key.ty };
    if (camp.engine === "new" && group.tile.key) {
      // Saved before anything that might end the camp (DECISIONS.md, "Scripted camps").
      this.progress.activators.push(group.tile.key);
      this.save("activators", this.progress.activators);
    }
    commands.add("sell", key.tx, key.ty, key.item.id, town.id, 1, "COLQS");
    town.items.splice(town.items.indexOf(key), 1);
    view.remove(key);
    this.groups.splice(this.groups.indexOf(group), 1);
    editor.gained();
    if (key.item.collectXp) {
      editor.tell(`+${key.item.collectXp} XP`);
    }
    this.showSteps(camp);
    if (this.groups.length === 0) {
      this.keysDone(camp, true);
    }
    void commands.flush();
    this.watch();
  }

  /** The chest opened: it goes, and the camp is done. */
  private open(camp: ScriptedCamp, chest: PlacedItem): void {
    const { town, commands, view } = this.parts;
    commands.add("sell", chest.tx, chest.ty, chest.item.id, town.id, 0, "TREAS");
    town.items.splice(town.items.indexOf(chest), 1);
    view.remove(chest);
    this.finish(camp, { x: chest.tx, y: chest.ty });
  }

  /** The camp done: the level's reward, the end window, the camp's prizes, the next camp in 10 minutes. */
  private finish(camp: ScriptedCamp, at: { x: number; y: number } | null): void {
    const { town, commands, editor, clock } = this.parts;
    const id = this.id!;
    const prize = campReward(town.level);
    town.gold += prize.gold;
    town.xp += prize.xp;
    const next = nextCamp(id);
    commands.add("collect_treasure", prize.gold, prize.xp, next, 0, 0, town.id);
    this.parts.camp.id = next;
    this.parts.camp.last = clock();
    this.parts.camp.vars = {};
    const spot = at ?? (camp.treasurePosOverride ? { x: camp.treasurePosOverride[0], y: camp.treasurePosOverride[1] } : this.prizeSpot);
    this.prizes(camp, camp.rewardsGoToStorage ? null : spot);
    this.camp = null;
    this.id = null;
    this.chest = null;
    this.groups = [];
    void commands.flush();
    editor.gained();
    editor.tell(`+${prize.gold} gold, +${prize.xp} XP`);
    notice(this.camps.title(id, camp.popup[2]), this.parts.line(camp.popup[3]), null,
      () => notice(this.parts.line(531), "The next camp arrives in 10 minutes. Build your defenses: raiders will attack between missions.", this.parts.pictureUrl(town.race === "t" ? "alert_troll_camp.jpg" : "alert_human_camp.jpg")));
  }

  /** The camp's prizes: units beside the spot, the player's; buildings (or anything with no spot) to storage. */
  private prizes(camp: ScriptedCamp, spot: { x: number; y: number } | null): void {
    const { town, items, commands } = this.parts;
    const ground = this.camps.ground();
    for (const id of camp.prizes) {
      const item = items.get(id);
      if (!item) {
        continue;
      }
      if (item.isUnit && spot) {
        const tile = nearestFree(ground, spot.x - 1, spot.y - 1);
        if (tile) {
          ground.take(tile.x, tile.y, 1, 1);
          this.camps.put({ id, x: tile.x, y: tile.y, unit: true });
          continue;
        }
      }
      commands.add("store_add_items", JSON.stringify([id]));
      town.store.set(id, (town.store.get(id) ?? 0) + 1);
    }
  }

  /** The camp being played (for the browser tests). */
  get playing(): number | null {
    return this.id;
  }

  /** The keys still standing, lit or not (for the browser tests). */
  get keys(): { key: PlacedItem; lit: boolean; guards: number }[] {
    return this.groups.map((g) => ({ key: g.key, lit: g.lit, guards: g.guards.filter((u) => this.parts.town.items.includes(u)).length }));
  }

  /** The bosses (or the wave) still to beat (for the browser tests). */
  get bosses(): PlacedItem[] {
    return this.endersDue ? this.enders.filter((u) => this.parts.town.items.includes(u)) : [];
  }

  get chestOpen(): boolean {
    return this.chestLit;
  }
}

/** The free tile nearest a tile, ring by ring. */
function nearestFree(ground: { free: (x: number, y: number) => boolean }, x: number, y: number): { x: number; y: number } | null {
  for (let ring = 0; ring < 10; ring++) {
    for (let dx = -ring; dx <= ring; dx++) {
      for (let dy = -ring; dy <= ring; dy++) {
        const tx = x + dx;
        const ty = y + dy;
        if (Math.max(Math.abs(dx), Math.abs(dy)) === ring && tx >= 0 && ty >= 0 && tx < 100 && ty < 100 && ground.free(tx, ty)) {
          return { x: tx, y: ty };
        }
      }
    }
  }
  return null;
}
