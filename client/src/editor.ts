// What happens when the player taps the map: collect from a ready building,
// choose how long a mill works, select a thing to move, turn, store or sell,
// or place what was chosen in the shop. The rules (rules/editing.ts,
// production.ts, levels.ts, shop.ts) change the town and say what to send;
// this ties them to the map, the bar, the shop window and the server.

import type { Command, CommandSender } from "./net/commands.ts";
import type { ItemInfo } from "./rules/config.ts";
import { choices, fits, isTheirs, move, refund, sell, store, turn } from "./rules/editing.ts";
import { tileUnder, type Point } from "./rules/geometry.ts";
import { levelUps, type Level } from "./rules/levels.ts";
import { HURRY_CASH, WORK_TIMES, canHurry, chooseWorkTime, collect, harvest, hurry, workState, type Collected, type Resource } from "./rules/production.ts";
import { buy, describe, obstacle, priceOf, unlock, type Obstacle } from "./rules/shop.ts";
import { placeStored, sellStored, storageChoices, storageRefund, storedItems, type Stored } from "./rules/storage.ts";
import type { PlacedItem, Town } from "./rules/town.ts";
import type { ActionBar } from "./ui/actions.ts";
import { duration } from "./ui/format.ts";
import { showMessage, type Hud } from "./ui/hud.ts";
import { STORAGE, type ShopWindow, type StorageCard } from "./ui/shop.ts";
import type { Camera } from "./view/camera.ts";
import { RESOURCE_COLOURS } from "./view/markers.ts";
import { fireStage } from "./view/fire.ts";
import type { TownView } from "./view/townView.ts";
import { canWalk, isWalkable, tilesUnder, unitMoved, unitPath, walkGrid } from "./rules/walking.ts";
import { DOUBLE_CLICK_MS, MAX_SELECTED, sameKindNear, squareTiles } from "./rules/group.ts";
import { takenTiles } from "./rules/editing.ts";
import { lifeShare } from "./view/selected.ts";
import { Doings } from "./rules/goals.ts";
import type { Effect } from "./sound.ts";
import { CURSORS, ICONS, type IconName } from "./ui/icons.ts";
import { CART, canBeHelped, cartMet, deliver } from "./rules/neighbours.ts";
import { skipLessons } from "./rules/lessons.ts";
import { buyLand, cantBuyLand, landForSale, landPrice, type LandPrice } from "./rules/land.ts";
import { TRAINING_MS, cantTrain, population, payForTraining, trained, trainingPrice, type Price } from "./rules/training.ts";
import { applyVillagers, lineUp, nextInLine, villagers } from "./rules/villagers.ts";
import { caught, homeFor } from "./rules/animals.ts";
import { SUBCAT, canGoInside, canHarvest, freeTileNear, goInside, harvestSeconds, harvested, isResource, letAllOut, letOut, nextResources, regrow, standingTile } from "./rules/work.ts";

/** How long a message stays at the top of the screen, and how many may wait to show. */
const SAY_MS = 2500;
/** A villager's repair: 25 life every 61 frames of the Flash client (30 a second). */
const REPAIR_LIFE = 25;
const REPAIR_MS = (61 * 1000) / 30;
const MOST_WAITING = 3;
/** How long "Captured!" shows over a wild animal just caught, as in the Flash client. */
const CAUGHT_MS = 5000;
const TOWN_HALL = 135;
const GATE = 222;

export interface EditorParts {
  town: Town;
  view: TownView;
  bar: ActionBar;
  commands: CommandSender;
  hud: Hud;
  camera: Camera;
  /** The game's clock: the server's time, in seconds. */
  clock: () => number;
  levels: Level[];
  shop: ShopWindow;
  /** Every item the game knows, by id: what's in storage is named by id. */
  items: Map<number, ItemInfo>;
  /** Told what's waiting, for the menus' red counts: gifts in storage. */
  waiting?: (gifts: number) => void;
  /** An item's picture in the Flash client's windows (a unit to train). */
  thumbnail?: (item: ItemInfo) => string;
  /** Land: the config's prices, and how many neighbours the player has (paying in gold needs some). */
  land?: { prices: LandPrice[]; neighbours: number };
  /** Where what the player does is counted, for the goals. */
  doings?: Doings;
  /** The game's sound effects. */
  sound?: (effect: Effect) => void;
  /** A building's own window, if it has one (the Wizardry Academy's spells): its button on the card. */
  windowOf?: (placed: PlacedItem) => { label: string; run: () => void; icon?: IconName } | null;
  /** Told when the town goes up a level (the welcome-back chest shows from level 4). */
  levelled?: () => void;
}

export class TownEditor {
  private readonly town: Town;
  private readonly view: TownView;
  private readonly bar: ActionBar;
  private readonly commands: CommandSender;
  private readonly hud: Hud;
  private readonly camera: Camera;
  private readonly clock: () => number;
  private readonly levels: Level[];
  private readonly shop: ShopWindow;
  private readonly items: Map<number, ItemInfo>;
  private readonly waiting: (gifts: number) => void;
  private readonly thumbnail: (item: ItemInfo) => string;
  private readonly land: { prices: LandPrice[]; neighbours: number };
  private readonly doings: Doings;
  private readonly sound: (effect: Effect) => void;
  private readonly windowOf: (placed: PlacedItem) => { label: string; run: () => void; icon?: IconName } | null;
  private readonly levelled: () => void;
  /** Buildings ready to collect at the last look: one turning ready makes its sound. */
  private readyBefore = new Set<PlacedItem>();
  /** Buildings training a unit: which, when it's done (the page's clock, ms), and how it was paid. */
  private readonly training = new Map<PlacedItem, { unit: ItemInfo; done: number; price: Price; withCash: boolean }>();
  private selected: PlacedItem | null = null;
  /** Several units selected at once (two or more; `selected` is null then), as with the Flash client's square tool. */
  private group: PlacedItem[] = [];
  /** The square tool: on, the next drag on the map draws a box, wherever it starts. */
  private squareTool = false;
  /** The last thing tapped and when (the page's clock, ms): a second tap on a selected unit soon after is a double click. */
  private lastTap: { placed: PlacedItem; at: number } | null = null;
  private moving: PlacedItem | null = null;
  /** The way the thing being moved faced before (Space turns it; cancelling turns it back). */
  private movingFacing = 0;
  /** The tile the thing being placed or moved was last shown on. */
  private shownAt: Point | null = null;
  /** What was chosen in the shop or storage, while the player places it: see-through, not on the map yet. */
  private building: PlacedItem | null = null;
  /** A raid has the town (homeDefence.ts): no editing until it's over. */
  private paused = false;
  /**
   * A thing tapped, before the editor looks at it (homeCamps.ts: a camp's
   * chest, an enemy to attack): true when it was taken care of. `units`
   * are the player's units selected (one, several, or none).
   */
  onTapItem: (placed: PlacedItem, units: PlacedItem[]) => boolean = () => false;
  /** Villagers repairing a burning building, and their repair's clock. */
  private readonly repairing = new Map<PlacedItem, { building: PlacedItem; timer: ReturnType<typeof setInterval> }>();
  /** Where it comes from: storage (one, then done), or null for the shop (as many as they like). */
  private fromStorage: Stored | null = null;
  /** Messages for the top of the screen: the first shows, the others wait their turn. */
  private sayQueue: string[] = [];
  /** Where the save has each unit that's walked, until the server hears where it stopped. */
  private readonly savedAt = new Map<PlacedItem, Point>();
  /** Trees and rocks being worked: since when (the game's clock), and by whom. */
  private readonly working = new Map<PlacedItem, { since: number; workers: Set<PlacedItem> }>();
  /** Carts waiting to be let in: tapping one asks again. */
  private readonly cartsWaiting = new Map<PlacedItem, () => void>();
  /** What each villager at work is working. */
  private readonly workingOn = new Map<PlacedItem, PlacedItem>();
  /** The tree or rock each villager is walking to, to work it. */
  private readonly headingTo = new Map<PlacedItem, PlacedItem>();
  /** Each villager's line of trees and rocks to work, one after another (rules/villagers.ts). */
  private readonly lines = new Map<PlacedItem, PlacedItem[]>();
  /** Trees and rocks in a line, and whose: they glow while any villager has them. */
  private readonly markedBy = new Map<PlacedItem, Set<PlacedItem>>();

