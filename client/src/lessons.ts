// Arthur's mandatory lessons: guidance, recovery and the saved first-dragon
// reward. Objectives live in rules/lessons.ts; see CLIENT.md.

import type { CommandSender } from "./net/commands.ts";
import type { TownEditor } from "./editor.ts";
import type { ItemInfo } from "./rules/config.ts";
import { freeSpotNear } from "./rules/dock.ts";
import { isOpenLand, takenTiles } from "./rules/editing.ts";
import { unitPoint, type Point } from "./rules/geometry.ts";
import {
  DRAGGIES, DRAGGY_NEAR, DRAGON_NEST, LAST_STEP, REWARD_STEP, LESSONS_DONE, LIGHT_KNIGHT, MARKED_TREES, NEST_GIFT_STEPS, NEST_NEAR, STEPS, SUBCAT, TREES_TO_CUT,
  moves, pageOf, passes, stepReached, type LessonEvent, type Target, type TutorialCheckpoint, fightingUnit,
} from "./rules/lessons.ts";
import { inConstruction } from "./rules/construction.ts";
import { workState } from "./rules/production.ts";
import type { PlacedItem, Town } from "./rules/town.ts";
import { chooseDraggy, nestReminder } from "./ui/draggy.ts";
import { GOAL_WINDOW_EVENT } from "./ui/goalWindow.ts";
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
  /** The save's privateState, where the nest's steps are kept (rules/nest.ts). */
  privateState: Record<string, unknown>;
  clock: () => number;
  panning: () => boolean;
  fighting: () => boolean;
  rewardSaved: () => Promise<boolean>;
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
  private recovering = false;
  private transitioning = false;
  private rewardQueued = false;
  private resumeAfterTraining: number | null = null;
  private guidance = "";
  private foundTarget: PlacedItem | null = null;
  private readonly resized = () => { this.guidance = ""; };
  /** Where a unit half hidden behind something can still be tapped, found again twice a second (`tappable`). */
  private spotted: { unit: PlacedItem; at: Point; until: number } | null = null;
  /** Where the arrow points now (the browser tests tap there, as a player would). */
  pointing: Point | null = null;

  constructor(parts: LessonParts, from: number) {
    this.parts = parts;
    window.addEventListener("resize", this.resized);
    this.view = new LessonsView(() => this.hear({ kind: "next" }), () => void this.help());
    this.felled = (parts.privateState.tutorial as TutorialCheckpoint | undefined)?.trees ?? (from === REWARD_STEP ? TREES_TO_CUT : 0);
    document.body.classList.add("tutorial-active");
    this.lockMenus(true);
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
    // The goal card opens its goal's own window (ui/goalWindow.ts), as in the original's lessons: looked at, then closed.
    document.addEventListener(GOAL_WINDOW_EVENT, (e) => {
      this.hear({ kind: (e as CustomEvent<{ open: boolean }>).detail.open ? "goals" : "closed" });
    });
    // Combat orders are transient; reload returns to choosing the soldier.
    this.go(from >= 11 && from <= 13 ? 11 : from);
    this.restore();
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
    if (step === LAST_STEP && this.felled >= TREES_TO_CUT) step = REWARD_STEP;
    this.step = step;
    this.pointing = null;
    this.spot = undefined;
    this.guidance = "";
    this.foundTarget = null;
    this.view.helpLabel();
    this.checkpoint();
    if (step === REWARD_STEP) {
      this.finish();
      return;
    }
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
    if (step >= 11 && step <= 13 && !this.thing({ kind: "enemy" })) {
      queueMicrotask(() => this.go(14));
    } else if (passes(step)) {
      queueMicrotask(() => this.go(step + 1));
    }
    this.follow();
  }

  private hear(event: LessonEvent): void {
    if (!this.running || this.transitioning) {
      return;
    }
    if (this.step === LAST_STEP) {
      if (event.kind === "felled" && event.resource.subcategory === SUBCAT.tree) {
        this.felled = Math.min(TREES_TO_CUT, this.felled + 1);
        queueMicrotask(() => this.checkpoint());
        this.view.counter(`Trees chopped ${this.felled}/${TREES_TO_CUT}`);
        if (this.felled >= TREES_TO_CUT) {
          this.transitioning = true;
          queueMicrotask(() => { this.transitioning = false; this.go(REWARD_STEP); });
        }
      }
      return;
    }
    if (moves(this.step, event, this.parts.town.race)) {
      const from = this.step;
      const returning = [3, 24].includes(from) ? this.resumeAfterTraining : null;
      if (returning !== null) this.resumeAfterTraining = null;
      this.transitioning = true;
      // Placement/training/collection finish their commands after emitting.
      // Checkpoint only after that work, in the same ordered command batch.
      queueMicrotask(() => {
        this.transitioning = false;
        if (this.step !== from) return;
        if (event.kind === "placed") this.parts.editor.lessonReset();
        this.go(returning ?? from + 1);
      });
    }
  }

  /** Every screen frame: the arrow on its target, and the markers on the trees. */
  private follow(): void {
    const lesson = STEPS[this.step];
    if (!lesson) return;
    if (this.step === 26) {
      const farm = this.thing({ kind: "farm" });
      if (farm && workState(farm, this.parts.clock())?.status === "ready") { this.go(27); return; }
    }
    let target = lesson.target;
    let text = String(lesson.text);
    const selected = this.parts.editor.lessonSelected;
    if ([4, 5, 25, 31].includes(this.step) && selected?.item.subcategory !== SUBCAT.villager) {
      target = { kind: "villager" };
      text = "Select a villager first, then follow the arrow to the next action.";
    }
    if ([3, 4, 5, 6, 24, 25, 30, 31].includes(this.step) && !this.thing({ kind: "villager" }) && !this.parts.editor.lessonTraining) {
      target = { kind: "none" };
      text = "No villager is available outside. Press Show me to train one and continue.";
    }
    const farm = this.step === 25 ? this.thing({ kind: "farm" }) : null;
    if (farm && inConstruction(farm, Date.now())) {
      target = { kind: "none" };
      text = "Your farm is being built. Keep your villager selected; I'll point to the farm when it is ready.";
    }
    if (this.resumeAfterTraining !== null && [2, 23].includes(this.step)) text = "Train a villager to continue your unfinished task. Your progress is kept.";
    const guidance = `${target.kind}:${text}`;
    if (guidance !== this.guidance) {
      this.guidance = guidance;
      this.view.say(String(lesson.title), text, pageOf(this.resumeAfterTraining ?? this.step), lesson.next);
      const map = this.mapPoint(target);
      if (map) this.parts.lookAt(map);
    }
    const placed = this.thing(target);
    if (placed && placed !== this.foundTarget) {
      // Training finishes after this step starts. Pan when its unit appears.
      this.foundTarget = placed;
      this.parts.lookAt(this.middle(placed));
    }
    const at = this.screenPoint(target);
    const mapTarget = this.mapPoint(target);
    const blocked = at && mapTarget && (at.x < 20 || at.x > innerWidth - 20 || at.y < 20 || at.y > innerHeight - 20
      || !document.elementFromPoint(at.x, at.y)?.closest("canvas"));
    // A thing that has walked (or come out) under Arthur: the camera goes to it, once a second at most.
    const now = performance.now();
    if (at && !this.parts.panning() && (this.view.covers(at) || blocked) && now - this.uncovered > 1500) {
      const map = this.mapPoint(target);
      if (map) {
        this.parts.lookAt(map);
        this.uncovered = now;
      }
    }
    this.pointing = at;
    this.view.destination(at, target.kind === "ground" ? "Move here" : target.kind === "tile" ? "Build here" : "", this.parts.panning());
    if (this.step >= 11 && this.step <= 13 && !this.thing({ kind: "knight" })) this.view.helpLabel("Get a training knight");
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
        return button(".card-train-button, .actions .picture-button.train");
      case "build":
        return button('.menus button[aria-label="Build"]');
      case "goals":
        return button(".goal-card");
      case "close":
        return button(".goal-window .goal-ok") ?? button(".panel:not([hidden]) .panel-close");
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
    if (placed?.item.isUnit) {
      return this.tappable(placed);
    }
    const box = placed ? this.parts.view.screenBox(placed) : null;
    if (box && box.width > 0) {
      return { x: box.x + box.width / 2, y: box.y + box.height * 0.6 };
    }
    const at = this.mapPoint(target);
    return at ? this.parts.screenOf(at) : null;
  }

  /**
   * A unit's body on the screen; or, when something stands in front of it
   * there (a villager just trained comes out toward the map's far corner,
   * which can be behind the harbour's sails), the part of it nearest its
   * body that a tap still finds, so the arrow points where a tap works.
   */
  private tappable(unit: PlacedItem): Point {
    const body = this.parts.screenOf(this.middle(unit));
    const { view } = this.parts;
    if (view.itemAt(body) === unit) {
      this.spotted = null;
      return body;
    }
    const now = performance.now();
    if (this.spotted?.unit === unit && now < this.spotted.until && !this.parts.panning()) {
      return this.spotted.at;
    }
    const box = view.screenBox(unit);
    let best: Point | null = null;
    if (box && box.width > 0) {
      const step = Math.max(3, Math.min(box.width, box.height) / 8);
      for (let y = box.y + step / 2; y < box.y + box.height; y += step) {
        for (let x = box.x + step / 2; x < box.x + box.width; x += step) {
          const near = (p: Point) => (p.x - body.x) ** 2 + (p.y - body.y) ** 2;
          if ((!best || near({ x, y }) < near(best)) && view.itemAt({ x, y }) === unit) {
            best = { x, y };
          }
        }
      }
    }
    this.spotted = { unit, at: best ?? body, until: now + 500 };
    return this.spotted.at;
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
        return near((p) => p.item.id === LIGHT_KNIGHT) ?? near((p) => fightingUnit(p.item) && p.item.race === town.race);
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

  private checkpoint(): void {
    const command = stepReached(this.step, this.felled);
    this.parts.commands.add(command.cmd, ...command.args);
    this.parts.privateState.tutorial = { step: this.step, trees: this.felled };
  }

  private lockMenus(locked: boolean): void {
    document.querySelectorAll<HTMLButtonElement>('.menus button:not([aria-label="Build"])').forEach((button) => { button.disabled = locked; });
  }

  /** Restore selections and unfinished placement; these are not server state. */
  private restore(): void {
    const { editor } = this.parts;
    const select = (kind: Target["kind"]) => {
      const unit = this.thing({ kind } as Target);
      if (unit) editor.focusOn(unit);
    };
    if ([2, 23].includes(this.step)) select("hall");
    if ([4, 5, 6, 25, 31].includes(this.step)) select("villager");
    if ([12, 13].includes(this.step)) select("knight");
    const target = STEPS[this.step]?.target;
    if (target?.kind === "tile") {
      const item = this.parts.items.get(target.id);
      if (item && editor.lessonBuilding !== item.id) editor.startBuilding(item);
    }
    if (this.step === 25 && this.thing({ kind: "farm" })?.unitsInside) this.go(26);
    // Walking orders aren't saved until the worker arrives inside.
    if (this.step === 26 && !this.thing({ kind: "farm" })?.unitsInside) {
      this.go(25);
      select("villager");
    }
  }

  private async help(): Promise<void> {
    if (this.recovering || this.step >= REWARD_STEP) return;
    const { editor, town, commands, items, view } = this.parts;
    if (this.step >= 11 && this.step <= 13 && !this.thing({ kind: "knight" })) {
      const item = items.get(LIGHT_KNIGHT);
      const hall = this.thing({ kind: "hall" });
      const spot = item && freeSpotNear(town, item, { x: hall?.tx ?? 50, y: (hall?.ty ?? 50) + 3 });
      if (!item || !spot) { editor.tell("Make room near your Town Hall for a training knight."); return; }
      this.recovering = true;
      commands.add("tutorial_knight", spot.x, spot.y);
      if (await commands.flush()) {
        // A running battle owns its own fighters and selection. Reopen the
        // saved town so the replacement joins normally, with losses retained.
        if (this.parts.fighting()) { location.reload(); return; }
        const knight = this.place(item, spot);
        void view.redraw(knight);
        editor.lessonReset();
        this.go(11);
      } else editor.tell("The knight couldn't be saved. Reload to continue your lesson.");
      this.recovering = false;
    } else {
      if ([12, 13].includes(this.step) && this.parts.fighting()) {
        if (await commands.flush()) location.reload();
        return;
      }
      editor.lessonReset();
      // A training timer lost on reload needs its Train button again.
      if ([3, 4, 5, 6, 24, 25, 30, 31].includes(this.step) && !this.thing({ kind: "villager" }) && !editor.lessonTraining) {
        const from = this.step;
        this.resumeAfterTraining = from === 3 ? 4 : from === 6 ? 5 : from === 24 ? 25 : from >= 30 ? 31 : from;
        this.go(from < 20 ? 2 : 23);
      }
      if ([12, 13].includes(this.step)) this.go(11);
      if (this.step === 6) this.go(5);
      this.restore();
      const target = STEPS[this.step].target;
      if (target.kind === "card") {
        const item = items.get(target.id);
        if (item) editor.showInShop(item);
      }
      const at = this.mapPoint(target);
      if (at) this.parts.lookAt(at);
    }
  }

  private place(item: ItemInfo, spot: Point): PlacedItem {
    const placed: PlacedItem = { item, tx: spot.x, ty: spot.y, orientation: 0, unitsInside: 0, units: [], startedAt: null, workTime: 0 };
    this.parts.town.items.push(placed);
    return placed;
  }

  /** Reward pending is a saved step. Only a saved claim completes the tutorial. */
  private finish(): void {
    this.running = false;
    window.removeEventListener("resize", this.resized);
    this.view.remove();
    const draggies = DRAGGIES.map((id) => this.parts.items.get(id)).filter((item): item is ItemInfo => Boolean(item));
    chooseDraggy(draggies, this.parts.thumbnail,
      { title: "Choose your first draggy", header: "Your empire is ready!", line: "Pick your companion. Your dragon nest is included.", select: "Select" },
      (item) => this.giveDraggy(item));
  }

  private async giveDraggy(item: ItemInfo): Promise<boolean> {
    if (this.rewardQueued) return false;
    this.rewardQueued = true;
    const { town, items, commands, view, editor, privateState } = this.parts;
    const nestItem = items.get(DRAGON_NEST)!;
    let nest = town.items.find((p) => p.item.id === DRAGON_NEST) ?? null;
    const hasStoredNest = Boolean(town.store.get(DRAGON_NEST) || town.gifts.get(DRAGON_NEST));
    const newNest = !nest && !hasStoredNest;
    const nestSpot = !newNest ? null : freeSpotNear(town, nestItem, NEST_NEAR);
    // Reserve its footprint when finding the dragon's spot, without drawing early.
    if (nestSpot) nest = this.place(nestItem, nestSpot);
    const spot = freeSpotNear(town, item, DRAGGY_NEAR);
    commands.add("claim_tutorial_reward", item.id, nestSpot ? [nestSpot.x, nestSpot.y] : null, spot ? [spot.x, spot.y] : null);
    if (!await commands.flush() || !await this.parts.rewardSaved()) return false;
    privateState.tutorial = { step: LESSONS_DONE, trees: TREES_TO_CUT, draggy: item.id };
    if (newNest) Object.assign(privateState, { dragonNestActive: 1, stepNumber: NEST_GIFT_STEPS, dragonNumber: 0, timeStampTakeCare: -1 });
    if (nestSpot) {
      void view.redraw(nest!);
    } else if (!nest && !hasStoredNest) town.store.set(DRAGON_NEST, 1);
    if (spot) {
      const draggy = this.place(item, spot);
      void view.redraw(draggy);
      this.parts.lookAt(this.middle(draggy));
    } else town.store.set(item.id, (town.store.get(item.id) ?? 0) + 1);
    editor.tell(`${item.name} is yours!${spot ? "" : " Find your gift in Storage."}`);
    this.step = LESSONS_DONE;
    nestReminder(nestItem, this.parts.thumbnail(nestItem), { title: "Dragon Nest", text: nest ? "Your nest will help you raise more dragons. Select it whenever you're ready." : "Your nest is in Storage. Place it when you have room to raise more dragons." }, () => this.showNest(nest));
    return true;
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
    document.body.classList.remove("tutorial-active");
    this.lockMenus(false);
    this.parts.finished();
  }
}
