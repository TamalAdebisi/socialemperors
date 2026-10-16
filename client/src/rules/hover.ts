// What the mouse lights on the map, as the Flash client does (our notes, our
// words): anything but scenery, and nothing being built; over it a popup
// with its name and, for a building that works, how far along its round is
// and the time left. Towers, walls and castles have no popup; a mill or mine
// waiting for its working time, its name alone.

import { inConstruction } from "./construction.ts";
import { workState } from "./production.ts";
import type { PlacedItem } from "./town.ts";

/** Scenery (the config's kind 1011): nothing lights up. */
const SCENERY = 1011;
/** Defence (category 2: towers, walls, castles): lit, but no popup. */
const DEFENCE = 2;

export interface Popup {
  name: string;
  /** Its round of work: how far along (0 to 1) and the seconds left; null for the name alone. */
  round: { share: number; secondsLeft: number } | null;
}

/** Whether the mouse lights a thing (`now`: milliseconds, Date.now()). */
export function lights(placed: PlacedItem, now: number): boolean {
  return placed.item.subcategory !== SCENERY && !inConstruction(placed, now);
}

/**
 * The popup over a thing (`clock`: the game's, in seconds), or null for
 * none. A building with no workers shows its whole round still to go, as
 * the game's does.
 */
export function popupOf(placed: PlacedItem, clock: number): Popup | null {
  if (placed.item.category === DEFENCE) {
    return null;
  }
  const state = workState(placed, clock);
  const production = placed.item.production;
  const round = state?.status === "working" ? { share: state.done, secondsLeft: state.secondsLeft }
    : state?.status === "ready" ? { share: 1, secondsLeft: 0 }
    : state?.status === "idle" && production && production.kind !== "chosen" ? { share: 0, secondsLeft: production.seconds }
    : null;
  return { name: placed.item.name, round };
}
