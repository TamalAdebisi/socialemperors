// The later original Soul Mixer, researched locally in version 1.4.07.
// The archived 2012 config lacks its content tables. Never manufacture
// ranks, waiting times or cash prices: those must come from original data.
import type { Command } from "../net/commands.ts";
import type { GameConfig, ItemInfo } from "./config.ts";
import { isTheirs } from "./editing.ts";
import { freeTileNear, letAllOut } from "./work.ts";
import { countOf, population } from "./training.ts";
import { freeSpotNear, type Given } from "./dock.ts";
import type { PlacedItem, Town } from "./town.ts";

export const SOUL_MIXER = 1529;
export const LEGACY_SOULS = new Set([2048, 2037, 777, 758]);
export interface Powerup { cash: number; increment: number }
export interface MixerRules { units: ItemInfo[]; powerups: Powerup[]; missing: string[]; minLevel: number | null }
export interface MixQueue { ts: number; unit: number; amount: number }
export interface MixerState { queues: Map<string, MixQueue>; reserved: Set<string> }
export interface MixPreview { unit: ItemInfo; excluded: Set<number>; upgrades: number; parents: number[] }

export function mixerRules(config: GameConfig, items: Map<number, ItemInfo>): MixerRules {
  const ranked = [...items.values()].filter((item) => item.isUnit && (item.breedingOrder ?? 0) > 0);
  const units = ranked.filter((item) => Number.isSafeInteger(item.breedingOrder))
    .sort((a, b) => a.breedingOrder! - b.breedingOrder!);
  const raw = config.globals?.SOUL_MIXER_POWERUPS_LEVELS;
  const powerups: Powerup[] = Array.isArray(raw) ? raw.flatMap((row: unknown) => {
    if (!row || typeof row !== "object") return [];
    const entry = row as Record<string, unknown>;
    if ([entry.cash_cost, entry.order_increment].some((value) => value === null || value === undefined || value === "")) return [];
    const cash = Number(entry.cash_cost), increment = Number(entry.order_increment);
    return Number.isSafeInteger(cash) && cash >= 0 && Number.isSafeInteger(increment) && increment >= 0 ? [{ cash, increment }] : [];
  }) : [];
  const missing = [];
  const minimum = Number(config.globals?.SOUL_MIXER_MIN_LEVEL);
  const minLevel = Number.isSafeInteger(minimum) && minimum > 0 ? minimum : null;
  if (minLevel === null) missing.push("SOUL_MIXER_MIN_LEVEL");
  if (units.length < 3 || units.length !== ranked.length) missing.push("breeding_order");
  if (!units.length || units.some((item) => !Number.isSafeInteger(item.soulMixingTime) || item.soulMixingTime! <= 0)) missing.push("sm_training_time");
  if (!powerups.length || powerups.length !== (Array.isArray(raw) ? raw.length : 0)) missing.push("SOUL_MIXER_POWERUPS_LEVELS");
  return { units, powerups, missing, minLevel };
}

/** The later original checks on opening and level-up. Missing content never grants a nonworking building. */
export function givenMixer(town: Town, rules: MixerRules, items: Map<number, ItemInfo>): Given | null {
  if (rules.missing.length || rules.minLevel === null || town.level < rules.minLevel || town.items.some((one) => one.item.id === SOUL_MIXER)
    || (town.gifts.get(SOUL_MIXER) ?? 0) > 0 || (town.store.get(SOUL_MIXER) ?? 0) > 0) return null;
  const item = items.get(SOUL_MIXER);
  const spot = item && freeSpotNear(town, item, { x: 59, y: 59 });
  if (!item || !spot) return null;
  const placed: PlacedItem = { item, tx: spot.x, ty: spot.y, orientation: 0, unitsInside: 0, units: [], startedAt: null, workTime: 0 };
  town.items.push(placed);
  return { placed, commands: [{ cmd: "buy", args: [SOUL_MIXER, spot.x, spot.y, 0, town.id, 1, 1, "b"] }] };
}

