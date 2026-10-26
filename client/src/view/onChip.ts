// Pictures kept on the graphics chip only. A sheet's page, decoded, is a
// big picture in the page's own memory (64 MB for a whole page), and PixiJS
// keeps it after copying it to the graphics chip, in case it must copy it
// again. With the renderer known, each page is copied there at once, a
// small map of its see-through parts is kept for taps (hit.ts), and the
// page's own copy is let go: a big unit takes about 40% less memory. If the
// graphics chip is reset (a phone may do it to a page in the background),
// the pages are made again from their files. CLIENT.md, "Light art".

import type { Renderer, TextureSource } from "pixi.js";

/** Makes a group's pictures again, one per page, in the order given to keep. */
export type Remake = () => Promise<CanvasImageSource[]>;

interface Group {
  sources: TextureSource[];
  remake: Remake;
}

/** Where a page is see-through, at half its size each way: one bit per 2 x 2 pixels. */
export interface Mask {
  width: number;
  height: number;
  bits: Uint8Array;
}

/** A 2 x 2 block counts as the picture from this average alpha: one pixel of it at hit.ts's limit (32). */
const MASK_ALPHA = 8;

const masks = new WeakMap<TextureSource, Mask>();

/**
 * Whether a page's pixel (in its own pixels) is part of a picture, from the
 * map kept when the page was let go; undefined when it has none (the page
 * still has its own copy, to look at).
 */
export function maskedOpaque(source: TextureSource, x: number, y: number): boolean | undefined {
  const mask = masks.get(source);
  return mask ? opaqueIn(mask, x, y) : undefined;
}

/** Whether a mask has the picture at a page's pixel (x, y). */
export function opaqueIn(mask: Mask, x: number, y: number): boolean {
  const mx = Math.floor(x / 2), my = Math.floor(y / 2);
  if (mx < 0 || my < 0 || mx >= mask.width || my >= mask.height) {
    return false;
  }
  const i = my * mask.width + mx;
  return (mask.bits[i >> 3] & (1 << (i & 7))) !== 0;
}

/** A mask from a page drawn at half size (RGBA, `width` x `height`): one bit a pixel. */
export function maskFrom(pixels: Uint8ClampedArray, width: number, height: number): Mask {
  const bits = new Uint8Array(Math.ceil((width * height) / 8));
  for (let i = 0, alpha = 3; i < width * height; i++, alpha += 4) {
    if (pixels[alpha] >= MASK_ALPHA) {
      bits[i >> 3] |= 1 << (i & 7);
    }
  }
  return { width, height, bits };
}

/** The map of a page's see-through parts, read from its picture at half size. */
function maskOf(image: CanvasImageSource, width: number, height: number): Mask | null {
  const w = Math.max(1, Math.ceil(width / 2)), h = Math.max(1, Math.ceil(height / 2));
  const canvas = Object.assign(document.createElement("canvas"), { width: w, height: h });
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return null;
  }
  // Halving averages each 2 x 2 block.
  context.drawImage(image, 0, 0, width / 2, height / 2);
  const pixels = context.getImageData(0, 0, w, h).data;
  canvas.width = canvas.height = 0;
  return maskFrom(pixels, w, h);
}

/** What a page holds once let go: one see-through pixel, never drawn (the graphics chip has the picture). */
let empty: ImageData | null = null;

function letGo(source: TextureSource): void {
  const picture = source.resource as unknown;
  empty ??= new ImageData(1, 1);
  if (picture === empty) {
    return;
  }
  source.resource = empty;
  if (typeof ImageBitmap !== "undefined" && picture instanceof ImageBitmap) {
    picture.close();
  } else if (typeof HTMLCanvasElement !== "undefined" && picture instanceof HTMLCanvasElement) {
    picture.width = picture.height = 0;  // a canvas gives its memory back when it has no pixels
  }
}

/** Whether a page's own copy has been let go (its picture is on the graphics chip only). */
export function onChipOnly(source: TextureSource): boolean {
  return empty !== null && source.resource === empty;
}

export class OnChip {
  private readonly renderer: Renderer;
  private readonly groups = new Set<Group>();
  private readonly kept = new WeakSet<TextureSource>();

  constructor(renderer: Renderer) {
    this.renderer = renderer;
    // After the graphics chip is reset: PixiJS has forgotten every picture; make them again.
    renderer.runners.contextChange.add({ contextChange: () => void this.restore() });
  }

  /**
   * Copies pages to the graphics chip now, keeps their maps for taps, and
   * lets go of their own copies. `remake` makes them again if the chip is
   * reset.
   */
  keep(sources: TextureSource[], remake: Remake): void {
    const fresh = sources.filter((source) => !this.kept.has(source) && !source.destroyed);
    if (fresh.length === 0) {
      return;
    }
    const group: Group = { sources, remake };
    for (const source of fresh) {
      this.kept.add(source);
      const mask = maskOf(source.resource as CanvasImageSource, source.pixelWidth, source.pixelHeight);
      if (mask) {
        masks.set(source, mask);
      }
      this.upload(source);
      letGo(source);
      source.once("destroy", () => this.groups.delete(group));
    }
    this.groups.add(group);
  }

  private upload(source: TextureSource): void {
    // Sends the page now (and makes its smaller copies for zooming out), not when first drawn.
    this.renderer.texture.initSource(source);
  }

  private async restore(): Promise<void> {
    for (const group of [...this.groups]) {
      let pictures: CanvasImageSource[];
      try {
        pictures = await group.remake();
      } catch (error) {
        console.warn("A picture could not be made again after the graphics chip reset:", error);
        continue;
      }
      group.sources.forEach((source, n) => {
        const picture = pictures[n];
        if (source.destroyed || !picture) {
          return;
        }
        source.resource = picture;
        source.update();  // sends it again if PixiJS has drawn it since the reset...
        this.upload(source);  // ...or for the first time since
        letGo(source);
      });
    }
  }
}
