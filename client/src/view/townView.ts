// Draws a town: the ground, then every building and unit from the back to
// the front, placed as the Flash client places them (rules/geometry.ts).
// It shows changes (a thing moved, turned or gone) but doesn't make them:
// rules/editing.ts does.

import { AnimatedSprite, Assets, ColorMatrixFilter, Container, Graphics, Sprite, type Texture } from "pixi.js";

import type { ItemInfo } from "../rules/config.ts";
import { BUILD_MS, builtShare, inConstruction } from "../rules/construction.ts";
import {
  IDLE_DIRECTIONS,
  TILE_HEIGHT,
  TILE_WIDTH,
  buildingOrigin,
  buildingPoint,
  depth,
  groundBlocks,
  isTree,
  terrainItemId,
  unitFacing,
  unitPoint,
  type Point,
} from "../rules/geometry.ts";
import { footprintSize } from "../rules/editing.ts";
import type { PlacedItem, Town } from "../rules/town.ts";
import { anchorOf, type ArtLibrary, type ItemArt } from "./art.ts";
import { InfoPopup, PROGRESS, ProgressBar, loadBars } from "./bars.ts";
import { buildingLoopLength, buildingStateCount, buildingStateFrames, pouringTower } from "./buildingAnimation.ts";
import { scaffoldArt, scaffoldSprite } from "./construction.ts";
import { fireSprite, fireStage } from "./fire.ts";
import { isOpaqueAt, unitHitDistance } from "./hit.ts";
import { lookKey, lookOf } from "./looks.ts";
import { Markers, type Sign } from "./markers.ts";
import { HOVER_LIFE, LIFE, SELECTED, loadSelected, markLife, markSelected, unmarkLife, unmarkSelected } from "./selected.ts";
import { LOOK_AROUND_MS, headingTo, lookAround, stepTowards } from "../rules/walking.ts";
import { BLOCKS, BLOCK_TILES, isOuterBlock } from "../rules/geometry.ts";
import { ICONS } from "../ui/icons.ts";

/** How often the screen draws, which Pixi counts animation speed in. */
const TICKER_FPS = 60;
/**
 * A tree or rock a villager has lined up glows pale yellow round its edge,
 * as in the Flash client: copies of its picture a little way out on every
 * side, filled with the colour, behind it.
 */
const OUTLINE = "outline";
const OUTLINE_STEPS = [[-2, 0], [2, 0], [0, -2], [0, 2], [-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]];
/** The colour (0xffffb0), as a colour matrix: red, green and blue set, the picture's own alpha kept. */
const OUTLINE_MATRIX = [0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0xb0 / 255, 0, 0, 0, 1, 0];

export class TownView {
  readonly root = new Container();
  private readonly ground = new Container();
  /** Marks on the ground: a footprint being placed. */
  private readonly marks = new Container();
  /** "For sale" signs on the land the player hasn't bought, in their own town (showLandForSale). */
  private readonly landSigns = new Container();
  private landForSale = false;
  private readonly things = new Container();
  private readonly art: ArtLibrary;
  private readonly items: Map<number, ItemInfo>;
  private readonly town: Town;
  /** Each thing on the map and the container its picture is drawn in. */
  private readonly slots = new Map<PlacedItem, Container>();
  /** What's selected (one thing, or several units): marked as the game marks it (view/selected.ts). */
  private readonly highlighted = new Set<PlacedItem>();
  /** The box being dragged out to select units, over everything. */
  private readonly box = new Graphics();
  private readonly outlineFill = new ColorMatrixFilter();
  /** Trees and rocks in a villager's line: they're outlined. */
  private readonly lined = new Set<PlacedItem>();
  /** Buildings whose harvest is ready, and the look each farm and ranch was drawn with (view/looks.ts). */
  private readonly ready = new Set<PlacedItem>();
  private readonly looks = new Map<PlacedItem, string>();
  /** Whether the town is being drawn yet (build): before, there's nothing to draw again. */
  private built = false;
  /** Signs over buildings: ready to collect, asleep... */
  private readonly markers = new Markers();
  /** A building being bought, drawn see-through where it would go. */
  private readonly ghostLayer = new Container();
  private ghost: { slot: Container; drawnAt: Point } | null = null;
  /** Which way each unit faces (rules/geometry.ts numbers them), and where it is on the map while it walks. */
  private readonly facing = new Map<PlacedItem, number>();
  private readonly walkers = new Map<PlacedItem, Walk>();
  /** What a unit standing still is doing: working a tree (ATAQUE) or a rock (PICAR); standing (QUIETO) when it's not here. */
  private readonly poses = new Map<PlacedItem, Pose>();
  private lookAroundIn = LOOK_AROUND_MS;
  /** The bars at the foot of things being built or collected (view/bars.ts), filled as `share` says. */
  private readonly bars = new Map<PlacedItem, { bar: ProgressBar; share: () => number }>();
  /** What the mouse is on, marked as the game marks it (hover), and its popup, over everything on the map. */
  private hovered: PlacedItem | null = null;
  private readonly popups = new Container();
  private popup: { placed: PlacedItem; popup: InfoPopup } | null = null;
  private zoom = 1;

