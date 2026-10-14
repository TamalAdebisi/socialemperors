// Draws a town: the ground, then every building and unit from the back to
// the front, placed as the Flash client places them (rules/geometry.ts).
// It shows changes (a thing moved, turned or gone) but doesn't make them:
// rules/editing.ts does.

import { AnimatedSprite, ColorMatrixFilter, Container, Graphics, Sprite, type Texture } from "pixi.js";

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
import { isOpaqueAt } from "./hit.ts";

/** How often the screen draws, which Pixi counts animation speed in. */
const TICKER_FPS = 60;

export class TownView {
  readonly root = new Container();
  private readonly ground = new Container();
  /** Marks on the ground: a footprint being placed. */
  private readonly marks = new Container();
  private readonly things = new Container();
  private readonly art: ArtLibrary;
  private readonly items: Map<number, ItemInfo>;
  private readonly town: Town;
  /** Each thing on the map and the container its picture is drawn in. */
  private readonly slots = new Map<PlacedItem, Container>();
  private readonly glow = new ColorMatrixFilter();
  private highlighted: PlacedItem | null = null;

  constructor(art: ArtLibrary, items: Map<number, ItemInfo>, town: Town) {
    this.art = art;
    this.items = items;
    this.town = town;
    this.glow.brightness(1.25, false);
    this.root.addChild(this.ground, this.marks, this.things);
  }

  /** Draw everything; `progress` hears how many of the town's pictures are ready. */
  async build(progress: (done: number, total: number) => void): Promise<{ missing: string[] }> {
    const missing = new Set<string>();
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
    const slots = this.things.children;
    for (let i = slots.length - 1; i >= 0; i--) {
      const slot = slots[i];
      const picture = slot.children[0];
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
    let slot = this.slots.get(placed);
    if (!slot) {
      slot = new Container();
      this.slots.set(placed, slot);
      this.things.addChild(slot);
    }
    await this.draw(placed, slot);
    this.sort();
    if (this.highlighted === placed) {
      this.highlight(placed);
    }
  }

  /** Take a thing off the map (sold, stored). */
  remove(placed: PlacedItem): void {
    const slot = this.slots.get(placed);
    if (slot) {
      this.things.removeChild(slot);
      slot.destroy({ children: true });
      this.slots.delete(placed);
    }
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

  /** See-through while being moved. */
  setGhost(placed: PlacedItem, ghost: boolean): void {
    const slot = this.slots.get(placed);
    if (slot) {
      slot.alpha = ghost ? 0.7 : 1;
    }
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
    slot.removeChildren().forEach((child) => child.destroy());
    slot.position.set(0, 0);
    if (art === null) {
      slot.addChild(footprint(placed, 0xffffff));
      return false;
    }
    slot.addChild(placed.item.isUnit ? unitSprite(art, placed) : buildingSprite(art, placed, this.town.skin));
    return true;
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

function buildingSprite(art: ItemArt, placed: PlacedItem, skin: number): Container {
  // Its frame is the way it faces; past the last, the game shows the last.
  const facing = Math.min(placed.orientation, Math.max(art.framesOf("frame"), 1) - 1);
  const name = `frame/${facing}`;
  let textures = art.animation(name) ?? [];
  if (isTree(placed.item) && textures.length > 1) {
    // A tree's frames are its looks for each island skin (snow on ice...).
    textures = [textures[Math.min(skin, textures.length - 1)]];
  }
  const sprite = animated(textures, art.fps);
  const bounds = art.boundsOf(name);
  place(sprite, buildingOrigin(buildingPoint(placed.tx, placed.ty), bounds ?? { x: 0, y: 0, w: 0, h: 0 }));
  return sprite;
}

function unitSprite(art: ItemArt, placed: PlacedItem): Container {
  // A unit waiting in town faces down, down-right or down-left, by chance.
  const direction = IDLE_DIRECTIONS[Math.floor(Math.random() * IDLE_DIRECTIONS.length)];
  const facing = unitFacing(direction);
  const name = art.has(`QUIETO/${facing.frame}`) ? `QUIETO/${facing.frame}` : "frame/0";
  const sprite = animated(art.animation(name) ?? [], art.fps);
  if (facing.mirrored) {
    sprite.scale.x = -1;
  }
  place(sprite, unitPoint(placed.tx, placed.ty));
  return sprite;
}

/** A still picture, or an animation playing at the art's own speed. */
function animated(textures: Texture[], fps: number): Sprite {
  if (textures.length === 0) {
    return new Sprite();
  }
  let sprite: Sprite;
  if (new Set(textures).size > 1) {
    const animation = new AnimatedSprite(textures);
    animation.animationSpeed = fps / TICKER_FPS;
    // Start somewhere in the loop, so a crowd doesn't move in step.
    animation.gotoAndPlay(Math.floor(Math.random() * textures.length));
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
