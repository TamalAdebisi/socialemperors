// Arthur's lessons in the new client (CLIENT.md, "Arthur's lessons"): the
// Flash client's tutorial, step by step (rules/lessons.ts), on the town as
// it is. Each step points at what to tap, waits for the player to do it
// (the editor tells what they do), and is reported to the server as the
// Flash client reports it. At the end the town gets the dragon nest and a
// draggy of the player's choice.

import type { CommandSender } from "./net/commands.ts";
import type { TownEditor } from "./editor.ts";
import type { ItemInfo } from "./rules/config.ts";
import { freeSpotNear } from "./rules/dock.ts";
import { isOpenLand, takenTiles } from "./rules/editing.ts";
import { unitPoint, type Point } from "./rules/geometry.ts";
import {
  DRAGGIES, DRAGGY_NEAR, DRAGON_NEST, LAST_STEP, LIGHT_KNIGHT, MARKED_TREES, NEST_GIFT_STEPS, NEST_NEAR, STEPS, SUBCAT, TREES_TO_CUT,
  moves, pageOf, passes, stepReached, type LessonEvent, type Target,
} from "./rules/lessons.ts";
import type { PlacedItem, Town } from "./rules/town.ts";
import { chooseDraggy, nestReminder } from "./ui/draggy.ts";
import { LessonsView } from "./ui/lessons.ts";
import { closePanel, onPanelChange } from "./ui/panel.ts";
import type { TownView } from "./view/townView.ts";

export interface LessonParts {
  town: Town;
  items: Map<number, ItemInfo>;
  editor: TownEditor;
  view: TownView;
  commands: CommandSender;
  /** The game's words (localisation ids). */
  line: (id: number) => string;
  /** A point of the map on the screen, and the camera brought to one. */
  screenOf: (map: Point) => Point;
  lookAt: (map: Point) => void;
  thumbnail: (item: ItemInfo) => string;
  /** Where this browser keeps the step it's at (to carry on after a reload); null forgets it. */
  remember: (step: number | null) => void;
  /** The lessons are over: what comes after (the goals, the carts...). */
  finished: () => void;
}

/** A unit's body, above its feet, on the map. */
const UNIT_BODY = 25;
/** How long the arrow stays on the nest once the reminder is closed, as in the original. */
const NEST_ARROW_MS = 8000;

export class Lessons {
  private readonly parts: LessonParts;
  private readonly view: LessonsView;
  private step = -1;
  private felled = 0;
  private ground: Point | null | undefined;
  /** Where this step's building goes (worked out once a step). */
  private spot: Point | null | undefined;
  private running = true;
  /** When the camera last went to a target Arthur covered. */
  private uncovered = 0;
  /** Where the arrow points now (the browser tests tap there, as a player would). */
  pointing: Point | null = null;

  constructor(parts: LessonParts, from: number) {
    this.parts = parts;
    this.view = new LessonsView(() => this.hear({ kind: "next" }));
    parts.editor.listeners.push((event) => this.hear(event));
    let goals = false;
    onPanelChange((panel) => {
      if (panel?.key === "goals") {
        this.hear({ kind: "goals" });
      } else if (goals) {
        this.hear({ kind: "closed" });
      }
      goals = panel?.key === "goals";
    });
    this.go(from);
    const frame = () => {
      if (this.running) {
        this.follow();
        requestAnimationFrame(frame);
      }
    };
    requestAnimationFrame(frame);
  }

  /** Where the lessons are (for the browser tests). */
  get at(): number {
    return this.step;
  }

