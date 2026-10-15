// The scripted troll camps in the player's town (CLIENT.md, "Scripted
// camps"), played as the Flash client plays them. The pieces stand in the
// four corners of the map (rules/scripted-camps.json): keys guarded by
// enemy units, a chest, sometimes a wave or a boss. Once a key's guards are
// beaten it lights up; one tap takes it. When the story says, the chest
// lights up; one tap opens it: the level's reward and the next camp.
//
// The old engine (camps 7 and 13) saves nothing of its own: how far a camp
// has got is read from the pieces still standing, as in the original.
//
// Commands, as the Flash client's: a free `buy` for each piece, `sell` ...
// "CLEAN_<camp>" for what the border loses, `collect_new` for a key, `sell`
// ... "ATRZO" for its scenery and "COLQS" for the key itself, `sell` ...
// "TREAS" and `collect_treasure` for the chest.

import type { CampParts, Camps } from "./homeCamps.ts";
import { borderTrolls, campReward, nextCamp, onBorder } from "./rules/camps.ts";
import {
  SCRIPTED_TIPS, guardsBox, oldCampState, scriptedCamp, tilePieces, type ScriptedCamp, type ScriptedTile,
} from "./rules/scripted.ts";
import type { PlacedItem } from "./rules/town.ts";
import { notice } from "./ui/notice.ts";

/** A key and what goes with it: its guards (captured when the camp is read), its scenery. */
interface Group {
  key: PlacedItem;
  guards: PlacedItem[];
  scenery: PlacedItem[];
  lit: boolean;
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
  /** The wave (or bosses) that must fall before the chest opens. */
  private enders: PlacedItem[] = [];
  private endersDue = false;

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
    const town = this.parts.town;
    const chests = town.items.filter((p) => p.item.id === camp.chest).length;
    const keys = town.items.filter((p) => p.item.id === camp.activator).length;
    const total = camp.tiles.filter((t) => t.pieces.some((p) => p[4] === "key")).length;
    const state = oldCampState(chests, keys, total);
    if (state === "none" || state === "error") {
      // Nothing yet (or a muddle): the camp is put up afresh, with its window.
      this.spawn(id, camp);
    }
    this.readBack(camp);
    this.watch();
  }

  /** The border cleared, every tile put down, trolls about the border, and the camp's window. */
  private spawn(id: number, camp: ScriptedCamp): void {
    const { town } = this.parts;
    this.camps.clearBorder(id);
    for (const tile of camp.tiles) {
      this.place(tile);
    }
    for (const troll of borderTrolls(this.camps.enemiesLeft(), town.level, town.race, this.random, this.camps.ground())) {
      this.camps.put(troll);
    }
    const picture = camp.pictures[town.race === "t" ? 1 : 0] ?? camp.pictures[0];
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

  /** Each key with the enemy units standing in its box now (they must all fall), its scenery; the chest; the enders. */
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
      this.groups.push({ key, guards, scenery, lit: false });
    }
    this.chest = town.items.find((p) => p.item.id === camp.chest) ?? null;
    this.chestLit = false;
    this.enders = [];
    this.endersDue = false;
    if (this.groups.length === 0 && this.chest) {
      this.allKeysTaken(camp, false);
    }
  }

  /** Every key taken: the wave comes (camp 13), or the chest lights up. */
  private allKeysTaken(camp: ScriptedCamp, live: boolean): void {
    const town = this.parts.town;
    if (!camp.bossStage) {
      this.chestLit = true;
      return;
    }
    if (live) {
      for (const tile of camp.bossTiles) {
        this.enders.push(...this.place(tile));
      }
    } else {
      // Read back: the units standing where the wave came, of the undead or bosses' kind.
      const spots = new Set(camp.bossTiles.flatMap((t) => t.pieces.map(([, x, y]) => `${x},${y}`)));
      this.enders = town.items.filter((p) => p.item.isUnit && spots.has(`${p.tx},${p.ty}`)
        && (p.item.race === "e" || p.item.subcategory === 85));
    }
    this.endersDue = true;
  }

  /** Every second, and after a fight: keys whose guards are all gone light up; the chest when its turn comes. */
  watch(): void {
    const camp = this.camp;
    if (!camp) {
      return;
    }
    const standing = new Set(this.parts.town.items);
    for (const group of this.groups) {
      if (!group.lit && group.guards.every((g) => !standing.has(g))) {
        group.lit = true;
      }
      this.parts.view.sign(group.key, group.lit ? { kind: "ready", resource: "gold" } : null);
    }
    if (this.endersDue && this.enders.every((u) => !standing.has(u))) {
      this.endersDue = false;
      this.chestLit = true;
    }
    if (this.chest) {
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

  /** A lit key taken: what it pays, its scenery and itself gone; the last brings the wave or lights the chest. */
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
    commands.add("sell", key.tx, key.ty, key.item.id, town.id, 1, "COLQS");
    town.items.splice(town.items.indexOf(key), 1);
    view.remove(key);
    this.groups.splice(this.groups.indexOf(group), 1);
    editor.gained();
    if (key.item.collectXp) {
      editor.tell(`+${key.item.collectXp} XP`);
    }
    if (this.groups.length === 0) {
      this.allKeysTaken(camp, true);
    }
    void commands.flush();
    this.watch();
  }

  /** The chest opened: the level's reward, the end window, the next camp in 4 hours. */
  private open(camp: ScriptedCamp, chest: PlacedItem): void {
    const { town, commands, view, editor, clock } = this.parts;
    const id = this.id!;
    commands.add("sell", chest.tx, chest.ty, chest.item.id, town.id, 0, "TREAS");
    town.items.splice(town.items.indexOf(chest), 1);
    view.remove(chest);
    const prize = campReward(town.level);
    town.gold += prize.gold;
    town.xp += prize.xp;
    const next = nextCamp(id);
    commands.add("collect_treasure", prize.gold, prize.xp, next, 0, 0, town.id);
    this.parts.camp.id = next;
    this.parts.camp.last = clock();
    this.camp = null;
    this.id = null;
    this.chest = null;
    void commands.flush();
    editor.gained();
    editor.tell(`+${prize.gold} gold, +${prize.xp} XP`);
    notice(this.camps.title(id, camp.popup[2]), this.parts.line(camp.popup[3]), null,
      () => notice(this.parts.line(531), this.parts.line(532), this.parts.pictureUrl(town.race === "t" ? "alert_troll_camp.jpg" : "alert_human_camp.jpg")));
  }

  /** Whether a thing is part of the camp being played (for the browser tests). */
  get playing(): number | null {
    return this.id;
  }

  /** The keys still standing, lit or not (for the browser tests). */
  get keys(): { key: PlacedItem; lit: boolean; guards: number }[] {
    return this.groups.map((g) => ({ key: g.key, lit: g.lit, guards: g.guards.filter((u) => this.parts.town.items.includes(u)).length }));
  }

  get chestOpen(): boolean {
    return this.chestLit;
  }
}

/** Whether a tile is in one of the map's corners, where the scripted camps stand. */
export function inCorner(x: number, y: number): boolean {
  return onBorder(x, y) && (x < 20 || x >= 80) && (y < 20 || y >= 80);
}