  constructor(art: ArtLibrary, items: Map<number, ItemInfo>, town: Town) {
    this.art = art;
    this.items = items;
    this.town = town;
    void loadSelected();
    void loadBars();
    this.outlineFill.matrix = OUTLINE_MATRIX as typeof this.outlineFill.matrix;
    this.root.addChild(this.ground, this.landSigns, this.marks, this.things, this.popups, this.ghostLayer, this.markers.layer, this.box);
    this.ghostLayer.alpha = 0.7;
  }

  /**
   * A raid has the town (homeDefence.ts): the battle draws everything on
   * the map but the ground, until it's over.
   */
  setFighting(fighting: boolean): void {
    for (const layer of [this.marks, this.things, this.popups, this.ghostLayer, this.markers.layer]) {
      layer.visible = !fighting;
    }
  }

  /** Show a building that isn't on the map yet (being bought) see-through at its tile; null takes it away. */
  showGhost(placed: PlacedItem | null): void {
    this.ghost?.slot.destroy({ children: true });
    this.ghost = null;
    if (placed) {
      const slot = new Container();
      this.ghostLayer.addChild(slot);
      this.ghost = { slot, drawnAt: buildingPoint(placed.tx, placed.ty) };
      // Placement keeps changing `placed` while its art loads. Draw at
      // this fixed origin: moveGhost already applies the pointer's offset.
      // Reading the new tile after awaiting art applies that move twice.
      void this.draw({ ...placed }, slot);
    }
  }

  /** Move the see-through building to another tile. */
  moveGhost(tile: Point): void {
    if (this.ghost) {
      const to = buildingPoint(tile.x, tile.y);
      this.ghost.slot.position.set(to.x - this.ghost.drawnAt.x, to.y - this.ghost.drawnAt.y);
    }
  }

  /** Move animations along: `ms` since the last frame, at the camera's zoom. */
  tick(ms: number, zoom: number): void {
    this.markers.tick(ms, zoom);
    // The bars and the popup keep their size on the screen, whatever the zoom, as the game's.
    this.zoom = zoom;
    for (const { bar, share } of this.bars.values()) {
      bar.set(share());
      bar.scale.set(1 / zoom);
    }
    this.popup?.popup.scale.set(1 / zoom);
    for (const [placed, walk] of this.walkers) {
      this.stepWalk(placed, walk, Math.min(ms, 100));
    }
    this.lookAroundIn -= ms;
    if (this.lookAroundIn <= 0) {
      this.lookAroundIn += LOOK_AROUND_MS;
      for (const [placed, direction] of this.facing) {
        const turned = this.walkers.has(placed) || this.poses.has(placed) || inConstruction(placed, Date.now()) ? null
          : lookAround(placed, direction);
        if (turned !== null && turned !== direction) {
          this.facing.set(placed, turned);
          void this.redrawUnit(placed);
        }
      }
    }
  }

  /**
   * Walk a unit along a path of tiles (rules/walking.ts), playing its walk.
   * `enter` hears each tile it reaches and may stop it there (false: it's
   * blocked now); `arrive` hears when it stops. A unit already walking goes
   * on to the tile it's heading for, then takes the new path from there.
   */
  walk(placed: PlacedItem, path: Point[], enter: (tile: Point) => boolean, arrive: () => void): void {
    const walking = this.walkers.get(placed);
    if (walking) {
      walking.path = path;
      walking.enter = enter;
      walking.arrive = arrive;
      return;
    }
    if (path.length === 0) {
      arrive();
      return;
    }
    const at = unitPoint(placed.tx, placed.ty);
    const walk: Walk = { at, next: null, path, enter, arrive };
    this.walkers.set(placed, walk);
    this.nextTile(placed, walk);
  }

  /** A unit standing still works (facing a tile), or just stands (null). */
  pose(placed: PlacedItem, pose: Pose | null, face?: Point): void {
    if (pose === null) {
      this.poses.delete(placed);
    } else {
      this.poses.set(placed, pose);
    }
    if (face) {
      this.facing.set(placed, headingTo(unitPoint(placed.tx, placed.ty), unitPoint(face.x, face.y), this.facing.get(placed) ?? 5));
    }
    void this.redrawUnit(placed);
  }

  /** The tile a walking unit is heading for (its next one), or where it stands. */
  headingFor(placed: PlacedItem): Point {
    const walk = this.walkers.get(placed);
    return walk?.next ?? { x: placed.tx, y: placed.ty };
  }

