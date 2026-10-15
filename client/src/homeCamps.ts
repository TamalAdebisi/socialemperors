// The troll camps in the player's town (CLIENT.md, "Troll camps"): when
// one is due (4 hours after the last chest), the border is cleared and the
// camp put up (rules/camps.ts), with trolls about the border, and the game's
// window tells its story. Its chest (or prison) lights up once no enemy unit
// is left on the map; one tap opens it: the prize, the prisoners, and the
// next camp 4 hours later. Sending units at the camp makes the town a
// battlefield (homeDefence.ts) until the fighting stops.
//
// The commands are the Flash client's: `sell` ... "CLEAN_<camp>" for what
// the border loses, a free `buy` for every piece, `sell` ... "TREAS" and
// `collect_treasure` for the chest, a free `buy` for each prisoner freed.

import type { CommandSender } from "./net/commands.ts";
import {
  BUILT_HERE, borderTrolls, campDue, campOfChest, campReward, campTexts, correctCamp, freedUnits, isChest, nextCamp, onBorder,
  planCamp, sideAtHome, type CampPiece, type Ground,
} from "./rules/camps.ts";
import type { Battle, Fighter } from "./rules/battle.ts";
import type { ItemInfo } from "./rules/config.ts";
import { takenTiles } from "./rules/editing.ts";
import type { PlacedItem, Town } from "./rules/town.ts";
import { unitMoved } from "./rules/walking.ts";
import { freeTileNear } from "./rules/work.ts";
import type { TownEditor } from "./editor.ts";
import { notice } from "./ui/notice.ts";
import { ScriptedCamps } from "./homeScripted.ts";
import { scriptedHere } from "./rules/scripted.ts";
import type { TownView } from "./view/townView.ts";

const TOWN_HALL = 135;

export interface CampParts {
  town: Town;
  items: Map<number, ItemInfo>;
  commands: CommandSender;
  view: TownView;
  editor: TownEditor;
  /** The game's clock (the server's time, seconds). */
  clock: () => number;
  /** The save's camp: which comes next, when the last chest was opened, and a scripted camp's saved progress. */
  camp: { id: number; last: number; vars?: Record<string, unknown> };
  /** The game's words by localisation id, and where the windows' pictures are. */
  line: (id: number) => string;
  pictureUrl: (name: string) => string;
  /** Units sent at an enemy: the town becomes a battlefield. */
  engage: (units: PlacedItem[], target: PlacedItem) => void;
  /** During a fight: the fighter standing for a thing of the town, and the battle. */
  fighterOf?: (placed: PlacedItem) => Fighter | null;
  battle?: () => Battle | null;
  random?: () => number;
}

export class Camps {
  private readonly parts: CampParts;
  private readonly random: () => number;
  private ready = false;
  private shown: PlacedItem | null = null;
  /** The scripted camps (homeScripted.ts): stories with keys, waves and bosses. */
  readonly scripted: ScriptedCamps;

  constructor(parts: CampParts) {
    this.parts = parts;
    this.random = parts.random ?? Math.random;
    this.scripted = new ScriptedCamps(parts, this, this.random);
    parts.editor.onTapItem = (placed, units) => this.tap(placed, units);
  }

  /** Whose a thing in town is (the side the original gives it on load). */
  sideOf(placed: PlacedItem): "self" | "enemy" | "nobody" {
    return placed.nobodys ? "nobody" : sideAtHome(this.parts.town.race, placed.item, placed.tx, placed.ty);
  }

  /** The enemy units left anywhere in town. */
  enemiesLeft(): number {
    return this.parts.town.items.filter((p) => p.item.isUnit && this.sideOf(p) === "enemy").length;
  }

  /**
   * The chest of a camp built here. A scripted camp's chest (the classic
   * game puts those up) opens by its own story, not when the enemies are
   * gone, so it's left alone (DECISIONS.md, "Troll camps").
   */
  private chest(): PlacedItem | null {
    return this.parts.town.items.find((p) => isChest(p.item) && campOfChest(p.item.id) !== null) ?? null;
  }

  /**
   * The town opened: a camp due comes now. As in the original, a camp
   * still standing is put up afresh, somewhere else, each time the game
   * starts (DECISIONS.md, "Troll camps").
   */
  arrive(): void {
    const { town, commands, camp, clock } = this.parts;
    if (!campDue(camp.last, clock())) {
      return;
    }
    const id = correctCamp(camp.id, town.race);
    if (id !== camp.id) {
      // A camp this race doesn't get: on to one it does, as the original moves it.
      commands.add("collect_treasure", 0, 0, id, 0, 0, town.id);
      camp.id = id;
    }
    if (scriptedHere(id, town.race)) {
      this.scripted.arrive(id);
      return;
    }
    if (!BUILT_HERE.has(id)) {
      return;  // a story camp not yet played here: the classic game puts it up
    }
    this.spawn(id);
  }

  /** The border cleared for a camp: the player's units there walk home, the rest goes. */
  clearBorder(id: number, where: (x: number, y: number) => boolean = onBorder): void {
    const { town, commands, view } = this.parts;
    const hall = town.items.find((p) => p.item.subcategory === TOWN_HALL && this.sideOf(p) === "self");
    for (const placed of [...town.items]) {
      if (!where(placed.tx, placed.ty)) {
        continue;
      }
      if (placed.item.isUnit && this.sideOf(placed) === "self") {
        const tile = hall ? freeTileNear(town, hall) : null;
        if (tile) {
          const from = { x: placed.tx, y: placed.ty };
          placed.tx = tile.x;
          placed.ty = tile.y;
          const moved = unitMoved(town, placed, from);
          commands.add(moved.cmd, ...moved.args);
          void view.redraw(placed);
        }
        continue;
      }
      commands.add("sell", placed.tx, placed.ty, placed.item.id, town.id, 1, `CLEAN_${id}`);
      town.items.splice(town.items.indexOf(placed), 1);
      view.remove(placed);
    }
  }

