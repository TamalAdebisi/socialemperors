// The game config (get_game_config.php): every item the game knows. The
// server sends numbers as strings, as the Flash client expects; ItemInfo
// gives the fields the town needs as proper numbers.

import { productionOf, type Production } from "./production.ts";

/** One item as the config has it. Only the fields the client reads are listed. */
export interface ConfigItem {
  id: string;
  name: string;
  /** "b" building (anything placed: houses, trees, walls...), "u" unit. */
  type: string;
  /** The art: assets/buildingsprites/<img_name>.swf, our <img_name>.json sheet. */
  img_name: string;
  /** Footprint in tiles. */
  width: string;
  height: string;
  category_id: string;
  subcat_functional: string;
  /** Units: 1 when it flies. */
  flying?: string;
  /** Units: how fast they walk, in pixels a frame of the Flash client (30 a second). */
  velocity?: string;
  /** What it costs, and in what: g gold, w wood, f food, s stone, c cash. */
  cost?: string;
  cost_type?: string;
  /** How many ways it can face (its art's frames). */
  max_frame?: string;
  /** Producing: how long one round of work takes (seconds), what it gives
   * (collect_type: g, w, f, s or c) and the experience that comes with it. */
  activation?: string;
  collect?: string;
  collect_type?: string;
  collect_xp?: string;
  /** How many units fit inside (a mill's workers, a barracks' soldiers). */
  unit_capacity?: string;
  /** The shop: 1 or 3 sold to humans, 2 or 4 to trolls, 0 not sold. */
  in_store?: string;
  /** The shop's tab (the categories table's "sub" ids: 11 Houses...). */
  subcategory_id?: string;
  /** The level it can be bought from, and the level it shows in the shop from (0: always). */
  min_level?: string;
  store_level?: string;
  /** The experience buying it gives. */
  xp?: string;
  /** Its place in the shop: smaller first. */
  display_order?: string;
  /** "1" for the shop's New tab. */
  new_item?: string;
  /** Whose it is: "h" humans, "t" trolls, "a" anyone's, "n" nobody's (trees, rocks), "e" enemies'. */
  race?: string;
  /** Buildings: the unit they train (0 none). */
  trains?: string;
  /** Buildings: the room they give the town's people; units: the room they take. */
  population?: string;
  /** How many of it a town may have (0: no limit), and what it costs in cash instead. */
  units_limit?: string;
  cost_unit_cash?: string;
  /** How many potions bring the unit back from the graveyard. */
  potion?: string;
  /** Battles (rules/battle.ts): hit points, damage a hit, taken off each hit,
   * reach in tiles, frames between hits (30 a second). */
  life?: string;
  attack?: string;
  defense?: string;
  attack_range?: string;
  attack_interval?: string;
  /** Units: 2 for big ones, which take more room in a formation. */
  size?: string;
  /** 0: can be walked over (crops, flowers). */
  elevation?: string;
  /** Tags like "god", "colossus", "dragon". */
  groups?: string;
}

/** A tab of the shop and its smaller tabs: the config's categories table. */
export interface ConfigCategory {
  id?: number;
  name?: string;
  sub: { id: number; name: string; parent: number }[];
}

/** One row of the levels table: level n is row n - 1. */
export interface ConfigLevel {
  name: string;
  /** The experience it takes to reach this level. */
  exp_required: number | string;
  /** The prize for reaching it. */
  reward_type: string;
  reward_amount: number | string;
}

export interface GameConfig {
  items: ConfigItem[];
  levels?: ConfigLevel[];
  categories?: Record<string, ConfigCategory>;
  globals?: {
    /** Producing buildings that work for a time the player chooses. */
    COLLECT_VARIABLE_IDS?: (number | string)[];
    [name: string]: unknown;
  };
  [section: string]: unknown;
}