  constructor(parts: EditorParts) {
    ({ town: this.town, view: this.view, bar: this.bar, commands: this.commands, hud: this.hud,
      camera: this.camera, clock: this.clock, levels: this.levels, shop: this.shop, items: this.items } = parts);
    this.waiting = parts.waiting ?? (() => {});
    this.windowOf = parts.windowOf ?? (() => null);
    this.levelled = parts.levelled ?? (() => {});
    this.thumbnail = parts.thumbnail ?? (() => "");
    this.land = parts.land ?? { prices: [], neighbours: 0 };
    this.doings = parts.doings ?? new Doings();
    this.sound = parts.sound ?? (() => {});
    this.camera.onTap = (at, touch) => this.tap(at, touch);
    this.camera.onHover = (at) => this.hover(at);
    this.camera.onPress = (at) => this.startsBox(at);
    this.camera.onBox = (from, to, done) => this.dragBox(from, to, done);
    window.addEventListener("keydown", (e) => {
      if (e.key === " " && (this.building || this.moving)) {
        e.preventDefault();  // not the page scrolling
        this.turnWhilePlacing();
        return;
      }
      if (e.key === " " && !(e.target instanceof HTMLButtonElement || e.target instanceof HTMLInputElement)) {
        // The square tool, as in the Flash client (a button that has the focus keeps Space for itself).
        e.preventDefault();
        this.takeSquareTool();
        return;
      }
      if (e.key === "Escape") {
        if (this.building) {
          this.stopBuilding();
        } else if (this.moving) {
          this.cancelMove();
        } else if (this.squareTool) {
          this.setSquareTool(false);
        } else {
          this.select(null);
        }
      }
    });
    // Buildings finish their work as time goes by: their signs, and the selected one's countdown.
    setInterval(() => this.refresh(), 1000);
    this.refresh();
    // Experience the save already has past the next level (from the classic game, or the server).
    this.levelUp();
    this.hud.update(this.town);
  }

  /** Signs over the buildings (ready, asleep), the selected one's countdown and what's waiting, as of now. */
  refresh(): void {
    const now = this.clock();
    let ready = 0;
    // Villagers' speed and name go with the town hall: built, upgraded or stored since the last look.
    applyVillagers(this.town, this.items);
    const readyNow = new Set<PlacedItem>();
    for (const placed of this.town.items) {
      const state = workState(placed, now);
      if (state === null) {
        continue;
      }
      const resource = placed.item.production!.resource;
      this.view.showState(placed, state.status === "ready");
      if (state.status === "ready") {
        ready++;
        readyNow.add(placed);
        if (!this.readyBefore.has(placed)) {
          this.sound("ready");
        }
      }
      this.view.sign(placed, state.status === "ready" ? { kind: "ready", resource }
        : state.status === "asleep" ? { kind: "asleep" } : null);
    }
    this.hud.ready(ready);
    this.readyBefore = readyNow;
    for (const [building, training] of this.training) {
      if (performance.now() >= training.done) {
        this.finishTraining(building);
      }
    }
    for (const [resource, work] of this.working) {
      if (now - work.since >= harvestSeconds(resource.item, this.town)) {
        this.finishHarvest(resource);
      }
    }
    if (!this.paused) {
      for (const animal of caught(this.town)) {
        this.caught(animal);
      }
    }
    for (const placed of [...this.town.items]) {
      if (placed.item.subcategory === SUBCAT.regrowing) {
        const grown = regrow(this.town, placed, now, this.items);
        if (grown) {
          this.send(grown.commands);
          this.view.remove(placed);
          void this.view.redraw(grown.rock);
        }
      }
    }
    this.waiting([...this.town.gifts.values()].reduce((sum, n) => sum + n, 0));
    if (this.selected && !this.moving) {
      this.bar.describe(this.detail(this.selected));
    }
    // A unit of a group gone from the map (into a building, say): the others stay selected.
    if (this.group.some((unit) => !this.town.items.includes(unit))) {
      this.selectGroup(this.group.filter((unit) => this.town.items.includes(unit)));
    }
  }

  /** The glove: collect every building that's ready, as tapping each would. */
  collectAll(): void {
    const now = this.clock();
    const ready = this.town.items.filter((placed) => workState(placed, now)?.status === "ready");
    for (const placed of ready) {
      this.collect(placed);
    }
  }

  /** Open the shop (or its storage), leaving whatever was going on; pressed again, put it away. */
  openShop(category?: number): void {
    if (this.building) {
      this.stopBuilding();
    }
    if (this.moving) {
      this.cancelMove();
    }
    this.select(null);
    this.shop.toggle(category);
  }

  openStorage(): void {
    this.openShop(STORAGE);
  }

  /** Open a building early, for cash, from the shop. */
  unlock(item: ItemInfo): void {
    const done = unlock(this.town, item);
    if (typeof done === "string") {
      this.say(done);
      return;
    }
    this.send([done]);
    this.hud.update(this.town);
    this.say(`${item.name} is open to you now.`);
  }

  /** What's in storage, as the storage window shows it, with what each card's buttons do. */
  storageCards(): StorageCard[] {
    const people = population(this.town, this.items);
    return storedItems(this.town, this.items).map((stored) => {
      const can = storageChoices(this.town, stored, people.max - people.current);
      const back = storageRefund(stored.item);
      return {
        item: stored.item,
        count: stored.count,
        gift: stored.gift,
        note: can.why,
        place: can.place ? () => this.startPlacingStored(stored) : null,
        sell: can.sell ? {
          label: back ? `Sell for ${back.amount} ${back.resource}` : "Sell for nothing",
          run: () => this.sellFromStorage(stored),
        } : null,
      };
    });
  }

  private sellFromStorage(stored: Stored): void {
    this.send([sellStored(this.town, stored)]);
    this.hud.update(this.town);
    this.shop.refresh();
  }

  /** Place one thing from storage: like building, but one, and it's free. */
  private startPlacingStored(stored: Stored): void {
    this.startBuilding(stored.item, stored);
  }

