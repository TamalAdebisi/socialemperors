// A building's first child is a state selector in the original game.
// Our sheets advanced every child together, interleaving those states.
// Keep only the chosen state's samples, holding each until its next sample
// so animations INSIDE that state keep their original duration.
import { BUILDING_STATES } from "./buildingStates.ts";

/** This incomplete export is shown as its original first idle pose. */
export const STEADY_BUILDING = "1527_dragonCity_cross";

export function buildingStateCount(art: string, facing: number): number {
  return BUILDING_STATES[art]?.[facing] ?? 1;
}

/** Indices at the sheet's fps, or null when there is no state timeline to separate. */
export function buildingStateFrames(art: string, facing: number, pictures: number, state = 0): number[] | null {
  const states = buildingStateCount(art, facing);
  if (states <= 1 || pictures === 0) {
    return null;
  }
  const first = Math.max(0, Math.min(state, states - 1, pictures - 1));
  // This export has only five idle samples, five seconds apart, and cuts
  // off a longer nested timeline. Playing them would introduce large jumps.
  // Keep its original idle pose until a separately held-state loop exists.
  if (art === STEADY_BUILDING) {
    return [first];
  }
  const last = first + Math.floor((pictures - 1 - first) / states) * states;
  return Array.from({ length: pictures }, (_, time) => Math.min(first + Math.floor(time / states) * states, last));
}

/** These towers' second state pours at a target; their first waits without pouring. */
export function pouringTower(art: string): boolean {
  return art === "oiltower" || art === "torreagua";
}

/** Entirely empty final frames found across all 2,163 structure atlas pages. */
export const BLANK_BUILDING_ENDS: Readonly<Record<string, number>> = {
  "1448_chained_chest": 210,
  "1449_chained_chest": 210,
  "1467_chained_dark": 210,
  "3006_chained_monster_chest": 210,
  "3032_chained_creatures": 210,
  "3074_chained_chest": 210,
  "retretetrol": 382,
};

/** Keep genuine motion; loop before a known blank frame makes the whole structure disappear. */
export function buildingLoopLength(art: string, pictures: number): number {
  return BLANK_BUILDING_ENDS[art] === pictures ? pictures - 1 : pictures;
}
