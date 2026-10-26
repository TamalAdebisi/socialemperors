// An item's picture on a plain canvas, for the windows in HTML (the shop):
// cut from the same sprite sheet the map uses, and fitted to the canvas.
// It's cut straight from the sheet's file (ArtLibrary.cutouts): browsing the
// shop puts nothing on the graphics chip and keeps no whole sheet.

import type { ItemInfo } from "../rules/config.ts";
import type { ArtLibrary, Cutout } from "./art.ts";

/** A picture is never drawn more than this much larger than its art. */
const MOST_ENLARGED = 1.5;
/** Pictures kept for cards drawn again (another tab, the shop opened again): the last this many. */
const KEPT = 64;

const covers = new Map<string, Promise<Cutout | null>>();

/** The picture that stands for an item: a building's first way, a unit's first standing picture. */
function cover(art: ArtLibrary, name: string): Promise<Cutout | null> {
  let picture = covers.get(name);
  if (picture) {
    covers.delete(name);  // to the back of the queue: kept longest
  } else {
    picture = art.cutouts(name, (runs) => {
      const first = runs.find(([run]) => run === "frame/0") ?? runs[0];
      return [first ? first[1].slice(0, 1) : []];
    }).then((cut) => cut?.runs[0]?.[0] ?? null);
  }
  covers.set(name, picture);
  if (covers.size > KEPT) {
    covers.delete(covers.keys().next().value!);
  }
  return picture;
}

export async function drawThumbnail(art: ArtLibrary, item: ItemInfo, canvas: HTMLCanvasElement): Promise<void> {
  // Sharp on high-resolution screens: as many canvas pixels as screen pixels.
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.round((canvas.clientWidth || 96) * ratio);
  const height = Math.round((canvas.clientHeight || 96) * ratio);
  canvas.width = width;
  canvas.height = height;
  const picture = await cover(art, item.art);
  const context = canvas.getContext("2d");
  if (!picture || !context) {
    canvas.classList.add("missing");  // no art (yet): the card shows without a picture
    return;
  }
  const scale = Math.min(width / picture.width, height / picture.height, MOST_ENLARGED * ratio);
  const w = picture.width * scale;
  const h = picture.height * scale;
  context.imageSmoothingQuality = "high";
  // The picture's own pixels (half as many for a sheet stored at half size), fitted to the card.
  context.drawImage(picture.image, (width - w) / 2, (height - h) / 2, w, h);
}
