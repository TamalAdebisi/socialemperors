// The shop's Offers (CLIENT.md, "Offers"): the original's offer packs and
// mystery boxes, for cash earned in the game. Each card has the pack's own
// picture when the game has one (images_new/en/offer_pack_<id>.png),
// otherwise its prizes' pictures; what it gives; and Buy, or a super box's
// three choices. The rules are in rules/offers.ts.

import type { GameConfig, ItemInfo } from "../rules/config.ts";
import { SUPER_PRIZES, buyOffer, contents, offerName, offers, superPrices, type Bought, type Offer } from "../rules/offers.ts";
import type { Town } from "../rules/town.ts";
import { iconImage } from "./icons.ts";

export interface OfferParts {
  config: GameConfig;
  town: Town;
  items: Map<number, ItemInfo>;
  thumbnail: (item: ItemInfo) => string;
  /** Pictures in the game's images_new/. */
  picture: (name: string) => string;
  line: (id: number, fallback: string) => string;
  bought: (offer: Offer, result: Bought) => void;
  short: (why: string) => void;
}

const numbers = new Intl.NumberFormat("en");
/** The game's words for a mystery box's prizes, commonest first (POPUP_MISTERY_*). */
const RARITY = [["COMMON", "Common"], ["COMMON", "Common"], ["UNCOMMON", "Uncommon"], ["RARE", "Rare"]] as const;

export function offerCards(parts: OfferParts): HTMLLIElement[] {
  return offers(parts.config).map((offer) => card(parts, offer));
}

function card(parts: OfferParts, offer: Offer): HTMLLIElement {
  const li = document.createElement("li");
  const box = document.createElement("div");
  box.className = "shop-card offer-card";
  box.dataset.offer = String(offer.id);
  const picture = document.createElement("span");
  picture.className = "offer-picture";
  const image = new Image();
  image.alt = "";
  image.decoding = "async";
  image.addEventListener("error", () => image.replaceWith(prizes(parts, offer)), { once: true });
  image.src = parts.picture(`en/offer_pack_${offer.id}.png`);
  picture.append(image);
  const name = document.createElement("span");
  name.className = "shop-name";
  name.textContent = offerName(offer, parts.items);
  box.append(picture, name);
  if (offer.kind === "mystery") box.append(rarities(parts, offer));
  const gives = givesLine(offer);
  if (gives) box.append(gives);
  const actions = document.createElement("span");
  actions.className = "shop-actions";
  const prices = offer.kind === "super" ? superPrices(parts.config, offer) : [offer.cash];
  prices.forEach((cash, choice) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "button small gold";
    const label = offer.kind === "super" ? `${SUPER_PRIZES[choice]} prize${SUPER_PRIZES[choice] === 1 ? "" : "s"} · ${cash} ` : `Buy · ${cash} `;
    button.append(label, iconImage("cash"));
    button.setAttribute("aria-label", `${label.trim()} cash`);
    button.addEventListener("click", () => {
      const result = buyOffer(parts.town, offer, choice, parts.config);
      if (typeof result === "string") parts.short(result);
      else parts.bought(offer, result);
    });
    actions.append(button);
  });
  box.append(actions);
  li.append(box);
  return li;
}

/** The prizes' own pictures, for an offer the game has no picture of. */
function prizes(parts: OfferParts, offer: Offer): HTMLElement {
  const strip = document.createElement("span");
  strip.className = "offer-prizes";
  const unique = contents(offer).filter((id, i, all) => all.indexOf(id) === i).slice(0, 8);
  for (const id of unique) {
    const item = parts.items.get(id);
    if (!item) continue;
    const thumb = new Image();
    thumb.src = parts.thumbnail(item);
    thumb.alt = item.name;
    thumb.title = item.name;
    strip.append(thumb);
  }
  return strip;
}

/** A mystery box's four prizes, rare to common, as the original window lists them. */
function rarities(parts: OfferParts, offer: Offer): HTMLElement {
  const list = document.createElement("span");
  list.className = "offer-rarities";
  const prizes = offer.items as [number, number][];
  for (let i = prizes.length - 1; i >= 0; i--) {
    const item = parts.items.get(Number(prizes[i]![0]));
    const [key, fallback] = RARITY[i] ?? RARITY[0];
    const row = document.createElement("span");
    row.textContent = `${parts.line(rarityLine(key), fallback)}: ${item?.name ?? "?"}`;
    list.append(row);
  }
  return list;
}

/** The game's text ids for POPUP_MISTERY_RARE, _UNCOMMON and _COMMON. */
function rarityLine(key: "RARE" | "UNCOMMON" | "COMMON"): number {
  return { RARE: 903, UNCOMMON: 904, COMMON: 905 }[key];
}

function givesLine(offer: Offer): HTMLElement | null {
  const r = offer.resources;
  const parts = [["g", "gold"], ["w", "wood"], ["f", "food"], ["s", "stone"], ["m", "mana"]] as const;
  const text = parts.filter(([key]) => r[key] > 0).map(([key, word]) => `${numbers.format(r[key])} ${word}`);
  if (offer.kind !== "super" && r.x > 0) text.push(`${numbers.format(r.x)} XP`);
  if (!text.length) return null;
  const line = document.createElement("span");
  line.className = "shop-xp";
  line.textContent = `And ${text.join(", ")}`;
  return line;
}
