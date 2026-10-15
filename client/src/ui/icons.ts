// The game's own icons and buttons, drawn from its Flash file by
// tools/art/export_ui.py, for the windows in HTML and the signs on the map.
// Vite copies each file named here into the build, under a name that
// changes with its contents, so browsers keep it as long as it's the same.

import type { Resource } from "../rules/production.ts";

export const ICONS = {
  // Resources, experience and people.
  gold: new URL("./art/gold.webp", import.meta.url).href,
  wood: new URL("./art/wood.webp", import.meta.url).href,
  food: new URL("./art/food.svg", import.meta.url).href,  // our carrot: the game's was a steak
  stone: new URL("./art/stone.webp", import.meta.url).href,
  cash: new URL("./art/cash.webp", import.meta.url).href,
  xp: new URL("./art/xp.webp", import.meta.url).href,
  asleep: new URL("./art/asleep.webp", import.meta.url).href,
  // The tools, as on the Flash client's bar.
  build: new URL("./art/build.webp", import.meta.url).href,
  storage: new URL("./art/storage.webp", import.meta.url).href,
  "fast-collect": new URL("./art/fast-collect.webp", import.meta.url).href,
  pointer: new URL("./art/pointer.webp", import.meta.url).href,
  "pointer-cancel": new URL("./art/pointer-cancel.webp", import.meta.url).href,
  "square-tool": new URL("./art/square-tool.webp", import.meta.url).href,
  "square-tool-space": new URL("./art/square-tool-space.webp", import.meta.url).href,
  // The menus' other buttons: the game bar's own, and its villager for the neighbours.
  units: new URL("./art/units.webp", import.meta.url).href,
  quests: new URL("./art/quests.webp", import.meta.url).href,
  pvp: new URL("./art/pvp.webp", import.meta.url).href,
  survival: new URL("./art/survival.webp", import.meta.url).href,
  tournament: new URL("./art/tournament.webp", import.meta.url).href,
  world: new URL("./art/my-world.webp", import.meta.url).href,
  neighbours: new URL("./art/neighbours.webp", import.meta.url).href,
  population: new URL("./art/population.webp", import.meta.url).href,
  // Bonuses: the game bar's daily bonus button, and its gift box for the chests.
  "daily-bonus": new URL("./art/daily-bonus.webp", import.meta.url).href,
  // The welcome-back chest's own button, the game's "Reward" box.
  "welcome-back": new URL("./art/welcome-back.webp", import.meta.url).href,
  "music-on": new URL("./art/music-on.webp", import.meta.url).href,
  "music-off": new URL("./art/music-off.webp", import.meta.url).href,
  "sound-on": new URL("./art/sound-on.webp", import.meta.url).href,
  "sound-off": new URL("./art/sound-off.webp", import.meta.url).href,
  "help-ray": new URL("./art/help-ray.webp", import.meta.url).href,
  // What a selected unit can do to what's under it: chop, mine, go inside.
  axe: new URL("./art/axe.webp", import.meta.url).href,
  pick: new URL("./art/pick.webp", import.meta.url).href,
  inside: new URL("./art/inside.webp", import.meta.url).href,
  // Over a wild animal just caught.
  caught: new URL("./art/caught.webp", import.meta.url).href,
  // On each block of land that can be bought, on the map.
  "for-sale": new URL("./art/for-sale.webp", import.meta.url).href,
  gifts: new URL("./art/gifts.webp", import.meta.url).href,
  // The selected thing's buttons, as on its info panel.
  move: new URL("./art/move.webp", import.meta.url).href,
  turn: new URL("./art/turn.webp", import.meta.url).href,
  store: new URL("./art/store.webp", import.meta.url).href,
  remove: new URL("./art/remove.webp", import.meta.url).href,
  close: new URL("./art/close.webp", import.meta.url).href,
  // The way home from an island (the game bar's), and the quest window's stars.
  "my-town": new URL("./art/my-town.webp", import.meta.url).href,
  "star-on": new URL("./art/star-on.webp", import.meta.url).href,
  "star-off": new URL("./art/star-off.webp", import.meta.url).href,
  // Spells: the book that opens them in battle, and mana.
  "spell-book": new URL("./art/spell-book.webp", import.meta.url).href,
  mana: new URL("./art/mana.webp", import.meta.url).href,
  // The graveyard's potions.
  potion: new URL("./art/potion.webp", import.meta.url).href,
  // The cards' buttons for a building's window: the graveyards' and the altar's, the harbour's, the zeppelin tower's.
  "open-graveyard": new URL("./art/open-graveyard.webp", import.meta.url).href,
  "open-harbour": new URL("./art/open-harbour.webp", import.meta.url).href,
  "open-zeppelin": new URL("./art/open-zeppelin.webp", import.meta.url).href,
  // Arthur's lessons, and the free draggy at their end.
  "tutor-arthur": new URL("./art/tutor-arthur.webp", import.meta.url).href,
  "tutor-arrow": new URL("./art/tutor-arrow.webp", import.meta.url).href,
  "tutor-bubble": new URL("./art/tutor-bubble.webp", import.meta.url).href,
  "tutor-next": new URL("./art/tutor-next.webp", import.meta.url).href,
  "tutor-marker": new URL("./art/tutor-marker.webp", import.meta.url).href,
  "draggy-window": new URL("./art/draggy-window.webp", import.meta.url).href,
  "draggy-title": new URL("./art/draggy-title.webp", import.meta.url).href,
  "draggy-frame": new URL("./art/draggy-frame.webp", import.meta.url).href,
  "reminder-ok": new URL("./art/reminder-ok.webp", import.meta.url).href,
  "open-nest": new URL("./art/open-nest.webp", import.meta.url).href,
  "open-gate": new URL("./art/open-gate.webp", import.meta.url).href,
  "close-gate": new URL("./art/close-gate.webp", import.meta.url).href,
  // Pausing: the options panel's button, the game's GAME PAUSED and its RESUME.
  pause: new URL("./art/pause.webp", import.meta.url).href,
  "game-paused": new URL("./art/game-paused.webp", import.meta.url).href,
  resume: new URL("./art/resume.webp", import.meta.url).href,
} as const;

export type IconName = keyof typeof ICONS;

/** A resource's icon. */
export function resourceIcon(resource: Resource): string {
  return ICONS[resource];
}

/** An icon as an image, sized by CSS (class "icon"); `label` for screen readers, or "" when text says it already. */
export function iconImage(name: IconName, label = ""): HTMLImageElement {
  const image = new Image();
  image.className = "icon";
  image.src = ICONS[name];
  image.alt = label;
  image.decoding = "async";
  image.draggable = false;
  return image;
}

/**
 * The Flash client's mouse pointers for a selected unit (and the square
 * tool), as CSS cursors: the picture, then its hot spot (the pixel that
 * points) from the top left.
 */
export const CURSORS = {
  square: `url("${new URL("./art/cursor-square.png", import.meta.url).href}") 13 9, crosshair`,
  remove: `url("${new URL("./art/cursor-remove.png", import.meta.url).href}") 16 13, crosshair`,
  collect: `url("${new URL("./art/cursor-collect.png", import.meta.url).href}") 16 13, pointer`,
  axe: `url("${new URL("./art/cursor-axe.png", import.meta.url).href}") 4 4, pointer`,
  pick: `url("${new URL("./art/cursor-pick.png", import.meta.url).href}") 4 4, pointer`,
  inside: `url("${new URL("./art/cursor-inside.png", import.meta.url).href}") 1 12, pointer`,
  repair: `url("${new URL("./art/cursor-repair.png", import.meta.url).href}") 4 4, pointer`,
};
