// Signs over the map's buildings, as the Flash client shows them: a bubble in
// the colour of what a building gives when it's ready to collect, "zz" when
// its workers wait for a working time, "Captured!" over a wild animal just
// caught, and the "+240" that rises from a building as it's collected.
// Drawn on the map, so they move with it.

import { Assets, Container, Graphics, Rectangle, Sprite, Text, Texture } from "pixi.js";

import type { Point } from "../rules/geometry.ts";
import type { Resource } from "../rules/production.ts";
import type { PlacedItem } from "../rules/town.ts";
import { ICONS } from "../ui/icons.ts";
import { friendBubble, type FriendWords } from "./friendBubble.ts";

/** The resources' colours, from their icons (food: our carrot's orange). */
export const RESOURCE_COLOURS: Record<Resource | "xp", number> = {
  gold: 0xf2c14e, wood: 0xa86b3c, food: 0xff8f1f, stone: 0xa9aeb5, cash: 0x5cc96b, xp: 0x7fb2ff,
};

/** How big an icon is in its bubble, on the map. */
const ICON_SIZE = 28;
/** How wide "Captured!" is over an animal. */
const CAUGHT_SIZE = 64;
/** The icons' pictures, loaded once for every sign. */
const textures = new Map<string, Promise<Texture | null>>();

function texture(url: string): Promise<Texture | null> {
  let loading = textures.get(url);
  if (!loading) {
    loading = Assets.load<Texture>(url).catch(() => null);
    textures.set(url, loading);
  }
  return loading;
}

export type Sign = { kind: "ready"; resource: Resource } | { kind: "asleep" } | { kind: "caught" }
  | { kind: "friend"; name: string; words: FriendWords };

/** How far signs bob up and down (pixels), and how long one bob takes (ms). */
const BOB = 4;
const BOB_MS = 1600;
/** A number rising from a collected building: how far, and for how long. */
const RISE = 70;
const RISE_MS = 1600;
/** A picture popping up (pop): how big, how far it rises, for how long. */
const POP_SIZE = 44;
const POP_RISE = 24;
const POP_MS = 1000;
/** Zoomed out further than this, signs stop shrinking with the map, so they can still be seen. */
const SMALLEST_SCALE = 0.75;

export class Markers {
  readonly layer = new Container();
  private readonly signs = new Map<PlacedItem, { sign: Container; key: string; phase: number; light?: (on: boolean) => void }>();
  private lit: PlacedItem | null = null;
  private readonly rising: { text: Container; age: number; from: number; rise: number; ms: number }[] = [];
  private clock = 0;
  private scale = 1;

  /** Put a sign over a building at `top` (its picture's top middle), or take it away (null). */
  set(placed: PlacedItem, sign: Sign | null, top: Point | null): void {
    const key = sign === null ? "" : sign.kind === "ready" ? `ready ${sign.resource}` : sign.kind === "friend" ? `friend ${sign.name}` : sign.kind;
    const current = this.signs.get(placed);
    if (current && current.key === key && top) {
      current.sign.position.x = top.x;
      current.sign.y = top.y;  // tick() adds the bob
      return;
    }
    if (current) {
      current.sign.destroy({ children: true });
      this.signs.delete(placed);
    }
    if (sign === null || top === null) {
      return;
    }
    const friend = sign.kind === "friend" ? friendBubble(sign.name, sign.words) : null;
    const drawn = friend ? friend.sign : sign.kind === "caught" ? picture(ICONS.caught, CAUGHT_SIZE)
      : signWith(sign.kind === "ready" ? ICONS[sign.resource] : ICONS.asleep);
    drawn.position.set(top.x, top.y);
    drawn.scale.set(this.scale);
    this.layer.addChild(drawn);
    friend?.light(this.lit === placed);
    // Each sign starts its bob somewhere else, so a row of mills doesn't move in step. A friend's doesn't bob, as in the game.
    this.signs.set(placed, { sign: drawn, key, phase: friend ? NaN : Math.random() * BOB_MS, light: friend?.light });
  }

  /** Numbers rising from `at` and fading: what a collect gave. */
  rise(at: Point, lines: { text: string; colour: number }[]): void {
    const group = new Container();
    lines.forEach((line, i) => {
      const text = new Text({
        text: line.text,
        style: { fontFamily: "system-ui, sans-serif", fontSize: 26, fontWeight: "800", fill: line.colour,
          stroke: { color: 0x1d1d1d, width: 5, join: "round" } },
      });
      text.anchor.set(0.5, 1);
      text.y = i * 30;
      group.addChild(text);
    });
    group.position.set(at.x, at.y);
    group.scale.set(this.scale);
    this.layer.addChild(group);
    this.rising.push({ text: group, age: 0, from: at.y, rise: RISE, ms: RISE_MS });
  }