  isWalking(placed: PlacedItem): boolean {
    return this.walkers.has(placed);
  }

  groundClick(at: Point): void {
    this.markers.groundClick(at);
  }

  /** Stop every walk on the last tile it reached, without hearing that they arrived (a raid takes over the town): the units that were walking. */
  stopWalks(): PlacedItem[] {
    const walking = [...this.walkers.keys()];
    this.walkers.clear();
    walking.forEach((placed) => void this.redrawUnit(placed));
    return walking;
  }

  /** The tiles units are walking to, the ends of their paths ("x,y"), but `except`'s own. */
  destinations(except?: PlacedItem): Set<string> {
    const tiles = new Set<string>();
    for (const [placed, walk] of this.walkers) {
      const end = walk.path.at(-1) ?? walk.next;
      if (placed !== except && end) {
        tiles.add(`${end.x},${end.y}`);
      }
    }
    return tiles;
  }

  private nextTile(placed: PlacedItem, walk: Walk): void {
    const tile = walk.path.shift();
    if (!tile) {
      this.walkers.delete(placed);
      walk.next = null;
      void this.redrawUnit(placed);
      walk.arrive();
      return;
    }
    walk.next = tile;
    const direction = headingTo(walk.at, unitPoint(tile.x, tile.y), this.facing.get(placed) ?? 5);
    // A new way to face, or the first step: the walk, that way.
    if (direction !== this.facing.get(placed) || !walk.started) {
      this.facing.set(placed, direction);
      walk.started = true;
      void this.redrawUnit(placed);
    }
  }

  private stepWalk(placed: PlacedItem, walk: Walk, ms: number): void {
    if (!walk.next) {
      return;
    }
    const target = unitPoint(walk.next.x, walk.next.y);
    walk.at = stepTowards(walk.at, target, placed.item.velocity, ms);
    const slot = this.slots.get(placed);
    const picture = slot && pictureOf(slot);
    if (slot && picture) {
      // The picture and its marks (selected) move together.
      const dx = walk.at.x - picture.x;
      const dy = walk.at.y - picture.y;
      slot.children.forEach((child) => child.position.set(child.x + dx, child.y + dy));
    }
    this.markers.moveTo(placed, this.topOf(placed));
    if (walk.at.x === target.x && walk.at.y === target.y) {
      const tile = walk.next;
      if (!walk.enter(tile)) {
        walk.path = [];
      }
      // On its new tile now: drawn in its place among the others.
      this.sort();
      this.nextTile(placed, walk);
    }
  }

  /** Show a sign over a thing (ready, asleep), or none. */
  sign(placed: PlacedItem, sign: Sign | null): void {
    this.markers.set(placed, sign, this.topOf(placed));
  }

  /** One of the game's pictures (or a part of one, `frame`) popping up over a thing for a moment. */
  pop(placed: PlacedItem, url: string, frame?: { x: number; y: number; width: number; height: number }): void {
    this.markers.pop(this.topOf(placed) ?? buildingPoint(placed.tx, placed.ty), url, frame);
  }

  /** Numbers rising from a thing: what collecting it gave. */
  rise(placed: PlacedItem, lines: { text: string; colour: number }[]): void {
    this.markers.rise(this.topOf(placed) ?? buildingPoint(placed.tx, placed.ty), lines);
  }

  /** The top middle of a thing's picture, on the map; null before it's drawn. */
  private topOf(placed: PlacedItem): Point | null {
    const slot = this.slots.get(placed);
    const bounds = slot?.getLocalBounds();
    if (!bounds || bounds.width === 0) {
      return null;
    }
    return { x: bounds.x + bounds.width / 2, y: bounds.y };
  }

  /** Draw everything; `progress` hears how many of the town's pictures are ready. */
  async build(progress: (done: number, total: number) => void): Promise<{ missing: string[] }> {
    const missing = new Set<string>();
    this.built = true;
    const jobs: Promise<void>[] = [this.buildGround(missing)];

    // Back to front. Array.sort keeps the save's order for equal depths.
    const sorted = [...this.town.items].sort((a, b) => depth(a) - depth(b));
    for (const placed of sorted) {
      // A slot in the right order now; the picture goes in when it arrives.
      const slot = new Container();
      this.slots.set(placed, slot);
      this.things.addChild(slot);
      jobs.push(this.draw(placed, slot).then((drawn) => {
        if (!drawn) {
          missing.add(placed.item.art);
        }
      }));
    }

    let done = 0;
    progress(0, jobs.length);
    await Promise.all(jobs.map((job) => job.then(() => progress(++done, jobs.length))));
    return { missing: [...missing] };
  }

