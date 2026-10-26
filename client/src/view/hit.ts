// Whether a point of the screen is on a picture's visible part, not on the
// see-through space around it, as the Flash client tests clicks. A tree's
// box overlaps the house behind it; its transparent corners mustn't catch
// clicks meant for the house.

import { Sprite, ViewContainer, type Container } from "pixi.js";

import type { Point } from "../rules/geometry.ts";
import { maskedOpaque } from "./onChip.ts";

/** Pixels this see-through or more don't count as the picture. */
const MIN_ALPHA = 32;

type Rect = { x: number; y: number; width: number; height: number };

/** The current picture's trimmed box on screen, without its empty export canvas. */
export function visualScreenBox(picture: Container): Rect {
  if (!(picture instanceof Sprite)) {
    return picture.getBounds();
  }
  // Sprite.getBounds() includes texture.orig, even when most of that canvas
  // was trimmed away. Bull Gladiator's canvas is 1060px wide; its idle
  // picture is about 250–390px. Padding mustn't become a selectable margin.
  const { minX, maxX, minY, maxY } = picture.visualBounds;
  const { a, b, c, d, tx, ty } = picture.getGlobalTransform();
  const width = maxX - minX, height = maxY - minY;
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const halfWidth = (Math.abs(a) * width + Math.abs(c) * height) / 2;
  const halfHeight = (Math.abs(b) * width + Math.abs(d) * height) / 2;
  return {
    x: a * cx + c * cy + tx - halfWidth,
    y: b * cx + d * cy + ty - halfHeight,
    width: halfWidth * 2,
    height: halfHeight * 2,
  };
}

/**
 * A picture's box on its slot's layer (the map's things): its own box moved
 * by the picture's and the slot's positions and scales. Sums only, where
 * getBounds works its way up to the screen, so it's cheap enough for every
 * picture on the map: to pass over those nowhere near a point (TownView's
 * itemAt), or off the screen (its culling).
 */
export function layerBox(slot: Container, picture: Container): Rect {
  const own = picture instanceof ViewContainer ? picture.bounds : picture.getLocalBounds();
  picture.updateLocalTransform();
  slot.updateLocalTransform();
  const p = picture.localTransform, s = slot.localTransform;
  // The two moves as one: the slot's after the picture's.
  const a = s.a * p.a + s.c * p.b, b = s.b * p.a + s.d * p.b;
  const c = s.a * p.c + s.c * p.d, d = s.b * p.c + s.d * p.d;
  const tx = s.a * p.tx + s.c * p.ty + s.tx, ty = s.b * p.tx + s.d * p.ty + s.ty;
  // A corner's x is a·x + c·y + tx: the box's least x takes the lesser of each part (and so on),
  // without listing the four corners. It runs for every picture each frame (culling): no arrays.
  const x = tx + Math.min(a * own.minX, a * own.maxX) + Math.min(c * own.minY, c * own.maxY);
  const y = ty + Math.min(b * own.minX, b * own.maxX) + Math.min(d * own.minY, d * own.maxY);
  const right = tx + Math.max(a * own.minX, a * own.maxX) + Math.max(c * own.minY, c * own.maxY);
  const bottom = ty + Math.max(b * own.minX, b * own.maxX) + Math.max(d * own.minY, d * own.maxY);
  return { x, y, width: right - x, height: bottom - y };
}

/**
 * How far past the screen's edges a picture is still drawn when culling, in
 * screen pixels: room for what goes with it beside it (bars, rings, flames).
 */
export const CULL_MARGIN = 200;

/**
 * The screen (`screen`: its size), with CULL_MARGIN round it, on a layer
 * of the map: what a picture's layerBox must touch to be drawn.
 */
export function seenOnLayer(layer: Container, screen: { width: number; height: number }): Rect {
  const from = layer.toLocal({ x: -CULL_MARGIN, y: -CULL_MARGIN });
  const to = layer.toLocal({ x: screen.width + CULL_MARGIN, y: screen.height + CULL_MARGIN });
  return { x: Math.min(from.x, to.x), y: Math.min(from.y, to.y), width: Math.abs(to.x - from.x), height: Math.abs(to.y - from.y) };
}

