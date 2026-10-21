// Loads the sprite sheets tools/export_art.sh makes from the game's Flash
// files: <img_name>.json and .webp (and <img_name>-1.json... for big items),
// each loaded once and only when something on screen needs it.

import { Assets, CanvasSource, Spritesheet, Texture, isSafari, type SpritesheetData } from "pixi.js";

import type { Bounds } from "../rules/geometry.ts";
import { STEADY_BUILDING } from "./buildingAnimation.ts";

interface SheetMeta {
  image: string;
  fps?: number;
  bounds?: Record<string, Bounds>;
  related_multi_packs?: string[];
}

interface SheetJson extends SpritesheetData {
  animations?: Record<string, string[]>;
  meta: SpritesheetData["meta"] & SheetMeta;
}

/** Where a picture's anchor is, as a fraction of its canvas: the point the game positions it by. */
export function anchorOf(texture: Texture): { x: number; y: number } {
  return texture.defaultAnchor ?? { x: 0, y: 0 };
}

export class ItemArt {
  readonly name: string;
  readonly fps: number;
  private readonly animations: Map<string, Texture[]>;
  private readonly bounds: Record<string, Bounds>;
  private order: Texture[][] | null = null;

  constructor(name: string, fps: number, animations: Map<string, Texture[]>, bounds: Record<string, Bounds>) {
    this.name = name;
    this.fps = fps;
    this.animations = animations;
    this.bounds = bounds;
  }

  /** The pictures of an animation ("QUIETO/3", "frame/0"), one per frame at fps. */
  animation(name: string): Texture[] | undefined {
    return this.animations.get(name);
  }

  has(name: string): boolean {
    return this.animations.has(name);
  }

  /** The picture that stands for the item (a building facing its first way), for windows like the shop. */
  cover(): Texture | undefined {
    return this.animations.get("frame/0")?.[0] ?? this.animations.values().next().value?.[0];
  }

  /**
   * An effect's frames in the order the game plays them (a spell's
   * animation, its labels one after another), and where its last labelled
   * part starts: the part that goes round while the effect lasts.
   */
  timeline(): { frames: Texture[]; lastPart: number } {
    const frames: Texture[] = [];
    let lastPart = 0;
    let label = "";
    for (const [name, textures] of this.animations) {
      const here = name.slice(0, name.lastIndexOf("/"));
      if (here !== label) {
        label = here;
        lastPart = frames.length;
      }
      frames.push(...textures);
    }
    return { frames, lastPart };
  }

  /**
   * A unit's animation by the Flash client's number for it, the way the
   * game finds it (the game never names them): animation n facing way k
   * (0 to 4) is the (5n + k)th picture run of the sheet, whatever its label.
   * 0 standing, 1 walking, 2 attacking, 3 dying, 6 to 14 its special moves.
   */
  numbered(animation: number, way: number): Texture[] | undefined {
    if (!this.order) {
      this.order = [...this.animations.values()];
    }
    return this.order[animation * 5 + way];
  }

  /**
   * A unit's animation by number (`numbered`), as the Flash client finds
   * every one of them, so a sheet's labels don't matter: the older units
   * say QUIETO for standing, newer ones RESPIRAR, respira or QUIETORL. One
   * the sheet hasn't got falls back to standing that way, then to the
   * first picture.
   */
  pose(animation: number, way: number): Texture[] {
    for (const run of [this.numbered(animation, way), this.numbered(0, way), this.numbered(0, 0)]) {
      if (run?.length) return run;
    }
    return [];
  }

  /** How many frames follow a label: a unit's directions, a building's ways of facing. */
  framesOf(label: string): number {
    let count = 0;
    while (this.animations.has(`${label}/${count}`)) {
      count++;
    }
    return count;
  }

  /**
   * An animation's box as Flash measures it, which the game places
   * buildings by. Sheets from before the box was recorded fall back to the
   * first picture's visible part.
   */
  boundsOf(name: string): Bounds | undefined {
    const recorded = this.bounds[name];
    if (recorded) {
      return recorded;
    }
    const texture = this.animations.get(name)?.[0];
    if (!texture?.trim) {
      return undefined;
    }
    const anchor = anchorOf(texture);
    return {
      x: texture.trim.x - anchor.x * texture.orig.width,
      y: texture.trim.y - anchor.y * texture.orig.height,
      w: texture.trim.width,
      h: texture.trim.height,
    };
  }
}

