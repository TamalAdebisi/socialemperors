// What a farm or ranch shows, as the Flash client picks it (our notes, our
// words; CLIENT.md, "Villagers at work"). Its picture in the game's file
// holds all its states one after another, and the game shows the one that
// fits: an empty field, the villager inside at work, ripe crops; a ranch
// with as many animals as are inside. Played straight through, as we did
// before, a farm cycled through a man, a woman and ripe crops whoever was
// there. No drawing here, so it can be tested.

import type { PlacedItem } from "../rules/town.ts";

const FARM = 122, RANCH = 123;
/** The villagers who are men (human and troll); the women have pictures of their own. */
const MEN = new Set([500, 580]);
/**
 * A farm's 45 pictures: 1 the empty field; 2 to 21 a man at work; 22 to 43
 * a woman at work; 44 ripe crops with the man, 45 with the woman. (Counted
 * from 0 below.)
 */
const FARM_PICTURES = 45;
const MAN_AT_WORK = [1, 20], WOMAN_AT_WORK = [21, 42], RIPE_WITH_MAN = 43, RIPE_WITH_WOMAN = 44;

/**
 * Which of a building's pictures to show, in turn ([n] for a still one), or
 * null to play them all: a building whose pictures aren't laid out this way
 * (the Training Stables' are a long animation of their own).
 */
export function lookOf(placed: PlacedItem, pictures: number, ready: boolean): number[] | null {
  if (placed.item.subcategory === FARM && pictures === FARM_PICTURES) {
    if (placed.unitsInside === 0) {
      return [0];
    }
    const man = MEN.has(placed.units?.[0] ?? 500);
    if (ready) {
      return [man ? RIPE_WITH_MAN : RIPE_WITH_WOMAN];
    }
    const [first, last] = man ? MAN_AT_WORK : WOMAN_AT_WORK;
    return Array.from({ length: last - first + 1 }, (_, i) => first + i);
  }
  if (placed.item.subcategory === RANCH && pictures === placed.item.capacity + 1) {
    return [Math.min(placed.unitsInside, pictures - 1)];
  }
  return null;
}

/** What decides a farm's or ranch's look: when it changes, it's drawn again. */
export function lookKey(placed: PlacedItem, ready: boolean): string | null {
  const kind = placed.item.subcategory;
  return kind === FARM || kind === RANCH ? `${placed.unitsInside} ${placed.units?.[0] ?? ""} ${ready}` : null;
}
