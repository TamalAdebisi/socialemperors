// An item's picture on a plain canvas, for the windows in HTML (the shop):
// cut from the same sprite sheet the map uses, and fitted to the canvas.

import type { ItemInfo } from "../rules/config.ts";
import type { ArtLibrary } from "./art.ts";

/** A picture is never drawn more than this much larger than its art. */
const MOST_ENLARGED = 1.5;

export async function drawThumbnail(art: ArtLibrary, item: ItemInfo, canvas: HTMLCanvasElement): Promise<void> {
  // Sharp on high-resolution screens: as many canvas pixels as screen pixels.
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.round((canvas.clientWidth || 96) * ratio);
  const height = Math.round((canvas.clientHeight || 96) * ratio);
  canvas.width = width;
  canvas.height = height;
  const texture = (await art.get(item.art))?.cover();
  const source = texture?.source.resource as CanvasImageSource | undefined;
  const context = canvas.getContext("2d");
  if (!texture || !source || !context) {
    canvas.classList.add("missing");  // no art (yet): the card shows without a picture
    return;
  }
  const frame = texture.frame;
  const scale = Math.min(width / frame.width, height / frame.height, MOST_ENLARGED * ratio);
  const w = frame.width * scale;
  const h = frame.height * scale;
  context.imageSmoothingQuality = "high";
  context.drawImage(source, frame.x, frame.y, frame.width, frame.height, (width - w) / 2, (height - h) / 2, w, h);
}
