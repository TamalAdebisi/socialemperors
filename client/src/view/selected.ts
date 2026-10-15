// What's selected, marked as the Flash client marks it. Under it: a golden
// ring for a unit, the golden outline of its ground for a building (a
// picture for each size, 1x1 to 5x5, and 6x6 for anything wider). Over it:
// its life bar, green, red for what it has lost. All the game's own pictures
// (tools/art/export_ui.py).

import { Assets, Container, Sprite, type Texture } from "pixi.js";

import { TILE_HEIGHT, buildingPoint, unitPoint, type Point } from "../rules/geometry.ts";
import type { PlacedItem } from "../rules/town.ts";
import anchors from "./art/anchors.json" with { type: "json" };

/** The marks' labels in a thing's slot, to tell them from the thing's picture. */
export const SELECTED = "selected";
export const LIFE = "life";

const UNIT = "selected-unit";
const SIZES = [1, 2, 3, 4, 5, 6].map((n) => `selected-${n}x${n}`);
const BAR = "life-bar";
const GREEN = "life-bar-green";
const URLS = Object.fromEntries([UNIT, ...SIZES, BAR, GREEN].map((name) => [name, new URL(`./art/${name}.webp`, import.meta.url).href]));
/** The game shows its life bar at 0.6 of its size, and 5 px above the thing's picture. */
const BAR_SCALE = 0.6;
const BAR_ABOVE = 5;

/** The pictures, once loaded: kept so the marks go back at once each time a unit is drawn again (it turns, it walks). */
const textures = new Map<string, Texture>();
let loading: Promise<void> | null = null;

/** Load the marks' pictures (once). Until they're here, nothing is marked. */
export function loadSelected(): Promise<void> {
  loading ??= Promise.all(Object.entries(URLS).map(async ([name, url]) => {
    textures.set(name, await Assets.load<Texture>(url));
  })).then(() => undefined, () => undefined);
  return loading;
}

/** Which picture goes under a thing: the ring for a unit, the outline of its size for a building. */
export function selectedName(placed: PlacedItem): string {
  return placed.item.isUnit ? UNIT : SIZES[Math.min(6, Math.max(1, placed.item.width)) - 1];
}

/**
 * Where a thing stands: a building's point (the bottom corner of its
 * ground), a unit's (the middle of its tile, or `at` while it walks).
 */
function pointOf(placed: PlacedItem, at?: Point): Point {
  return placed.item.isUnit ? at ?? unitPoint(placed.tx, placed.ty) : buildingPoint(placed.tx, placed.ty);
}

/** Where the ring or outline goes: a building's own point; half a tile lower for a unit, as the game puts it, so the ring is round its feet. */
export function selectedPoint(placed: PlacedItem, at?: Point): Point {
  const p = pointOf(placed, at);
  return placed.item.isUnit ? { x: p.x, y: p.y + TILE_HEIGHT / 2 } : p;
}

/** How much of its life a thing has, 0 to 1: a building hurt in a raid has less; units in town are whole. */
export function lifeShare(placed: PlacedItem): number {
  const life = placed.item.life;
  if (!(life > 0) || placed.health === undefined) {
    return 1;
  }
  return Math.min(1, Math.max(0, placed.health / life));
}

/**
 * Mark a thing as selected, in its slot: the ring or outline under its
 * picture, the life bar over it (above the picture's height, from where it
 * stands, as the game measures). False while the pictures are still loading.
 */
export function markSelected(slot: Container, placed: PlacedItem, picture: Container, at?: Point): boolean {
  unmarkSelected(slot);
  const under = textures.get(selectedName(placed));
  const back = textures.get(BAR);
  const green = textures.get(GREEN);
  if (!under || !back || !green) {
    return false;
  }
  const ring = sprite(under, selectedName(placed));
  ring.label = SELECTED;
  const p = selectedPoint(placed, at);
  ring.position.set(p.x, p.y);
  slot.addChildAt(ring, 0);

  const bar = new Container({ label: LIFE });
  const backSprite = sprite(back, BAR, BAR_SCALE);
  backSprite.anchor.x = 0;
  const greenSprite = sprite(green, GREEN, BAR_SCALE);
  greenSprite.anchor.x = 0;
  greenSprite.scale.x *= lifeShare(placed);
  bar.addChild(backSprite, greenSprite);
  const stands = pointOf(placed, at);
  bar.position.set(stands.x - backSprite.width / 2, stands.y - picture.getLocalBounds().height - BAR_ABOVE);
  slot.addChild(bar);

  // Neither is part of the thing's size (signs over it stay put) nor takes taps.
  for (const mark of [ring, bar]) {
    mark.measurable = false;
    mark.eventMode = "none";
  }
  return true;
}

/** Take a thing's selection marks away. */
export function unmarkSelected(slot: Container): void {
  slot.getChildByLabel(SELECTED)?.destroy();
  slot.getChildByLabel(LIFE)?.destroy({ children: true });
}

function sprite(texture: Texture, name: string, size = 1): Sprite {
  const anchor = (anchors as Record<string, { x: number; y: number; scale: number }>)[name];
  const s = new Sprite(texture);
  s.anchor.set(anchor.x, anchor.y);
  s.scale.set(size / anchor.scale);
  return s;
}
