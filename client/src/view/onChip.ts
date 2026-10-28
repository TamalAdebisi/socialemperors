// Pictures kept on the graphics chip only. A sheet's page, decoded, is a
// big picture in the page's own memory (64 MB for a whole page), and PixiJS
// keeps it after copying it to the graphics chip, in case it must copy it
// again. With the renderer known, each page is copied there at once, a
// small map of its see-through parts is kept for taps (hit.ts), and the
// page's own copy is let go: a big unit takes about 40% less memory. A page
// in the graphics chip's own format (KTX2) is let go of the same way, its
// map coming from the sheet's mask file. If the graphics chip is reset (a
// phone may do it to a page in the background), drawing pauses while the
// pages are made again from their files. CLIENT.md, "Light art".

import { Ticker, type Renderer, type TextureSource } from "pixi.js";

/** A page's picture: a picture to draw, or the graphics chip's own format, one buffer per size (KTX2). */
export type Picture = CanvasImageSource | Uint8Array[];

/** Makes a group's pictures again, one per page, in the order given to keep. */
export type Remake = () => Promise<Picture[]>;

interface Group {
  sources: TextureSource[];
  remake: Remake;
}

/** Where a page is see-through: one bit per `cell` x `cell` of its pixels. */
export interface Mask {
  width: number;
  height: number;
  bits: Uint8Array;
  /** The page's pixels each way per bit: 2 for a page at its size, 1 for one at half size (light art). */
  cell: number;
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
  const mx = Math.floor(x / mask.cell), my = Math.floor(y / mask.cell);
  if (mx < 0 || my < 0 || mx >= mask.width || my >= mask.height) {
    return false;
  }
  const i = my * mask.width + mx;
  return (mask.bits[i >> 3] & (1 << (i & 7))) !== 0;
}

/**
 * A mask from pixels (RGBA, `width` x `height`): one bit a pixel, set where
 * `channel` reaches `least`. A page drawn at half size is read by its alpha;
 * a sheet's mask file (pack_sheet.py: white where the picture is) by its red.
 */
export function maskFrom(pixels: Uint8ClampedArray, width: number, height: number,
  { channel = 3, least = MASK_ALPHA, cell = 2 } = {}): Mask {
  const bits = new Uint8Array(Math.ceil((width * height) / 8));
  for (let i = 0, at = channel; i < width * height; i++, at += 4) {
    if (pixels[at] >= least) {
      bits[i >> 3] |= 1 << (i & 7);
    }
  }
  return { width, height, bits, cell };
}

/** The pixels of a picture drawn at a size (w x h), read back. */
function pixelsOf(image: CanvasImageSource, w: number, h: number): Uint8ClampedArray | null {
  const canvas = Object.assign(document.createElement("canvas"), { width: w, height: h });
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return null;
  }
  context.drawImage(image, 0, 0, w, h);
  const pixels = context.getImageData(0, 0, w, h).data;
  canvas.width = canvas.height = 0;
  return pixels;
}

/** The map of a page's see-through parts, read from its picture at half size. */
function maskOf(image: CanvasImageSource, width: number, height: number): Mask | null {
  const w = Math.max(1, Math.ceil(width / 2)), h = Math.max(1, Math.ceil(height / 2));
  // Halving averages each 2 x 2 block.
  const pixels = pixelsOf(image, w, h);
  return pixels && maskFrom(pixels, w, h);
}

/**
 * A sheet's mask file (white where the picture is, at half the page's
 * size), for a page `scale` times its size (1, or 0.5 for light art).
 */
export async function maskFile(url: string, scale: number, cache: RequestCache = "default"): Promise<Mask | null> {
  const response = await fetch(url, { cache });
  if (!response.ok) {
    return null;
  }
  const image = await createImageBitmap(await response.blob());
  const pixels = pixelsOf(image, image.width, image.height);
  const mask = pixels && maskFrom(pixels, image.width, image.height, { channel: 0, least: 128, cell: 2 * scale });
  image.close();
  return mask;
}

/** What a page holds once let go: one see-through pixel, or no buffers, never drawn (the graphics chip has the picture). */
let empty: ImageData | null = null;
const NO_LEVELS: Uint8Array[] = [];

