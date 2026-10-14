// What happens when the player taps the map: collect from a ready building,
// choose how long a mill works, select a thing to move, turn, store or sell,
// or place what was chosen in the shop. The rules (rules/editing.ts,
// production.ts, levels.ts, shop.ts) change the town and say what to send;
// this ties them to the map, the bar, the shop window and the server.

import type { Command, CommandSender } from "./net/commands.ts";
import type { ItemInfo } from "./rules/config.ts";
import { choices, fits, move, refund, sell, store, turn } from "./rules/editing.ts";
import { tileUnder, type Point } from "./rules/geometry.ts";
import { levelUps, type Level } from "./rules/levels.ts";
import { WORK_TIMES, chooseWorkTime, collect, harvest, workState } from "./rules/production.ts";
import { buy, describe, obstacle, priceOf, type Obstacle } from "./rules/shop.ts";
import { placeStored, sellStored, storageChoices, storageRefund, storedItems, type Stored } from "./rules/storage.ts";
import type { PlacedItem, Town } from "./rules/town.ts";
import type { ActionBar } from "./ui/actions.ts";
import { duration } from "./ui/format.ts";
import { showMessage, type Hud } from "./ui/hud.ts";
import { STORAGE, type ShopWindow, type StorageCard } from "./ui/shop.ts";
import type { Camera } from "./view/camera.ts";
import { RESOURCE_COLOURS } from "./view/markers.ts";
import type { TownView } from "./view/townView.ts";
import { canWalk, findPath, isWalkable, unitMoved, walkGrid } from "./rules/walking.ts";
import { SUBCAT, canGoInside, canHarvest, goInside, harvestSeconds, harvested, isResource, letAllOut, letOut, nextResources, regrow, standingTile } from "./rules/work.ts";