/** Whether two boxes share any of their area. */
export function overlaps(one: Rect, other: Rect): boolean {
  return one.x < other.x + other.width && other.x < one.x + one.width && one.y < other.y + other.height && other.y < one.y + one.height;
}

/** Whether a point is in a box or within `margin` of it. */
export function nearBox(box: Rect, at: Point, margin: number): boolean {
  return at.x >= box.x - margin && at.x <= box.x + box.width + margin && at.y >= box.y - margin && at.y <= box.y + box.height + margin;
}

/** A unit's target: at least this far each way from its middle, on the screen... */
const UNIT_HALF_TARGET = 22;
/** ...and this far past its picture. */
const UNIT_MARGIN = 8;
/**
 * The furthest outside a unit's picture box a near miss can be, on the
 * screen: a 22px half target round a middle that is inside the box.
 */
export const UNIT_REACH = Math.max(UNIT_HALF_TARGET, UNIT_MARGIN);

/** Units get an eight-pixel margin and at least a 44px target at every zoom. */
export function unitHitDistance(box: Rect, screen: Point): number {
  if (box.width <= 0 || box.height <= 0) return Infinity;
  const dx = Math.abs(screen.x - (box.x + box.width / 2));
  const dy = Math.abs(screen.y - (box.y + box.height / 2));
  if (dx > Math.max(UNIT_HALF_TARGET, box.width / 2 + UNIT_MARGIN) || dy > Math.max(UNIT_HALF_TARGET, box.height / 2 + UNIT_MARGIN)) {
    return Infinity;
  }
  return Math.hypot(dx, dy);
}

let probe: CanvasRenderingContext2D | null = null;

export function isOpaqueAt(picture: Container, screen: Point): boolean {
  if (!picture.getBounds().containsPoint(screen.x, screen.y)) {
    return false;
  }
  if (!(picture instanceof Sprite)) {
    return true;  // an outline drawn for an item without art: its box will do
  }
  const texture = picture.texture;
  const pixel = sheetPixel(picture.toLocal(screen), picture.anchor, texture.orig, texture.trim ?? null, texture.frame,
    texture.source.resolution);
  if (!pixel) {
    return false;
  }
  // A page kept on the graphics chip only has a map of its see-through parts (view/onChip.ts).
  const masked = maskedOpaque(texture.source, pixel.x, pixel.y);
  if (masked !== undefined) {
    return masked;
  }
  const source = texture.source.resource as CanvasImageSource | undefined;
  if (!source) {
    return true;
  }
  probe ??= makeProbe();
  if (!probe) {
    return true;
  }
  probe.clearRect(0, 0, 1, 1);
  probe.drawImage(source, pixel.x, pixel.y, 1, 1, 0, 0, 1, 1);
  return probe.getImageData(0, 0, 1, 1).data[3] >= MIN_ALPHA;
}

/**
 * Which pixel of the sprite sheet a point of a sprite shows, or null when the
 * point is in the see-through border the packer trimmed off.
 * `local` is measured from the sprite's anchor; `orig` is the whole picture
 * before trimming, `trim` the part of it kept, `frame` where that part is in
 * the sheet. All are in the game's pixels; `scale` is the sheet's pixels to
 * one of those (0.5 for the biggest gods, stored at half size).
 */
export function sheetPixel(local: Point, anchor: Point, orig: Rect, trim: Rect | null, frame: Rect,
  scale = 1): Point | null {
  // From the anchor to the whole picture's top left...
  let x = local.x + anchor.x * orig.width;
  let y = local.y + anchor.y * orig.height;
  // ...to the kept part's top left...
  if (trim) {
    x -= trim.x;
    y -= trim.y;
  }
  if (x < 0 || y < 0 || x >= frame.width || y >= frame.height) {
    return null;
  }
  // ...to the sheet.
  return { x: Math.floor((frame.x + x) * scale), y: Math.floor((frame.y + y) * scale) };
}

function makeProbe(): CanvasRenderingContext2D | null {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  return canvas.getContext("2d", { willReadFrequently: true });
}