/** Only known, well-formed original queues are restored; never silently mark malformed work ready. */
export function readMixer(saved: unknown): MixerState {
  const queues = new Map<string, MixQueue>();
  const reserved = new Set<string>();
  if (saved && typeof saved === "object" && !Array.isArray(saved)) {
    for (const [key, value] of Object.entries(saved)) {
      const validKey = /^[1-9]\d*$/.test(key) && Number.isSafeInteger(Number(key));
      // Claimed queues and queues in another town still own their original
      // identifier; malformed payloads must not make that identifier reusable.
      if (validKey) reserved.add(key);
      if (!value || typeof value !== "object") continue;
      const row = value as Record<string, unknown>;
      const ts = Number(row.ts), unit = Number(row.unit), amount = Number(row.amount);
      if (validKey && [row.ts, row.unit, row.amount].every(wireInteger)
        && [ts, unit, amount].every(Number.isSafeInteger) && ts >= 0 && unit > 0 && amount === 1) {
        queues.set(key, { ts, unit, amount });
      }
    }
  }
  return { queues, reserved };
}

function wireInteger(value: unknown): boolean {
  return (typeof value === "number" || (typeof value === "string" && value.trim() !== ""))
    && Number.isSafeInteger(Number(value)) && Number(value) >= 0;
}

export function mixingChoices(town: Town, rules: MixerRules): PlacedItem[] {
  const eligible = new Set(rules.units.map((unit) => unit.id));
  const omitted = new Set([71, 73, 74, 75, 76, 88, 90]);
  return town.items.filter((unit) => unit.item.isUnit && eligible.has(unit.item.id) && !omitted.has(unit.item.subcategory) && !unit.wild && isTheirs(town, unit.item))
    .sort((a, b) => a.item.displayOrder - b.item.displayOrder || a.item.id - b.item.id);
}

function indexAt(rules: MixerRules, power: number, excluded: Set<number>): number {
  const index = rules.units.findIndex((unit) => unit.breedingOrder! >= power && !excluded.has(unit.id));
  return index < 0 ? rules.units.length - 1 : index;
}

/** The original weighted rank and random range; the parents remain inside. */
export function previewMix(rules: MixerRules, parents: number[], random = Math.random): MixPreview | null {
  if (rules.missing.length || parents.length !== 2) return null;
  const inputs = parents.map((id) => rules.units.find((item) => item.id === id));
  if (inputs.some((item) => !item)) return null;
  const powers = inputs.map((item) => item!.breedingOrder!);
  let power = Math.max(10, Math.ceil(Math.min(...powers) * 0.3 + Math.max(...powers) * 0.7)) + Math.floor(random() * 12);
  if (power === Math.max(...powers)) power++;
  if (power > 400) power = Math.floor(400 + random() * (rules.units.at(-1)!.breedingOrder! - 400));
  const excluded = new Set(parents);
  const unit = rules.units[indexAt(rules, power, excluded)];
  return unit ? { unit, excluded, upgrades: 0, parents: [...parents] } : null;
}

export function nextPowerup(rules: MixerRules, preview: MixPreview): Powerup | null {
  return rules.powerups[Math.min(preview.upgrades, rules.powerups.length - 1)] ?? null;
}

/** Original charges the current price, then uses the next level's increment. */
export function powerupMix(town: Town, rules: MixerRules, preview: MixPreview, random = Math.random): string | null {
  const price = nextPowerup(rules, preview);
  if (!price || rules.missing.length) return "The original Soul Mixer rules are unavailable.";
  if (town.cash < price.cash) return "Not enough cash.";
  const excluded = new Set(preview.excluded).add(preview.unit.id);
  let index: number;
  if (preview.unit.breedingOrder! >= 400) {
    index = indexAt(rules, Math.floor(400 + random() * (rules.units.at(-1)!.breedingOrder! - 400)), excluded);
  } else {
    index = indexAt(rules, preview.unit.breedingOrder!, excluded)
      + rules.powerups[Math.min(preview.upgrades + 1, rules.powerups.length - 1)]!.increment;
    while (rules.units[index] && excluded.has(rules.units[index]!.id)) index++;
  }
  const unit = rules.units[index];
  if (!unit || excluded.has(unit.id)) return "No further unit is available for this mix.";
  town.cash -= price.cash;
  preview.unit = unit;
  preview.upgrades++;
  preview.excluded = excluded.add(unit.id);
  return null;
}

export function legacyMixWarning(town: Town, building: PlacedItem): string | null {
  return town.level < 20 && building.units?.some((id) => LEGACY_SOULS.has(id)) ? "Reach level 20 before mixing these dragons." : null;
}

