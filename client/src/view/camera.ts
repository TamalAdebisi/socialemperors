// The camera over the town: drag (mouse or one finger) to move, with a
// glide after letting go; wheel, pinch (two fingers) or +/- to zoom,
// smoothly, around the pointer. A drag the town asks for (one that starts
// on a unit) draws a box to select units instead. It runs every frame the screen draws, so it
// is as smooth as the screen (60 or 120 times a second; Flash drew 24 or 30).

import type { Container } from "pixi.js";

import type { Point } from "../rules/geometry.ts";

export interface Area {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** The Flash game's stage: the old client was laid out for this and scaled to the window. */
const STAGE = { width: 760, height: 600 };
/** The Flash client's zoom: where it starts and how far it goes, on its stage. */
const ZOOM_START = 0.7;
const ZOOM_MIN = 0.15;
const ZOOM_MAX = 1.4;
/** A press that moves less than this and is let go within TAP_MS is a tap, not a drag. */
const TAP_MOVE = 8;
const TAP_MS = 500;
/** How quickly a zoom or a glide settles, in milliseconds (smaller is snappier). */
const ZOOM_EASE_MS = 90;
const GLIDE_EASE_MS = 325;

export class Camera {
  private readonly world: Container;
  private readonly area: Area;
  private width = 1;
  private height = 1;
  /** The point of the map in the middle of the screen, and pixels on screen per pixel of map. */
  private centre: Point;
  private zoom = ZOOM_START;
  private targetZoom = ZOOM_START;
  /** The screen point a zoom keeps still (the pointer, or the middle of a pinch). */
  private zoomAround: Point | null = null;
  /** Glide after a drag, in screen pixels per millisecond. */
  private velocity: Point = { x: 0, y: 0 };
  private flight: { from: Point; to: Point; elapsed: number; duration: number } | null = null;
  private readonly pointers = new Map<number, Point>();
  private recentMoves: { t: number; x: number; y: number }[] = [];
  private pinchDistance = 0;
  private readonly keys = new Set<string>();
  private press: { x: number; y: number; t: number; moved: number; pinched: boolean; box: boolean } | null = null;
  /** A map tap, its Shift modifier and input timestamp. Screen points. */
  onTap: ((at: Point, touch: boolean, shift: boolean, time?: number) => void) | null = null;
  onHover: ((at: Point) => void) | null = null;
  /** The mouse left the map (onto a window, or off the page). */
  onLeave: (() => void) | null = null;
  /**
   * A press on the map: true when the town takes the drag to draw a box
   * (selecting units) instead of moving the map. `onBox` then hears the box
   * as it grows, from where the press began (screen points), and once more
   * when it's let go (`done`; a second finger ends it too, with no size).
   */
  onPress: ((at: Point, touch: boolean) => boolean) | null = null;
  onBox: ((from: Point, to: Point, done: boolean) => void) | null = null;
  private canvas: HTMLCanvasElement | null = null;

  constructor(world: Container, area: Area, centre: Point) {
    this.world = world;
    this.area = area;
    this.centre = { ...centre };
  }

  /** The mouse pointer over the map, as CSS has it ("" for the usual arrow). */
  setCursor(cursor: string): void {
    if (this.canvas && this.canvas.style.cursor !== cursor) {
      this.canvas.style.cursor = cursor;
    }
  }

  /** The window's size changed (and at the start). */
  resize(width: number, height: number): void {
    const first = this.width === 1;
    const oldScale = this.screenScale();
    this.width = width;
    this.height = height;
    const ratio = this.screenScale() / oldScale;
    this.zoom = first ? ZOOM_START * this.screenScale() : this.clampZoom(this.zoom * ratio);
    this.targetZoom = this.zoom;
    this.apply();
  }