  /**
   * One of the game's pictures popping up from `at` for a moment: what a unit
   * was sent to do, a collection piece found (`frame`: its part of the picture).
   */
  pop(at: Point, url: string, frame?: { x: number; y: number; width: number; height: number }): void {
    const group = new Container();
    group.position.set(at.x, at.y);
    group.scale.set(this.scale);
    this.layer.addChild(group);
    void texture(url).then((loaded) => {
      if (!loaded || group.destroyed) {
        if (!group.destroyed) {
          group.destroy();  // no picture, nothing to show
        }
        return;
      }
      const picture = frame ? new Texture({ source: loaded.source, frame: new Rectangle(frame.x, frame.y, frame.width, frame.height) }) : loaded;
      const icon = new Sprite(picture);
      icon.anchor.set(0.5, 1);
      icon.scale.set(POP_SIZE / Math.max(picture.width, picture.height));
      group.addChild(icon);
      // Its second starts once the picture is in: a slow first download mustn't use it up unseen.
      this.rising.push({ text: group, age: 0, from: at.y, rise: POP_RISE, ms: POP_MS });
    });
  }

  /** Move things along: `ms` since the last tick; `zoom` is the map's. */
  tick(ms: number, zoom: number): void {
    this.clock += ms;
    this.scale = Math.max(1, SMALLEST_SCALE / zoom);
    for (const { sign, phase } of this.signs.values()) {
      sign.scale.set(this.scale);
      sign.pivot.y = Number.isNaN(phase) ? 0 : BOB * Math.sin(((this.clock + phase) / BOB_MS) * 2 * Math.PI);
    }
    for (let i = this.rising.length - 1; i >= 0; i--) {
      const r = this.rising[i];
      r.age += ms;
      const t = r.age / r.ms;
      if (t >= 1) {
        r.text.destroy({ children: true });
        this.rising.splice(i, 1);
        continue;
      }
      r.text.y = r.from - r.rise * this.scale * easeOut(t);
      r.text.alpha = t < 0.5 ? 1 : 2 * (1 - t);
    }
  }

  /** Take away a building's sign (it was sold, stored...). */
  /**
   * The thing whose sign is under a screen point, the one in front: in the
   * Flash client a sign is part of its building, so tapping the ready bubble
   * collects, as tapping the building does.
   */
  signAt(screen: Point): PlacedItem | null {
    let found: PlacedItem | null = null;
    for (const [placed, { sign }] of this.signs) {
      if (sign.visible && sign.getBounds().containsPoint(screen.x, screen.y)) {
        found = placed;  // later signs are drawn over earlier ones
      }
    }
    return found;
  }

  /** The mouse is on this thing (or none): a friend's bubble over it shows the hand and "Accept". */
  highlight(placed: PlacedItem | null): void {
    if (placed === this.lit) {
      return;
    }
    if (this.lit) {
      this.signs.get(this.lit)?.light?.(false);
    }
    this.lit = placed;
    if (placed) {
      this.signs.get(placed)?.light?.(true);
    }
  }

  remove(placed: PlacedItem): void {
    this.set(placed, null, null);
  }

  /** The building was drawn again somewhere else: its sign goes with it. */
  moveTo(placed: PlacedItem, top: Point | null): void {
    const current = this.signs.get(placed);
    if (current && top) {
      current.sign.position.set(top.x, top.y);
    }
  }

  /** Hide a building's sign for a while (while it's being moved), or show it again. */
  show(placed: PlacedItem, visible: boolean): void {
    const current = this.signs.get(placed);
    if (current) {
      current.sign.visible = visible;
    }
  }
}

function easeOut(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

/** A white bubble pointing down at the building. */
function bubble(): Graphics {
  return new Graphics()
    .circle(0, -26, 20).fill({ color: 0xffffff }).stroke({ color: 0x2b2118, width: 2, alpha: 0.5 })
    .poly([-8, -10, 8, -10, 0, 0]).fill({ color: 0xffffff });
}

/** A bubble with one of the game's icons in it: the resource that's ready, or "zZ". */
/** A picture of its own, no bubble (the game's "Captured!"), its longest side `size`. */
function picture(url: string, size: number): Container {
  const sign = new Container();
  void texture(url).then((loaded) => {
    if (!loaded || sign.destroyed) {
      return;
    }
    const icon = new Sprite(loaded);
    icon.anchor.set(0.5, 1);
    icon.scale.set(size / Math.max(loaded.width, loaded.height));
    sign.addChild(icon);
  });
  return sign;
}

function signWith(url: string): Container {
  const sign = new Container();
  sign.addChild(bubble());
  void texture(url).then((loaded) => {
    if (!loaded || sign.destroyed) {
      return;
    }
    const icon = new Sprite(loaded);
    icon.anchor.set(0.5);
    icon.scale.set(ICON_SIZE / Math.max(loaded.width, loaded.height));
    icon.y = -26;
    sign.addChild(icon);
  });
  return sign;
}
