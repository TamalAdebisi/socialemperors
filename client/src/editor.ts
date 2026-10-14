// What happens when the player taps the map: select a thing, then move,
// turn, store or sell it. The rules (rules/editing.ts) change the town and
// say what to send; this ties them to the map, the bar and the server.

import type { CommandSender } from "./net/commands.ts";
import { choices, fits, move, refund, sell, store, turn } from "./rules/editing.ts";
import { tileUnder, type Point } from "./rules/geometry.ts";
import type { PlacedItem, Town } from "./rules/town.ts";
import type { ActionBar } from "./ui/actions.ts";
import { showStatus, type Hud } from "./ui/hud.ts";
import type { Camera } from "./view/camera.ts";
import type { TownView } from "./view/townView.ts";

const RESOURCE_NAMES: Record<string, string> = { gold: "gold", wood: "wood", food: "food", stone: "stone" };

export class TownEditor {
  private readonly town: Town;
  private readonly view: TownView;
  private readonly bar: ActionBar;
  private readonly commands: CommandSender;
  private readonly hud: Hud;
  private readonly camera: Camera;
  private moving: PlacedItem | null = null;

  constructor(town: Town, view: TownView, bar: ActionBar, commands: CommandSender, hud: Hud, camera: Camera) {
    this.town = town;
    this.view = view;
    this.bar = bar;
    this.commands = commands;
    this.hud = hud;
    this.camera = camera;
    camera.onTap = (at) => this.tap(at);
    camera.onHover = (at) => this.hover(at);
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        this.moving ? this.cancelMove() : this.select(null);
      }
    });
  }

  private tap(at: Point): void {
    if (this.moving) {
      this.place(this.moving, this.tileAt(at));
      return;
    }
    this.select(this.view.itemAt(at));
  }

  private hover(at: Point): void {
    if (this.moving) {
      this.preview(this.moving, this.tileAt(at));
    }
  }

  /** The tile under a point of the screen: where a moved building's front corner goes. */
  private tileAt(at: Point): Point {
    return tileUnder(this.camera.toMap(at));
  }

  private select(placed: PlacedItem | null): void {
    this.view.highlight(placed);
    if (!placed) {
      this.bar.hide();
      return;
    }
    const can = choices(placed);
    const back = refund(placed.item);
    this.bar.show({
      name: can.why ? `${placed.item.name}: ${can.why}` : placed.item.name,
      move: can.move ? () => this.startMove(placed) : null,
      turn: can.turn ? () => this.turn(placed) : null,
      store: can.store ? () => this.store(placed) : null,
      sell: can.sell ? () => this.sell(placed) : null,
      refund: back ? `${back.amount} ${RESOURCE_NAMES[back.resource] ?? back.resource}` : "",
      close: () => this.select(null),
    });
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
    this.commands.add(command.cmd, ...command.args);
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
    const command = turn(this.town, placed);
    this.commands.add(command.cmd, ...command.args);
    void this.view.redraw(placed);
  }

  private sell(placed: PlacedItem): void {
    const command = sell(this.town, placed);
    this.commands.add(command.cmd, ...command.args);
    this.view.remove(placed);
    this.hud.update(this.town);
    this.select(null);
  }

  private store(placed: PlacedItem): void {
    const command = store(this.town, placed);
    this.commands.add(command.cmd, ...command.args);
    this.view.remove(placed);
    this.select(null);
    showStatus(`${placed.item.name} is in your storage.`);
    setTimeout(() => showStatus(""), 2500);
  }
}
