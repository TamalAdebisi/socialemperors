// The goals' HELP! (ui/goalWindow.ts): the game's yellow arrow, drawn as
// Arthur's lessons draw it, pointing at where to start (the Build menu, or
// the town hall's training button). It goes when that is tapped, or after a
// while, as the Flash client's arrow did once its hint was followed.

import { ICONS } from "./icons.ts";

const SHOWN_MS = 8000;
let arrow: HTMLElement | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;

/** Point at an element on the screen (none found: nothing shows). */
export function pointAt(target: Element | null): void {
  hideArrow();
  if (!target) {
    return;
  }
  const box = target.getBoundingClientRect();
  const at = { x: box.left + box.width / 2, y: box.top + box.height / 2 };
  arrow = document.createElement("div");
  arrow.className = "lesson-arrow help-arrow";
  arrow.innerHTML = `<img src="${ICONS["tutor-arrow"]}" alt="">`;
  // From the right near the screen's left (the rail), from below near its top, else from the upper left.
  const angle = at.x < 220 ? 180 : at.y < 170 ? -90 : 45;
  arrow.style.transform = `translate(${Math.round(at.x)}px, ${Math.round(at.y)}px) rotate(${angle}deg)`;
  document.body.append(arrow);
  target.addEventListener("click", hideArrow, { once: true });
  timer = setTimeout(hideArrow, SHOWN_MS);
}

export function hideArrow(): void {
  clearTimeout(timer);
  arrow?.remove();
  arrow = null;
}