export function startMix(town: Town, building: PlacedItem, rules: MixerRules, state: MixerState, preview: MixPreview, now: number): Command[] | string {
  if (rules.missing.length) return "The original Soul Mixer rules are unavailable.";
  if (building.item.id !== SOUL_MIXER || !town.items.includes(building) || building.units?.length !== 2) return "Select two units first.";
  if (building.units.slice().sort().join(",") !== preview.parents.slice().sort().join(",")) return "Your selected souls changed. Check the new preview.";
  if (!rules.units.some((item) => item.id === preview.unit.id)) return "That result is not available for mixing.";
  if (building.queueId && state.queues.has(building.queueId)) return "Mixing is already in progress.";
  const warning = legacyMixWarning(town, building);
  if (warning) return warning;
  if (preview.unit.unitsLimit > 0 && countOf(town, preview.unit.id) >= preview.unit.unitsLimit) return "You already have the maximum number of this unit.";
  const commands: Command[] = Array.from({ length: preview.upgrades }, (_, level) => ({ cmd: "buy_powerups", args: [Math.min(level, rules.powerups.length - 1)] }));
  if (!building.queueId) building.queueId = String(Math.max(0, ...[...state.reserved].map(Number), ...town.items.map((item) => Number(item.queueId) || 0)) + 1);
  state.reserved.add(building.queueId);
  state.queues.set(building.queueId, { unit: preview.unit.id, ts: Math.floor(now), amount: 1 });
  commands.push({ cmd: "push_queue_unit", args: [building.tx, building.ty, SOUL_MIXER, preview.unit.id, Number(building.queueId), 0] });
  return commands;
}

export function mixRemaining(queue: MixQueue, item: ItemInfo, now: number): number | null {
  if (queue.ts === 0) return 0;
  return item.soulMixingTime && item.soulMixingTime > 0 ? Math.max(0, Math.ceil(queue.ts + item.soulMixingTime - now)) : null;
}

export function speedMix(town: Town, building: PlacedItem, state: MixerState, item: ItemInfo, now: number, rules: MixerRules): Command | string {
  if (building.item.id !== SOUL_MIXER || !town.items.includes(building)) return "The Soul Mixer is no longer in your town.";
  if (rules.missing.length) return "The original Soul Mixer rules are unavailable.";
  const queue = state.queues.get(building.queueId ?? "");
  if (!queue) return "No mix is in progress.";
  const remaining = mixRemaining(queue, item, now);
  if (remaining === null) return "The original Soul Mixer rules are unavailable.";
  if (remaining === 0) return "Your unit is ready.";
  const cost = Math.ceil(remaining / 3600);
  if (town.cash < cost) return "Not enough cash.";
  town.cash -= cost;
  queue.ts = 0;
  return { cmd: "speed_up_queue", args: [building.queueId] };
}

/** A completed mix waits for Get unit. Both parents return, without casualties or XP. */
export function claimMix(town: Town, building: PlacedItem, state: MixerState, items: Map<number, ItemInfo>, now: number): { units: PlacedItem[]; commands: Command[] } | string {
  if (building.item.id !== SOUL_MIXER || !town.items.includes(building)) return "The Soul Mixer is no longer in your town.";
  const queue = state.queues.get(building.queueId ?? "");
  const item = queue ? items.get(queue.unit) : undefined;
  if (!queue || !item || mixRemaining(queue, item, now) !== 0) return "Your unit is not ready yet.";
  const people = population(town, items);
  if (people.current + item.population > people.max) return "No room for more people: build houses.";
  const tile = freeTileNear(town, building);
  if (!tile) return "There is no free space beside the Soul Mixer.";
  const unit: PlacedItem = { item, tx: tile.x, ty: tile.y, orientation: 0, unitsInside: 0, units: [], startedAt: null, workTime: 0 };
  town.items.push(unit);
  state.queues.delete(building.queueId!);
  const returned = letAllOut(town, building, items);
  return { units: [unit, ...returned.map((one) => one.unit)], commands: [
    { cmd: "pop_queue_unit", args: [building.queueId, tile.x, tile.y, SOUL_MIXER] }, ...returned.flatMap((one) => one.commands),
  ] };
}