  private go(step: number): void {
    this.step = step;
    this.spot = undefined;
    if (step > 0) {
      this.parts.commands.add(stepReached(step).cmd, ...stepReached(step).args);
    }
    this.parts.remember(step);
    const lesson = STEPS[step];
    const words = (w: number | string) => (typeof w === "number" ? this.parts.line(w).replace("#0#", "Arthur").trim() : w);
    this.view.say(words(lesson.title), words(lesson.text), pageOf(step), lesson.next);
    this.view.counter(step === LAST_STEP ? `Trees chopped ${this.felled}/${TREES_TO_CUT}` : null);
    // A step on the map: the camera goes to it, as the original's did.
    const at = this.mapPoint(lesson.target);
    if (at) {
      this.parts.lookAt(at);
    }
    // A thing on the map to tap: an open window (the goals) is put away, or Arthur, who stands left of it, would cover the town.
    if (["hall", "villager", "knight", "enemy", "farm", "marked", "tree", "ground"].includes(lesson.target.kind)) {
      closePanel();
    }
    // The shop at the page with what to choose, as the original's showed it.
    if (lesson.target.kind === "card") {
      const item = this.parts.items.get(lesson.target.id);
      if (item) {
        this.parts.editor.showInShop(item);
      }
    }
    if (passes(step)) {
      queueMicrotask(() => this.go(step + 1));
    }
  }

  private hear(event: LessonEvent): void {
    if (!this.running) {
      return;
    }
    if (this.step === LAST_STEP) {
      if (event.kind === "felled" && event.resource.subcategory === SUBCAT.tree) {
        this.felled++;
        this.view.counter(`Trees chopped ${this.felled}/${TREES_TO_CUT}`);
        if (this.felled >= TREES_TO_CUT) {
          this.finish();
        }
      }
      return;
    }
    if (moves(this.step, event)) {
      this.go(this.step + 1);
    }
  }

  /** Every screen frame: the arrow on its target, and the markers on the trees. */
  private follow(): void {
    const lesson = STEPS[this.step];
    const at = this.screenPoint(lesson.target);
    // A thing that has walked (or come out) under Arthur: the camera goes to it, once a second at most.
    const now = performance.now();
    if (at && this.view.covers(at) && now - this.uncovered > 1000) {
      const map = this.mapPoint(lesson.target);
      if (map) {
        this.parts.lookAt(map);
        this.uncovered = now;
      }
    }
    this.pointing = at;
    const dim = this.step === 0 || this.step === 14 ? "all" : at === null ? "none" : "around";
    this.view.point(at, dim);
    this.view.mark(this.step === LAST_STEP ? this.markedTrees().map((tree) => this.parts.screenOf(this.middle(tree))) : []);
  }

  /** Where a target is on the map, for a step about the map. */
  private mapPoint(target: Target): Point | null {
    const placed = this.thing(target);
    if (placed) {
      return this.middle(placed);
    }
    if (target.kind === "tile") {
      // Where the original puts it if that's free, else the nearest spot where it fits.
      this.spot ??= (() => {
        const item = this.parts.items.get(target.id);
        return item ? freeSpotNear(this.parts.town, item, { x: target.x, y: target.y }) : null;
      })();
      return this.spot ? unitPoint(this.spot.x, this.spot.y) : null;
    }
    if (target.kind === "ground") {
      const tile = this.groundTile();
      return tile ? unitPoint(tile.x, tile.y) : null;
    }
    if (target.kind === "marked") {
      const tree = this.markedTrees()[0];
      return tree ? this.middle(tree) : null;
    }
    return null;
  }