  /** The player chose something in the shop: place it, as many as they like, until Done. Or one from storage. */
  startBuilding(item: ItemInfo, fromStorage: Stored | null = null): void {
    this.select(null);
    const centre = this.tileAt({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    this.building = { item, tx: centre.x, ty: centre.y, orientation: 0, unitsInside: 0, startedAt: null, workTime: 0 };
    this.fromStorage = fromStorage;
    this.view.showGhost(this.building);
    this.previewBuilding(centre);
    if (fromStorage) {
      this.bar.prompt(`Tap where ${item.name} goes`, [{ label: "Cancel", run: () => this.stopBuilding() }]);
    } else {
      const price = priceOf(item);
      this.bar.prompt(`Tap where ${item.name} goes (${price.amount} ${price.resource} each)`,
        [{ label: "Done", run: () => this.stopBuilding() }]);
    }
  }

  private previewBuilding(tile: Point): void {
    const building = this.building!;
    this.shownAt = tile;
    building.tx = tile.x;
    building.ty = tile.y;
    this.view.moveGhost(tile);
    this.view.showFootprint(building, fits(this.town, building));
  }

  private placeBuilding(tile: Point): void {
    if (this.fromStorage) {
      this.placeFromStorage(this.fromStorage, tile);
      return;
    }
    const item = this.building!.item;
    const bought = buy(this.town, item, tile.x, tile.y, this.clock(), this.building!.orientation);
    if (typeof bought === "string") {
      this.previewBuilding(tile);
      this.say(bought);
      return;
    }
    this.send([bought.command]);
    this.sound("place");
    void this.view.redraw(bought.placed);
    const price = priceOf(item);
    const lines = [{ text: `−${price.amount} ${price.resource}`, colour: RESOURCE_COLOURS[price.resource] }];
    if (item.xp > 0) {
      lines.push({ text: `+${item.xp} XP`, colour: RESOURCE_COLOURS.xp });
    }
    this.view.rise(bought.placed, lines);
    this.levelUp();
    this.hud.update(this.town);
    this.refresh();
    const next = obstacle(this.town, item);
    if (next) {
      this.stopBuilding();
      this.say(noMore(item, next));
    } else {
      this.previewBuilding(tile);  // red now: it's taken
    }
  }

  private placeFromStorage(stored: Stored, tile: Point): void {
    const xpBefore = this.town.xp;
    const people = population(this.town, this.items);
    const done = placeStored(this.town, stored, tile.x, tile.y, this.clock(), this.levels, people.max - people.current,
      this.building!.orientation);
    if (typeof done === "string") {
      this.previewBuilding(tile);
      this.say(done);
      return;
    }
    this.send([done.command]);
    this.sound("place");
    this.doings.placedStored = true;
    void this.view.redraw(done.placed);
    if (this.town.xp > xpBefore) {
      this.view.rise(done.placed, [{ text: `+${this.town.xp - xpBefore} XP`, colour: RESOURCE_COLOURS.xp }]);
      this.levelUp();
    }
    this.hud.update(this.town);  // a unit placed takes room among the people
    this.refresh();
    this.stopBuilding();
  }

  private stopBuilding(): void {
    this.building = null;
    this.fromStorage = null;
    this.view.showGhost(null);
    this.view.showFootprint(null);
    this.bar.hide();
  }

  private tap(at: Point, touch = false): void {
    if (this.paused) {
      return;
    }
    if (this.building) {
      this.placeBuilding(this.tileAt(at));
      return;
    }
    if (this.moving) {
      this.place(this.moving, this.tileAt(at));
      return;
    }
    const placed = this.view.itemAt(at);
    const cart = placed ? this.cartsWaiting.get(placed) : undefined;
    if (cart) {
      cart();  // a neighbour's cart, waiting: ask again
      return;
    }
    if (placed?.item.id === CART) {
      return;  // a cart on its round: only the client has it, so it can't be sent anywhere
    }
    // The square tool works once: the box it drew is done, or this tap was instead.
    this.setSquareTool(false);
    // The player's units selected (one, or a group): what they're sent to do.
    const units = this.sendable();
    if (placed && this.onTapItem(placed, units)) {
      return;
    }
    // A selected unit of theirs tapped again within a second: the double click, its kind near it (rules/group.ts).
    const last = this.lastTap;
    this.lastTap = placed ? { placed, at: performance.now() } : null;
    if (placed && last?.placed === placed && performance.now() - last.at < DOUBLE_CLICK_MS && units.includes(placed)) {
      const kin = sameKindNear(placed, this.town.items.filter((u) => canWalk(this.town, u)));
      if (kin.length > 0) {
        this.lastTap = null;
        this.selectGroup(kin);
        return;
      }
    }
    if (units.length > 0 && placed?.wild) {
      // A wild animal: the units go to it (as near as they can), and so catch it, as in the Flash client.
      let sent = false;
      for (const unit of units) {
        this.clearLine(unit);
        const tile = this.standingTile(unit, placed);
        if (!tile) {
          this.say(`${unit.item.name} can't get to ${placed.item.name}.`);
        } else if (this.walkTo(unit, tile)) {
          sent = true;
        }
      }
      if (sent) {
        this.sound("place");
      }
      return;
    }
    if (units.length > 0 && !placed) {
      if (this.sendTo(units, this.tileAt(at))) {
        this.sound("place");  // the Flash client's sound for units sent off
      }
      return;
    }
    if (!placed) {
      const tile = this.tileAt(at);
      const block = landForSale(this.town, tile.x, tile.y);
      if (block !== null) {
        this.offerLand(block);
        return;
      }
    }
    const repairers = placed ? units.filter((unit) => this.canRepair(unit, placed)) : [];
    if (placed && repairers.length > 0) {
      this.sound("place");
      repairers.forEach((unit) => this.repair(unit, placed));
      return;
    }
    const workers = placed ? units.filter((unit) => canHarvest(unit.item, placed.item)) : [];
    if (placed && workers.length === 1 && units.length === 1) {
      this.lineUp(workers[0], placed, touch);
      return;
    }
    if (placed && workers.length > 0) {
      // Several villagers: each lines it up, and those free set off together, each to a tile of its own beside it.
      workers.forEach((unit, i) => this.lineUp(unit, placed, touch, { first: i === 0 }));
      return;
    }
    const goers = placed ? units.filter((unit) => canGoInside(this.town, unit.item, placed)) : [];
    if (placed && goers.length === 1 && units.length === 1) {
      const unit = goers[0];
      this.clearLine(unit);
      this.sound("place");
      this.showWhatItDoes(unit, placed, touch);
      this.goInto(unit, placed);
      return;
    }
    if (placed && goers.length > 0) {
      // Several: as many as there's room for go in, and the building is selected, as in the Flash client.
      const room = placed.item.capacity - placed.unitsInside;
      goers.slice(0, Math.max(0, room)).forEach((unit) => {
        this.clearLine(unit);
        this.goInto(unit, placed);
      });
      this.sound("place");
      this.showWhatItDoes(goers[0], placed, touch);
      this.select(placed);
      return;
    }
    const state = placed ? workState(placed, this.clock()) : null;
    if (placed && state?.status === "ready") {
      this.collect(placed);
    } else if (placed && state?.status === "asleep") {
      this.askWorkTime(placed);
    } else {
      this.select(placed);
    }
  }

  private hover(at: Point): void {
    if (this.squareTool) {
      return;  // its pointer stays until it's used
    }
    if (this.building || this.moving) {
      this.camera.setCursor("");  // a unit's pointer from before doesn't apply while placing
    }
    if (this.building) {
      this.previewBuilding(this.tileAt(at));
    } else if (this.moving) {
      this.preview(this.moving, this.tileAt(at));
    } else {
      this.pointAt(at);
    }
  }

  /**
   * The mouse over the map with a unit selected: the Flash client's pointer
   * for what the unit would do there, an axe over a tree it can chop, a
   * pickaxe over a rock or gold, a red arrow over a building it can go into,
   * a bucket over a burning building a villager can repair.
   */
  private pointAt(at: Point): void {
    const units = this.sendable();
    const placed = units.length > 0 ? this.view.itemAt(at) : null;
    if (placed && units.some((unit) => this.canRepair(unit, placed))) {
      this.camera.setCursor(CURSORS.repair);
      return;
    }
    const work = placed ? units.map((unit) => workFor(this.town, unit, placed)).find((w) => w !== null) ?? null : null;
    this.camera.setCursor(work ? CURSORS[work] : "");
  }

  /** On a phone (no pointer to show it), the same picture pops up over what the unit was sent to. */
  private showWhatItDoes(unit: PlacedItem, placed: PlacedItem, touch: boolean): void {
    const work = workFor(this.town, unit, placed);
    if (touch && work) {
      this.view.pop(placed, ICONS[work]);
    }
  }

  /** The tile under a point of the screen: where a moved building's front corner goes. */
  private tileAt(at: Point): Point {
    return tileUnder(this.camera.toMap(at));
  }

  /**
   * Where a unit stands to work a thing, go into it or catch it
   * (rules/work.ts): not where another unit is already walking to, so
   * villagers sent together, or one after another, each get a tile of their own.
   */
  private standingTile(unit: PlacedItem, target: PlacedItem): Point | null {
    return standingTile(this.town, unit, target, this.view.destinations(unit));
  }

  /** Whether a unit got to the tile it set off for (not stopped short by something built in its way). */
  private reached(unit: PlacedItem, tile: Point): boolean {
    return unit.tx === tile.x && unit.ty === tile.y;
  }

  /** The player's units selected, to send: the group, or the one selected. */
  private sendable(): PlacedItem[] {
    const chosen = this.group.length > 0 ? this.group : this.selected ? [this.selected] : [];
    return chosen.filter((unit) => this.town.items.includes(unit) && canWalk(this.town, unit));
  }

  /**
   * Several units selected (a box, a double click), at most 20: marked on
   * the map, their portraits on the card. One alone is simply selected.
   */
  private selectGroup(units: PlacedItem[]): void {
    const chosen = units.slice(0, MAX_SELECTED);
    if (chosen.length <= 1) {
      this.select(chosen[0] ?? null);
      return;
    }
    this.camera.setCursor("");
    this.selected = null;
    this.group = chosen;
    this.view.highlight(chosen);
    this.bar.showGroup(chosen.map((unit) => ({ name: unit.item.name, picture: this.thumbnail(unit.item), life: lifeShare(unit) })),
      (i) => this.select(chosen[i]), () => this.select(null));
  }

  /**
   * Units sent to a tile of the ground. One walks to it; several stand in a
   * square grown from it, the i-th on the i-th free tile, as in the Flash
   * client (rules/group.ts). True when any set off.
   */
  private sendTo(units: PlacedItem[], tile: Point): boolean {
    if (units.length === 1) {
      this.clearLine(units[0]);
      return this.walkTo(units[0], tile);
    }
    const grid = walkGrid(this.town);
    if (!isWalkable(grid, tile.x, tile.y)) {
      this.say("They can't get there.");
      return false;
    }
    const taken = takenTiles(this.town);
    for (const unit of units) {
      taken.delete(`${unit.tx},${unit.ty}`);  // their own places are free as they set off
    }
    const tiles = squareTiles(tile, units.length, (t) => isWalkable(grid, t.x, t.y) && !taken.has(`${t.x},${t.y}`));
    let sent = false;
    units.forEach((unit, i) => {
      if (tiles[i]) {
        this.clearLine(unit);
        sent = this.walkTo(unit, tiles[i]) || sent;
      }
    });
    return sent;
  }

  /** The square tool taken up (its button, or Space): nothing selected, and the next drag on the map draws a box. */
  takeSquareTool(): void {
    if (this.paused || this.building || this.moving) {
      return;
    }
    this.doings.selectionToolUsed = true;
    this.select(null);
    this.setSquareTool(true);
  }

  private setSquareTool(on: boolean): void {
    if (this.squareTool === on) {
      return;
    }
    this.squareTool = on;
    this.hud.squareTool(on);
    this.camera.setCursor(on ? CURSORS.square : "");
  }

  /** A press on the map: a drag from one of the player's units (or any, with the square tool on) draws a box, as in the Flash client. */
  private startsBox(at: Point): boolean {
    if (this.paused || this.building || this.moving) {
      return false;
    }
    if (this.squareTool) {
      return true;
    }
    const placed = this.view.itemAt(at);
    return placed !== null && canWalk(this.town, placed);
  }

  /** The box being drawn (screen points), and let go: the player's units in it are selected. */
  private dragBox(from: Point, to: Point, done: boolean): void {
    if (!done) {
      this.view.showBox(this.camera.toMap(from), this.camera.toMap(to));
      return;
    }
    this.view.showBox(null);
    this.setSquareTool(false);
    // A few pixels across is a slip, not a box.
    if (Math.abs(to.x - from.x) <= 3 || Math.abs(to.y - from.y) <= 3) {
      return;
    }
    this.selectGroup(this.view.unitsIn(from, to).filter((unit) => canWalk(this.town, unit)));
  }

  private select(placed: PlacedItem | null): void {
    this.camera.setCursor(this.squareTool ? CURSORS.square : "");  // the unit's pointer was for the one selected before
    this.selected = placed;
    this.group = [];
    this.view.highlight(placed);
    if (!placed) {
      this.bar.hide();
      return;
    }
    const can = choices(this.town, placed);
    const back = refund(placed.item);
    // An open gate can only be shut again, as in the Flash client (its other buttons come back then).
    const shut = !placed.open;
    this.bar.show({
      name: placed.item.name,
      detail: this.detail(placed),
      move: can.move && shut ? () => this.startMove(placed) : null,
      turn: can.turn && shut ? () => this.turn(placed) : null,
      store: can.store && shut ? () => this.store(placed) : null,
      sell: can.sell && shut ? () => this.sell(placed) : null,
      refund: back ? `${back.amount} ${back.resource}` : "",
      letOut: placed.unitsInside > 0 && (placed.units?.length ?? 0) > 0 ? () => this.letOne(placed) : null,
      train: this.trainChoice(placed),
      hurry: choices(this.town, placed).move && canHurry(placed, this.clock()) ? { price: HURRY_CASH, run: () => this.hurry(placed) } : null,
      open: this.gateButton(placed) ?? this.windowOf(placed),
      close: () => this.select(null),
    });
  }

  /** A wall gate of the player's: its button to open it for units to pass, or shut it. */
  private gateButton(placed: PlacedItem): { label: string; icon: IconName; run: () => void } | null {
    if (placed.item.subcategory !== GATE || !isTheirs(this.town, placed.item)) {
      return null;
    }
    return placed.open
      ? { label: "Close door", icon: "close-gate", run: () => this.openGate(placed, false) }
      : { label: "Open door", icon: "open-gate", run: () => this.openGate(placed, true) };
  }

  /**
   * Open a wall gate, so units walk through it, or shut it again. As in the
   * Flash client it isn't saved: gates are shut each time the town opens.
   */
  private openGate(gate: PlacedItem, open: boolean): void {
    gate.open = open;
    void this.view.redraw(gate);
    this.sound("place");
    this.select(gate);
  }

  /** What a thing is doing: "ready in 2 h 13 min". Its work comes first, then why it can't be changed. */
  private detail(placed: PlacedItem): string {
    const training = this.training.get(placed);
    if (training) {
      return `Training ${training.unit.name}… ${duration((training.done - performance.now()) / 1000)}`;
    }
    const state = workState(placed, this.clock());
    switch (state?.status) {
      case "working":
        return `Ready in ${duration(state.secondsLeft)}`;
      case "ready":
        return "Ready: tap it to collect";
      case "asleep":
        return "Tap it to choose how long it works";
      case "idle":
        if (placed.item.production!.kind !== "always") {
          return "No workers inside: select a villager, then tap it";
        }
    }
    if (placed.unitsInside > 0) {
      return `${placed.unitsInside} of ${placed.item.capacity} inside`;
    }
    if (isResource(placed.item) && this.working.has(placed)) {
      const left = harvestSeconds(placed.item, this.town) - (this.clock() - this.working.get(placed)!.since);
      return `Being worked: ${duration(Math.max(left, 0))} left`;
    }
    if (placed.wild) {
      return "In the wild: bring one of your units near to catch it";
    }
    if (placed.item.subcategory === SUBCAT.villager && canWalk(this.town, placed)) {
      return `Tap the ground where it should go, or up to ${villagers(this.town).line} trees or rocks to work`;
    }
    if (canWalk(this.town, placed)) {
      return "Tap the ground where it should go";
    }
    const why = choices(this.town, placed).why;
    return why ? why[0].toUpperCase() + why.slice(1) : "";
  }

  /** Only villagers repair, and only the player's buildings that burn. */
  private canRepair(unit: PlacedItem, building: PlacedItem): boolean {
    return unit.item.subcategory === SUBCAT.villager && !building.item.isUnit && building.health !== undefined
      && building.health < building.item.life;
  }

  /**
   * A villager sent to a burning building: it walks beside it, then puts
   * 25 life back every 61 frames of the Flash client (about 2 seconds)
   * until it's whole, the flames going down as it goes.
   */
  private repair(unit: PlacedItem, building: PlacedItem, tries = 2): void {
    const tile = this.standingTile(unit, building);
    if (!tile) {
      this.say(`${unit.item.name} can't get to ${building.item.name}.`);
      return;
    }
    this.walkTo(unit, tile, () => {
      this.unitStopped(unit);
      if (!this.reached(unit, tile)) {
        if (tries > 1 && building.health !== undefined) {
          this.repair(unit, building, tries - 1);
        }
        return;
      }
      this.view.pose(unit, "PICAR", { x: building.tx, y: building.ty });
      const timer = setInterval(() => {
        if (!this.town.items.includes(unit) || building.health === undefined) {
          this.stopRepair(unit);
          return;
        }
        const before = fireStage(building.health, building.item.life);
        building.health = Math.min(building.item.life, building.health + REPAIR_LIFE);
        this.view.rise(building, [{ text: `+${REPAIR_LIFE}`, colour: 0x6fe36f }]);
        if (building.health >= building.item.life) {
          building.health = undefined;
          building.ruined = undefined;
          this.stopRepair(unit);
          this.say(`${building.item.name} is repaired.`);
        }
        if (fireStage(building.health ?? building.item.life, building.item.life) !== before) {
          void this.view.redraw(building);
          this.hud.update(this.town);
        }
      }, REPAIR_MS);
      this.repairing.set(unit, { building, timer });
    });
  }

  private stopRepair(unit: PlacedItem): void {
    const repair = this.repairing.get(unit);
    if (repair) {
      clearInterval(repair.timer);
      this.repairing.delete(unit);
      this.view.pose(unit, null);
    }
  }

  /**
   * A raid has the town (homeDefence.ts): nothing can be built, moved or
   * collected until it's over, and what the player was doing stops.
   */
  pause(why: string): void {
    if (this.building) {
      this.stopBuilding();
    } else if (this.moving) {
      this.cancelMove();
    }
    this.select(null);
    for (const unit of [...this.repairing.keys()]) {
      this.stopRepair(unit);
    }
    for (const unit of [...this.workingOn.keys()]) {
      this.stopWorking(unit);
    }
    for (const unit of [...this.lines.keys()]) {
      this.clearLine(unit);
    }
    this.headingTo.clear();
    // Walks stop where they are: the fight moves the units now, and a walk left going would finish unseen and undo it.
    for (const unit of this.view.stopWalks()) {
      this.unitStopped(unit);  // the server hears where it got to
    }
    this.paused = true;
    this.bar.prompt(why, []);
  }

  /** The raid is over: the town is the player's again (its units where the fight left them). */
  resume(moved: PlacedItem[]): void {
    this.paused = false;
    this.bar.hide();
    this.camera.onTap = (at, touch) => this.tap(at, touch);
    this.camera.onHover = (at) => this.hover(at);
    for (const unit of moved) {
      const from = this.savedAt.get(unit) ?? null;
      this.savedAt.delete(unit);
      if (from && (from.x !== unit.tx || from.y !== unit.ty)) {
        this.send([unitMoved(this.town, unit, from)]);
      }
    }
    this.refresh();
    this.hud.update(this.town);
  }

  /** Where each unit is saved, before a raid moves them. */
  remember(units: PlacedItem[]): void {
    for (const unit of units) {
      if (!this.savedAt.has(unit)) {
        this.savedAt.set(unit, { x: unit.tx, y: unit.ty });
      }
    }
  }

  /**
   * Someone back on the map from a window (a graveyard, the Altar of
   * Heroes): drawn, the collect sound, what it cost rising over it, and any
   * level reached with its experience.
   */
  arrived(placed: PlacedItem, lines: { text: string; resource: Resource | "xp" }[]): void {
    void this.view.redraw(placed).then(() => this.view.rise(placed, lines.map((l) => ({ text: l.text, colour: RESOURCE_COLOURS[l.resource] }))));
    this.sound("collect");
    this.levelUp();
    this.hud.update(this.town);
    this.refresh();
  }

  /** Gold and experience won in a raid: a level may come with them. */
  gained(): void {
    this.levelUp();
    this.hud.update(this.town);
  }

  /**
   * Send a unit walking to a tile, round what's in the way, as the Flash
   * client does; `then` when it gets there. `work`: the tree or rock it's
   * going to work.
   */
  private walkTo(unit: PlacedItem, tile: Point, then: () => void = () => this.unitStopped(unit), work?: PlacedItem): boolean {
    const from = this.view.headingFor(unit);
    const path = unitPath(this.town, unit, from, tile);
    if (path === null) {
      this.say(`${unit.item.name} can't get there.`);
      return false;
    }
    this.stopWorking(unit);
    this.stopRepair(unit);
    if (work) {
      this.headingTo.set(unit, work);
    } else {
      this.headingTo.delete(unit);
    }
    if (!this.savedAt.has(unit)) {
      this.savedAt.set(unit, { x: unit.tx, y: unit.ty });
    }
    // A unit standing in a building (a gate shut on it) walks out across it.
    const under = tilesUnder(this.town, from);
    this.view.walk(unit, path, (next) => {
      // Something built in the way since it set off: it stops before it. (Its path may cross
      // unbought land when it's on its way back to its own: only buildings count here.)
      if (!unit.item.flying && !under.has(`${next.x},${next.y}`) && !isWalkable(walkGrid(this.town, true), next.x, next.y)) {
        return false;
      }
      unit.tx = next.x;
      unit.ty = next.y;
      return true;
    }, then);
    return true;
  }

  /**
   * A tree or rock tapped with a villager selected: it joins the villager's
   * line and glows, and the villager sets off for it if it isn't busy. The
   * line full, the tree or rock is selected instead, as in the Flash client.
   */
  private lineUp(unit: PlacedItem, resource: PlacedItem, touch: boolean, group?: { first: boolean }): void {
    const line = this.lines.get(unit) ?? [];
    const room = villagers(this.town).line;
    const joined = lineUp(line, resource, room, this.workingOn.has(unit) || this.headingTo.has(unit));
    if (!joined) {
      if (group) {
        return;  // one of several: its line is full, the others go on
      }
      this.say(`${unit.item.name} has ${room} lined up already.`);
      this.select(resource);
      return;
    }
    this.lines.set(unit, line);
    if (joined.marked) {
      this.mark(resource, unit);
    }
    if (!group || group.first) {
      this.sound("place");
      this.showWhatItDoes(unit, resource, touch);
    }
    if (joined.goNow && this.workingOn.get(unit) !== resource && this.headingTo.get(unit) !== resource) {
      this.work(unit, resource);
    }
  }

  /** A tree or rock in a villager's line glows until it's worked, or no villager has it in line. */
  private mark(resource: PlacedItem, unit: PlacedItem): void {
    const by = this.markedBy.get(resource) ?? new Set<PlacedItem>();
    by.add(unit);
    this.markedBy.set(resource, by);
    this.view.lineUp(resource, true);
  }

  /** Off one villager's line (or everyone's, when it's been worked). */
  private unmark(resource: PlacedItem, unit?: PlacedItem): void {
    const by = this.markedBy.get(resource);
    if (!by) {
      return;
    }
    if (unit) {
      by.delete(unit);
    } else {
      by.clear();
    }
    if (by.size === 0) {
      this.markedBy.delete(resource);
      this.view.lineUp(resource, false);
    }
  }

  private dropFromLine(unit: PlacedItem, resource: PlacedItem): void {
    const line = this.lines.get(unit) ?? [];
    if (line.includes(resource)) {
      line.splice(line.indexOf(resource), 1);
      this.unmark(resource, unit);
    }
  }

  /** A villager sent anywhere but to a tree or rock forgets its line, as in the Flash client. */
  private clearLine(unit: PlacedItem): void {
    for (const resource of this.lines.get(unit) ?? []) {
      this.unmark(resource, unit);
    }
    this.lines.delete(unit);
  }

  /**
   * A wild animal one of the player's units came near: theirs now. "Captured!"
   * shows over it, and it walks to the nearest ranch of its kind and in, or
   * with none, beside the town hall, as in the Flash client.
   */
  private caught(animal: PlacedItem): void {
    animal.wild = false;
    this.doings.captured(animal.item);
    this.view.sign(animal, { kind: "caught" });
    setTimeout(() => this.view.sign(animal, null), CAUGHT_MS);
    const home = homeFor(this.town, animal);
    if (home) {
      this.goInto(animal, home);
      return;
    }
    const hall = this.town.items.find((placed) => placed.item.subcategory === TOWN_HALL);
    const tile = hall ? freeTileNear(this.town, hall) : null;
    if (tile) {
      this.walkTo(animal, tile);
    }
  }

  /** A villager sold or stored: it stops whatever it was doing. */
  private letGo(unit: PlacedItem): void {
    this.stopWorking(unit);
    this.clearLine(unit);
    this.headingTo.delete(unit);
  }

  /**
   * A villager done with a tree or rock (worked, or gone before it got
   * there): on to the next in its line; with none left, the nearest of the
   * same kind touching it, and on through those.
   */
  private goOn(unit: PlacedItem, done: PlacedItem): void {
    this.unmark(done, unit);
    const line = this.lines.get(unit) ?? [];
    const free = (placed: PlacedItem) => this.town.items.includes(placed) && !this.working.has(placed);
    for (;;) {
      const { next, dropped } = nextInLine(line, done, free);
      dropped.forEach((placed) => this.unmark(placed, unit));
      if (!next) {
        break;
      }
      if (this.work(unit, next)) {
        return;
      }
      // Out of reach: work() took it off the line; the one after.
    }
    this.lines.delete(unit);
    // The nearest touching it that it can get to (one walled in by others is passed over).
    for (const touching of nextResources(this.town, { x: done.tx, y: done.ty }, done.item.subcategory, (placed) => this.working.has(placed))) {
      if (this.work(unit, touching)) {
        break;
      }
    }
  }

  /**
   * A villager sent to a tree or rock: it walks beside it, then works it
   * until it's done. False when it can't get there. `tries`: stopped short
   * on the way (something built in it), it sets off again once from there.
   */
  private work(unit: PlacedItem, resource: PlacedItem, tries = 2): boolean {
    const tile = this.standingTile(unit, resource);
    if (!tile) {
      this.say(`${unit.item.name} can't get to ${resource.item.name}.`);
    }
    const going = tile !== null && this.walkTo(unit, tile, () => {
      this.headingTo.delete(unit);
      this.unitStopped(unit);
      if (!this.town.items.includes(resource)) {
        this.goOn(unit, resource);  // gone while it walked (another villager finished it)
        return;
      }
      if (!this.reached(unit, tile)) {
        if (tries <= 1 || !this.work(unit, resource, tries - 1)) {
          this.goOn(unit, resource);
        }
        return;
      }
      const work = this.working.get(resource) ?? { since: this.clock(), workers: new Set<PlacedItem>() };
      work.workers.add(unit);
      this.working.set(resource, work);
      this.workingOn.set(unit, resource);
      const tree = resource.item.subcategory === SUBCAT.tree;
      this.view.pose(unit, tree ? "ATAQUE" : "PICAR", { x: resource.tx, y: resource.ty });
      this.sound(tree ? "lumber" : "stone");
      this.refresh();
    }, resource);
    if (!going) {
      this.dropFromLine(unit, resource);
    }
    return going;
  }

  /** A unit leaves the tree or rock it was working; nobody left at it, its work is lost. */
  private stopWorking(unit: PlacedItem): void {
    const resource = this.workingOn.get(unit);
    if (!resource) {
      return;
    }
    this.workingOn.delete(unit);
    this.view.pose(unit, null);
    const work = this.working.get(resource);
    work?.workers.delete(unit);
    if (work && work.workers.size === 0) {
      this.working.delete(resource);
    }
  }

  /** A tree or rock worked to the end: its harvest, a rock growing back, and the villagers on to the next. */
  private finishHarvest(resource: PlacedItem): void {
    const work = this.working.get(resource)!;
    this.working.delete(resource);
    this.unmark(resource);
    if (!this.town.items.includes(resource)) {
      // Removed while being worked (the bulldozer): the villagers just stop.
      for (const unit of work.workers) {
        this.workingOn.delete(unit);
        this.view.pose(unit, null);
      }
      return;
    }
    const done = harvested(this.town, resource, work.workers.size, this.clock(), this.items);
    this.send(done.commands);
    this.doings.collected(resource.item);
    this.view.rise(resource, [
      { text: `+${done.amount} ${done.resource}`, colour: RESOURCE_COLOURS[done.resource] },
      ...(done.xp > 0 ? [{ text: `+${done.xp} XP`, colour: RESOURCE_COLOURS.xp }] : []),
    ]);
    this.view.remove(resource);
    if (this.selected === resource) {
      this.select(null);
    }
    if (done.regrowing) {
      void this.view.redraw(done.regrowing);
    }
    this.levelUp();
    this.hud.update(this.town);
    for (const unit of work.workers) {
      this.workingOn.delete(unit);
      this.view.pose(unit, null);
      this.goOn(unit, resource);
    }
  }

  /** A unit sent into a building: it walks to its door and goes in, if there's still room (stopped short, it tries once more). */
  private goInto(unit: PlacedItem, building: PlacedItem, tries = 2): void {
    const tile = this.standingTile(unit, building);
    if (!tile) {
      this.say(`${unit.item.name} can't get to ${building.item.name}.`);
      return;
    }
    this.walkTo(unit, tile, () => {
      if (!this.town.items.includes(building) || !canGoInside(this.town, unit.item, building)) {
        this.unitStopped(unit);
        return;
      }
      if (!this.reached(unit, tile)) {
        this.unitStopped(unit);
        if (tries > 1) {
          this.goInto(unit, building, tries - 1);
        }
        return;
      }
      const from = this.savedAt.get(unit) ?? { x: unit.tx, y: unit.ty };
      this.savedAt.delete(unit);
      this.send([goInside(this.town, unit, building, from, this.clock())]);
      this.doings.pushedInto(unit.item, building.item);
      this.view.remove(unit);
      if (this.selected === unit) {
        this.select(building);
      }
      this.refresh();
    });
  }

  /** Let one unit out of the selected building, beside it. */
  private letOne(building: PlacedItem): void {
    const out = letOut(this.town, building, this.items);
    if (!out) {
      this.say(`There's no room around ${building.item.name}.`);
      return;
    }
    this.send(out.commands);
    this.doings.letOut(building.item);
    void this.view.redraw(out.unit);
    this.select(building);
    this.refresh();
  }

  /** What the card offers a building that trains a unit (its own, of the player's people): Train, with the price. */
  private trainChoice(building: PlacedItem): NonNullable<Parameters<ActionBar["show"]>[0]["train"]> | null {
    const unit = this.items.get(building.item.trains);
    if (!unit || !unit.isUnit || !choices(this.town, building).move) {
      return null;
    }
    const price = trainingPrice(this.town, unit);
    const label = `${price.amount} ${price.resource}${price.food ? ` + ${price.food} food` : ""}`;
    return {
      unit: unit.name,
      picture: this.thumbnail(unit),
      price: label,
      run: () => this.train(building, unit, false),
      cash: unit.cashCost > 0 ? { price: String(unit.cashCost), run: () => this.train(building, unit, true) } : null,
    };
  }

  /** Train a unit: paid now, out beside the building in 3 seconds, one at a time. */
  private train(building: PlacedItem, unit: ItemInfo, withCash: boolean): void {
    if (this.training.has(building)) {
      this.say(`${building.item.name} is training already.`);
      return;
    }
    const why = cantTrain(this.town, unit, this.items, withCash);
    if (why) {
      this.say(why);
      return;
    }
    const price = payForTraining(this.town, unit, withCash);
    this.training.set(building, { unit, done: performance.now() + TRAINING_MS, price, withCash });
    const lines = withCash ? [{ text: `−${unit.cashCost} cash`, colour: RESOURCE_COLOURS.cash }]
      : [{ text: `−${price.amount} ${price.resource}`, colour: RESOURCE_COLOURS[price.resource] },
        ...(price.food ? [{ text: `−${price.food} food`, colour: RESOURCE_COLOURS.food }] : [])];
    if (unit.xp > 0) {
      lines.push({ text: `+${unit.xp} XP`, colour: RESOURCE_COLOURS.xp });
    }
    this.view.rise(building, lines);
    this.levelUp();
    this.hud.update(this.town);
    this.refresh();
    setTimeout(() => this.refresh(), TRAINING_MS + 50);
  }

  private finishTraining(building: PlacedItem): void {
    const training = this.training.get(building)!;
    this.training.delete(building);
    if (!this.town.items.includes(building)) {
      return;  // sold or stored meanwhile: the Flash client loses it too
    }
    const done = trained(this.town, building, training.unit, training.price, training.withCash);
    if (!done) {
      this.say(`No room around ${building.item.name} for ${training.unit.name}.`);
      return;
    }
    this.send([done.command]);
    this.sound("place");
    this.doings.trained(training.unit, building.item);
    void this.view.redraw(done.placed);
    this.hud.update(this.town);
    if (this.selected === building) {
      this.select(building);
    }
  }

  /** Before a building is sold or stored, everybody inside comes out, as in the Flash client. */
  private emptyOut(building: PlacedItem): void {
    for (const out of letAllOut(this.town, building, this.items)) {
      this.send(out.commands);
      void this.view.redraw(out.unit);
    }
  }

  /** A unit stopped walking: the server hears where, as the Flash client tells it. */
  private unitStopped(unit: PlacedItem): void {
    const from = this.savedAt.get(unit);
    if (from && (from.x !== unit.tx || from.y !== unit.ty)) {
      this.send([unitMoved(this.town, unit, from)]);
      this.savedAt.set(unit, { x: unit.tx, y: unit.ty });
    }
  }

  private collect(placed: PlacedItem): void {
    this.collected(placed, collect(this.town, placed, this.clock()));
  }

  /** Finish a building's work now, for cash, and collect it. */
  private hurry(placed: PlacedItem): void {
    const cashBefore = this.town.cash;
    this.collected(placed, hurry(this.town, placed, this.clock()));
    if (this.town.cash < cashBefore) {
      this.view.rise(placed, [{ text: `−${cashBefore - this.town.cash} cash`, colour: RESOURCE_COLOURS.cash }]);
      this.select(placed);
    }
  }

  /** Land for sale tapped: what it costs, in gold (with enough neighbours) or cash. */
  private offerLand(block: number): void {
    this.select(null);
    const price = landPrice(this.town, this.land.prices);
    if (!price) {
      return;
    }
    const gold = new Intl.NumberFormat("en-US").format(price.coins);
    this.bar.prompt(`Land for sale: ${gold} gold (with ${price.neighbors} neighbour${price.neighbors > 1 ? "s" : ""}) or ${price.cash} cash`, [
      { label: `Buy for ${gold} gold`, run: () => this.buyLand(block, false) },
      { label: `Buy for ${price.cash} cash`, run: () => this.buyLand(block, true) },
      { label: "Cancel", run: () => this.bar.hide() },
    ]);
  }

  private buyLand(block: number, withCash: boolean): void {
    const price = landPrice(this.town, this.land.prices);
    if (!price) {
      return;
    }
    const why = cantBuyLand(this.town, price, withCash, this.land.neighbours);
    if (why) {
      this.say(why);
      return;
    }
    this.send([buyLand(this.town, block, price, withCash)]);
    this.bar.hide();
    this.hud.update(this.town);
    void this.view.redrawGround();
    this.say("The land is yours.");
  }

  private collected(placed: PlacedItem, done: Collected | string): void {
    if (typeof done === "string") {
      this.say(done);
      return;
    }
    this.doings.collected(placed.item);
    this.send(done.commands);
    this.sound("collect");
    const lines = [{ text: `+${done.amount} ${done.resource}`, colour: RESOURCE_COLOURS[done.resource] }];
    if (done.xp > 0) {
      lines.push({ text: `+${done.xp} XP`, colour: RESOURCE_COLOURS.xp });
    }
    if (done.wood > 0) {
      lines.push({ text: `−${done.wood} wood`, colour: RESOURCE_COLOURS.wood });
    }
    if (done.usedUp !== undefined) {
      // The animal the harvest used up (the Flash client shows it flying off).
      lines.push({ text: `−1 ${this.items.get(done.usedUp)?.name ?? "animal"}`, colour: 0xffffff });
    }
    this.view.rise(placed, lines);
    this.levelUp();
    this.hud.update(this.town);
    this.refresh();
  }

  /** Experience gained: go up any levels reached, as the Flash client does, and say so. */
  private levelUp(): void {
    const { commands, reached } = levelUps(this.town, this.levels);
    this.send(commands);
    const last = reached.at(-1);
    if (last) {
      this.sound("level-up");
      const prizes = reached.filter((r) => r.prize).map((r) => `${r.prize!.amount} ${r.prize!.resource}`);
      this.say(`Level ${last.level}: ${last.name}!${prizes.length ? ` You get ${prizes.join(", ")}.` : ""}`);
      this.levelled();
    }
  }

  /** A mill or mine whose workers wait: how long should they work? */
  private askWorkTime(placed: PlacedItem): void {
    this.selected = null;
    this.view.highlight(placed);
    const resource = placed.item.production!.resource;
    this.bar.prompt(`How long should ${placed.item.name} work?`, [
      ...WORK_TIMES.map((time, i) => ({
        label: `${duration(time.minutes * 60)}: ${harvest(placed, i + 1)} ${resource}`,
        run: () => this.chooseWorkTime(placed, i + 1),
      })),
      ...((placed.units?.length ?? 0) > 0 ? [{ label: "Let out", run: () => this.letOne(placed) }] : []),
      { label: "Cancel", run: () => this.select(null) },
    ]);
  }

  private chooseWorkTime(placed: PlacedItem, choice: number): void {
    this.send([chooseWorkTime(this.town, placed, choice, this.clock())]);
    this.doings.workTime(placed.item, WORK_TIMES[choice - 1].minutes);
    this.view.rise(placed, [{ text: `Working ${duration(WORK_TIMES[choice - 1].minutes * 60)}`, colour: 0xffffff }]);
    this.select(null);
    this.refresh();
  }

  private startMove(placed: PlacedItem): void {
    this.moving = placed;
    this.movingFacing = placed.orientation;
    this.view.setGhost(placed, true);
    this.bar.prompt(`Tap where ${placed.item.name} goes`, [{ label: "Cancel", run: () => this.cancelMove() }]);
  }

  private preview(placed: PlacedItem, tile: Point): void {
    this.shownAt = tile;
    const spot = { ...placed, tx: tile.x, ty: tile.y };
    this.view.showFootprint(spot, fits(this.town, spot, placed));
    this.view.offset(placed, tile);
  }

  private place(placed: PlacedItem, tile: Point): void {
    const command = move(this.town, placed, tile.x, tile.y);
    if (command === null) {
      this.preview(placed, tile);
      this.bar.prompt(`${placed.item.name} doesn't fit there`, [{ label: "Cancel", run: () => this.cancelMove() }]);
      return;
    }
    this.send([command]);
    this.doings.moved(placed.item);
    this.endMove(placed);
  }

  private cancelMove(): void {
    if (this.moving) {
      this.moving.orientation = this.movingFacing;  // turned with Space meanwhile: back as it was
      this.endMove(this.moving);
    }
  }

  /**
   * Space while placing or moving a building turns it to face its next way,
   * as in the Flash client; it's bought, placed or moved facing that way.
   */
  private turnWhilePlacing(): void {
    const thing = this.building ?? this.moving!;
    if (thing.item.isUnit || thing.item.facings < 2) {
      return;
    }
    thing.orientation = (thing.orientation + 1) % thing.item.facings;
    const at = this.shownAt ?? { x: thing.tx, y: thing.ty };
    if (this.building) {
      this.view.showGhost(this.building);
      this.previewBuilding(at);
    } else {
      const moving = this.moving!;
      void this.view.redraw(moving).then(() => {
        if (this.moving === moving) {
          this.preview(moving, at);
        }
      });
    }
  }

  private endMove(placed: PlacedItem): void {
    this.moving = null;
    this.view.showFootprint(null);
    this.view.setGhost(placed, false);
    void this.view.redraw(placed);
    this.select(placed);
  }

  private turn(placed: PlacedItem): void {
    this.send([turn(this.town, placed)]);
    void this.view.redraw(placed);
  }

  private sell(placed: PlacedItem): void {
    this.letGo(placed);
    // What comes back rises from it, as in the Flash client.
    const back = refund(placed.item);
    if (back) {
      this.view.rise(placed, [{ text: `+${back.amount} ${back.resource}`, colour: RESOURCE_COLOURS[back.resource as keyof typeof RESOURCE_COLOURS] }]);
    }
    this.emptyOut(placed);
    this.send([sell(this.town, placed)]);
    this.view.remove(placed);
    this.hud.update(this.town);
    this.select(null);
  }

  private store(placed: PlacedItem): void {
    this.letGo(placed);
    this.emptyOut(placed);
    this.send([store(this.town, placed)]);
    this.doings.stored(placed.item);
    this.view.remove(placed);
    this.select(null);
    this.say(`${placed.item.name} is in your storage.`);
  }

  private send(commands: Command[]): void {
    for (const command of commands) {
      this.commands.add(command.cmd, ...command.args);
    }
  }

  /**
   * Arthur's lessons not started: the Flash client would give them now. They
   * are in the classic game for now, on this same empire; or they can be
   * skipped, as if finished. Asked again on each visit until answered.
   */
  /**
   * The server's message for the player as the town opens (a neighbour helped,
   * a gift came: a line each), as the Flash client shows it: once, until OK,
   * which tells the server it's read (`clear_message`). Then `next`.
   */
  showServerMessage(message: string, next: () => void): void {
    this.bar.prompt(message, [{ label: "OK", run: () => {
      this.bar.hide();
      this.send([{ cmd: "clear_message", args: [] }]);
      next();
    } }]);
  }

  offerLessons(classicUrl: string): void {
    this.bar.prompt("Arthur teaches the first steps: a villager, a farm, a house, a knight and a first battle. "
      + "His lessons are in the classic game for now.", [
      { label: "Take the lessons", run: () => {
        this.bar.hide();
        void this.commands.flush().finally(() => location.assign(classicUrl));
      } },
      { label: "Skip them", run: () => {
        this.bar.hide();
        this.send([skipLessons()]);
        void this.commands.flush();  // at once: the classic game reads it too
        this.say("Lessons skipped. Your empire awaits!");
      } },
    ]);
  }

  /**
   * The donkey carts that bring neighbours' help, one after another, as the
   * Flash client shows them: each asks to be let in, then goes from building
   * to building helped, bringing each its share.
   */
  welcomeCarts(list: { helper: string; buildings: { x: number; y: number; id: number }[] }[], nameOf: (pid: string) => string): void {
    const [cart, ...rest] = list;
    const item = this.items.get(CART);
    if (!cart || !item) {
      return;
    }
    const tile = freeTileNear(this.town, { tx: 50, ty: 50 } as PlacedItem);
    if (!tile) {
      return;
    }
    const unit: PlacedItem = { item, tx: tile.x, ty: tile.y, orientation: 0, unitsInside: 0, units: [], startedAt: null, workTime: 0 };
    this.town.items.push(unit);
    void this.view.redraw(unit);
    const gone = () => {
      this.view.remove(unit);
      this.town.items.splice(this.town.items.indexOf(unit), 1);
      this.welcomeCarts(rest, nameOf);
    };
    const count = cart.buildings.length;
    const ask = () => this.bar.prompt(`${nameOf(cart.helper)} helped you: their cart brings a share for ${count} building${count > 1 ? "s" : ""}.`, [
      { label: "Let it in", run: () => {
        this.cartsWaiting.delete(unit);
        this.bar.hide();
        this.send([cartMet(this.town, cart.helper)]);
        this.cartRound(unit, [...cart.buildings], gone);
      } },
      { label: "No thanks", run: () => {
        this.cartsWaiting.delete(unit);
        this.bar.hide();
        this.send([cartMet(this.town, cart.helper)]);
        gone();
      } },
    ]);
    this.cartsWaiting.set(unit, ask);
    ask();
  }

  /** The cart goes to the next building helped and brings it its share; then the one after. */
  private cartRound(cart: PlacedItem, left: { x: number; y: number; id: number }[], done: () => void): void {
    const next = left.shift();
    if (!next) {
      done();
      return;
    }
    const building = this.town.items.find((p) => p.item.id === next.id && p.tx === next.x && p.ty === next.y);
    const tile = building && canBeHelped(building.item) ? standingTile(this.town, cart, building) : null;
    if (!building || !tile) {
      this.cartRound(cart, left, done);  // gone, or out of reach: on to the next
      return;
    }
    const walking = this.walkTo(cart, tile, () => {
      const brought = deliver(this.town, building);
      this.send([brought.command]);
      this.view.rise(building, [
        { text: `+${brought.amount} ${brought.resource}`, colour: RESOURCE_COLOURS[brought.resource] },
        { text: `+${brought.xp} XP`, colour: RESOURCE_COLOURS.xp },
      ]);
      this.levelUp();
      this.hud.update(this.town);
      this.cartRound(cart, left, done);
    });
    if (!walking) {
      this.cartRound(cart, left, done);
    }
  }

  /** A message for the player, at the top of the screen (the goals and bonuses use it too). */
  tell(text: string): void {
    this.say(text);
  }

  /** A message at the top of the screen for a moment, after any before it (the same one twice waits once). */
  private say(text: string): void {
    if (this.sayQueue.includes(text) || this.sayQueue.length >= MOST_WAITING) {
      return;
    }
    this.sayQueue.push(text);
    if (this.sayQueue.length === 1) {
      this.sayNext();
    }
  }

  private sayNext(): void {
    const text = this.sayQueue[0];
    if (text === undefined) {
      return;
    }
    showMessage(text);
    setTimeout(() => {
      this.sayQueue.shift();
      showMessage("");
      this.sayNext();
    }, SAY_MS);
  }
}

/** Why placing stopped after the last one: "Not enough wood for another Farm Land." */
function noMore(item: ItemInfo, why: Obstacle): string {
  switch (why.kind) {
    case "price":
      return `Not enough ${why.price.resource} for another ${item.name}.`;
    case "limit":
      return `That's as many ${item.name} as a town can have.`;
    case "level":
      return `${item.name}: ${describe(why).toLowerCase()}.`;
  }
}

/** What a unit would do to a thing on the map, as the Flash client's pointers show it, or null. */
function workFor(town: Town, unit: PlacedItem, placed: PlacedItem): "axe" | "pick" | "inside" | null {
  if (canHarvest(unit.item, placed.item)) {
    return placed.item.subcategory === SUBCAT.tree ? "axe" : "pick";
  }
  return canGoInside(town, unit.item, placed) ? "inside" : null;
}
