// The time and weather machines. Pack sizes and prices come from the game
// config; ownership belongs to the player, while terrain belongs to a town.
import type { GameConfig } from "./config.ts";

export const TIME_MACHINE = 1463;
export const WEATHER_MACHINE = 373;
export const TIME_MACHINE_HELP = "timeMachineHelp";
export const WEATHER_PICTURES = ["CESPED.jpg", "DESIERTO.jpg", "NIEVE.jpg", "MINERAL.jpg", "SELVA.jpg", "nubes.jpg"] as const;
export const WEATHER_SKINS = [0, 1, 2, 4, 5, 6] as const;
export interface TimePack { hours: number; price: number }
export interface MachineRules { packs: TimePack[]; skinPrice: number }

export function machineRules(config: GameConfig): MachineRules {
  const source = config.globals?.TIME_MACHINE;
  return {
    packs: Array.isArray(source) ? source.map((pack: { hours: unknown; price: unknown }) => ({ hours: Number(pack.hours), price: Number(pack.price) })) : [],
    skinPrice: Number(config.globals?.COST_UNLOCK_SKIN) || 0,
  };
}

/** Saved counts may be absent on an empire that never bought a packet. */
export function timePackets(saved: unknown, length: number): number[] {
  return Array.from({ length }, (_, index) => Array.isArray(saved) ? Math.max(0, Math.trunc(Number(saved[index]) || 0)) : 0);
}

/** The original compares the saved unlock with the text "true". Grass is free. */
export function skinUnlocked(saved: unknown, skin: number): boolean {
  return skin === 0 || (saved !== null && typeof saved === "object" && (saved as Record<string, unknown>)[String(skin)] === "true");
}

/** The original spells these units out itself, without translation keys. */
export function packDuration(pack: TimePack): string {
  if (pack.hours < 1) return `${Math.trunc(pack.hours * 60)} mins`;
  if (pack.hours >= 24) return `${Math.trunc(pack.hours / 24)} ${pack.hours < 48 ? "day" : "days"}`;
  return `${pack.hours} ${pack.hours === 1 ? "hour" : "hours"}`;
}