export interface ItemInfo {
  id: number;
  name: string;
  isUnit: boolean;
  art: string;
  width: number;
  height: number;
  category: number;
  subcategory: number;
  flying: boolean;
  /** Units: pixels a frame of the Flash client (rules/walking.ts); 0 for things that don't walk. */
  velocity: number;
  /** How many units fit inside. */
  capacity: number;
  /** One round of work (seconds), what it gives and in what (g, w, f, s, c), and the experience: the config's raw numbers. */
  activation: number;
  collect: number;
  collectType: string;
  collectXp: number;
  /** Buildings: the unit they train, or 0. */
  trains: number;
  /** Buildings: room for the town's people; units: the room they take. */
  population: number;
  /** How many a town may have (0: no limit). */
  unitsLimit: number;
  /** Units: their price in cash, instead of their cost. */
  cashCost: number;
  cost: number;
  costType: string;
  /** Units: how many potions bring it back from the graveyard. */
  potion?: number;
  /** A social building (the config's social_items: staffed by friends or helpers, like the harbour). */
  social?: boolean;
  /** How many ways it can face: turning it goes round these. */
  facings: number;
  /** What it produces and how, or null when it doesn't (rules/production.ts). */
  production: Production | null;
  /** The shop (rules/shop.ts): who it's sold to (in_store), its tab, from which levels, in what order. */
  inStore: number;
  shopTab: number;
  minLevel: number;
  storeLevel: number;
  displayOrder: number;
  isNew: boolean;
  /** The experience buying it gives. */
  xp: number;
  /** Whose it is: "h", "t", "a" anyone's, "n" nobody's (trees, rocks), "e" enemies'. */
  race: string;
  /** Battles: the config's life, attack, defense, attack_range (tiles) and
   * attack_interval (frames of the Flash client, 30 a second). */
  life: number;
  attack: number;
  defense: number;
  attackRange: number;
  attackInterval: number;
  /** Units: 1, or 2 for big ones. */
  size: number;
  /** 0: something units walk over (crops, flowers); buildings are 1. */
  elevation: number;
  groups: string;
}

export function itemInfo(item: ConfigItem, chosenTime: Set<number> = new Set()): ItemInfo {
  return {
    id: Number(item.id),
    name: item.name,
    isUnit: item.type === "u",
    art: item.img_name,
    width: Number(item.width) || 1,
    height: Number(item.height) || 1,
    category: Number(item.category_id),
    subcategory: Number(item.subcat_functional),
    flying: item.flying === "1",
    velocity: Number(item.velocity) || 0,
    capacity: Number(item.unit_capacity) || 0,
    activation: Number(item.activation) || 0,
    collect: Number(item.collect) || 0,
    collectType: item.collect_type ?? "",
    collectXp: Number(item.collect_xp) || 0,
    trains: Number(item.trains) || 0,
    population: Number(item.population) || 0,
    unitsLimit: Number(item.units_limit) || 0,
    cashCost: Number(item.cost_unit_cash) || 0,
    cost: Number(item.cost) || 0,
    costType: item.cost_type ?? "g",
    potion: Number(item.potion) || 0,
    facings: Math.max(Number(item.max_frame) || 1, 1),
    production: productionOf(item, chosenTime),
    inStore: Number(item.in_store) || 0,
    shopTab: Number(item.subcategory_id) || 0,
    minLevel: Number(item.min_level) || 0,
    storeLevel: Number(item.store_level) || 0,
    displayOrder: Number(item.display_order) || 0,
    isNew: item.new_item === "1",
    xp: Number(item.xp) || 0,
    race: item.race ?? "",
    life: Number(item.life) || 0,
    attack: Number(item.attack) || 0,
    defense: Number(item.defense) || 0,
    attackRange: Number(item.attack_range) || 0,
    attackInterval: Number(item.attack_interval) || 0,
    size: Number(item.size) || 1,
    elevation: item.elevation === undefined ? 1 : Number(item.elevation),
    groups: item.groups ?? "",
  };
}

/** The config's items by id. */
export function itemsById(config: GameConfig): Map<number, ItemInfo> {
  const chosenTime = new Set((config.globals?.COLLECT_VARIABLE_IDS ?? []).map(Number));
  const social = new Set(((config.social_items ?? []) as { id: number | string }[]).map((s) => Number(s.id)));
  const items = new Map<number, ItemInfo>();
  for (const item of config.items) {
    const info = itemInfo(item, chosenTime);
    if (social.has(info.id)) {
      info.social = true;
    }
    items.set(info.id, info);
  }
  return items;
}
