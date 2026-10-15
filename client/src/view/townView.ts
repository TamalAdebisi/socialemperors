// Draws a town: the ground, then every building and unit from the back to
// the front, placed as the Flash client places them (rules/geometry.ts).
// It shows changes (a thing moved, turned or gone) but doesn't make them:
// rules/editing.ts does.

import { AnimatedSprite, Assets, ColorMatrixFilter, Container, Graphics, Sprite, type Texture } from "pixi.js";

import type { ItemInfo } from "../rules/config.ts";
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
import { fireSprite, fireStage } from "./fire.ts";
import { isOpaqueAt } from "./hit.ts";
import { lookKey, lookOf } from "./looks.ts";
import { Markers, type Sign } from "./markers.ts";
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
  private readonly glow = new ColorMatrixFilter();
  private highlighted: PlacedItem | null = null;
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

  constructor(art: ArtLibrary, items: Map<number, ItemInfo>, town: Town) {
    this.art = art;
    this.items = items;
    this.town = town;
    this.glow.brightness(1.25, false);
    this.outlineFill.matrix = OUTLINE_MATRIX as typeof this.outlineFill.matrix;
    this.root.addChild(this.ground, this.landSigns, this.marks, this.things, this.ghostLayer, this.markers.layer);
    this.ghostLayer.alpha = 0.7;
  }

  /**
   * A raid has the town (homeDefence.ts): the battle draws everything on
   * the map but the ground, until it's over.
   */
  setFighting(fighting: boolean): void {
    for (const layer of [this.marks, this.things, this.ghostLayer, this.markers.layer]) {
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
      void this.draw(placed, slot);
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
    for (const [placed, walk] of this.walkers) {
      this.stepWalk(placed, walk, Math.min(ms, 100));
    }
    this.lookAroundIn -= ms;
    if (this.lookAroundIn <= 0) {
      this.lookAroundIn += LOOK_AROUND_MS;
      for (const [placed, direction] of this.facing) {
        const turned = this.walkers.has(placed) || this.poses.has(placed) ? null : lookAround(placed, direction);
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
    if (slot) {
      pictureOf(slot)?.position.set(walk.at.x, walk.at.y);
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

  /** One of the game's pictures popping up over a thing for a moment. */
  pop(placed: PlacedItem, url: string): void {
    this.markers.pop(this.topOf(placed) ?? buildingPoint(placed.tx, placed.ty), url);
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
    return null;
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
    if (this.highlighted === placed) {
      this.highlight(placed);
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
    const slot = this.slots.get(placed);
    if (slot) {
      this.things.removeChild(slot);
      slot.destroy({ children: true });
      this.slots.delete(placed);
    }
    this.markers.remove(placed);
    if (this.highlighted === placed) {
      this.highlighted = null;
    }
  }

  /** Make one thing stand out (the one selected), or none. */
  highlight(placed: PlacedItem | null): void {
    for (const slot of this.slots.values()) {
      slot.filters = [];
    }
    this.highlighted = placed;
    const slot = placed ? this.slots.get(placed) : undefined;
    if (slot) {
      slot.filters = [this.glow];
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
  showFootprint(placed: PlacedItem | null, fits = true): void {
    this.marks.removeChildren().forEach((child) => child.destroy());
    if (placed) {
      this.marks.addChild(footprint(placed, fits ? 0x5fd35f : 0xe0533d));
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

  /** Draw a unit again: facing another way, or walking, or standing still. */
  private async redrawUnit(placed: PlacedItem): Promise<void> {
    const slot = this.slots.get(placed);
    const art = await this.art.get(placed.item.art);
    if (!slot || slot.destroyed || art === null) {
      return;
    }
    const walk = this.walkers.get(placed);
    const sprite = unitSprite(art, this.facing.get(placed) ?? 5, walk ? "ANDAR" : this.poses.get(placed) ?? "QUIETO", walk?.at ?? unitPoint(placed.tx, placed.ty));
    slot.removeChildren().forEach((child) => child.destroy());
    slot.addChild(sprite);
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

/** A thing's picture in its slot: not its outline. */
function pictureOf(slot: Container): Container | undefined {
  return slot.children.find((child) => child.label !== OUTLINE);
}

export function buildingSprite(art: ItemArt, placed: PlacedItem, skin: number, ready = false, still?: number): Container {
  // Its frame is the way it faces; past the last, the game shows the last.
  const facing = Math.min(placed.orientation, Math.max(art.framesOf("frame"), 1) - 1);
  const name = `frame/${facing}`;
  let textures = art.animation(name) ?? [];
  if (isTree(placed.item) && textures.length > 1) {
    // A tree's frames are its looks for each island skin (snow on ice...).
    textures = [textures[Math.min(skin, textures.length - 1)]];
  } else if (still !== undefined && art.has("steps/0")) {
    // A chest that fills up as its camp goes: the picture with this many steps.
    const steps = art.animation("steps/0") ?? [];
    textures = [steps[Math.min(still, steps.length - 1)]];
  } else if (still !== undefined && textures.length > 1) {
    textures = [textures[Math.min(still, textures.length - 1)]];
  }
  // A farm or ranch: only the pictures that fit who's inside and its harvest.
  const look = lookOf(placed, textures.length, ready);
  if (look) {
    textures = look.map((i) => textures[i]);
  }
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