  /** The border cleared, the camp put up, trolls about the border, and the camp's window. */
  private spawn(id: number): void {
    const { town, items } = this.parts;
    this.clearBorder(id);
    const ground = this.ground();
    const size = (pieceId: number): [number, number] => {
      const item = items.get(pieceId);
      return item ? [item.width, item.height] : [1, 1];
    };
    const plan = planCamp(id, town.level, town.race, this.random, ground, size);
    if (!plan) {
      return;
    }
    for (const piece of plan.pieces) {
      this.put(piece);
    }
    for (const troll of borderTrolls(this.enemiesLeft(), town.level, town.race, this.random, ground)) {
      this.put(troll);
    }
    const texts = campTexts(id, town.race);
    if (texts) {
      notice(this.title(id, texts.start[0]), this.parts.line(texts.start[1]), this.parts.pictureUrl(texts.picture));
    }
    this.watch();
  }

  /** "Quest 4 : The treasure village", as the game titles a camp's window. */
  title(id: number, title: number): string {
    return `${this.parts.line(1044).replace("#0#", String(id + 1))} : ${this.parts.line(title)}`;
  }

  /** A piece on the map, saved with a free buy as the Flash client saves it. */
  put(piece: CampPiece): PlacedItem | null {
    const { town, items, commands, view } = this.parts;
    const item = items.get(piece.id);
    if (!item) {
      return null;
    }
    const placed: PlacedItem = { item, tx: piece.x, ty: piece.y, orientation: 0, unitsInside: 0, units: [], startedAt: null, workTime: 0 };
    town.items.push(placed);
    commands.add("buy", piece.id, piece.x, piece.y, 0, town.id, 1, 1, piece.unit ? "u" : "b");
    void view.redraw(placed);
    return placed;
  }

  /** The map's taken tiles, for putting pieces on free ones. */
  ground(): Ground {
    const taken = takenTiles(this.parts.town);
    return {
      free: (x, y) => !taken.has(`${x},${y}`),
      take: (x, y, w, h) => {
        for (let dx = 0; dx < w; dx++) {
          for (let dy = 0; dy < h; dy++) {
            taken.add(`${x - dx},${y - dy}`);
          }
        }
      },
    };
  }

  /** Every second: the chest lights up once no enemy unit is left. */
  watch(): void {
    this.scripted.watch();
    const chest = this.chest();
    this.ready = chest !== null && this.enemiesLeft() === 0;
    if (this.shown && this.shown !== chest) {
      this.parts.view.sign(this.shown, null);
    }
    this.shown = chest;
    if (chest) {
      this.parts.view.sign(chest, this.ready ? { kind: "ready", resource: "gold" } : null);
    }
  }

  /** A tap: the chest, or an enemy with a unit of the player's selected. */
  private tap(placed: PlacedItem, units: PlacedItem[]): boolean {
    if (this.scripted.tap(placed)) {
      return true;
    }
    if (isChest(placed.item) && placed === this.chest()) {
      this.watch();
      if (this.ready) {
        this.open(placed);
      } else {
        const left = this.enemiesLeft();
        const tip = campTexts(campOfChest(placed.item.id) ?? 3, this.parts.town.race)?.tip;
        this.parts.editor.tell(`${tip ? `${this.parts.line(tip)} ` : ""}${left} ${left === 1 ? "enemy" : "enemies"} left.`);
      }
      return true;
    }
    // Those selected that can fight attack it together, as in the Flash client.
    const fighters = units.filter((unit) => unit.item.attack > 0);
    if (fighters.length > 0 && this.sideOf(placed) === "enemy") {
      this.parts.engage(fighters, placed);
      return true;
    }
    return false;
  }

  /** The chest opened: the prize, the prisoners, and the next camp in 4 hours. */
  private open(chest: PlacedItem): void {
    const { town, commands, view, editor, camp, clock } = this.parts;
    const finished = campOfChest(chest.item.id) ?? camp.id;
    commands.add("sell", chest.tx, chest.ty, chest.item.id, town.id, 0, "TREAS");
    town.items.splice(town.items.indexOf(chest), 1);
    view.remove(chest);
    this.shown = null;
    const prize = campReward(town.level);
    town.gold += prize.gold;
    town.xp += prize.xp;
    const next = nextCamp(finished);
    commands.add("collect_treasure", prize.gold, prize.xp, next, 0, 0, town.id);
    camp.id = next;
    camp.last = clock();
    for (const unit of freedUnits(finished, town.race, { x: chest.tx, y: chest.ty }, this.random, this.ground())) {
      this.put(unit);
    }
    void commands.flush();
    editor.gained();
    editor.tell(`+${prize.gold} gold, +${prize.xp} XP`);
    const texts = campTexts(finished, town.race);
    if (texts) {
      notice(this.title(finished, texts.end[0]), this.parts.line(texts.end[1]), null,
        () => notice(this.parts.line(531), this.parts.line(532), this.parts.pictureUrl(town.race === "t" ? "alert_troll_camp.jpg" : "alert_human_camp.jpg")));
    }
  }
}
