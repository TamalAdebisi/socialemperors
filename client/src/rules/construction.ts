// Building something (CLIENT.md, "Construction"), as the Flash client does
// it (our notes, our words): whatever is bought from the shop, and a
// building placed from storage, stands in scaffolding for 10 seconds, with
// a bar filling under it. Meanwhile it takes nobody in, has no buttons, the
// bulldozer and the glove pass it by, and a tower doesn't shoot; a unit
// stands still. Its work clock runs all the same. It isn't saved: opened
// again, the town shows it finished.

import type { ItemInfo } from "./config.ts";
import type { PlacedItem } from "./town.ts";

/** How long the scaffolding stands, in milliseconds. */
export const BUILD_MS = 10_000;

/** The kinds that have scaffolding of their own: a farm's field being dug, a ranch's fence going up. */
const FARM = 122;
const RANCH = 123;
/** The Hatchery is a ranch by its kind but gets the usual scaffolding. */
const HATCHERY = 226;

/** The scaffolding's picture (view/art/scaffold-*.json): the farm's, the ranch's, or one for its width. */
export type Scaffold = "scaffold-1x1" | "scaffold-2x2" | "scaffold-3x3" | "scaffold-4x4" | "scaffold-farm" | "scaffold-ranch";

export function scaffoldOf(item: ItemInfo): Scaffold {
  if (item.subcategory === RANCH && item.id !== HATCHERY) {
    return "scaffold-ranch";
  }
  if (item.subcategory === FARM) {
    return "scaffold-farm";
  }
  return item.width <= 1 ? "scaffold-1x1" : item.width === 2 ? "scaffold-2x2" : item.width === 3 ? "scaffold-3x3" : "scaffold-4x4";
}

/** Whether something put on the map is built first: anything bought; from storage, only buildings. */
export function isBuilt(item: ItemInfo, fromStorage: boolean): boolean {
  return !fromStorage || !item.isUnit;
}

/** Start building it now (`now`: milliseconds, Date.now()). */
export function startBuilding(placed: PlacedItem, now: number): void {
  placed.builtAt = now + BUILD_MS;
}

/** Whether it's still being built at `now`. */
export function inConstruction(placed: PlacedItem, now: number): boolean {
  return placed.builtAt !== undefined && now < placed.builtAt;
}

/** How far along it is, 0 to 1 (1 when it isn't being built). */
export function builtShare(placed: PlacedItem, now: number): number {
  if (placed.builtAt === undefined) {
    return 1;
  }
  return Math.min(1, Math.max(0, 1 - (placed.builtAt - now) / BUILD_MS));
}
