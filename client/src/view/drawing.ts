// How finely the game is drawn. On a high-density screen (a Retina laptop,
// most phones) a page pixel is two screen pixels each way, so a sharp
// drawing has four times the pixels to fill: a slower graphics chip falls
// behind in a busy town. "Fast drawing" (the Menu) draws one for one, a
// little softer, as a 1x screen shows it. Remembered in this browser, for
// the town and the fights alike.

const SAVED = "se-fast-drawing";
/** This page's choice, when one was made: it holds even where storage is refused. */
let chosen: boolean | null = null;

/** Whether fast drawing is on in this browser: off unless chosen. */
export function fastDrawing(): boolean {
  if (chosen !== null) {
    return chosen;
  }
  try {
    return localStorage.getItem(SAVED) === "on";
  } catch {
    return false;  // storage refused (a private window): the sharp drawing
  }
}

export function setFastDrawing(on: boolean): void {
  chosen = on;
  try {
    localStorage.setItem(SAVED, on ? "on" : "off");
  } catch {
    // Not remembered, then: it holds until the page closes.
  }
}

/**
 * Screen pixels drawn for each pixel of the page: the screen's own, up to
 * 2 (more costs a lot for little to see), or 1 when drawing fast.
 */
export function drawingResolution(): number {
  return fastDrawing() ? 1 : Math.min(window.devicePixelRatio || 1, 2);
}

/** Whether the screen has more pixels than the page: only then does fast drawing change anything. */
export function denseScreen(): boolean {
  return (window.devicePixelRatio || 1) > 1;
}