  /** Listen to the mouse, fingers and keyboard on the game's canvas. */
  attach(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    canvas.style.touchAction = "none";  // the page mustn't scroll or zoom itself under our fingers
    canvas.addEventListener("pointerdown", (e) => {
      this.flight = null;
      canvas.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
      if (this.pointers.size === 1) {
        const at = { x: e.offsetX, y: e.offsetY };
        const touch = e.pointerType === "touch" || e.pointerType === "pen";
        // A slow render or pixel hit test may delay these handlers. Measure
        // the actual gesture, not the time spent waiting for JavaScript.
        this.press = { ...at, t: e.timeStamp, moved: 0, pinched: false, box: this.onPress?.(at, touch) ?? false };
      } else if (this.press) {
        this.press.pinched = true;
        if (this.press.box) {
          // Two fingers: a pinch after all, not a box.
          this.press.box = false;
          this.onBox?.(this.press, this.press, true);
        }
      }
      this.velocity = { x: 0, y: 0 };
      this.recentMoves = [];
      this.pinchDistance = this.pinchSpread();
    });
    canvas.addEventListener("pointerleave", (e) => {
      if (e.pointerType === "mouse") {
        this.onLeave?.();
      }
    });
    canvas.addEventListener("pointermove", (e) => {
      if (e.pointerType === "mouse" && e.buttons === 0) {
        this.onHover?.({ x: e.offsetX, y: e.offsetY });
      }
      this.pointerMoved(e);
    });
    const release = (e: PointerEvent) => {
      if (!this.pointers.delete(e.pointerId)) {
        return;
      }
      if (this.pointers.size === 0) {
        const press = this.press;
        this.press = null;
        if (e.type === "pointerup" && press && !press.pinched && press.moved < TAP_MOVE
            && e.timeStamp - press.t < TAP_MS) {
          this.velocity = { x: 0, y: 0 };
          if (press.box) {
            this.onBox?.(press, press, true);  // no box after all, just a tap
          }
          this.onTap?.({ x: e.offsetX, y: e.offsetY }, e.pointerType === "touch" || e.pointerType === "pen", e.shiftKey, e.timeStamp);
          return;
        }
        if (press?.box) {
          this.onBox?.(press, { x: e.offsetX, y: e.offsetY }, true);
          return;
        }
        this.startGlide();
      }
      this.pinchDistance = this.pinchSpread();
    };
    canvas.addEventListener("pointerup", release);
    canvas.addEventListener("pointercancel", release);
    canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      // A wheel click is about 100; trackpads send many small steps.
      this.zoomBy(Math.pow(1.1, -e.deltaY / 100), { x: e.offsetX, y: e.offsetY });
    }, { passive: false });
    window.addEventListener("keydown", (e) => {
      if (e.key === "+" || e.key === "=") {
        this.zoomBy(1.25, null);
      } else if (e.key === "-" || e.key === "_") {
        this.zoomBy(1 / 1.25, null);
      } else {
        this.keys.add(e.key);
      }
    });
    window.addEventListener("keyup", (e) => this.keys.delete(e.key));
    window.addEventListener("blur", () => this.keys.clear());
  }

  /** Zoom by a factor, keeping `around` (a screen point; the middle when null) still. */
  zoomBy(factor: number, around: Point | null): void {
    this.targetZoom = this.clampZoom(this.targetZoom * factor);
    this.zoomAround = around;
  }

  /** Move the camera; called every frame with the milliseconds since the last. */
  update(ms: number): void {
    // The arrow keys, as in the Flash client: 900 screen pixels a second. (Letters are the
    // menus' shortcuts, ui/menus.ts; with WASD here too, S, A and W did both.)
    const step = 0.9 * ms;
    const dx = (this.held("ArrowRight") - this.held("ArrowLeft")) * step;
    const dy = (this.held("ArrowDown") - this.held("ArrowUp")) * step;
    if (dx || dy) {
      this.flight = null;
      this.panScreen(dx, dy);
    }
    if (this.flight) {
      const f = this.flight;
      f.elapsed = Math.min(f.duration, f.elapsed + ms);
      const t = f.elapsed / f.duration;
      const ease = t * t * (3 - 2 * t);
      this.centre = { x: f.from.x + (f.to.x - f.from.x) * ease, y: f.from.y + (f.to.y - f.from.y) * ease };
      if (t === 1) this.flight = null;
    }
    // Glide: the drag's speed, fading.
    if (this.pointers.size === 0 && (this.velocity.x || this.velocity.y)) {
      this.panScreen(this.velocity.x * ms, this.velocity.y * ms);
      const fade = Math.exp(-ms / GLIDE_EASE_MS);
      this.velocity = { x: this.velocity.x * fade, y: this.velocity.y * fade };
      if (Math.hypot(this.velocity.x, this.velocity.y) < 0.01) {
        this.velocity = { x: 0, y: 0 };
      }
    }
    // Zoom: ease towards the target, keeping the chosen point still.
    if (this.zoom !== this.targetZoom) {
      const around = this.zoomAround ?? { x: this.width / 2, y: this.height / 2 };
      const before = this.toMap(around);
      const ease = 1 - Math.exp(-ms / ZOOM_EASE_MS);
      this.zoom += (this.targetZoom - this.zoom) * ease;
      if (Math.abs(this.zoom - this.targetZoom) < 0.0005 * this.targetZoom) {
        this.zoom = this.targetZoom;
      }
      const after = this.toMap(around);
      this.centre = { x: this.centre.x + before.x - after.x, y: this.centre.y + before.y - after.y };
    }
    this.apply();
  }

  /** Put a point of the map in the middle of the screen. */
  lookAt(point: Point): void {
    this.flight = null;
    this.centre = { ...point };
    this.velocity = { x: 0, y: 0 };
    this.apply();
  }

  /** Guide the eye to an objective, leaving room for the tutorial and its controls. */
  panTo(point: Point, screen: Point, duration = 700): void {
    const to = { x: point.x + (this.width / 2 - screen.x) / this.zoom,
      y: point.y + (this.height / 2 - screen.y) / this.zoom };
    this.velocity = { x: 0, y: 0 };
    if (duration <= 0) this.lookAt(to);
    else this.flight = { from: { ...this.centre }, to, elapsed: 0, duration };
  }

  get panning(): boolean { return this.flight !== null; }

  /** How big the map is drawn: 1 is the art's own size. */
  get scale(): number {
    return this.zoom;
  }

  /** The point of the map under a point of the screen. */
  toMap(screen: Point): Point {
    return {
      x: this.centre.x + (screen.x - this.width / 2) / this.zoom,
      y: this.centre.y + (screen.y - this.height / 2) / this.zoom,
    };
  }

  private pointerMoved(e: PointerEvent): void {
    const last = this.pointers.get(e.pointerId);
    if (!last) {
      return;
    }
    const now = { x: e.offsetX, y: e.offsetY };
    this.pointers.set(e.pointerId, now);
    if (this.press) {
      this.press.moved = Math.max(this.press.moved, Math.hypot(now.x - this.press.x, now.y - this.press.y));
    }
    if (this.pointers.size === 1 && this.press?.box) {
      // Drawing a box: the map stays put.
      if (this.press.moved >= TAP_MOVE) {
        this.onBox?.(this.press, now, false);
      }
    } else if (this.pointers.size === 1) {
      // Drag: the map follows the pointer.
      this.panScreen(last.x - now.x, last.y - now.y);
      this.recentMoves.push({ t: performance.now(), x: last.x - now.x, y: last.y - now.y });
      this.recentMoves = this.recentMoves.filter((move) => performance.now() - move.t < 100);
    } else if (this.pointers.size === 2) {
      // Pinch: zoom by how far the fingers spread, around their middle, at once.
      const spread = this.pinchSpread();
      const middle = this.pinchMiddle();
      if (this.pinchDistance > 0) {
        const before = this.toMap(middle);
        this.zoom = this.targetZoom = this.clampZoom(this.zoom * (spread / this.pinchDistance));
        const after = this.toMap(middle);
        this.centre = { x: this.centre.x + before.x - after.x, y: this.centre.y + before.y - after.y };
      }
      this.pinchDistance = spread;
      // And move with the fingers' middle (each finger counts half).
      this.panScreen((last.x - now.x) / 2, (last.y - now.y) / 2);
    }
  }

  private startGlide(): void {
    const moves = this.recentMoves.filter((move) => performance.now() - move.t < 100);
    if (moves.length < 2) {
      return;
    }
    const time = Math.max(16, performance.now() - moves[0].t);
    const sum = moves.reduce((total, move) => ({ x: total.x + move.x, y: total.y + move.y }), { x: 0, y: 0 });
    this.velocity = { x: sum.x / time, y: sum.y / time };
  }

  private panScreen(dx: number, dy: number): void {
    this.centre = { x: this.centre.x + dx / this.zoom, y: this.centre.y + dy / this.zoom };
  }

  private pinchSpread(): number {
    const [a, b] = [...this.pointers.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }

  private pinchMiddle(): Point {
    const [a, b] = [...this.pointers.values()];
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }

  private held(key: string): number {
    return this.keys.has(key) ? 1 : 0;
  }

  /** How much bigger the window is than the Flash stage, as the old page scaled it. */
  private screenScale(): number {
    return Math.min(Math.max(Math.min(this.width / STAGE.width, this.height / STAGE.height), 0.6), 3);
  }

  private clampZoom(zoom: number): number {
    const scale = this.screenScale();
    return Math.min(Math.max(zoom, ZOOM_MIN * scale), Math.max(ZOOM_MAX * scale, 1.5));
  }

  private apply(): void {
    // Keep the middle of the screen over the map.
    this.centre = {
      x: Math.min(Math.max(this.centre.x, this.area.left), this.area.right),
      y: Math.min(Math.max(this.centre.y, this.area.top), this.area.bottom),
    };
    this.world.scale.set(this.zoom);
    this.world.position.set(this.width / 2 - this.centre.x * this.zoom, this.height / 2 - this.centre.y * this.zoom);
  }
}
