// How finely the game is drawn. On a high-density screen (a Retina laptop,
// most phones) a page pixel is two screen pixels each way, so a sharp
// drawing has four times the pixels to fill: a slower graphics chip falls
// behind in a busy town. "Fast drawing" (the Menu) draws one for one, a
// little softer, as a 1x screen shows it; on a phone or tablet it's on
// unless switched off. "Light art" keeps big units' pictures at half size, a
// quarter of the memory (view/art.ts). Both are remembered in this browser,
// for the town and the fights alike. CLIENT.md, "Light art".

import type { Ticker } from "pixi.js";

const SAVED = "se-fast-drawing";
const SAVED_LIGHT = "se-light-art";
/** This page's choices, when made: they hold even where storage is refused. */
let chosen: boolean | null = null;
let chosenLight: boolean | null = null;

/** "on", "off", or null when this browser hasn't been told. */
function remembered(key: string): boolean | null {
  try {
    const saved = localStorage.getItem(key);
    return saved === "on" ? true : saved === "off" ? false : null;
  } catch {
    return null;  // storage refused (a private window)
  }
}

function remember(key: string, on: boolean): void {
  try {
    localStorage.setItem(key, on ? "on" : "off");
  } catch {
    // Not remembered, then: it holds until the page closes.
  }
}

/** A phone or tablet: a finger to point with, and nothing to hover with. */
export function touchScreen(): boolean {
  return typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches && !matchMedia("(hover: hover)").matches;
}

/** Whether fast drawing is on in this browser: as chosen, or else on a touch screen. */
export function fastDrawing(): boolean {
  return chosen ?? remembered(SAVED) ?? touchScreen();
}

export function setFastDrawing(on: boolean): void {
  chosen = on;
  remember(SAVED, on);
}

/**
 * Whether big units are kept at half size: as chosen in the Menu, or on a
 * touch screen or a computer that says it has 4 GB or less. Null when
 * neither: the page decides by how much its big units would take
 * (ArtLibrary.plan).
 */
export function lightArt(): boolean | null {
  const choice = chosenLight ?? remembered(SAVED_LIGHT);
  if (choice !== null) {
    return choice;
  }
  const memory = typeof navigator === "undefined" ? undefined : (navigator as { deviceMemory?: number }).deviceMemory;
  return touchScreen() || (memory !== undefined && memory <= 4) ? true : null;
}

/** Light art from now on (the next page drawn: what's loaded stays as it is). */
export function setLightArt(on: boolean): void {
  chosenLight = on;
  remember(SAVED_LIGHT, on);
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

/**
 * At most 60 drawings a second. Phones and gaming screens offer 90 to 144,
 * but the art moves at 30 pictures a second: the rest is heat and battery.
 * Set a little over 60, as PixiJS rounds each gap down to whole
 * milliseconds and would otherwise skip every other frame of a 60 Hz screen.
 */
export const MOST_FRAMES = 64;

export function steadyFrames(ticker: Ticker): void {
  ticker.maxFPS = MOST_FRAMES;
}
