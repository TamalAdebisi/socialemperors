// Offer packs and mystery boxes (CLIENT.md, "Offers"), bought with cash the
// player earned: the original sold them for real money. Three kinds, as the
// config's offer_packs have them: a pack of fixed items, a mystery box
// (one prize of four, rare to common) and a super mystery box (one, two or
// four prizes from three rows, the first the rarest). The rolls are the
// original's (PromotionPacks), made here and told to the server, as the
// Flash client does; its prices are economy.py's. No drawing here.

import type { Command } from "../net/commands.ts";
import type { GameConfig, ItemInfo } from "./config.ts";
import type { Town } from "./town.ts";

export type OfferKind = "pack" | "mystery" | "super";

export interface Offer {
  id: number;
  kind: OfferKind;
  /** The original showed these (enabled); the rest come after. */
  enabled: boolean;
  position: number;
  /** A pack's and a mystery box's price; a super box has three (superPrices). */
  cash: number;
  resources: { g: number; w: number; f: number; s: number; m: number; x: number };
  /** pack: its items; mystery: [prize, roll below which it is won], commonest first; super: three rows of prizes, the rarest first. */
  items: number[] | [number, number][] | number[][];
}

interface ConfigPack {
  id: number; position: number | string; cost_cash: number | string; enabled: number | string; pack_type: number | string;
  gold?: number; stone?: number; food?: number; wood?: number; mana?: number; xp?: number;
  items: unknown;
}

const KINDS: OfferKind[] = ["pack", "mystery", "super"];

export function offers(config: GameConfig): Offer[] {
  const packs = ((config as unknown as { offer_packs?: ConfigPack[] }).offer_packs ?? [])
    .filter((pack) => Array.isArray(pack.items) && pack.items.length > 0 && KINDS[Number(pack.pack_type)]);
  return packs.map((pack) => ({
    id: Number(pack.id), kind: KINDS[Number(pack.pack_type)]!, enabled: Number(pack.enabled) === 1, position: Number(pack.position) || 0,
    cash: Number(pack.cost_cash) || 0,
    resources: { g: Number(pack.gold) || 0, w: Number(pack.wood) || 0, f: Number(pack.food) || 0, s: Number(pack.stone) || 0,
      m: Number(pack.mana) || 0, x: Number(pack.xp) || 0 },
    items: pack.items as Offer["items"],
  })).sort((a, b) => Number(b.enabled) - Number(a.enabled) || KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind) || a.position - b.position || a.id - b.id);
}

/** A super box's three prices: one, two or four prizes (globals.SUPER_PACK_PRICES, from economy.py). */
export function superPrices(config: GameConfig, offer: Offer): number[] {
  const table = (config.globals?.SUPER_PACK_PRICES ?? {}) as Record<string, number[]>;
  return (table[String(offer.id)] ?? table.default ?? [60, 100, 200]).map(Number);
}

/** How many prizes each of a super box's choices gives. */
export const SUPER_PRIZES = [1, 2, 4];

/** Every item an offer can give, for its pictures. */
export function contents(offer: Offer): number[] {
  if (offer.kind === "pack") return (offer.items as number[]).map(Number);
  if (offer.kind === "mystery") return (offer.items as [number, number][]).map(([id]) => Number(id));
  return (offer.items as number[][]).flat().map(Number);
}

/** The mystery box's draw: a roll of 0 to 100 against each prize's mark (35, 70, 90, 100: the last the rare one). */
export function rollMystery(offer: Offer, random = Math.random): number {
  const prizes = offer.items as [number, number][];
  const roll = random() * 100;
  const index = prizes.findIndex(([, mark]) => roll < Number(mark));
  return Number(prizes[index < 0 ? prizes.length - 1 : index]![0]);
}

/** The super box's draws for its choice (0, 1 or 2), as the original's buySuperPack. */
export function rollSuper(offer: Offer, choice: number, random = Math.random): number[] {
  const [rare, middle, common] = offer.items as number[][];
  const pick = (rows: number[][]) => {
    const all = rows.flat();
    return Number(all[Math.floor(random() * all.length)]);
  };
  if (choice === 0) return [pick([middle!, common!])];
  if (choice === 1) return [pick([rare!, middle!, common!]), pick([middle!, common!])];
  return [pick([rare!]), pick([middle!, common!]), pick([middle!, common!]), pick([middle!, common!])];
}

export interface Bought { cash: number; items: number[]; commands: Command[] }

/** Buys an offer: the cash, the resources and the items into this town's storage. */
export function buyOffer(town: Town, offer: Offer, choice: number, config: GameConfig, random = Math.random): Bought | string {
  const cash = offer.kind === "super" ? superPrices(config, offer)[choice] ?? 0 : offer.cash;
  if (town.cash < cash) return `Not enough cash: it takes ${cash}.`;
  let items: number[];
  let command: Command;
  if (offer.kind === "pack") {
    items = contents(offer);
    command = { cmd: "buy_offer_pack", args: [town.id, offer.id] };
  } else if (offer.kind === "mystery") {
    items = [rollMystery(offer, random)];
    command = { cmd: "buy_offer_pack", args: [town.id, offer.id, items[0]!] };
  } else {
    items = rollSuper(offer, choice, random);
    command = { cmd: "buy_super_offer_pack", args: [town.id, offer.id, items.join(","), cash] };
  }
  town.cash -= cash;
  const r = offer.resources;
  town.gold += r.g;
  town.wood += r.w;
  town.food += r.f;
  town.stone += r.s;
  if (offer.kind !== "super") town.xp += r.x;  // the original shows a super box's xp but doesn't give it
  for (const id of items) town.store.set(id, (town.store.get(id) ?? 0) + 1);
  return { cash, items, commands: [command] };
}

/** An offer's name: the original windows say "Pack" or "Mystery box"; ours adds its best prizes. */
export function offerName(offer: Offer, items: Map<number, ItemInfo>): string {
  const names = (ids: number[]) => ids.map((id) => items.get(id)?.name).filter(Boolean).slice(0, 3).join(", ");
  if (offer.kind === "super") return `Super mystery box: ${names((offer.items as number[][])[0]!)}`;
  if (offer.kind === "mystery") return `Mystery box: ${names([...contents(offer)].reverse())}`;  // the rare one first
  return `Pack: ${names(contents(offer).filter((id, i, all) => all.indexOf(id) === i))}`;
}
