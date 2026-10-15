// The Flash client's bars on the map, with its own pictures (FauxBarMC,
// tools/art/export_ui.py): the bar at the foot of something being built
// (its percentage) or collected ("Collecting..."), and the popup over what
// the mouse is on (InfoPopupMC: its name, and for a building at work the
// same bar and the time left). Both keep their size on the screen whatever
// the zoom, as in the game: whoever shows them scales them by 1 / zoom.

import { Assets, Container, Graphics, Sprite, Text, type Texture, type TextStyleOptions } from "pixi.js";

import type { Point } from "../rules/geometry.ts";
import anchors from "./art/anchors.json" with { type: "json" };

/** The label of a thing's bar in its slot, to tell it from the thing's picture. */
export const PROGRESS = "progress";

const BACK = new URL("./art/progress-back.webp", import.meta.url).href;
const FILL = new URL("./art/progress-fill.webp", import.meta.url).href;
/** Where the yellow is on its picture, from the game's point (pixels at the game's size): it fills from the left. */
const FILL_LEFT = -64.7;
const FILL_WIDTH = 130.7;
/** The bar's middle, where the percentage goes, and how far over its thing's point it is (10 px, as the game has it). */
const MIDDLE = { x: 2, y: -1.7 };
const ABOVE = 10;
const INK = 0x252525;
const textures = new Map<string, Texture>();

/** Load the bars' pictures (once). Until they're here, a bar shows its words alone. */
export async function loadBars(): Promise<void> {
  await Promise.all([BACK, FILL].map(async (url) => {
    textures.set(url, await Assets.load<Texture>(url));
  })).catch(() => undefined);
}

/**
 * The bar at the foot of something being built (or its percentage alone,
 * `textOnly`, for a 1x1 thing), or being collected (`words`: "Collecting...",
 * the game's own, instead of the percentage). set(share) fills it. Put it at
 * the thing's point; it sits 10 px above.
 */
export class ProgressBar extends Container {
  private readonly cover = new Graphics();
  private readonly text: Text;
  private readonly words: string | null;
  private shown = -1;

  constructor(point: Point, textOnly: boolean, words: string | null = null) {
    super();
    this.label = PROGRESS;
    this.words = words;
    this.position.set(point.x, point.y - ABOVE);
    this.eventMode = "none";
    if (!textOnly) {
      this.addChild(...barPictures(this.cover, 1, 1, { x: 0, y: 0 }));
    }
    this.text = new Text({ text: words ?? "0%", anchor: 0.5, style: textStyle(14, textOnly) });
    this.text.position.set(MIDDLE.x, MIDDLE.y);
    this.addChild(this.text);
  }

  /** How full: 0 to 1. */
  set(share: number): void {
    const percent = Math.min(100, Math.floor(share * 100));
    if (percent === this.shown) {
      return;
    }
    this.shown = percent;
    if (this.words === null) {
      this.text.text = `${percent}%`;
    }
    this.cover.clear().rect(FILL_LEFT, -20, FILL_WIDTH * Math.min(1, Math.max(0, share)), 40).fill({ color: 0xffffff });
  }
}

/**
 * The popup over the thing the mouse is on, as the Flash client's: its name;
 * for a building that works, a bar with how far along its round is and the
 * time left under it. Put it at the thing's point: it sits 30 px above.
 */
export class InfoPopup extends Container {
  /** The game's popup draws the same bar a little smaller: its share of the bar above, across and down. */
  private static readonly SCALE = { x: 0.906, y: 0.838 };
  /** Where that bar's point is, from the popup's. */
  private static readonly BAR_AT = { x: -1.6, y: 17.4 };
  private readonly cover = new Graphics();
  private readonly bar = new Container();
  private readonly percent: Text;
  private readonly left: Text;

  constructor(point: Point, name: string) {
    super();
    this.position.set(point.x, point.y - 30);
    this.eventMode = "none";
    const title = new Text({ text: name, anchor: 0.5, style: textStyle(15, true) });
    title.position.set(1, -6);
    const { SCALE, BAR_AT } = InfoPopup;
    this.bar.addChild(...barPictures(this.cover, SCALE.x, SCALE.y, BAR_AT));
    this.percent = new Text({ text: "", anchor: 0.5, style: textStyle(13, false) });
    this.percent.position.set(0, 18.3);
    this.left = new Text({ text: "", anchor: 0.5, style: textStyle(13, true) });
    this.left.position.set(2, 43);
    this.bar.addChild(this.percent, this.left);
    this.bar.visible = false;
    this.addChild(title, this.bar);
  }

  /** Its round: how far along (0 to 1) and the time left in words; null: the name alone. */
  set(round: { share: number; left: string } | null): void {
    this.bar.visible = round !== null;
    if (!round) {
      return;
    }
    const share = Math.min(1, Math.max(0, round.share));
    this.percent.text = `${Math.min(100, Math.round(share * 100))}%`;
    this.left.text = round.left;
    const { SCALE, BAR_AT } = InfoPopup;
    this.cover.clear().rect(BAR_AT.x + FILL_LEFT * SCALE.x, 0, FILL_WIDTH * SCALE.x * share, 40).fill({ color: 0xffffff });
  }
}

/** The bar's back and its yellow (masked by `cover`, which fills it), at a scale, its point at `at`. */
function barPictures(cover: Graphics, sx: number, sy: number, at: Point): Container[] {
  const back = picture(BACK, "progress-back");
  const fill = picture(FILL, "progress-fill");
  if (!back || !fill) {
    return [];
  }
  for (const sprite of [back, fill]) {
    sprite.scale.x *= sx;
    sprite.scale.y *= sy;
    sprite.position.set(at.x, at.y);
  }
  fill.mask = cover;
  return [back, fill, cover];
}

/** The game's words on its bars: dark, bold, edged in white where they stand on the map. */
function textStyle(size: number, edged: boolean): TextStyleOptions {
  return {
    fontFamily: "system-ui, sans-serif", fontSize: size, fontWeight: "800", fill: INK,
    ...(edged ? { stroke: { color: 0xffffff, width: 4, join: "round" as const } } : {}),
  };
}

function picture(url: string, name: string): Sprite | null {
  const texture = textures.get(url);
  if (!texture) {
    return null;
  }
  const anchor = (anchors as Record<string, { x: number; y: number; scale: number }>)[name];
  const sprite = new Sprite(texture);
  sprite.anchor.set(anchor.x, anchor.y);
  sprite.scale.set(1 / anchor.scale);
  return sprite;
}