  /** Where a thing's picture is on the screen (its box), or null when it isn't drawn. */
  screenBox(placed: PlacedItem): { x: number; y: number; width: number; height: number } | null {
    const slot = this.slots.get(placed);
    if (!slot || slot.destroyed) {
      return null;
    }
    const box = slot.getBounds();
    return { x: box.x, y: box.y, width: box.width, height: box.height };
  }

  /** The thing whose picture is under a point of the screen, the one in front. */
  itemAt(screen: Point): PlacedItem | null {
    // A sign over a building first: it stands in front of everything on the map.
    const signed = this.markers.signAt(screen);
    if (signed) {
      return signed;
    }
    const slots = this.things.children;
    for (let i = slots.length - 1; i >= 0; i--) {
      const slot = slots[i];
      const picture = pictureOf(slot);
      if (picture && isOpaqueAt(picture, screen)) {
        for (const [placed, s] of this.slots) {
          if (s === slot) {
            return placed;
          }
        }
      }
    }
    // A near miss on a small unit must select it before the editor sends
    // the previous unit to the ground. Exact picture hits above still win.
    let nearest: PlacedItem | null = null;
    let distance = Infinity;
    for (const [placed, slot] of this.slots) {
      if (!placed.item.isUnit || !slot.visible) continue;
      const picture = pictureOf(slot);
      if (!picture) continue;
      const d = unitHitDistance(picture.getBounds(), screen);
      if (d < distance || (nearest && d === distance && depth(placed) > depth(nearest))) {
        nearest = placed;
        distance = d;
      }
    }
    return nearest;
  }

  /** Draw a thing again (it moved or turned), and put it back in order. */
  async redraw(placed: PlacedItem): Promise<void> {
    if (!this.built) {
      // Asked before the town is drawn (the editor's first look): build() draws it as it is then.
      // Drawing it now too left a second picture behind that nothing kept track of.
      return;
    }
    let slot = this.slots.get(placed);
    if (!slot) {
      slot = new Container();
      this.slots.set(placed, slot);
      this.things.addChild(slot);
    }
    await this.draw(placed, slot);
    this.sort();
    this.markers.moveTo(placed, this.topOf(placed));
    if (this.highlighted.has(placed)) {
      this.mark(placed);
    }
    if (this.hovered === placed) {
      this.markHover(placed);
    }
  }

  /** Take a thing off the map (sold, stored). */
  remove(placed: PlacedItem): void {
    this.lined.delete(placed);
    this.ready.delete(placed);
    this.looks.delete(placed);
    this.walkers.delete(placed);
    this.poses.delete(placed);
    this.facing.delete(placed);
    this.bars.delete(placed);
    if (this.hovered === placed) {
      this.hover(null, null);
    }
    const slot = this.slots.get(placed);
    if (slot) {
      this.things.removeChild(slot);
      slot.destroy({ children: true });
      this.slots.delete(placed);
    }
    this.markers.remove(placed);
    this.highlighted.delete(placed);
  }

  /**
   * Mark what's selected as the Flash client does (one thing, several
   * units, or nothing): a ring under a unit or the outline of a building's
   * ground, its life bar over it (view/selected.ts).
   */
  highlight(selected: PlacedItem | PlacedItem[] | null): void {
    for (const placed of this.highlighted) {
      const slot = this.slots.get(placed);
      if (slot) {
        unmarkSelected(slot);
      }
    }
    this.highlighted.clear();
    for (const placed of selected === null ? [] : Array.isArray(selected) ? selected : [selected]) {
      this.highlighted.add(placed);
      this.mark(placed);
    }
  }

  /** The box being dragged out to select units, between two points of the map; null takes it away. */
  showBox(from: Point | null, to?: Point): void {
    this.box.clear();
    if (from && to) {
      // As the Flash client draws it: a thin white line, the inside faintly white.
      this.box.rect(Math.min(from.x, to.x), Math.min(from.y, to.y), Math.abs(to.x - from.x), Math.abs(to.y - from.y))
        .fill({ color: 0xffffff, alpha: 0.1 })
        .stroke({ color: 0xffffff, width: 2 });
    }
  }

  /**
   * The units whose pictures touch a box on the screen (their pictures'
   * boxes, as the Flash client tests them), in the town's order.
   */
  unitsIn(a: Point, b: Point): PlacedItem[] {
    const left = Math.min(a.x, b.x), right = Math.max(a.x, b.x), top = Math.min(a.y, b.y), bottom = Math.max(a.y, b.y);
    return this.town.items.filter((placed) => {
      const slot = placed.item.isUnit ? this.slots.get(placed) : undefined;
      const picture = slot && pictureOf(slot);
      if (!picture || !slot.visible) {
        return false;
      }
      const bounds = picture.getBounds();
      return bounds.width > 0 && bounds.x < right && bounds.x + bounds.width > left && bounds.y < bottom && bounds.y + bounds.height > top;
    });
  }

