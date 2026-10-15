// Something being built (rules/construction.ts), as the Flash client shows
// it: the game's scaffolding in its place (workers at work, a farm's field
// being dug, a ranch's fence going up: tools/art/export_ui.py makes the
// sheets), placed as the game places it, and the bar under it filling for
// 10 seconds with the percentage on it. A 1x1 thing has the percentage
// alone. The bar keeps its size on the screen whatever the zoom, as there.

import { AnimatedSprite, Assets, Container, Graphics, Sprite, Text, type Texture } from "pixi.js";

import { scaffoldOf, type Scaffold } from "../rules/construction.ts";
import { buildingOrigin, type Point } from "../rules/geometry.ts";
import type { ItemInfo } from "../rules/config.ts";
import { bundledArt, type ItemArt } from "./art.ts";
import anchors from "./art/anchors.json" with { type: "json" };

/** The label of a thing's bar in its slot, to tell it from the thing's picture. */
export const PROGRESS = "progress";

const KINDS: Scaffold[] = ["scaffold-1x1", "scaffold-2x2", "scaffold-3x3", "scaffold-4x4", "scaffold-farm", "scaffold-ranch"];
const SHEETS = Object.fromEntries(KINDS.map((kind) => [kind, {
  json: new URL(`./art/${kind}.json`, import.meta.url).href,
  image: new URL(`./art/${kind}.webp`, import.meta.url).href,
}])) as Record<Scaffold, { json: string; image: string }>;
const loading = new Map<Scaffold, Promise<ItemArt | null>>();

/** A scaffold's sheet, loaded the first time something needs it; null if it can't be. */
export function scaffoldArt(item: ItemInfo): Promise<ItemArt | null> {
  const kind = scaffoldOf(item);
  let art = loading.get(kind);
  if (!art) {
    art = bundledArt(kind, SHEETS[kind].json, SHEETS[kind].image).catch((error: unknown) => {
      console.warn(`No scaffolding ${kind}:`, error);
      return null;
    });
    loading.set(kind, art);
  }
  return art;
}

/**
 * The scaffolding standing on `point` (a building's, or a unit's), `ms`
 * into its building: it plays once, then its workers keep at it. The game
 * places it as it places a building, by its box as it first appears.
 */
export function scaffoldSprite(art: ItemArt, point: Point, ms: number): Sprite {
  const build = art.animation("build/0") ?? [];
  const hold = art.animation("hold/0") ?? [];
  const sprite = new AnimatedSprite(build.length > 0 ? build : hold);
  sprite.animationSpeed = art.fps / 60;  // the ticker's 60 frames a second
  const goRound = () => {
    sprite.textures = hold.length > 0 ? hold : build;
    sprite.loop = true;
    sprite.gotoAndPlay(0);
  };
  const at = Math.floor((ms / 1000) * art.fps);
  if (at >= build.length) {
    goRound();
  } else {
    sprite.loop = false;
    sprite.onComplete = goRound;
    sprite.gotoAndPlay(at);
  }
  const bounds = art.boundsOf("build/0") ?? { x: 0, y: 0, w: 0, h: 0 };
  sprite.position.copyFrom(buildingOrigin(point, bounds));
  return sprite;
}

const BACK = new URL("./art/progress-back.webp", import.meta.url).href;
const FILL = new URL("./art/progress-fill.webp", import.meta.url).href;
/** Where the yellow is on its picture, from the game's point (pixels at the game's size): it fills from the left. */
const FILL_LEFT = -64.7;
const FILL_WIDTH = 130.7;
/** The bar's middle, where the percentage goes, and how far over its thing's point it is (10 px, as the game has it). */
const MIDDLE = { x: 2, y: -1.7 };
const ABOVE = 10;
const textures = new Map<string, Texture>();

/**
 * The bar under something being built (or its percentage alone, `textOnly`):
 * set(share) fills it. Put it at the thing's point; it sits 10 px above.
 */
export class ProgressBar extends Container {
  private readonly fill: Sprite | null = null;
  private readonly cover = new Graphics();
  private readonly percent: Text;
  private shown = -1;

  constructor(point: Point, textOnly: boolean) {
    super();
    this.label = PROGRESS;
    this.position.set(point.x, point.y - ABOVE);
    this.eventMode = "none";
    if (!textOnly) {
      const back = picture(BACK, "progress-back");
      this.fill = picture(FILL, "progress-fill");
      if (back && this.fill) {
        this.fill.mask = this.cover;
        this.addChild(back, this.fill, this.cover);
      }
    }
    this.percent = new Text({
      text: "0%",
      anchor: 0.5,
      style: {
        fontFamily: "system-ui, sans-serif", fontSize: 14, fontWeight: "800", fill: 0x252525,
        // The percentage alone has a white glow round it, as the game draws it.
        ...(textOnly ? { stroke: { color: 0xffffff, width: 4, join: "round" as const } } : {}),
      },
    });
    this.percent.position.set(MIDDLE.x, MIDDLE.y);
    this.addChild(this.percent);
  }

  /** How full: 0 to 1. */
  set(share: number): void {
    const percent = Math.min(100, Math.floor(share * 100));
    if (percent === this.shown) {
      return;
    }
    this.shown = percent;
    this.percent.text = `${percent}%`;
    this.cover.clear().rect(FILL_LEFT, -20, FILL_WIDTH * Math.min(1, share), 40).fill({ color: 0xffffff });
  }
}

/** Load the bar's pictures (once). Until they're here, a bar shows its percentage alone. */
export async function loadProgress(): Promise<void> {
  await Promise.all([BACK, FILL].map(async (url) => {
    textures.set(url, await Assets.load<Texture>(url));
  })).catch(() => undefined);
}

function picture(url: string, name: string): Sprite | null {
  const texture = textures.get(url);
  if (!texture) {
    return null;
  }
  const anchor = (anchors as Record<string, { x: number; y: number; scale: number }>)[name];
  const sprite = new Sprite(texture);
  sprite.anchor.set(anchor.x, anchor.y);
  sprite.scale.set(1 / anchor.scale);
  return sprite;
}