/** A unit's picture runs a town shows: standing and walking (animations 0 and 1), 5 ways each. */
const TOWN_RUNS = 10;

export class ArtLibrary {
  private readonly base: string;
  private readonly loading = new Map<string, Promise<ItemArt | null>>();
  /** The pages of each whole sheet of several pages loaded, to let go of (letGo). */
  private readonly bigPages = new Map<string, string[]>();

  /** `base`: where the sheets are (the page's artUrl). */
  constructor(base: string) {
    this.base = base.replace(/\/$/, "");
  }

  /** An item's art, or null when there is no sheet for it (yet). */
  get(name: string): Promise<ItemArt | null> {
    return this.cached(name, () => this.load(name));
  }

  /**
   * A unit's art for the town map, which shows units standing and walking
   * (and villagers working, whose sheets are small). A sheet of several
   * pages, a big dragon's or god's, is cut down to those pictures, copied
   * into pages of their own: the Red Djinn Dragon Rider's whole sheet is
   * 247 MB decoded (a knight's is 1), its standing and walking 50. A
   * battle loads the whole sheet (get). CLIENT.md, "Big units in town".
   */
  unit(name: string): Promise<ItemArt | null> {
    return this.cached(`${name} in town`, async () => {
      const index = await this.data(`${name}.json`);
      if (!index.meta.related_multi_packs?.length) {
        return this.cached(name, () => this.load(name, index));  // one page: the whole sheet, as everything else has it
      }
      return this.loadTownUnit(name, index);
    });
  }

  /**
   * Lets go of the whole sheets of several pages loaded for these items,
   * after a raid at home: the town's map has its own smaller copies
   * (unit), and a big unit's whole sheet takes hundreds of MB. Asked for
   * again, a sheet loads again.
   */
  letGo(names: Iterable<string>): void {
    for (const name of names) {
      const pages = this.bigPages.get(name);
      if (!pages) continue;
      this.bigPages.delete(name);
      this.loading.delete(name);
      for (const page of pages) void Assets.unload(page);
    }
  }

  private cached(key: string, load: () => Promise<ItemArt | null>): Promise<ItemArt | null> {
    let art = this.loading.get(key);
    if (art === undefined) {
      art = load().catch((error: unknown) => {
        console.warn(`No art for ${key}:`, error);
        return null;
      });
      this.loading.set(key, art);
    }
    return art;
  }

  private async load(name: string, index?: SheetJson): Promise<ItemArt> {
    if (name === STEADY_BUILDING) return this.loadSteady(name);
    const data = index ?? await this.data(`${name}.json`);
    const first = { data, sheet: await sheetOf(data, `${this.base}/${data.meta.image}`) };
    const others = await Promise.all((first.data.meta.related_multi_packs ?? []).map((file) => this.page(file)));
    if (others.length > 0) {
      this.bigPages.set(name, [first, ...others].map((page) => `${this.base}/${page.data.meta.image}`));
    }
    return itemArt(name, first.data, [first.sheet, ...others.map((page) => page.sheet)]);
  }

