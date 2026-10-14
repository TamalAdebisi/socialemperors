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
import type { PlacedItem, Town } from "./rules/town.ts";
import type { ActionBar } from "./ui/actions.ts";
import { duration } from "./ui/format.ts";
import { showStatus, type Hud } from "./ui/hud.ts";
import type { ShopWindow } from "./ui/shop.ts";
import type { Camera } from "./view/camera.ts";
import { RESOURCE_COLOURS } from "./view/markers.ts";
import type { TownView } from "./view/townView.ts";

/** How long a message stays in the middle of the screen, and how many may wait to show. */
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
  private selected: PlacedItem | null = null;
  private moving: PlacedItem | null = null;
  /** What was chosen in the shop, while the player places it: see-through, not on the map yet. */
  private building: PlacedItem | null = null;
  /** Messages for the middle of the screen: the first shows, the others wait their turn. */
  private sayQueue: string[] = [];

  constructor(parts: EditorParts) {
    ({ town: this.town, view: this.view, bar: this.bar, commands: this.commands, hud: this.hud,
      camera: this.camera, clock: this.clock, levels: this.levels, shop: this.shop } = parts);
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
  }

  /** Signs over the buildings (ready, asleep) and the selected one's countdown, as of now. */
  refresh(): void {
    const now = this.clock();
    for (const placed of this.town.items) {
      const state = workState(placed, now);
      if (state === null) {
        continue;
      }
      const resource = placed.item.production!.resource;
      this.view.sign(placed, state.status === "ready" ? { kind: "ready", resource }
        : state.status === "asleep" ? { kind: "asleep" } : null);
    }
    if (this.selected && !this.moving) {
      this.bar.rename(this.label(this.selected));
    }
  }

  /** Open the shop, leaving whatever was going on. */
  openShop(): void {
    if (this.building) {
      this.stopBuilding();
    }
    if (this.moving) {
      this.cancelMove();
    }
    this.select(null);
    this.shop.open();
  }

  /** The player chose something in the shop: place it, as many as they like, until Done. */
  startBuilding(item: ItemInfo): void {
    this.select(null);
    const centre = this.tileAt({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    this.building = { item, tx: centre.x, ty: centre.y, orientation: 0, unitsInside: 0, startedAt: null, workTime: 0 };
    this.view.showGhost(this.building);
    this.previewBuilding(centre);
    const price = priceOf(item);
    this.bar.prompt(`Tap where ${item.name} goes (${price.amount} ${price.resource} each)`,
      [{ label: "Done", run: () => this.stopBuilding() }]);
  }

  private previewBuilding(tile: Point): void {
    const building = this.building!;
    building.tx = tile.x;
    building.ty = tile.y;
    this.view.moveGhost(tile);
    this.view.showFootprint(building, fits(this.town, building));
  }

  private placeBuilding(tile: Point): void {
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

  private stopBuilding(): void {
    this.building = null;
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
    const can = choices(placed);
    const back = refund(placed.item);
    this.bar.show({
      name: this.label(placed),
      move: can.move ? () => this.startMove(placed) : null,
      turn: can.turn ? () => this.turn(placed) : null,
      store: can.store ? () => this.store(placed) : null,
      sell: can.sell ? () => this.sell(placed) : null,
      refund: back ? `${back.amount} ${back.resource}` : "",
      close: () => this.select(null),
    });
  }

  /** A thing's name and what it's doing: "Mill I: ready in 2 h 13 min". Its work comes first. */
  private label(placed: PlacedItem): string {
    const { name } = placed.item;
    const state = workState(placed, this.clock());
    switch (state?.status) {
      case "working":
        return `${name}: ready in ${duration(state.secondsLeft)}`;
      case "ready":
        return `${name}: ready, tap it to collect`;
      case "asleep":
        return `${name}: tap it to choose how long it works`;
      case "idle":
        if (placed.item.production!.kind !== "always") {
          return `${name}: no workers inside (put villagers in from the classic game)`;
        }
    }
    const why = choices(placed).why;
    return why ? `${name}: ${why}` : name;
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
    this.send([sell(this.town, placed)]);
    this.view.remove(placed);
    this.hud.update(this.town);
    this.select(null);
  }

  private store(placed: PlacedItem): void {
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

  /** A message in the middle of the screen for a moment, after any before it (the same one twice waits once). */
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
    showStatus(text);
    setTimeout(() => {
      this.sayQueue.shift();
      showStatus("");
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
