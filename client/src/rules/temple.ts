// Supreme Bahamut's temple. Notes in docs/original/rules/temple.md explain
// the local source reading, including the rules outside the window.

import type { Command } from "../net/commands.ts";
import type { ItemInfo } from "./config.ts";
import { isTheirs } from "./editing.ts";
import { standBeside } from "./graveyard.ts";
import type { Point } from "./geometry.ts";
import { savedTile, type PlacedItem, type Town } from "./town.ts";

export const SUPREME_TEMPLE = 1394;
export const SUPREME_DRAGON = 2003;
export const BAHAMUT_HEART = 1410;
export const TEMPLE_WAIT = 48 * 60 * 60;

export type TempleOffering = { kind: "resource"; resource: "gold" | "stone" | "wood" | "food" | "mana" | "cash"; key: string; amount: number }
  | { kind: "dragon"; item: number }
  | { kind: "collection"; collection: number; item: number };

/** Display order, not a required order: each unfinished offering can be chosen. */
export const TEMPLE_OFFERINGS: readonly TempleOffering[] = [
  { kind: "resource", resource: "gold", key: "g", amount: 100000 },
  { kind: "resource", resource: "stone", key: "s", amount: 100000 },
  { kind: "resource", resource: "wood", key: "w", amount: 100000 },
  { kind: "resource", resource: "food", key: "f", amount: 100000 },
  { kind: "resource", resource: "mana", key: "m", amount: 50 },
  { kind: "resource", resource: "cash", key: "c", amount: 50 },
  ...[649, 684, 695, 853, 875].map((item): TempleOffering => ({ kind: "dragon", item })),
  { kind: "collection", collection: 23, item: BAHAMUT_HEART },
];

export interface TempleState { done: number[]; since: number }
export interface TempleChange { state: TempleState; commands: Command[]; removed?: PlacedItem; placed?: PlacedItem }

export function readTemple(saved: Record<string, unknown>): TempleState {
  const done = Array.isArray(saved.templeStep) ? [...new Set(saved.templeStep.map(Number)
    .filter((step) => Number.isInteger(step) && step >= 0 && step < TEMPLE_OFFERINGS.length))] : [];
  const since = Number(saved.timeStampTemple);
  return { done, since: Number.isFinite(since) && since > 0 ? since : 0 };
}

export function writeTemple(saved: Record<string, unknown>, state: TempleState): void {
  saved.templeStep = [...state.done];
  saved.timeStampTemple = state.since;
}

export function templeSeconds(state: TempleState, now: number): number {
  return state.since > 0 ? Math.max(0, Math.ceil(state.since + TEMPLE_WAIT - now)) : 0;
}

/** Only a live player's dragon standing outside a building can be sacrificed. */
export function templeDragon(town: Town, id: number): PlacedItem | undefined {
  return town.items.find((placed) => placed.item.id === id && placed.item.isUnit && isTheirs(town, placed.item) && !placed.wild);
}

/** The original's displayed gift list combines shared gifts and this town's store. */
export function canOffer(town: Town, mana: number, offering: TempleOffering): boolean {
  if (offering.kind === "resource") return (offering.resource === "mana" ? mana : town[offering.resource]) >= offering.amount;
  if (offering.kind === "dragon") return templeDragon(town, offering.item) !== undefined;
  return (town.gifts.get(offering.item) ?? 0) + (town.store.get(offering.item) ?? 0) >= 1;
}

/** One offering, paid once, starts the wait even when it is the twelfth. */
export function offerAtTemple(town: Town, magic: { mana: number }, state: TempleState, step: number, now: number,
  prepareRemoval: (unit: PlacedItem) => Point = savedTile): TempleChange | null {
  const offering = TEMPLE_OFFERINGS[step];
  if (!offering || state.done.includes(step) || templeSeconds(state, now) > 0 || !canOffer(town, magic.mana, offering)) return null;
  const commands: Command[] = [];
  let data: Record<string, number>;
  let removed: PlacedItem | undefined;
  if (offering.kind === "resource") {
    if (offering.resource === "mana") magic.mana -= offering.amount;
    else town[offering.resource] -= offering.amount;
    data = { [offering.key]: offering.amount };
  } else if (offering.kind === "dragon") {
    removed = templeDragon(town, offering.item)!;
    const at = prepareRemoval(removed);
    commands.push({ cmd: "sell", args: [at.x, at.y, offering.item, town.id, 1, "DEBUG"] });
    town.items.splice(town.items.indexOf(removed), 1);
    data = { u: offering.item };
  } else data = { collection: offering.collection };
  commands.push({ cmd: "next_temple_step", args: [JSON.stringify(data), step] });
  return { state: { done: [...state.done, step], since: Math.floor(now) }, commands, removed };
}

/** Free beside the temple: no population or unit-limit gate and no new XP. */
export function claimTemple(town: Town, items: Map<number, ItemInfo>, building: PlacedItem, state: TempleState, now: number): TempleChange | null {
  const dragon = items.get(SUPREME_DRAGON);
  if (!dragon || building.item.id !== SUPREME_TEMPLE || !town.items.includes(building)
    || state.done.length !== TEMPLE_OFFERINGS.length || templeSeconds(state, now) > 0) return null;
  const placed = standBeside(town, dragon, building);
  const commands: Command[] = [{ cmd: "buy", args: [dragon.id, placed.tx, placed.ty, placed.orientation, town.id, 1, 1, "u"] }];
  // sell_stored_item takes this town's store first, then falls back to gifts.
  const box = (town.store.get(BAHAMUT_HEART) ?? 0) > 0 ? town.store : town.gifts;
  const hearts = box.get(BAHAMUT_HEART) ?? 0;
  if (hearts > 0) {
    if (hearts === 1) box.delete(BAHAMUT_HEART); else box.set(BAHAMUT_HEART, hearts - 1);
    commands.push({ cmd: "sell_stored_item", args: [BAHAMUT_HEART, town.id] });
  }
  commands.push({ cmd: "reset_temple", args: [] });
  return { state: { done: [], since: 0 }, commands, placed };
}