  private mark(placed: PlacedItem): void {
    const slot = this.slots.get(placed);
    const picture = slot && pictureOf(slot);
    if (!slot || !picture) {
      return;
    }
    if (!markSelected(slot, placed, picture, this.walkers.get(placed)?.at)) {
      // The marks' pictures are still on their way: mark it when they're here, if it's still the one.
      void loadSelected().then(() => {
        if (this.highlighted.has(placed) && !slot.destroyed) {
          markSelected(slot, placed, picture, this.walkers.get(placed)?.at);
        }
      });
    }
  }

  /**
   * Told whether a building's harvest is ready, as the editor looks each
   * second: a farm or ranch is drawn again when who's inside it or its
   * harvest has changed, to show what fits (view/looks.ts).
   */
  showState(placed: PlacedItem, ready: boolean): void {
    if (ready) {
      this.ready.add(placed);
    } else {
      this.ready.delete(placed);
    }
    const look = lookKey(placed, ready);
    if (look !== null && this.looks.get(placed) !== look) {
      this.looks.set(placed, look);
      void this.redraw(placed);
    }
  }

  /** Outline a tree or rock a villager has lined up, or stop. */
  lineUp(placed: PlacedItem, on: boolean): void {
    if (on) {
      this.lined.add(placed);
    } else {
      this.lined.delete(placed);
    }
    const slot = this.slots.get(placed);
    if (slot) {
      this.outline(slot, on);
    }
  }

  private outline(slot: Container, on: boolean): void {
    slot.getChildByLabel(OUTLINE)?.destroy({ children: true });
    const picture = pictureOf(slot);
    if (!on || !(picture instanceof Sprite)) {
      return;
    }
    const halo = new Container({ label: OUTLINE });
    for (const [dx, dy] of OUTLINE_STEPS) {
      const copy = new Sprite(picture.texture);
      copy.anchor.copyFrom(picture.anchor);
      copy.scale.copyFrom(picture.scale);
      copy.position.set(picture.x + dx, picture.y + dy);
      halo.addChild(copy);
    }
    // An animated picture's silhouette must follow the very same frame.
    // Separate AnimatedSprites drift, and a snapshot leaves a large stale
    // shape behind moving parts. Sync just before drawing, after the ticker.
    halo.onRender = () => {
      for (let i = 0; i < halo.children.length; i++) {
        const copy = halo.children[i] as Sprite;
        const [dx, dy] = OUTLINE_STEPS[i];
        copy.texture = picture.texture;
        copy.anchor.copyFrom(picture.anchor);
        copy.scale.copyFrom(picture.scale);
        copy.position.set(picture.x + dx, picture.y + dy);
      }
    };
    halo.filters = [this.outlineFill];
    slot.addChildAt(halo, 0);
  }

  /** See-through while being moved. */
  setGhost(placed: PlacedItem, ghost: boolean): void {
    const slot = this.slots.get(placed);
    if (slot) {
      slot.alpha = ghost ? 0.7 : 1;
    }
    this.markers.show(placed, !ghost);
  }

  /** Draw a thing as if it stood on another tile (while it's being moved). */
  offset(placed: PlacedItem, tile: Point): void {
    const slot = this.slots.get(placed);
    if (slot) {
      const from = buildingPoint(placed.tx, placed.ty);
      const to = buildingPoint(tile.x, tile.y);
      slot.position.set(to.x - from.x, to.y - from.y);
    }
  }

  /** Show where a footprint would go, green if it fits and red if not; null hides it. */
  /**
   * A short bar at a thing's foot with the game's words on it
   * ("Collecting..."), filling as `share` goes from 0 to 1; hideBar takes
   * it away.
   */
  showBar(placed: PlacedItem, words: string, share: () => number): void {
    const slot = this.slots.get(placed);
    if (!slot || slot.destroyed) {
      return;
    }
    this.hideBar(placed);
    const bar = new ProgressBar(placed.item.isUnit ? unitPoint(placed.tx, placed.ty) : buildingPoint(placed.tx, placed.ty), false, words);
    bar.set(share());
    bar.scale.set(1 / this.zoom);
    slot.addChild(bar);
    this.bars.set(placed, { bar, share });
  }

  hideBar(placed: PlacedItem): void {
    const shown = this.bars.get(placed);
    if (shown) {
      shown.bar.destroy({ children: true });
      this.bars.delete(placed);
    }
  }