  /**
   * A big unit's standing and walking pictures, copied pixel for pixel
   * from its whole pages into pages of their own, packed as the exporter
   * packs (packShelves). One whole page is decoded at a time, then let go.
   */
  private async loadTownUnit(name: string, index: SheetJson): Promise<ItemArt> {
    const runs = Object.entries(index.animations ?? {}).slice(0, TOWN_RUNS);
    const needed = new Set(runs.flatMap(([, frames]) => frames));
    const pages = [index, ...await Promise.all((index.meta.related_multi_packs ?? []).map((file) => this.data(file)))];
    const pictures = pages.flatMap((page) => Object.entries(page.frames)
      .filter(([frame]) => needed.has(frame))
      .map(([frame, data]) => ({ frame, data, page })));
    if (pictures.length < needed.size) throw new Error(`${name}: a standing or walking picture is missing`);
    const packed = packShelves(pictures.map(({ data }) => data.frame));
    const canvases = packed.pages.map(({ w, h }) => Object.assign(document.createElement("canvas"), { width: w, height: h }));
    const contexts = canvases.map((canvas) => canvas.getContext("2d")!);
    for (const page of pages) {
      const mine = pictures.map((picture, i) => ({ ...picture, at: packed.places[i] })).filter((picture) => picture.page === page);
      if (mine.length === 0) continue;
      const response = await fetch(`${this.base}/${page.meta.image}`);
      if (!response.ok) throw new Error(`${page.meta.image}: ${response.status}`);
      const bitmap = await createImageBitmap(await response.blob());
      for (const { data: { frame }, at } of mine) {
        contexts[at.page].drawImage(bitmap, frame.x, frame.y, frame.w, frame.h, at.x, at.y, frame.w, frame.h);
      }
      bitmap.close();
    }
    // The pictures keep their sizes, trims and anchors, in the sheet's own scale (half size for the biggest).
    const resolution = parseFloat(String(index.meta.scale ?? "1")) || 1;
    const sheets = await Promise.all(canvases.map(async (canvas, n) => {
      const frames = Object.fromEntries(pictures.flatMap(({ frame, data }, i) => {
        const at = packed.places[i];
        return at.page === n ? [[frame, { ...data, frame: { ...data.frame, x: at.x, y: at.y } }]] : [];
      }));
      const source = new CanvasSource({ resource: canvas, resolution, autoGenerateMipmaps: true });
      const sheet = new Spritesheet(new Texture({ source }), {
        frames, meta: { image: `${name} in town ${n}`, size: { w: canvas.width, h: canvas.height }, scale: String(resolution) },
      });
      await sheet.parse();
      return sheet;
    }));
    return itemArt(name, { ...index, animations: Object.fromEntries(runs) }, sheets);
  }

  /** This fixed pose needs two image pages, not the export's 100 decoded pages. */
  private async loadSteady(name: string): Promise<ItemArt> {
    const index = await this.data(`${name}.json`);
    const animations = Object.fromEntries(Object.entries(index.animations ?? {}).map(([label, frames]) => [label, frames.slice(0, 1)]));
    const needed = new Set(Object.values(animations).flat());
    if (needed.size === 0) throw new Error(`${name}: no idle frames`);
    const pages = [index, ...await Promise.all((index.meta.related_multi_packs ?? []).map((file) => this.data(file)))];
    const selected = pages.map((page) => ({ ...page, animations: undefined,
      frames: Object.fromEntries(Object.entries(page.frames).filter(([frame]) => needed.has(frame))) }))
      .filter((page) => Object.keys(page.frames).length > 0);
    const found = new Set(selected.flatMap((page) => Object.keys(page.frames)));
    if ([...needed].some((frame) => !found.has(frame))) throw new Error(`${name}: missing idle frame`);
    const sheets = await Promise.all(selected.map((page) => sheetOf(page, `${this.base}/${page.meta.image}`)));
    return itemArt(name, { ...index, animations }, sheets);
  }

  private async data(file: string): Promise<SheetJson> {
    const response = await fetch(`${this.base}/${file}`);
    if (!response.ok) {
      throw new Error(`${file}: ${response.status}`);
    }
    return await response.json() as SheetJson;
  }

  private async page(file: string): Promise<{ data: SheetJson; sheet: Spritesheet }> {
    const data = await this.data(file);
    return { data, sheet: await sheetOf(data, `${this.base}/${data.meta.image}`) };
  }
}

/**
 * A sheet of one page that comes with the client (view/art/: the
 * scaffolding), by the addresses the build gave its JSON and its picture.
 */
export async function bundledArt(name: string, json: string, image: string): Promise<ItemArt> {
  const response = await fetch(json);
  if (!response.ok) {
    throw new Error(`${name}: ${response.status}`);
  }
  const data = (await response.json()) as SheetJson;
  return itemArt(name, data, [await sheetOf(data, image)]);
}

async function sheetOf(data: SheetJson, image: string): Promise<Spritesheet> {
  const texture = await Assets.load<Texture>({
    src: image,
    // Smaller copies for when the map is zoomed out, so the art doesn't shimmer.
    data: { autoGenerateMipmaps: true },
  });
  await repairSafariBitmap(texture, image);
  const sheet = new Spritesheet(texture, data);
  await sheet.parse();
  return sheet;
}

const checkedBitmaps = new WeakMap<object, Promise<void>>();