/** How long a message stays at the top of the screen, and how many may wait to show. */
const SAY_MS = 2500;
const MOST_WAITING = 3;

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
  private selected: PlacedItem | null = null;
  private moving: PlacedItem | null = null;
  /** What was chosen in the shop or storage, while the player places it: see-through, not on the map yet. */
  private building: PlacedItem | null = null;
  /** Where it comes from: storage (one, then done), or null for the shop (as many as they like). */
  private fromStorage: Stored | null = null;
  /** Messages for the top of the screen: the first shows, the others wait their turn. */
  private sayQueue: string[] = [];
  /** Where the save has each unit that's walked, until the server hears where it stopped. */
  private readonly savedAt = new Map<PlacedItem, Point>();
  /** Trees and rocks being worked: since when (the game's clock), and by whom. */
  private readonly working = new Map<PlacedItem, { since: number; workers: Set<PlacedItem> }>();
  /** What each villager at work is working. */
  private readonly workingOn = new Map<PlacedItem, PlacedItem>();

  constructor(parts: EditorParts) {
    ({ town: this.town, view: this.view, bar: this.bar, commands: this.commands, hud: this.hud,
      camera: this.camera, clock: this.clock, levels: this.levels, shop: this.shop, items: this.items } = parts);
    this.waiting = parts.waiting ?? (() => {});
    this.camera.onTap = (at) => this.tap(at);
    this.camera.onHover = (at) => this.hover(at);
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (this.building) {
          this.stopBuilding();
        } else if (this.moving) {
          this.cancelMove();
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
    for (const placed of this.town.items) {
      const state = workState(placed, now);
      if (state === null) {
        continue;
      }
      const resource = placed.item.production!.resource;
      ready += state.status === "ready" ? 1 : 0;
      this.view.sign(placed, state.status === "ready" ? { kind: "ready", resource }
        : state.status === "asleep" ? { kind: "asleep" } : null);
    }
    this.hud.ready(ready);
    for (const [resource, work] of this.working) {
      if (now - work.since >= harvestSeconds(resource.item)) {
        this.finishHarvest(resource);
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

  /** What's in storage, as the storage window shows it, with what each card's buttons do. */
  storageCards(): StorageCard[] {
    return storedItems(this.town, this.items).map((stored) => {
      const can = storageChoices(this.town, stored);
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
    const bought = buy(this.town, item, tile.x, tile.y, this.clock());
    if (typeof bought === "string") {
      this.previewBuilding(tile);
      this.say(bought);
      return;
    }
    this.send([bought.command]);
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
    const done = placeStored(this.town, stored, tile.x, tile.y, this.clock(), this.levels);
    if (typeof done === "string") {
      this.previewBuilding(tile);
      this.say(done);
      return;
    }
    this.send([done.command]);
    void this.view.redraw(done.placed);
    if (this.town.xp > xpBefore) {
      this.view.rise(done.placed, [{ text: `+${this.town.xp - xpBefore} XP`, colour: RESOURCE_COLOURS.xp }]);
      this.levelUp();
      this.hud.update(this.town);
    }
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

  private tap(at: Point): void {
    if (this.building) {
      this.placeBuilding(this.tileAt(at));
      return;
    }
    if (this.moving) {
      this.place(this.moving, this.tileAt(at));
      return;
    }
    const placed = this.view.itemAt(at);
    // A unit of theirs selected: the ground tapped, it walks there; a tree or rock, a villager works it; a building with room, in it goes.
    const unit = this.selected && canWalk(this.town, this.selected) ? this.selected : null;
    if (unit && !placed) {
      this.walkTo(unit, this.tileAt(at));
      return;
    }
    if (unit && placed && canHarvest(unit.item, placed.item)) {
      this.work(unit, placed);
      return;
    }
    if (unit && placed && canGoInside(this.town, unit.item, placed)) {
      this.goInto(unit, placed);
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
    if (this.building) {
      this.previewBuilding(this.tileAt(at));
    } else if (this.moving) {
      this.preview(this.moving, this.tileAt(at));
    }
  }

  /** The tile under a point of the screen: where a moved building's front corner goes. */
  private tileAt(at: Point): Point {
    return tileUnder(this.camera.toMap(at));
  }

  private select(placed: PlacedItem | null): void {
    this.selected = placed;
    this.view.highlight(placed);
    if (!placed) {
      this.bar.hide();
      return;
    }
    const can = choices(this.town, placed);
    const back = refund(placed.item);
    this.bar.show({
      name: placed.item.name,
      detail: this.detail(placed),
      move: can.move ? () => this.startMove(placed) : null,
      turn: can.turn ? () => this.turn(placed) : null,
      store: can.store ? () => this.store(placed) : null,
      sell: can.sell ? () => this.sell(placed) : null,
      refund: back ? `${back.amount} ${back.resource}` : "",
      letOut: placed.unitsInside > 0 && (placed.units?.length ?? 0) > 0 ? () => this.letOne(placed) : null,
      close: () => this.select(null),
    });
  }

  /** What a thing is doing: "ready in 2 h 13 min". Its work comes first, then why it can't be changed. */
  private detail(placed: PlacedItem): string {
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
      const left = harvestSeconds(placed.item) - (this.clock() - this.working.get(placed)!.since);
      return `Being worked: ${duration(Math.max(left, 0))} left`;
    }
    if (canWalk(this.town, placed)) {
      return "Tap the ground where it should go";
    }
    const why = choices(this.town, placed).why;
    return why ? why[0].toUpperCase() + why.slice(1) : "";
  }

  /** Send a unit walking to a tile, round what's in the way, as the Flash client does; `then` when it gets there. */
  private walkTo(unit: PlacedItem, tile: Point, then: () => void = () => this.unitStopped(unit)): boolean {
    const from = this.view.headingFor(unit);
    const path = findPath(walkGrid(this.town), from, tile, unit.item.flying);
    if (path === null) {
      this.say(`${unit.item.name} can't get there.`);
      return false;
    }
    this.stopWorking(unit);
    if (!this.savedAt.has(unit)) {
      this.savedAt.set(unit, { x: unit.tx, y: unit.ty });
    }
    this.view.walk(unit, path, (next) => {
      // Something built in the way since it set off: it stops before it.
      if (!unit.item.flying && !isWalkable(walkGrid(this.town), next.x, next.y)) {
        return false;
      }
      unit.tx = next.x;
      unit.ty = next.y;
      return true;
    }, then);
    return true;
  }

  /** A villager sent to a tree or rock: it walks beside it, then works it until it's done, then the next one touching it. */
  private work(unit: PlacedItem, resource: PlacedItem): void {
    const tile = standingTile(this.town, unit, resource);
    if (!tile) {
      this.say(`${unit.item.name} can't get to ${resource.item.name}.`);
      return;
    }
    this.walkTo(unit, tile, () => {
      this.unitStopped(unit);
      if (!this.town.items.includes(resource)) {
        return;  // gone while it walked (another villager finished it)
      }
      const work = this.working.get(resource) ?? { since: this.clock(), workers: new Set<PlacedItem>() };
      work.workers.add(unit);
      this.working.set(resource, work);
      this.workingOn.set(unit, resource);
      this.view.pose(unit, resource.item.subcategory === SUBCAT.tree ? "ATAQUE" : "PICAR", { x: resource.tx, y: resource.ty });
      this.refresh();
    });
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
    const busy = (placed: PlacedItem) => this.working.has(placed);
    for (const unit of work.workers) {
      this.workingOn.delete(unit);
      this.view.pose(unit, null);
      const next = nextResources(this.town, { x: resource.tx, y: resource.ty }, resource.item.subcategory, busy)[0];
      if (next) {
        this.work(unit, next);
      }
    }
  }

  /** A unit sent into a building: it walks to its door and goes in, if there's still room. */
  private goInto(unit: PlacedItem, building: PlacedItem): void {
    const tile = standingTile(this.town, unit, building);
    if (!tile) {
      this.say(`${unit.item.name} can't get to ${building.item.name}.`);
      return;
    }
    this.walkTo(unit, tile, () => {
      if (!this.town.items.includes(building) || !canGoInside(this.town, unit.item, building)) {
        this.unitStopped(unit);
        return;
      }
      const from = this.savedAt.get(unit) ?? { x: unit.tx, y: unit.ty };
      this.savedAt.delete(unit);
      this.send([goInside(this.town, unit, building, from, this.clock())]);
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
    this.send([out.command]);
    void this.view.redraw(out.unit);
    this.select(building);
    this.refresh();
  }

  /** Before a building is sold or stored, everybody inside comes out, as in the Flash client. */
  private emptyOut(building: PlacedItem): void {
    for (const out of letAllOut(this.town, building, this.items)) {
      this.send([out.command]);
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
    const done = collect(this.town, placed, this.clock());
    if (typeof done === "string") {
      this.say(done);
      return;
    }
    this.send(done.commands);
    const lines = [{ text: `+${done.amount} ${done.resource}`, colour: RESOURCE_COLOURS[done.resource] }];
    if (done.xp > 0) {
      lines.push({ text: `+${done.xp} XP`, colour: RESOURCE_COLOURS.xp });
    }
    if (done.wood > 0) {
      lines.push({ text: `−${done.wood} wood`, colour: RESOURCE_COLOURS.wood });
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
      const prizes = reached.filter((r) => r.prize).map((r) => `${r.prize!.amount} ${r.prize!.resource}`);
      this.say(`Level ${last.level}: ${last.name}!${prizes.length ? ` You get ${prizes.join(", ")}.` : ""}`);
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
    this.view.rise(placed, [{ text: `Working ${duration(WORK_TIMES[choice - 1].minutes * 60)}`, colour: 0xffffff }]);
    this.select(null);
    this.refresh();
  }

  private startMove(placed: PlacedItem): void {
    this.moving = placed;
    this.view.setGhost(placed, true);
    this.bar.prompt(`Tap where ${placed.item.name} goes`, [{ label: "Cancel", run: () => this.cancelMove() }]);
  }

  private preview(placed: PlacedItem, tile: Point): void {
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
    this.endMove(placed);
  }

  private cancelMove(): void {
    if (this.moving) {
      this.endMove(this.moving);
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
    this.emptyOut(placed);
    this.send([sell(this.town, placed)]);
    this.view.remove(placed);
    this.hud.update(this.town);
    this.select(null);
  }

  private store(placed: PlacedItem): void {
    this.emptyOut(placed);
    this.send([store(this.town, placed)]);
    this.view.remove(placed);
    this.select(null);
    this.say(`${placed.item.name} is in your storage.`);
  }

  private send(commands: Command[]): void {
    for (const command of commands) {
      this.commands.add(command.cmd, ...command.args);
    }
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