  /**
   * The thing the mouse is on (null: none), marked as the Flash client
   * marks it: a thin white outline and its life bar, and over it its popup
   * (view/bars.ts) when `info` gives one: its name, and a building's round
   * of work. `ground`: its ground outlined in white too, as the bulldozer
   * shows what it would take.
   */
  hover(placed: PlacedItem | null, info: { name: string; round: { share: number; left: string } | null } | null, ground = false): void {
    if (placed !== this.hovered) {
      if (this.hovered) {
        const slot = this.slots.get(this.hovered);
        if (slot && !slot.destroyed) {
          this.outline(slot, this.lined.has(this.hovered));
          unmarkLife(slot);
        }
      }
      this.hovered = placed;
      this.markers.highlight(placed);
      if (placed) {
        this.markHover(placed);
      }
    }
    this.showFootprint(placed && ground ? placed : null, true, 0xffffff);
    if (!placed || !info) {
      this.popup?.popup.destroy({ children: true });
      this.popup = null;
      return;
    }
    if (this.popup?.placed !== placed) {
      this.popup?.popup.destroy({ children: true });
      const popup = new InfoPopup(placed.item.isUnit ? unitPoint(placed.tx, placed.ty) : buildingPoint(placed.tx, placed.ty), info.name);
      popup.scale.set(1 / this.zoom);
      this.popups.addChild(popup);
      this.popup = { placed, popup };
    }
    this.popup.popup.set(info.round);
  }

  private markHover(placed: PlacedItem): void {
    const slot = this.slots.get(placed);
    const picture = slot && pictureOf(slot);
    if (!slot || !picture) {
      return;
    }
    this.outline(slot, true);
    markLife(slot, placed, picture, this.walkers.get(placed)?.at);
  }

  showFootprint(placed: PlacedItem | null, fits = true, colour?: number): void {
    this.marks.removeChildren().forEach((child) => child.destroy());
    if (placed) {
      this.marks.addChild(footprint(placed, colour ?? (fits ? 0x5fd35f : 0xe0533d)));
    }
  }

  private sort(): void {
    const order = [...this.slots].sort(([a], [b]) => depth(a) - depth(b) || this.town.items.indexOf(a) - this.town.items.indexOf(b));
    order.forEach(([, slot], index) => this.things.setChildIndex(slot, index));
  }

  /** Put a thing's picture in its slot. False when it has no art (yet): an outline instead. */
  private async draw(placed: PlacedItem, slot: Container): Promise<boolean> {
    const art = await this.art.get(placed.item.art);
    if (slot.destroyed) {
      return art !== null;  // taken away while its art loaded (a see-through building no longer wanted)
    }
    const offset = slot === this.ghost?.slot ? { x: slot.x, y: slot.y } : { x: 0, y: 0 };
    if (inConstruction(placed, Date.now())) {
      return this.drawScaffold(placed, slot).then(() => art !== null);
    }
    this.bars.delete(placed);
    slot.removeChildren().forEach((child) => child.destroy());
    slot.position.set(offset.x, offset.y);
    if (art === null) {
      slot.addChild(footprint(placed, 0xffffff));
      return false;
    }
    if (placed.item.isUnit) {
      if (!this.facing.has(placed)) {
        // A unit waiting in town faces down, down-right or down-left, by chance.
        this.facing.set(placed, IDLE_DIRECTIONS[Math.floor(Math.random() * IDLE_DIRECTIONS.length)]);
      }
      const walk = this.walkers.get(placed);
      slot.addChild(unitSprite(art, this.facing.get(placed)!, walk ? "ANDAR" : this.poses.get(placed) ?? "QUIETO", walk?.at ?? unitPoint(placed.tx, placed.ty)));
    } else {
      const sprite = buildingSprite(art, placed, this.town.skin, this.ready.has(placed), placed.steps);
      slot.addChild(sprite);
      // Burning since a raid (homeDefence.ts): the game's flames over it.
      const stage = placed.health === undefined ? 0 : fireStage(placed.health, placed.item.life);
      if (stage > 0) {
        const fire = await fireSprite(stage);
        // Redrawn meanwhile (a newer picture took this one's place): the newer one has its own flames.
        if (!slot.destroyed && !sprite.destroyed) {
          fire.position.copyFrom(sprite.position);
          slot.addChild(fire);
        }
      }
      if (this.lined.has(placed) && !slot.destroyed) {
        this.outline(slot, true);
      }
    }
    return true;
  }

  /**
   * Something being built: the scaffolding in its place, and the bar under
   * it (view/construction.ts). It's drawn finished when the editor draws it
   * again after its 10 seconds.
   */
  private async drawScaffold(placed: PlacedItem, slot: Container): Promise<void> {
    const scaffold = await scaffoldArt(placed.item);
    if (slot.destroyed) {
      return;
    }
    slot.removeChildren().forEach((child) => child.destroy());
    slot.position.set(0, 0);
    const now = Date.now();
    const point = placed.item.isUnit ? unitPoint(placed.tx, placed.ty) : buildingPoint(placed.tx, placed.ty);
    slot.addChild(scaffold ? scaffoldSprite(scaffold, point, builtShare(placed, now) * BUILD_MS) : footprint(placed, 0xffffff));
    const bar = new ProgressBar(point, placed.item.width <= 1);
    bar.set(builtShare(placed, now));
    bar.scale.set(1 / this.zoom);
    slot.addChild(bar);
    this.bars.set(placed, { bar, share: () => builtShare(placed, Date.now()) });
    if (this.highlighted.has(placed)) {
      this.mark(placed);
    }
  }