function letGo(source: TextureSource): void {
  const picture = source.resource as unknown;
  empty ??= new ImageData(1, 1);
  if (picture === empty || picture === NO_LEVELS) {
    return;
  }
  source.resource = Array.isArray(picture) ? NO_LEVELS : empty;
  // PixiJS keeps what a source was made with, picture included: let go of that one too.
  const made = (source as unknown as { options?: { resource?: unknown } }).options;
  if (made && made.resource === picture) {
    made.resource = source.resource;
  }
  if (typeof ImageBitmap !== "undefined" && picture instanceof ImageBitmap) {
    picture.close();
  } else if (typeof HTMLCanvasElement !== "undefined" && picture instanceof HTMLCanvasElement) {
    picture.width = picture.height = 0;  // a canvas gives its memory back when it has no pixels
  }
}

/** Whether a page's own copy has been let go (its picture is on the graphics chip only). */
export function onChipOnly(source: TextureSource): boolean {
  return (empty !== null && source.resource === empty) || source.resource === NO_LEVELS;
}

export class OnChip {
  private readonly renderer: Renderer;
  private readonly groups = new Set<Group>();
  private readonly kept = new WeakSet<TextureSource>();
  /** Drawing was going when the graphics chip was lost: it goes on once the pictures are back. */
  private resume = false;

  constructor(renderer: Renderer) {
    this.renderer = renderer;
    // Lost: nothing is drawn until the pictures are back (PixiJS would draw them empty).
    renderer.canvas.addEventListener?.("webglcontextlost", () => {
      this.resume ||= Ticker.shared.started;
      Ticker.shared.stop();
    });
    // After the graphics chip is reset: PixiJS has forgotten every picture; make them again.
    renderer.runners.contextChange.add({ contextChange: () => void this.restore() });
  }

  /**
   * Copies pages to the graphics chip now, keeps their maps for taps (from
   * `known`, or read from the pages), and lets go of their own copies.
   * `remake` makes them again if the chip is reset.
   */
  keep(sources: TextureSource[], remake: Remake, known: (Mask | null)[] = []): void {
    const fresh = sources.filter((source) => !this.kept.has(source) && !source.destroyed);
    if (fresh.length === 0) {
      return;
    }
    const group: Group = { sources, remake };
    for (const source of fresh) {
      this.kept.add(source);
      const mask = known[sources.indexOf(source)]
        ?? (Array.isArray(source.resource) ? null : maskOf(source.resource as CanvasImageSource, source.pixelWidth, source.pixelHeight));
      if (mask) {
        masks.set(source, mask);
      }
      this.upload(source);
      letGo(source);
      source.once("destroy", () => this.groups.delete(group));
    }
    this.groups.add(group);
  }

  /**
   * Puts sharper pictures in place of kept pages (view/art.ts, progressive
   * loading): each page the same size in the game's pixels, at `resolution`,
   * so every picture cut from it stays as it is and nothing drawn changes but
   * its sharpness. Its map for taps follows, and `remake` now makes the
   * sharper ones, if the graphics chip is reset.
   */
  sharpen(sources: TextureSource[], pictures: Picture[], resolution: number, remake: Remake): void {
    for (const group of this.groups) {
      if (group.sources === sources) group.remake = remake;
    }
    sources.forEach((source, n) => {
      const picture = pictures[n];
      if (source.destroyed || !picture || !this.kept.has(source)) {
        return;
      }
      const mask = masks.get(source);
      if (mask) {
        masks.set(source, { ...mask, cell: mask.cell * resolution / source.resolution });
      }
      source.resource = picture;
      if (Array.isArray(picture)) {
        source.mipLevelCount = picture.length;
      }
      // More of its own pixels, the same size in the game's: PixiJS sends it again on "resize".
      if (!source.resize(source.width, source.height, resolution)) {
        source.emit("update", source);
      }
      letGo(source);
    });
  }

  private upload(source: TextureSource): void {
    // Sends the page now (and makes its smaller copies for zooming out), not when first drawn.
    this.renderer.texture.initSource(source);
  }

  private async restore(): Promise<void> {
    await Promise.all([...this.groups].map(async (group) => {
      let pictures: Picture[];
      try {
        pictures = await group.remake();
      } catch (error) {
        console.warn("A picture could not be made again after the graphics chip reset:", error);
        return;
      }
      group.sources.forEach((source, n) => {
        const picture = pictures[n];
        if (source.destroyed || !picture) {
          return;
        }
        source.resource = picture;
        source.emit("update", source);  // sends it again if PixiJS has drawn it since the reset...
        this.upload(source);  // ...or for the first time since
        letGo(source);
      });
    }));
    if (this.resume) {
      this.resume = false;
      Ticker.shared.start();
    }
  }
}
