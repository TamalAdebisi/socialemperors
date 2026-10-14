// Signs over the map's buildings, as the Flash client shows them: a bubble in
// the colour of what a building gives when it's ready to collect, "zz" when
// its workers wait for a working time, and the "+240" that rises from a
// building as it's collected. Drawn on the map, so they move with it.

import { Container, Graphics, Text } from "pixi.js";

import type { Point } from "../rules/geometry.ts";
import type { Resource } from "../rules/production.ts";
import type { PlacedItem } from "../rules/town.ts";

/** The same colours as the top bar's (ui/style.css). */
export const RESOURCE_COLOURS: Record<Resource | "xp", number> = {
  gold: 0xf2c14e, wood: 0xa86b3c, food: 0xe2553f, stone: 0xa9aeb5, cash: 0x5cc96b, xp: 0x7fb2ff,
};

export type Sign = { kind: "ready"; resource: Resource } | { kind: "asleep" };

/** How far signs bob up and down (pixels), and how long one bob takes (ms). */
const BOB = 4;
const BOB_MS = 1600;
/** A number rising from a collected building: how far, and for how long. */
const RISE = 70;
const RISE_MS = 1600;
/** Zoomed out further than this, signs stop shrinking with the map, so they can still be seen. */
const SMALLEST_SCALE = 0.75;

export class Markers {
  readonly layer = new Container();
  private readonly signs = new Map<PlacedItem, { sign: Container; key: string; phase: number }>();
  private readonly rising: { text: Container; age: number; from: number }[] = [];
  private clock = 0;
  private scale = 1;

  /** Put a sign over a building at `top` (its picture's top middle), or take it away (null). */
  set(placed: PlacedItem, sign: Sign | null, top: Point | null): void {
    const key = sign === null ? "" : sign.kind === "ready" ? `ready ${sign.resource}` : "asleep";
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
    const drawn = sign.kind === "ready" ? readySign(RESOURCE_COLOURS[sign.resource]) : asleepSign();
    drawn.position.set(top.x, top.y);
    drawn.scale.set(this.scale);
    this.layer.addChild(drawn);
    // Each sign starts its bob somewhere else, so a row of mills doesn't move in step.
    this.signs.set(placed, { sign: drawn, key, phase: Math.random() * BOB_MS });
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
    this.rising.push({ text: group, age: 0, from: at.y });
  }

  /** Move things along: `ms` since the last tick; `zoom` is the map's. */
  tick(ms: number, zoom: number): void {
    this.clock += ms;
    this.scale = Math.max(1, SMALLEST_SCALE / zoom);
    for (const { sign, phase } of this.signs.values()) {
      sign.scale.set(this.scale);
      sign.pivot.y = BOB * Math.sin(((this.clock + phase) / BOB_MS) * 2 * Math.PI);
    }
    for (let i = this.rising.length - 1; i >= 0; i--) {
      const r = this.rising[i];
      r.age += ms;
      const t = r.age / RISE_MS;
      if (t >= 1) {
        r.text.destroy({ children: true });
        this.rising.splice(i, 1);
        continue;
      }
      r.text.y = r.from - RISE * this.scale * easeOut(t);
      r.text.alpha = t < 0.5 ? 1 : 2 * (1 - t);
    }
  }

  /** Take away a building's sign (it was sold, stored...). */
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

function readySign(colour: number): Container {
  const sign = new Container();
  sign.addChild(bubble(), new Graphics().circle(0, -26, 12).fill({ color: colour }).stroke({ color: 0x000000, width: 2, alpha: 0.2 }));
  return sign;
}

function asleepSign(): Container {
  const sign = new Container();
  const zz = new Text({ text: "zz", style: { fontFamily: "system-ui, sans-serif", fontSize: 20, fontWeight: "800", fill: 0x4a5a8a } });
  zz.anchor.set(0.5);
  zz.y = -27;
  sign.addChild(bubble(), zz);
  return sign;
}
