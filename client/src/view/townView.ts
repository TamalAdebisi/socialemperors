// Draws a town: the ground, then every building and unit from the back to
// the front, placed as the Flash client places them (rules/geometry.ts).
// Look only: nothing here changes the town (step 2 of CLIENT.md).

import { AnimatedSprite, Container, Graphics, Sprite, type Texture } from "pixi.js";

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
import type { PlacedItem, Town } from "../rules/town.ts";
import { anchorOf, type ArtLibrary, type ItemArt } from "./art.ts";

/** How often the screen draws, which Pixi counts animation speed in. */
const TICKER_FPS = 60;

export class TownView {
  readonly root = new Container();
  private readonly ground = new Container();
  private readonly things = new Container();
  private readonly art: ArtLibrary;
  private readonly items: Map<number, ItemInfo>;
  private readonly town: Town;

  constructor(art: ArtLibrary, items: Map<number, ItemInfo>, town: Town) {
    this.art = art;
    this.items = items;
    this.town = town;
    this.root.addChild(this.ground, this.things);
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
      this.things.addChild(slot);
      jobs.push(this.art.get(placed.item.art).then((art) => {
        if (art === null) {
          missing.add(placed.item.art);
          slot.addChild(footprint(placed));
        } else {
          slot.addChild(placed.item.isUnit ? unitSprite(art, placed) : buildingSprite(art, placed, this.town.skin));
        }
      }));
    }

    let done = 0;
    progress(0, jobs.length);
    await Promise.all(jobs.map((job) => job.then(() => progress(++done, jobs.length))));
    return { missing: [...missing] };
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

/** Where an item without art (yet) stands: its outline on the ground. */
function footprint(placed: PlacedItem): Graphics {
  const { x, y } = placed.item.isUnit ? unitPoint(placed.tx, placed.ty) : buildingPoint(placed.tx, placed.ty);
  const w = placed.item.isUnit ? 1 : placed.item.width;
  const h = placed.item.isUnit ? 1 : placed.item.height;
  const halfW = TILE_WIDTH / 2;
  const halfH = TILE_HEIGHT / 2;
  // The footprint's corners: bottom (the item's point), right, top, left.
  return new Graphics()
    .poly([x, y, x + halfW * h, y - halfH * h, x + halfW * (h - w), y - halfH * (w + h), x - halfW * w, y - halfH * w])
    .fill({ color: 0xffffff, alpha: 0.15 })
    .stroke({ color: 0xffffff, alpha: 0.5, width: 2 });
}
