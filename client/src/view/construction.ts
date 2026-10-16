// Something being built (rules/construction.ts), as the Flash client shows
// it: the game's scaffolding in its place (workers at work, a farm's field
// being dug, a ranch's fence going up: tools/art/export_ui.py makes the
// sheets), placed as the game places it. Its bar is in view/bars.ts.

import { AnimatedSprite, type Sprite } from "pixi.js";

import { scaffoldOf, type Scaffold } from "../rules/construction.ts";
import { buildingOrigin, type Point } from "../rules/geometry.ts";
import type { ItemInfo } from "../rules/config.ts";
import { bundledArt, type ItemArt } from "./art.ts";

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
