// Arthur's lessons on screen (CLIENT.md, "Arthur's lessons"): Arthur and
// his speech bubble at the right, the game's yellow arrow pointing at what
// to tap, the screen dimmed around it, the red markers over the trees to
// cut and their count. The game's own pictures; the dimming is drawn. The
// rules are in rules/lessons.ts, the steps in lessons.ts.

import type { Point } from "../rules/geometry.ts";
import { ICONS } from "./icons.ts";

export class LessonsView {
  private readonly box = document.createElement("section");
  private readonly title = document.createElement("h2");
  private readonly text = document.createElement("p");
  private readonly page = document.createElement("span");
  private readonly next = document.createElement("button");
  private readonly arrow = document.createElement("div");
  private readonly hole = document.createElement("div");
  private readonly count = document.createElement("div");
  private readonly help = document.createElement("button");
  private readonly target = document.createElement("div");
  private readonly markers: HTMLImageElement[] = [];

  constructor(onNext: () => void, onHelp: () => void = () => {}) {
    this.box.className = "lesson";
    this.box.setAttribute("role", "dialog");
    this.box.setAttribute("aria-label", "Arthur's lessons");
    const bubble = document.createElement("div");
    bubble.className = "lesson-bubble";
    bubble.style.backgroundImage = `url("${ICONS["tutor-bubble"]}")`;
    this.title.className = "lesson-title";
    this.text.className = "lesson-text";
    this.text.setAttribute("aria-live", "polite");
    const foot = document.createElement("div");
    foot.className = "lesson-foot";
    this.page.className = "lesson-page";
    this.next.type = "button";
    this.next.className = "lesson-next";
    this.next.setAttribute("aria-label", "Next");
    this.next.innerHTML = `<img src="${ICONS["tutor-next"]}" alt="">`;
    this.next.addEventListener("click", onNext);
    this.help.type = "button";
    this.help.className = "button tiny lesson-help";
    this.help.textContent = "Show me";
    this.help.addEventListener("click", onHelp);
    foot.append(this.page, this.help, this.next);
    bubble.append(this.title, this.text, this.count, foot);
    const arthur = document.createElement("img");
    arthur.className = "lesson-arthur";
    arthur.src = ICONS["tutor-arthur"];
    arthur.alt = "";
    this.box.append(bubble, arthur);
    this.arrow.className = "lesson-arrow";
    this.arrow.innerHTML = `<img src="${ICONS["tutor-arrow"]}" alt="">`;
    this.hole.className = "lesson-hole";
    this.count.className = "lesson-count";
    this.count.hidden = true;
    this.target.className = "lesson-target";
    this.target.hidden = true;
    document.body.append(this.hole, this.box, this.arrow, this.target);
  }

  /** A step's words (none: the bubble goes) and whether it has a Next. */
  say(title: string, text: string, page: string, next: boolean): void {
    this.box.hidden = !title && !text;
    this.title.textContent = title;
    this.text.textContent = text;
    this.page.textContent = page;
    this.next.hidden = !next;
    this.help.hidden = next;
    if (next) {
      this.next.focus();
    }
  }

  destination(at: Point | null, label: string, moving: boolean): void {
    this.box.dataset.moving = String(moving);
    this.target.hidden = !at || !label;
    this.target.textContent = label;
    if (at) this.target.style.transform = `translate(${Math.round(at.x)}px, ${Math.round(at.y)}px)`;
  }

  helpLabel(label = "Show me"): void { this.help.textContent = label; }

  /**
   * Point at a spot of the screen (null: no arrow). `dim`: "around" the
   * screen dimmed but a circle round it, "all" dimmed, "none" clear.
   */
  point(at: Point | null, dim: "around" | "all" | "none"): void {
    this.arrow.hidden = at === null;
    if (at) {
      // From the upper left, pointing down and right; from the right near the screen's left (the rail), from below near its top.
      const angle = at.x < 220 ? 180 : at.y < 170 ? -90 : 45;
      this.arrow.style.transform = `translate(${Math.round(at.x)}px, ${Math.round(at.y)}px) rotate(${angle}deg)`;
    }
    this.hole.hidden = dim === "none";
    this.hole.classList.toggle("all", dim === "all" || at === null);
    if (at && dim === "around") {
      this.hole.style.transform = `translate(${Math.round(at.x)}px, ${Math.round(at.y)}px)`;
    }
  }

  /** Whether Arthur and his bubble cover this spot of the screen. */
  covers(at: Point): boolean {
    if (this.box.hidden) {
      return false;
    }
    const box = this.box.getBoundingClientRect();
    return at.x >= box.left && at.x <= box.right && at.y >= box.top && at.y <= box.bottom;
  }

  /** The red markers over the trees to cut. */
  mark(spots: Point[]): void {
    while (this.markers.length < spots.length) {
      const marker = document.createElement("img");
      marker.className = "lesson-marker";
      marker.src = ICONS["tutor-marker"];
      marker.alt = "";
      document.body.append(marker);
      this.markers.push(marker);
    }
    this.markers.forEach((marker, i) => {
      const spot = spots[i];
      marker.hidden = !spot;
      if (spot) {
        marker.style.transform = `translate(${Math.round(spot.x)}px, ${Math.round(spot.y)}px)`;
      }
    });
  }

  /** "Trees chopped 1/3", or nothing. */
  counter(text: string | null): void {
    this.count.hidden = text === null;
    this.count.textContent = text ?? "";
  }

  remove(): void {
    for (const element of [this.box, this.arrow, this.hole, this.count, this.target, ...this.markers]) {
      element.remove();
    }
  }
}
