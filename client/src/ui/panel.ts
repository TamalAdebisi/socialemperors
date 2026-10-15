// The windows (CLIENT.md, "The menus: rail and dock"): on a wide screen a
// panel down the right, the town still in view and still playable beside
// it; on a phone a sheet over the lower half, above the dock, with a handle
// to drag it down. The same element either way: the style sheet decides.
// One window is open at a time, and the menu button that opened it is lit.

import { ICONS } from "./icons.ts";

/** How far a sheet is dragged down before letting go closes it, in pixels. */
const DRAG_TO_CLOSE = 80;

type Listener = (open: Panel | null) => void;
const listeners: Listener[] = [];
let current: Panel | null = null;

/** Hear when a window opens or closes (the menus light the open one's button). */
export function onPanelChange(listener: Listener): void {
  listeners.push(listener);
}

/** Put away whichever window is open (Arthur's lessons do, to show the town). */
export function closePanel(): void {
  current?.close();
}

function changed(): void {
  // What sits on the right of the screen makes way for an open panel (style.css).
  document.body.classList.toggle("panel-open", current !== null);
  for (const listener of listeners) {
    listener(current);
  }
}

export class Panel {
  private menu: string;
  readonly element: HTMLElement;
  /** Where the window's own content goes. */
  readonly body: HTMLElement;
  private readonly heading: HTMLElement;
  private readonly closed: (() => void) | undefined;

  constructor(key: string, title: string, { className = "", onClose }: { className?: string; onClose?: () => void } = {}) {
    this.menu = key;
    this.closed = onClose;
    this.element = document.createElement("section");
    this.element.className = `panel ${className}`.trim();
    this.element.hidden = true;
    this.element.setAttribute("role", "dialog");
    this.element.innerHTML = `
      <div class="panel-handle" aria-hidden="true"><span></span></div>
      <header class="panel-head">
        <h2></h2>
        <button class="panel-close" type="button" aria-label="Close window"><img src="${ICONS.close}" alt=""></button>
      </header>
      <div class="panel-body"></div>`;
    this.heading = this.element.querySelector("h2")!;
    this.body = this.element.querySelector(".panel-body")!;
    this.title = title;
    this.element.querySelector(".panel-close")!.addEventListener("click", () => this.close());
    // Escape closes the window, wherever the focus is; nothing else hears it then.
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.isOpen) {
        e.stopImmediatePropagation();
        this.close();
      }
    });
    this.dragToClose();
    document.body.appendChild(this.element);
  }

  /** Which menu button it belongs to ("build", "neighbours"...): lit while it's open. */
  get key(): string {
    return this.menu;
  }

  set key(key: string) {
    this.menu = key;
    if (current === this) {
      changed();
    }
  }

  get isOpen(): boolean {
    return !this.element.hidden;
  }

  set title(text: string) {
    this.heading.textContent = text;
    this.element.setAttribute("aria-label", text);
  }

  /** Open it, closing whichever window was open. */
  open(): void {
    if (current && current !== this) {
      current.close();
    }
    this.element.style.transform = "";
    this.element.hidden = false;
    current = this;
    changed();
  }

  close(): void {
    if (this.element.hidden) {
      return;
    }
    this.element.hidden = true;
    if (current === this) {
      current = null;
      changed();
    }
    this.closed?.();
  }

  /** Open if closed, close if open: a menu button pressed twice puts its window away. */
  toggle(): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  /** On a phone the sheet follows a finger dragging its handle or title down, and closes past a point. */
  private dragToClose(): void {
    const grips = [this.element.querySelector<HTMLElement>(".panel-handle")!, this.element.querySelector<HTMLElement>(".panel-head")!];
    let from: number | null = null;
    let pointer = -1;
    for (const grip of grips) {
      grip.addEventListener("pointerdown", (e) => {
        if (!isSheet() || (e.target as Element).closest("button")) {
          return;
        }
        from = e.clientY;
        pointer = e.pointerId;
        grip.setPointerCapture(e.pointerId);
      });
      grip.addEventListener("pointermove", (e) => {
        if (from !== null && e.pointerId === pointer) {
          this.element.style.transform = `translateY(${Math.max(0, e.clientY - from)}px)`;
        }
      });
      const release = (e: PointerEvent) => {
        if (from === null || e.pointerId !== pointer) {
          return;
        }
        const dragged = e.clientY - from;
        from = null;
        this.element.style.transform = "";
        if (dragged > DRAG_TO_CLOSE) {
          this.close();
        }
      };
      grip.addEventListener("pointerup", release);
      grip.addEventListener("pointercancel", release);
    }
  }
}

/** Whether windows show as sheets (a phone held upright, or any narrow screen): the style sheet's rule. */
export function isSheet(): boolean {
  return matchMedia(NARROW).matches;
}

/** Where the phone arrangement takes over: style.css uses the same rule. */
export const NARROW = "(max-width: 720px), (orientation: portrait) and (max-width: 1000px)";
