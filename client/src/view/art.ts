// Loads the sprite sheets tools/export_art.sh makes from the game's Flash
// files: <img_name>.json and .webp (and <img_name>-1.json... for big items),
// each loaded once and only when something on screen needs it. A big unit's
// sheet (several pages) is cut down to the moves shown, at half size on a
// phone or past the memory budget; given the renderer, every page goes to
// the graphics chip at once and its own copy is let go (view/onChip.ts).
// CLIENT.md, "Big units in town" and "Light art".

import { Assets, CompressedSource, ImageSource, Rectangle, Spritesheet, Texture, isSafari,
  type Renderer, type SpritesheetData, type SpritesheetFrameData, type TEXTURE_FORMATS, type TextureSource, type WebGLExtensions,
  type WebGLRenderer } from "pixi.js";

import type { Bounds } from "../rules/geometry.ts";
import { STEADY_BUILDING } from "./buildingAnimation.ts";
import { lightArt } from "./drawing.ts";
import type { Answer, Ask } from "./ktx2.worker.ts";
import { OnChip, maskFile, type Mask, type Picture } from "./onChip.ts";

interface SheetMeta {
  image: string;
  fps?: number;
  bounds?: Record<string, Bounds>;
  related_multi_packs?: string[];
  /** The page as the graphics chip keeps it (tools/art/ktx2.mjs), the same at half size, and where it's see-through (pack_sheet.py). */
  ktx2?: string;
  ktx2_half?: string;
  mask?: string;
}

/** A sheet page's JSON, as tools/art/pack_sheet.py writes it. */
export interface SheetJson extends SpritesheetData {
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
  /** The moves (animation numbers) a big unit's copy left out (ArtLibrary.fighter): loaded when one plays. */
  readonly leftOut: ReadonlySet<number>;