/** Keep Safari's worker path, recovering empty bitmaps and one corrupt atlas. */
function repairSafariBitmap(texture: Texture, image: string): Promise<void> {
  const source = texture.source;
  const bitmap = source.resource;
  if (!isSafari() || typeof ImageBitmap === "undefined" || !(bitmap instanceof ImageBitmap)) {
    return Promise.resolve();
  }
  let checked = checkedBitmaps.get(source);
  if (!checked) {
    checked = (async () => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 64;
      const context = canvas.getContext("2d", { willReadFrequently: true })!;
      const visible = (picture: ImageBitmap): boolean => {
        context.clearRect(0, 0, 64, 64);
        context.drawImage(picture, 0, 0, 64, 64);
        return context.getImageData(0, 0, 64, 64).data.some((value, i) => i % 4 === 3 && value > 0);
      };
      // This atlas can also arrive partially scrambled, with visible pixels.
      // A captured worker bitmap differed from the source on the CPU and GPU;
      // decoding the same file on the page restored its exact silhouette.
      const corruptAtlas = /(?:^|\/)1479_chained_levelup-1\.webp(?:[?#]|$)/.test(image);
      if (!corruptAtlas && visible(bitmap)) return;
      // Some large atlases arrive from WebKit's worker as transparent pixels.
      // The same file decoded on the page restores them. Do not replace a
      // genuinely empty atlas or change other already visible textures.
      const response = await fetch(image);
      if (!response.ok) throw new Error(`${image}: ${response.status}`);
      const replacement = await createImageBitmap(await response.blob());
      if (visible(replacement)) {
        source.resource = replacement;
        source.update();
        bitmap.close();
      } else {
        replacement.close();
      }
    })();
    checkedBitmaps.set(source, checked);
  }
  return checked;
}

/** Empty pixels around each picture, so neighbours don't bleed in when scaled (as tools/art/pack_sheet.py). */
const PADDING = 2;
/** The largest page: what phones' graphics chips accept, and Safari's biggest canvas. */
const MOST_PAGE = 4096;

/**
 * Where boxes go on pages of at most `most` x `most` pixels, as
 * tools/art/pack_sheet.py's pack() places them: on shelves, tallest first,
 * each with PADDING around it. Returns each box's page and top left, in the
 * order given, and each page's size.
 */
export function packShelves(boxes: { w: number; h: number }[], most = MOST_PAGE):
  { places: { page: number; x: number; y: number }[]; pages: { w: number; h: number }[] } {
  if (boxes.length === 0) return { places: [], pages: [{ w: 1, h: 1 }] };
  const widest = Math.max(...boxes.map((box) => box.w)) + PADDING;
  const tallest = Math.max(...boxes.map((box) => box.h)) + PADDING;
  if (widest > most || tallest > most) throw new Error(`a picture is bigger than a ${most} x ${most} page`);
  const area = boxes.reduce((sum, box) => sum + (box.w + PADDING) * (box.h + PADDING), 0);
  // About square when all fits on one page; pages as wide as allowed when not.
  const width = Math.min(most, Math.max(widest, Math.ceil(Math.sqrt(area) * 1.1)));
  const order = boxes.map((_, i) => i).sort((a, b) => boxes[b].h - boxes[a].h || a - b);
  const places: { page: number; x: number; y: number }[] = new Array(boxes.length);
  const pages: { w: number; h: number }[] = [];
  let page = 0, x = 0, y = 0, shelf = 0, used = 0;
  for (const i of order) {
    const { w, h } = boxes[i];
    if (x + w + PADDING > width) {  // the shelf is full: start the next one
      x = 0; y += shelf; shelf = 0;
    }
    if (x === 0 && y + h + PADDING > most) {  // the page is full: start the next one
      pages.push({ w: used, h: y });
      page++; y = 0; used = 0;
    }
    places[i] = { page, x: x + PADDING / 2, y: y + PADDING / 2 };
    x += w + PADDING;
    shelf = Math.max(shelf, h + PADDING);
    used = Math.max(used, x);
  }
  pages.push({ w: used, h: y + shelf });
  return { places, pages };
}

function itemArt(name: string, data: SheetJson, sheets: Spritesheet[]): ItemArt {
  const textures: Record<string, Texture> = {};
  for (const sheet of sheets) {
    Object.assign(textures, sheet.textures);
  }
  const animations = new Map<string, Texture[]>();
  for (const [animation, frames] of Object.entries(data.animations ?? {})) {
    animations.set(animation, frames.map((frame) => textures[frame] ?? Texture.EMPTY));
  }
  return new ItemArt(name, data.meta.fps ?? 30, animations, data.meta.bounds ?? {});
}
