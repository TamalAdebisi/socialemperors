// Chained buildings (CLIENT.md, "Chained buildings"; the server's
// chained_units.py and chained.py). The original's adverts for packs: here
// the shop sells each one that shows a unit for gold, its chains break
// chainHours after it was placed (or sooner, for 500 food an hour left: rules/speedUps.ts), and
// then Free puts its units beside it and the building goes. No drawing here.

import type { Command } from "../net/commands.ts";
import type { ItemInfo } from "./config.ts";
import { cantPayFood, payFood } from "./speedUps.ts";
import type { PlacedItem, Town } from "./town.ts";
import { population } from "./training.ts";
import { freeTileNear } from "./work.ts";

export function isChained(item: ItemInfo): boolean {
  return Boolean(item.chainedUnits?.length);
}

/** Seconds until the chains break (0: they have). */
export function secondsLeft(placed: PlacedItem, now: number): number {
  const started = placed.startedAt ?? 0;
  return Math.max(0, Math.ceil(started + (placed.item.chainHours ?? 0) * 3600 - now));
}

/** The original's cash for each hour left, started hours counting whole: paid in food (rules/speedUps.ts). */
export function speedUpCash(placed: PlacedItem, now: number): number {
  return Math.ceil(secondsLeft(placed, now) / 3600);
}

export function speedUp(town: Town, placed: PlacedItem, now: number): Command | string {
  const cash = speedUpCash(placed, now);
  if (cash === 0) return "The chains are already broken.";
  // Food, not cash (the owner's rule, 29 October 2026).
  const short = cantPayFood(town, cash);
  if (short) return short;
  payFood(town, cash);
  placed.startedAt = Math.floor(now) - (placed.item.chainHours ?? 0) * 3600;
  return { cmd: "speed_up_chained", args: [placed.tx, placed.ty, town.id] };
}

/** Free: the units on the nearest free tiles, the building gone. */
export function release(town: Town, placed: PlacedItem, items: Map<number, ItemInfo>, now: number): { units: PlacedItem[]; commands: Command[] } | string {
  if (!town.items.includes(placed) || !isChained(placed.item)) return "The Chained building is no longer here.";
  if (secondsLeft(placed, now) > 0) return "The chains aren't broken yet.";
  // Room for them all, as training and the Soul Mixer ask.
  const people = population(town, items);
  const needed = placed.item.chainedUnits!.reduce((sum, id) => sum + Math.max(items.get(id)?.population ?? 0, 0), 0);
  if (needed > 0 && people.current + needed > people.max) return "No room for more people: build houses.";
  const units: PlacedItem[] = [];
  for (const id of placed.item.chainedUnits!) {
    const item = items.get(id);
    const tile = freeTileNear(town, placed);
    if (!item || !tile) {
      town.items.splice(town.items.length - units.length, units.length);  // nothing changes
      return "There is no free space beside it.";
    }
    const unit: PlacedItem = { item, tx: tile.x, ty: tile.y, orientation: 0, unitsInside: 0, units: [], startedAt: Math.floor(now), workTime: 0 };
    town.items.push(unit);
    units.push(unit);
  }
  town.items.splice(town.items.indexOf(placed), 1);
  return { units, commands: [{ cmd: "release_chained", args: [placed.tx, placed.ty, town.id, units.map((u) => [u.tx, u.ty])] }] };
}