  constructor(name: string, fps: number, animations: Map<string, Texture[]>, bounds: Record<string, Bounds>,
    leftOut: ReadonlySet<number> = new Set()) {
    this.name = name;
    this.fps = fps;
    this.animations = animations;
    this.bounds = bounds;
    this.leftOut = leftOut;
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

/** A unit's drawn ways: animation n facing way k is the sheet's (5n + k)th picture run (ItemArt.numbered). */
const WAYS = 5;
/** The moves (animation numbers) a town shows: standing and walking. */
export const TOWN_MOVES = [0, 1];
/** The moves every fighter may show: standing, walking, attacking, dying. Special moves are each unit's own. */
export const FIGHT_MOVES = [0, 1, 2, 3];
/**
 * Above this many bytes of big units' pictures at full size, a page keeps
 * them at half size (a quarter of the memory): a graphics chip with more
 * than this to hold slows everything down (CLIENT.md, "Light art").
 */
export const BUDGET = 1.5 * 2 ** 30;
/** Pages decoded at once: a whole page is up to 64 MB while it is read. */
const DECODES = 2;

/** A picture cut out of a sheet, for the windows in HTML: its box around the anchor, in the game's pixels. */
export interface Cutout {
  image: ImageBitmap;
  x: number;
  y: number;
  width: number;
  height: number;
}

type Frame = SpritesheetFrameData & { anchor?: { x: number; y: number } };

/** Where a cut picture goes in a copy's pages, at its size there (`scale`). */
interface Cut {
  file: string;
  from: { x: number; y: number; w: number; h: number };
  to: { page: number; x: number; y: number };
  scale: number;
}

/**
 * How to make a copy's pages: the sheet's pages used as they are (their
 * KTX2, its smaller sizes only with `half`), then pages of cut pictures.
 */
interface Recipe {
  whole: { file: string; ktx2?: string; half: boolean }[];
  pages: { w: number; h: number }[];
  cuts: Cut[];
}

/** A page made: its picture, and for one in the graphics chip's format, which and its size. */
interface Made {
  picture: Picture;
  format?: TEXTURE_FORMATS;
  width: number;
  height: number;
}

/**
 * What the graphics chip reads that a KTX2 page can become, best first
 * (PixiJS's choice too), by the WebGL extension that says it can.
 */
const CHIP_FORMATS: [keyof WebGLExtensions, TEXTURE_FORMATS][] = [
  ["bptc", "bc7-rgba-unorm"], ["astc", "astc-4x4-unorm"], ["etc", "etc2-rgba8unorm"], ["s3tc", "bc3-rgba-unorm"],
];

/** The KTX library PixiJS ships, served with the client (vite copies them), for our reader (ktx2.worker.ts). */
const LIBKTX_JS = new URL("../../node_modules/pixi.js/transcoders/ktx/libktx.js", import.meta.url).href;
const LIBKTX_WASM = new URL("../../node_modules/pixi.js/transcoders/ktx/libktx.wasm", import.meta.url).href;

let reader: Worker | null = null;
let asked = 0;
const answers = new Map<number, (answer: Answer) => void>();

/** A KTX2 page read off the page (ktx2.worker.ts), one at a time in its turn. */
function readKtx2(url: string, formats: TEXTURE_FORMATS[], half: boolean): Promise<Answer> {
  if (!reader) {
    reader = new Worker(new URL("./ktx2.worker.ts", import.meta.url));
    reader.onmessage = (event: MessageEvent<Answer>) => {
      answers.get(event.data.id)?.(event.data);
      answers.delete(event.data.id);
    };
  }
  const ask: Ask = { id: ++asked, url, jsUrl: LIBKTX_JS, wasmUrl: LIBKTX_WASM, formats, half };
  return new Promise((answer) => {
    answers.set(ask.id, answer);
    reader!.postMessage(ask);
  });
}

/**
 * Above this share of a sheet's pictures (by area), a copy at full size
 * uses the pages as they are: copying would save little, and costs time.
 */
const WHOLE_SHARE = 0.75;

/**
 * Which of a unit's pictures a copy keeps, for the moves given, and where:
 * a page whose every picture is wanted is used as it is (a sheet packed
 * move by move has those), as is every page with one when nearly all are
 * wanted (WHOLE_SHARE); the other wanted pictures are cut out and packed
 * onto pages of their own, `shrink` times smaller. `moves` null: all of
 * them. `ready`: whether a page can be used as it is at this size (at half
 * size, a page in the graphics chip's format, its smaller copy). The copy keeps every
 * picture run, in its place so the moves keep their numbers: those it has
 * all the pictures of, the others empty.
 */
export function planCopy(pages: SheetJson[], moves: number[] | null, shrink: number, ready: (page: number) => boolean = () => shrink === 1):
  { runs: [string, string[]][]; whole: number[]; cut: { page: number; frame: string }[]; packed: ReturnType<typeof packShelves> } {
  const all = Object.entries(pages[0]?.animations ?? {});
  const wanted = moves && new Set(moves);
  const needed = new Set(all.flatMap(([, frames], i) => !wanted || wanted.has(Math.floor(i / WAYS)) ? frames : []));
  const area = (page: SheetJson, only?: Set<string>) => Object.entries(page.frames)
    .reduce((sum, [frame, { frame: { w, h } }]) => sum + (only && !only.has(frame) ? 0 : w * h), 0);
  const most = pages.reduce((sum, page) => sum + area(page, needed), 0) > WHOLE_SHARE * pages.reduce((sum, page) => sum + area(page), 0);
  // At half size, only a page in the graphics chip's format can be used as it is (its smaller copy).
  const whole = pages.map((page, n) => ({ frames: Object.keys(page.frames), n }))
    .filter(({ frames, n }) => ready(n) && frames.length > 0
      && (most ? frames.some((frame) => needed.has(frame)) : frames.every((frame) => needed.has(frame))))
    .map(({ n }) => n);
  const cut = pages.flatMap((page, n) => whole.includes(n) ? [] : Object.keys(page.frames)
    .filter((frame) => needed.has(frame)).map((frame) => ({ page: n, frame })));
  const kept = new Set([...whole.flatMap((n) => Object.keys(pages[n].frames)), ...cut.map(({ frame }) => frame)]);
  if ([...needed].some((frame) => !kept.has(frame))) {
    throw new Error("a picture of these moves is missing from the sheet");
  }
  const packed = packShelves(cut.map(({ page, frame }) => {
    const { w, h } = pages[page].frames[frame].frame;
    return { w: Math.ceil(w / shrink), h: Math.ceil(h / shrink) };
  }));
  const runs = all.map(([run, frames]): [string, string[]] => [run, frames.every((frame) => kept.has(frame)) ? frames : []]);
  return { runs, whole, cut, packed };
}

/** The sheet's own scale: 0.5 when its pictures are stored at half size (the biggest gods). */
function resolutionOf(page: SheetJson): number {
  return parseFloat(String(page.meta.scale ?? "1")) || 1;
}

/**
 * A picture as PixiJS's Spritesheet makes it, in the game's pixels, wherever
 * it now is (`at`, in `source`'s own pixels, which may be fewer: a copy at
 * half size). `resolution`: the sheet's own.
 */
function pictureTexture(source: TextureSource, label: string, data: Frame, at: { x: number; y: number }, resolution: number): Texture {
  const r = resolution;
  const w = Math.floor(data.frame.w) / r, h = Math.floor(data.frame.h) / r;
  const size = data.trimmed !== false && data.sourceSize ? data.sourceSize : data.frame;
  const trim = data.trimmed !== false && data.spriteSourceSize
    ? new Rectangle(Math.floor(data.spriteSourceSize.x) / r, Math.floor(data.spriteSourceSize.y) / r, w, h) : undefined;
  return new Texture({
    source,
    frame: new Rectangle(at.x / source.resolution, at.y / source.resolution, w, h),
    orig: new Rectangle(0, 0, Math.floor(size.w) / r, Math.floor(size.h) / r),
    trim,
    rotate: data.rotated ? 2 : 0,
    defaultAnchor: data.anchor,
    label,
  });
}

/** Lets only so many jobs run at once; the others wait their turn. */
class Turns {
  private running = 0;
  private readonly waiting: (() => void)[] = [];
  private readonly most: number;

  constructor(most: number) {
    this.most = most;
  }

  async run<T>(job: () => Promise<T>): Promise<T> {
    if (this.running >= this.most) {
      await new Promise<void>((go) => this.waiting.push(go));
    }
    this.running++;
    try {
      return await job();
    } finally {
      this.running--;
      this.waiting.shift()?.();
    }
  }
}

export class ArtLibrary {
  private readonly base: string;
  private readonly loading = new Map<string, Promise<ItemArt | null>>();
  private readonly sheets = new Map<string, Promise<SheetJson>>();
  /** The pages of each fight's copy of a big unit, and of each whole sheet of several pages, to let go of (letGo). */
  private readonly copies = new Map<string, TextureSource[]>();
  /** Keeps pages on the graphics chip only, given the renderer (view/onChip.ts). */
  private readonly chip: OnChip | null;
  private readonly renderer: WebGLRenderer | null;
  /** What the graphics chip reads that a KTX2 page can become; none: KTX2 pages aren't used. */
  private chipFormats: TEXTURE_FORMATS[] | null = null;
  private readonly decoding = new Turns(DECODES);
  /** How many times smaller big units' copies are (plan): decided once for the page. */
  private shrinking: Promise<number> | null = null;
  /** Whether this page's big units are at half size, once decided (the Menu's Light art shows it). */
  halfSize = false;

  /**
   * `base`: where the sheets are (the page's artUrl). `renderer`: the
   * page's, for its pictures to be kept on the graphics chip only.
   */
  constructor(base: string, renderer?: Renderer) {
    this.base = base.replace(/\/$/, "");
    this.renderer = renderer?.name === "webgl" ? renderer as WebGLRenderer : null;
    this.chip = this.renderer && new OnChip(this.renderer);
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
   * 247 MB decoded (a knight's is 1), its standing and walking 50. CLIENT.md,
   * "Big units in town".
   */
  unit(name: string): Promise<ItemArt | null> {
    return this.cut(`${name} in town`, name, TOWN_MOVES);
  }

  /**
   * A unit's art for a fight: a big one's cut down to what fighters do
   * (FIGHT_MOVES) and `specials`, its own special moves
   * (rules/specials.ts). A special move left out is loaded when it plays
   * (move). CLIENT.md, "Light art".
   */
  fighter(name: string, specials: number[] = []): Promise<ItemArt | null> {
    return this.cut(`${name} in fights`, name, [...FIGHT_MOVES, ...specials]);
  }

  /** One more move of a big unit's, which its fight copy left out (ItemArt.leftOut). */
  move(name: string, animation: number): Promise<ItemArt | null> {
    return this.cut(`${name} move ${animation}`, name, [animation]);
  }

  /**
   * Decides, before a town or a fight is drawn, whether big units' copies
   * are kept at half size: when the player chose it, on a touch screen or a
   * computer with little memory (drawing.ts, lightArt), or when their
   * pictures at full size would pass BUDGET. `units`: each unit's art and
   * the moves it will show. The page keeps to the first answer about big
   * units (a tournament's field, with none, leaves it to its armies).
   */
  plan(units: { art: string; moves: number[] }[]): Promise<void> {
    if (this.shrinking) {
      return this.shrinking.then(() => {});
    }
    const chosen = lightArt();
    if (chosen !== null) {
      this.shrinking = Promise.resolve(chosen ? 2 : 1);
      return Promise.resolve();
    }
    const seen = new Set<string>();
    const sizes = Promise.all(units.filter(({ art }) => !seen.has(art) && seen.add(art))
      .map(({ art, moves }) => this.fullSize(art, moves).catch(() => 0)))
      .then((all) => all.reduce((sum, size) => sum + size, 0));
    const deciding = sizes.then((bytes) => bytes > BUDGET ? 2 : 1);
    this.shrinking = deciding;
    return sizes.then((bytes) => {
      if (bytes === 0 && this.shrinking === deciding) {
        this.shrinking = null;  // no big unit here: the next plan decides
      }
    });
  }

  /** The copy's size: as planned, or else as lightArt says (or full size). */
  private async shrink(): Promise<number> {
    this.shrinking ??= Promise.resolve(lightArt() ? 2 : 1);
    const shrink = await this.shrinking;
    this.halfSize = shrink > 1;
    return shrink;
  }

  /** What a big unit's pictures for these moves take on the graphics chip at full size (with their smaller copies): 0 for a sheet of one page. */
  private async fullSize(name: string, moves: number[]): Promise<number> {
    const index = await this.data(`${name}.json`);
    if (!index.meta.related_multi_packs?.length) {
      return 0;
    }
    const pages = await this.pagesOf(index);
    const { whole, cut } = planCopy(pages, moves, 1);
    // A pixel takes 4 bytes, or 1 in the graphics chip's format (KTX2).
    const bytes = (n: number) => this.formats().length && pages[n].meta.ktx2 ? 1 : 4;
    const area = whole.reduce((sum, n) => sum + (pages[n].meta.size?.w ?? 0) * (pages[n].meta.size?.h ?? 0) * bytes(n), 0)
      + cut.reduce((sum, { page, frame }) => sum + pages[page].frames[frame].frame.w * pages[page].frames[frame].frame.h * 4, 0);
    return area * 4 / 3;
  }

  /**
   * Lets go of what was loaded for these items' fights, after a raid at
   * home: whole sheets of several pages and fights' copies. The town's map
   * has its own copies (unit), and a big unit's fight art takes hundreds of
   * MB. Asked for again, it loads again.
   */
  letGo(names: Iterable<string>): void {
    for (const name of names) {
      for (const key of [...this.loading.keys()].filter((key) => key === name || key === `${name} in fights` || key.startsWith(`${name} move `))) {
        const art = this.loading.get(key)!;
        // A sheet of one page, kept by the town too, isn't a copy: it stays.
        const release = (): void => {
          if (this.loading.get(key) !== art || (key === name && !this.copies.has(key))) return;  // asked for again since, or one page
          this.loading.delete(key);
          for (const source of this.copies.get(key) ?? []) source.destroy();
          this.copies.delete(key);
        };
        // One still loading is let go of once it has loaded.
        if (this.copies.has(key)) release(); else void art.then(release);
      }
    }
  }

  /**
   * Pictures cut out of an item's sheet as small bitmaps of their own, for
   * the windows in HTML (a shop card's picture, the units book's moving
   * one): a page decoded at a time and let go, nothing put on the graphics
   * chip. `pick` chooses the frames from the sheet's picture runs, in order.
   */
  async cutouts(name: string, pick: (runs: [string, string[]][]) => string[][]): Promise<{ fps: number; runs: Cutout[][] } | null> {
    try {
      const index = await this.data(`${name}.json`);
      const chosen = pick(Object.entries(index.animations ?? {}));
      const needed = new Set(chosen.flat());
      const cutouts = new Map<string, Cutout>();
      for (const page of await this.pagesOf(index)) {
        const mine = Object.entries(page.frames).filter(([frame]) => needed.has(frame)) as [string, Frame][];
        if (mine.length === 0) continue;
        const bitmap = await this.decode(`${this.base}/${page.meta.image}`);
        const r = resolutionOf(page);
        try {
          for (const [frame, data] of mine) {
            const { x, y, w, h } = data.frame;
            const size = data.sourceSize ?? data.frame;
            const trim = data.spriteSourceSize ?? { x: 0, y: 0 };
            const anchor = data.anchor ?? { x: 0, y: 0 };
            cutouts.set(frame, { image: await createImageBitmap(bitmap, x, y, Math.max(1, w), Math.max(1, h)),
              x: (trim.x - anchor.x * size.w) / r, y: (trim.y - anchor.y * size.h) / r, width: w / r, height: h / r });
          }
        } finally {
          bitmap.close();
        }
      }
      return { fps: index.meta.fps ?? 30, runs: chosen.map((run) => run.flatMap((frame) => cutouts.get(frame) ?? [])) };
    } catch (error) {
      console.warn(`No pictures for ${name}:`, error);
      return null;
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

  /** A unit's art cut down to some moves (`key`: unit, fighter, move): the whole sheet when it has one page. */
  private cut(key: string, name: string, moves: number[]): Promise<ItemArt | null> {
    return this.cached(key, async () => {
      const index = await this.data(`${name}.json`);
      if (!index.meta.related_multi_packs?.length) {
        return this.cached(name, () => this.load(name, index));  // one page: the whole sheet, as everything else has it
      }
      return this.loadCopy(key, name, index, moves);
    });
  }

  private async load(name: string, index?: SheetJson): Promise<ItemArt> {
    if (name === STEADY_BUILDING) return this.loadSteady(name);
    const data = index ?? await this.data(`${name}.json`);
    if (data.meta.related_multi_packs?.length) {
      // Several pages (the ground, a boss): each as it is, in the graphics chip's format when it has it.
      return this.loadCopy(name, name, data, null, 1);
    }
    return itemArt(name, data, [await this.sheet(data)]);
  }

  /** A page of a whole sheet, kept on the graphics chip only when the renderer is known. */
  private async sheet(data: SheetJson): Promise<Spritesheet> {
    const image = `${this.base}/${data.meta.image}`;
    const sheet = await sheetOf(data, image);
    this.chip?.keep([sheet.textureSource], async () => [await this.decode(image)]);
    return sheet;
  }

  /**
   * A big unit's pictures for some moves (planCopy), at the page's size
   * (plan): its pages that hold only those used as they are, the others'
   * copied into pages of their own, packed as the exporter packs. One whole
   * page is decoded at a time, then let go.
   */
  private async loadCopy(key: string, name: string, index: SheetJson, moves: number[] | null, size?: number): Promise<ItemArt> {
    const shrink = size ?? await this.shrink();
    const pages = await this.pagesOf(index);
    try {
      return await this.copy(key, name, index, pages, moves, shrink, this.formats().length > 0);
    } catch (error) {
      if (!this.formats().length || !pages.some((page) => page.meta.ktx2)) throw error;
      // The graphics chip's format didn't load: the WebP pages, from now on.
      console.warn(`${name}: no KTX2, its WebP instead:`, error);
      this.chipFormats = [];
      return this.copy(key, name, index, pages, moves, shrink, false);
    }
  }

  private async copy(key: string, name: string, index: SheetJson, pages: SheetJson[], moves: number[] | null,
    shrink: number, ktx2: boolean): Promise<ItemArt> {
    const ready = (n: number) => ktx2 && Boolean(pages[n].meta.ktx2) || shrink === 1;
    const { runs, whole, cut, packed } = planCopy(pages, moves, shrink, ready);
    const file = (name: string) => `${this.base}/${name}`;
    const half = shrink > 1;
    // At half size, a page's half-size KTX2 file (a quarter of the download), or else its whole one's smaller sizes.
    const chip = (meta: SheetMeta) => !ktx2 || !meta.ktx2 ? undefined
      : half && meta.ktx2_half ? { ktx2: file(meta.ktx2_half), half: false } : { ktx2: file(meta.ktx2), half };
    const recipe: Recipe = {
      whole: whole.map((n) => ({ file: file(pages[n].meta.image), half, ...chip(pages[n].meta) })),
      pages: cut.length > 0 ? packed.pages : [],
      cuts: cut.map(({ page, frame }, i) => ({ file: file(pages[page].meta.image), from: pages[page].frames[frame].frame, to: packed.places[i], scale: 1 / shrink })),
    };
    const made = await this.make(recipe);
    // The pictures keep their sizes, trims and anchors, in the sheet's own scale (half size for the biggest).
    const resolution = resolutionOf(index);
    // Plain pictures to PixiJS, the canvases too: a canvas source would be taken for somewhere to draw.
    const sources: TextureSource[] = made.map(({ picture, format, width, height }, n) => {
      const label = `${key} ${n}`;
      const r = resolution / (n < whole.length && !recipe.whole[n].ktx2 ? 1 : shrink);
      return format
        // Its colours are premultiplied already (pack_sheet.py), as PixiJS draws.
        ? new CompressedSource({ resource: picture as Uint8Array[], format, width: width / r, height: height / r, resolution: r,
          alphaMode: "premultiplied-alpha", label })
        : new ImageSource({ resource: picture as ImageBitmap, resolution: r, autoGenerateMipmaps: true,
          alphaMode: "premultiply-alpha-on-upload", label });
    });
    const textures: Record<string, Texture> = {};
    whole.forEach((page, n) => {
      const scale = recipe.whole[n].ktx2 ? 1 / shrink : 1;
      for (const [frame, data] of Object.entries(pages[page].frames)) {
        textures[frame] = pictureTexture(sources[n], frame, data as Frame, { x: data.frame.x * scale, y: data.frame.y * scale }, resolution);
      }
    });
    cut.forEach(({ page, frame }, i) => {
      const at = packed.places[i];
      textures[frame] = pictureTexture(sources[whole.length + at.page], frame, pages[page].frames[frame] as Frame, at, resolution);
    });
    // Where pages in the graphics chip's format are see-through: their mask files (the others' are read from them).
    const masks: (Mask | null)[] = await Promise.all(whole.map((page, n) => recipe.whole[n].ktx2 && pages[page].meta.mask
      ? maskFile(file(pages[page].meta.mask), 1 / shrink).catch(() => null) : null));
    this.chip?.keep(sources, async () => (await this.make(recipe)).map(({ picture }) => picture), masks);
    if (key === name || key.endsWith(" in fights") || key.includes(" move ")) {
      this.copies.set(key, sources);
    }
    const animations = new Map(runs.map(([run, frames]) => [run, frames.map((frame) => textures[frame] ?? Texture.EMPTY)]));
    // The moves it hasn't got: loaded when one plays (move).
    const all = Object.values(index.animations ?? {});
    const leftOut = new Set(runs.flatMap(([, frames], i) => frames.length === 0 && all[i].length > 0 ? [Math.floor(i / WAYS)] : []));
    return new ItemArt(name, index.meta.fps ?? 30, animations, index.meta.bounds ?? {}, leftOut);
  }

  /**
   * What the graphics chip reads that a KTX2 page can become (none without
   * the renderer, or on WebGL 1, which can't be told a page's smallest
   * copies stop early).
   */
  private formats(): TEXTURE_FORMATS[] {
    this.chipFormats ??= this.renderer?.context.webGLVersion === 2
      ? CHIP_FORMATS.filter(([extension]) => this.renderer!.context.extensions[extension]).map(([, format]) => format)
      : [];
    return this.chipFormats;
  }

  /**
   * A page in the graphics chip's format, read off the page into one
   * buffer per size (ktx2.worker.ts): sizes in whole blocks of 4, which
   * WebGL takes, from the half-size copy with `half` (light art).
   */
  private async ktx2(file: string, half: boolean): Promise<Made> {
    const read = await readKtx2(file, this.formats(), half);
    if ("error" in read) throw new Error(read.error);
    return { picture: read.levels, format: read.format as TEXTURE_FORMATS, width: read.width, height: read.height };
  }

  /** A copy's pages (Recipe): the whole ones read, the cut pictures drawn into theirs, reading each page once. */
  private async make(recipe: Recipe): Promise<Made[]> {
    const whole = await Promise.all(recipe.whole.map(async ({ file, ktx2, half }): Promise<Made> => {
      if (ktx2) return this.ktx2(ktx2, half);
      const picture = await this.decode(file);
      return { picture, width: picture.width, height: picture.height };
    }));
    const canvases = recipe.pages.map(({ w, h }) => Object.assign(document.createElement("canvas"), { width: w, height: h }));
    const contexts = canvases.map((canvas) => canvas.getContext("2d"));
    if (contexts.some((context) => context === null)) {
      throw new Error("no room for another canvas");
    }
    for (const file of new Set(recipe.cuts.map((cut) => cut.file))) {
      const page = await this.decode(file);
      for (const { from, to, scale } of recipe.cuts.filter((cut) => cut.file === file)) {
        contexts[to.page]!.drawImage(page, from.x, from.y, from.w, from.h, to.x, to.y, from.w * scale, from.h * scale);
      }
      page.close();
    }
    return [...whole, ...canvases.map((picture) => ({ picture, width: picture.width, height: picture.height }))];
  }

  /** A page's picture, decoded on the page (as Safari's repair does), a few at a time. */
  private decode(file: string): Promise<ImageBitmap> {
    return this.decoding.run(async () => {
      const response = await fetch(file);
      if (!response.ok) throw new Error(`${file}: ${response.status}`);
      return createImageBitmap(await response.blob());
    });
  }

  /** This fixed pose needs two image pages, not the export's 100 decoded pages. */
  private async loadSteady(name: string): Promise<ItemArt> {
    const index = await this.data(`${name}.json`);
    const animations = Object.fromEntries(Object.entries(index.animations ?? {}).map(([label, frames]) => [label, frames.slice(0, 1)]));
    const needed = new Set(Object.values(animations).flat());
    if (needed.size === 0) throw new Error(`${name}: no idle frames`);
    const pages = await this.pagesOf(index);
    const selected = pages.map((page) => ({ ...page, animations: undefined,
      frames: Object.fromEntries(Object.entries(page.frames).filter(([frame]) => needed.has(frame))) }))
      .filter((page) => Object.keys(page.frames).length > 0);
    const found = new Set(selected.flatMap((page) => Object.keys(page.frames)));
    if ([...needed].some((frame) => !found.has(frame))) throw new Error(`${name}: missing idle frame`);
    const sheets = await Promise.all(selected.map((page) => this.sheet(page)));
    return itemArt(name, { ...index, animations }, sheets);
  }

  /** An item's sheet's pages: its first, then the others it names. */
  private async pagesOf(index: SheetJson): Promise<SheetJson[]> {
    return [index, ...await Promise.all((index.meta.related_multi_packs ?? []).map((file) => this.data(file)))];
  }

  /** A sheet's JSON, fetched once (a big unit's town, fight and shop pictures all read it). */
  private data(file: string): Promise<SheetJson> {
    let sheet = this.sheets.get(file);
    if (!sheet) {
      sheet = (async () => {
        const response = await fetch(`${this.base}/${file}`);
        if (!response.ok) {
          throw new Error(`${file}: ${response.status}`);
        }
        return await response.json() as SheetJson;
      })();
      sheet.catch(() => {
        if (this.sheets.get(file) === sheet) this.sheets.delete(file);  // asked again, tried again
      });
      this.sheets.set(file, sheet);
    }
    return sheet;
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