  /** Where a target is on the screen: a thing of the map, or a button of the page. */
  private screenPoint(target: Target): Point | null {
    const button = (selector: string): Point | null => {
      const element = [...document.querySelectorAll<HTMLElement>(selector)].find((e) => e.offsetParent !== null);
      if (!element) {
        return null;
      }
      const box = element.getBoundingClientRect();
      return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
    };
    switch (target.kind) {
      case "train":
        return button(".actions .picture-button.train");
      case "build":
        return button('.menus button[aria-label="Build"]');
      case "goals":
        return button(".goal-card");
      case "close":
        return button(".panel:not([hidden]) .panel-close");
      case "card": {
        const name = this.parts.items.get(target.id)?.name;
        const card = [...document.querySelectorAll<HTMLElement>(".shop-card")].find((c) => c.querySelector(".shop-name")?.textContent === name);
        if (!card || card.offsetParent === null) {
          return null;
        }
        const box = card.getBoundingClientRect();
        return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
      }
      case "none":
      case "marked":
        return target.kind === "marked" ? this.screenOfFirstTree() : null;
    }
    // A building or a tree: the middle of its picture, where a tap finds it (a unit: its body, as the map point has it).
    const placed = this.thing(target);
    const box = placed && !placed.item.isUnit ? this.parts.view.screenBox(placed) : null;
    if (box && box.width > 0) {
      return { x: box.x + box.width / 2, y: box.y + box.height * 0.6 };
    }
    const at = this.mapPoint(target);
    return at ? this.parts.screenOf(at) : null;
  }

  private screenOfFirstTree(): Point | null {
    const tree = this.markedTrees()[0];
    const box = tree ? this.parts.view.screenBox(tree) : null;
    return box ? { x: box.x + box.width / 2, y: box.y + box.height * 0.6 } : tree ? this.parts.screenOf(this.middle(tree)) : null;
  }

  /** The thing a target names, nearest the town hall when there are several. */
  private thing(target: Target): PlacedItem | null {
    const { town } = this.parts;
    const hall = town.items.find((p) => p.item.subcategory === SUBCAT.townHall && p.item.race === town.race) ?? null;
    const near = (which: (p: PlacedItem) => boolean): PlacedItem | null => {
      const all = town.items.filter(which);
      const from = hall ?? { tx: 50, ty: 50 };
      all.sort((a, b) => (a.tx - from.tx) ** 2 + (a.ty - from.ty) ** 2 - ((b.tx - from.tx) ** 2 + (b.ty - from.ty) ** 2));
      return all[0] ?? null;
    };
    switch (target.kind) {
      case "hall":
        return hall;
      case "villager":
        return near((p) => p.item.subcategory === SUBCAT.villager && p.item.race === town.race && isOpenLand(town, p.tx, p.ty));
      case "tree":
        return near((p) => p.item.subcategory === SUBCAT.tree);
      case "knight":
        return near((p) => p.item.id === LIGHT_KNIGHT) ?? near((p) => p.item.isUnit && p.item.attack > 0 && p.item.race === town.race);
      case "enemy":
        return near((p) => p.item.isUnit && p.item.attack > 0 && p.item.race !== town.race && p.item.race !== "a" && p.item.race !== "n");
      case "farm":
        return near((p) => p.item.subcategory === SUBCAT.farm);
      default:
        return null;
    }
  }

  /** Open ground of the player's a few tiles in front of the town hall, for the villager's first walk. */
  private groundTile(): Point | null {
    const hall = this.thing({ kind: "hall" });
    if (!hall) {
      return null;
    }
    this.ground ??= (() => {
      const taken = takenTiles(this.parts.town);
      for (const [dx, dy] of [[-1, 3], [-3, 3], [1, 3], [-4, 1], [-1, 5], [-5, 3], [2, 4], [-3, 6]]) {
        const x = hall.tx + dx;
        const y = hall.ty + dy;
        if (isOpenLand(this.parts.town, x, y) && !taken.has(`${x},${y}`)) {
          return { x, y };
        }
      }
      return null;
    })();
    return this.ground;
  }

  /** The trees to cut: the clump the original marks, or the trees nearest the town hall if it's gone. */
  private markedTrees(): PlacedItem[] {
    const trees = this.parts.town.items.filter((p) => p.item.subcategory === SUBCAT.tree);
    const marked = trees.filter((p) => MARKED_TREES.some((m) => m.x === p.tx && m.y === p.ty));
    if (marked.length) {
      return marked;
    }
    const tree = this.thing({ kind: "tree" });
    return tree ? [tree] : [];
  }

