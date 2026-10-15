// Loads the sprite sheets tools/export_art.sh makes from the game's Flash
// files: <img_name>.json and .webp (and <img_name>-1.json... for big items),
// each loaded once and only when something on screen needs it.

import { Assets, Spritesheet, Texture, type SpritesheetData } from "pixi.js";

import type { Bounds } from "../rules/geometry.ts";

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

export class ArtLibrary {
  private readonly base: string;
  private readonly loading = new Map<string, Promise<ItemArt | null>>();

  /** `base`: where the sheets are (the page's artUrl). */
  constructor(base: string) {
    this.base = base.replace(/\/$/, "");
  }

  /** An item's art, or null when there is no sheet for it (yet). */
  get(name: string): Promise<ItemArt | null> {
    let art = this.loading.get(name);
    if (art === undefined) {
      art = this.load(name).catch((error: unknown) => {
        console.warn(`No art for ${name}:`, error);
        return null;
      });
      this.loading.set(name, art);
    }
    return art;
  }

  private async load(name: string): Promise<ItemArt> {
    const first = await this.page(`${name}.json`);
    const others = await Promise.all((first.data.meta.related_multi_packs ?? []).map((file) => this.page(file)));
    const textures: Record<string, Texture> = {};
    for (const page of [first, ...others]) {
      Object.assign(textures, page.sheet.textures);
    }
    const animations = new Map<string, Texture[]>();
    for (const [animation, frames] of Object.entries(first.data.animations ?? {})) {
      animations.set(animation, frames.map((frame) => textures[frame] ?? Texture.EMPTY));
    }
    return new ItemArt(name, first.data.meta.fps ?? 30, animations, first.data.meta.bounds ?? {});
  }

  private async page(file: string): Promise<{ data: SheetJson; sheet: Spritesheet }> {
    const response = await fetch(`${this.base}/${file}`);
    if (!response.ok) {
      throw new Error(`${file}: ${response.status}`);
    }
    const data = (await response.json()) as SheetJson;
    const texture = await Assets.load<Texture>({
      src: `${this.base}/${data.meta.image}`,
      // Smaller copies for when the map is zoomed out, so the art doesn't shimmer.
      data: { autoGenerateMipmaps: true },
    });
    const sheet = new Spritesheet(texture, data);
    await sheet.parse();
    return { data, sheet };
  }
}