  /** Draw a unit again: facing another way, or walking, or standing still. */
  private async redrawUnit(placed: PlacedItem): Promise<void> {
    const slot = this.slots.get(placed);
    const art = await this.art.get(placed.item.art);
    if (!slot || slot.destroyed || art === null || inConstruction(placed, Date.now())) {
      return;
    }
    const walk = this.walkers.get(placed);
    const sprite = unitSprite(art, this.facing.get(placed) ?? 5, walk ? "ANDAR" : this.poses.get(placed) ?? "QUIETO", walk?.at ?? unitPoint(placed.tx, placed.ty));
    slot.removeChildren().forEach((child) => child.destroy());
    slot.addChild(sprite);
    if (this.highlighted.has(placed)) {
      this.mark(placed);
    }
    if (this.hovered === placed) {
      this.markHover(placed);
    }
  }

  /** Draw the ground again: land bought. */
  async redrawGround(): Promise<void> {
    const old = this.ground.removeChildren();
    await this.buildGround(new Set());
    old.forEach((child) => child.destroy());
    if (this.landForSale) {
      await this.drawLandSigns();
    }
  }

  /**
   * A "for sale" sign in the middle of each block of land the player hasn't
   * bought (but the wild ring), as the Flash client shows them in the
   * player's own town. Tapping the land offers it, if it touches theirs.
   */
  async showLandForSale(): Promise<void> {
    this.landForSale = true;
    await this.drawLandSigns();
  }

  private async drawLandSigns(): Promise<void> {
    const texture = await Assets.load<Texture>(ICONS["for-sale"]).catch(() => null);
    this.landSigns.removeChildren().forEach((child) => child.destroy());
    if (!texture) {
      return;
    }
    for (let gy = 0; gy < BLOCKS; gy++) {
      for (let gx = 0; gx < BLOCKS; gx++) {
        if (isOuterBlock(gx, gy) || this.town.expansions.has(gx + BLOCKS * gy + 1)) {
          continue;
        }
        const sign = new Sprite(texture);
        sign.anchor.set(0.5, 1);
        sign.scale.set(1 / 3);  // drawn at three times the game's size (tools/art/export_ui.py)
        const middle = unitPoint(gx * BLOCK_TILES + BLOCK_TILES / 2, gy * BLOCK_TILES + BLOCK_TILES / 2);
        sign.position.set(middle.x, middle.y);
        this.landSigns.addChild(sign);
      }
    }
  }

  private async buildGround(missing: Set<string>): Promise<void> {
    const terrain = this.items.get(terrainItemId(this.town.skin)) ?? this.items.get(terrainItemId(0));
    const art = terrain ? await this.art.get(terrain.art) : null;
    if (art === null) {
      missing.add(terrain?.art ?? "terrain");
      return;
    }
    for (const block of groundBlocks(this.town.expansions)) {
      const name = `frame/${Math.min(block.frame, art.framesOf("frame") - 1)}`;
      const texture = art.animation(name)?.[0];
      const bounds = art.boundsOf(name);
      if (!texture || !bounds) {
        continue;
      }
      const sprite = new Sprite(texture);
      sprite.anchor.copyFrom(anchorOf(texture));
      place(sprite, buildingOrigin(buildingPoint(block.tx, block.ty), bounds));
      this.ground.addChild(sprite);
    }
  }
}

/** A thing's picture in its slot: not its outline, nor its marks as selected. */
function pictureOf(slot: Container): Container | undefined {
  return slot.children.find((child) => child.label !== OUTLINE && child.label !== SELECTED && child.label !== LIFE
    && child.label !== HOVER_LIFE && child.label !== PROGRESS);
}