  /** A thing's middle on the map; for a unit, its body rather than its feet. */
  private middle(placed: PlacedItem): Point {
    const at = unitPoint(placed.tx - (placed.item.width - 1) / 2, placed.ty - (placed.item.height - 1) / 2);
    return placed.item.isUnit ? { x: at.x, y: at.y - UNIT_BODY } : at;
  }

  /** Where a tile is on the screen now (for the browser tests). */
  screenOfTile(x: number, y: number): Point {
    return this.parts.screenOf(unitPoint(x, y));
  }

  /** The third tree down: the lessons are over. The nest, then the draggy. */
  private finish(): void {
    this.running = false;
    this.view.remove();
    this.parts.remember(null);
    this.giveNest();
  }

  private giveNest(): void {
    const { town, items, commands, view } = this.parts;
    const nestItem = items.get(DRAGON_NEST);
    let nest = town.items.find((p) => p.item.id === DRAGON_NEST) ?? null;
    if (nestItem && !nest) {
      const spot = freeSpotNear(town, nestItem, NEST_NEAR);
      if (spot) {
        nest = { item: nestItem, tx: spot.x, ty: spot.y, orientation: 0, unitsInside: 0, units: [], startedAt: null, workTime: 0 };
        town.items.push(nest);
        commands.add("buy", DRAGON_NEST, spot.x, spot.y, 0, town.id, 1, 1, "b");
        // The first egg starts at 7 of 10, as the Flash client gives it (sent as the text "0").
        for (let i = 0; i < NEST_GIFT_STEPS; i++) {
          commands.add("next_step", "0");
        }
        void view.redraw(nest);
      }
    }
    const draggies = DRAGGIES.map((id) => items.get(id)).filter((item): item is ItemInfo => Boolean(item));
    const line = this.parts.line;
    chooseDraggy(draggies, this.parts.thumbnail,
      { title: line(1403) || "FREE DRAGGY!!", header: line(1404) || "CONGRATULATIONS!!", line: line(1405), select: line(1406) || "Select" },
      (item) => this.giveDraggy(item, nest));
  }

  private giveDraggy(item: ItemInfo, nest: PlacedItem | null): void {
    const { town, commands, view, editor } = this.parts;
    const spot = freeSpotNear(town, item, DRAGGY_NEAR);
    if (spot) {
      const draggy: PlacedItem = { item, tx: spot.x, ty: spot.y, orientation: 0, unitsInside: 0, units: [], startedAt: null, workTime: 0 };
      town.items.push(draggy);
      commands.add("buy", item.id, spot.x, spot.y, 0, town.id, 1, 1, "u");
      void view.redraw(draggy);
      this.parts.lookAt(this.middle(draggy));
    }
    void commands.flush();  // at once, as the Flash client sends it
    editor.tell(`${item.name} is yours!`);
    const nestItem = nest?.item ?? this.parts.items.get(DRAGON_NEST);
    if (!nestItem) {
      this.parts.finished();
      return;
    }
    setTimeout(() => nestReminder(nestItem, this.parts.thumbnail(nestItem), { title: this.parts.line(1408) || "Dragon Nest", text: this.parts.line(1409) },
      () => this.showNest(nest)), 1500);
  }

  /** The reminder closed: the camera on the nest, the arrow on it a while. */
  private showNest(nest: PlacedItem | null): void {
    if (nest) {
      const at = this.middle(nest);
      this.parts.lookAt(at);
      const arrow = new LessonsView(() => {});
      arrow.say("", "", "", false);
      let showing = true;
      const frame = () => {
        if (showing) {
          arrow.point(this.parts.screenOf(at), "none");
          requestAnimationFrame(frame);
        }
      };
      requestAnimationFrame(frame);
      setTimeout(() => {
        showing = false;
        arrow.remove();
      }, NEST_ARROW_MS);
    }
    this.parts.finished();
  }
}
