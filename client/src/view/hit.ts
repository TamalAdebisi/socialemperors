// Whether a point of the screen is on a picture's visible part, not on the
// see-through space around it, as the Flash client tests clicks. A tree's
// box overlaps the house behind it; its transparent corners mustn't catch
// clicks meant for the house.

import { Sprite, type Container } from "pixi.js";

import type { Point } from "../rules/geometry.ts";

/** Pixels this see-through or more don't count as the picture. */
const MIN_ALPHA = 32;

type Rect = { x: number; y: number; width: number; height: number };

/** Units get an eight-pixel margin and at least a 44px target at every zoom. */
export function unitHitDistance(box: Rect, screen: Point): number {
  if (box.width <= 0 || box.height <= 0) return Infinity;
  const dx = Math.abs(screen.x - (box.x + box.width / 2));
  const dy = Math.abs(screen.y - (box.y + box.height / 2));
  if (dx > Math.max(22, box.width / 2 + 8) || dy > Math.max(22, box.height / 2 + 8)) return Infinity;
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