export function buildingSprite(art: ItemArt, placed: PlacedItem, skin: number, ready = false, still?: number, attacking = false): Container {
  // Its frame is the way it faces; past the last, the game shows the last. An open wall gate
  // shows the frames after its closed ones (two on), as in the Flash client.
  const facing = placed.open && art.has(`frame/${placed.orientation + 2}`) ? placed.orientation + 2
    : Math.min(placed.orientation, Math.max(art.framesOf("frame"), 1) - 1);
  const name = `frame/${facing}`;
  let textures = art.animation(name) ?? [];
  const look = lookOf(placed, textures.length, ready);
  if (isTree(placed.item) && textures.length > 1) {
    // A tree's frames are its looks for each island skin (snow on ice...).
    textures = [textures[Math.min(skin, textures.length - 1)]];
  } else if (still !== undefined && art.has("steps/0")) {
    // A chest that fills up as its camp goes: the picture with this many steps.
    const steps = art.animation("steps/0") ?? [];
    textures = [steps[Math.min(still, steps.length - 1)]];
  } else if (still !== undefined && textures.length > 1) {
    const frames = buildingStateFrames(art.name, facing, textures.length, still);
    textures = frames ? frames.map((i) => textures[i]) : [textures[Math.min(still, textures.length - 1)]];
  } else if (look) {
    // Working farms and ordinary ranches already select their own state.
    textures = look.map((i) => textures[i]);
  } else if (!(placed.item.id === 225 && placed.unitsInside > 0)) {
    // Completed buildings show their idle state, including non-social
    // mills/mines. Preserve nested smoke, flames, flags and other effects.
    // The stables have six animal-count states, each with a nested loop.
    // An occupied sacrifice altar retains its existing active sequence.
    const state = placed.item.subcategory === 123 && buildingStateCount(art.name, facing) === placed.item.capacity + 1
      ? placed.unitsInside : pouringTower(art.name) && attacking ? 1 : 0;
    const frames = buildingStateFrames(art.name, facing, textures.length, state);
    if (frames) {
      textures = frames.map((i) => textures[i]);
    }
  }
  textures = textures.slice(0, buildingLoopLength(art.name, textures.length));
  const sprite = animated(textures, art.fps);
  const bounds = art.boundsOf(name);
  place(sprite, buildingOrigin(buildingPoint(placed.tx, placed.ty), bounds ?? { x: 0, y: 0, w: 0, h: 0 }));
  return sprite;
}

/** What a unit's picture shows: standing, walking, chopping (its attack), picking at a rock, or dying. */
export type Pose = "QUIETO" | "ANDAR" | "ATAQUE" | "PICAR" | "MUERTE";

/** A unit facing one of its 8 ways, in a pose, at a point of the map. */
export function unitSprite(art: ItemArt, direction: number, pose: Pose, at: Point, once = false): Container {
  const facing = unitFacing(direction);
  const name = art.has(`${pose}/${facing.frame}`) ? `${pose}/${facing.frame}`
    : art.has(`QUIETO/${facing.frame}`) ? `QUIETO/${facing.frame}` : "frame/0";
  const sprite = animated(art.animation(name) ?? [], art.fps, once);
  if (facing.mirrored) {
    sprite.scale.x = -1;
  }
  place(sprite, at);
  return sprite;
}

/** A unit on its way: where it is, the tile it's heading for, and the tiles after. */
interface Walk {
  at: Point;
  next: Point | null;
  path: Point[];
  enter: (tile: Point) => boolean;
  arrive: () => void;
  started?: boolean;
}

/** A still picture, or an animation playing at the art's own speed (from its start and just once: `once`). */
export function animated(textures: Texture[], fps: number, once = false): Sprite {
  if (textures.length === 0) {
    return new Sprite();
  }
  let sprite: Sprite;
  if (new Set(textures).size > 1) {
    const animation = new AnimatedSprite(textures);
    animation.animationSpeed = fps / TICKER_FPS;
    if (once) {
      animation.loop = false;
      animation.gotoAndPlay(0);
    } else {
      // Start somewhere in the loop, so a crowd doesn't move in step.
      animation.gotoAndPlay(Math.floor(Math.random() * textures.length));
    }
    sprite = animation;
  } else {
    sprite = new Sprite(textures[0]);
  }
  sprite.anchor.copyFrom(anchorOf(textures[0]));
  return sprite;
}

function place(sprite: Container, at: Point): void {
  sprite.position.set(at.x, at.y);
}

/** A thing's footprint on the ground (and where an item without art stands). */
function footprint(placed: PlacedItem, colour: number): Graphics {
  const { x, y } = placed.item.isUnit ? unitPoint(placed.tx, placed.ty) : buildingPoint(placed.tx, placed.ty);
  const [w, h] = placed.item.isUnit ? [1, 1] : footprintSize(placed);
  const halfW = TILE_WIDTH / 2;
  const halfH = TILE_HEIGHT / 2;
  // The footprint's corners: bottom (the item's point), right, top, left.
  return new Graphics()
    .poly([x, y, x + halfW * h, y - halfH * h, x + halfW * (h - w), y - halfH * (w + h), x - halfW * w, y - halfH * w])
    .fill({ color: colour, alpha: 0.25 })
    .stroke({ color: colour, alpha: 0.8, width: 2 });
}
