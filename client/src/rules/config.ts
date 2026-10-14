// The game config (get_game_config.php): every item the game knows. The
// server sends numbers as strings, as the Flash client expects; ItemInfo
// gives the fields the town needs as proper numbers.

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
  /** What it costs, and in what: g gold, w wood, f food, s stone, c cash. */
  cost?: string;
  cost_type?: string;
  /** How many ways it can face (its art's frames). */
  max_frame?: string;
}

export interface GameConfig {
  items: ConfigItem[];
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
  cost: number;
  costType: string;
  /** How many ways it can face: turning it goes round these. */
  facings: number;
}

export function itemInfo(item: ConfigItem): ItemInfo {
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
    cost: Number(item.cost) || 0,
    costType: item.cost_type ?? "g",
    facings: Math.max(Number(item.max_frame) || 1, 1),
  };
}

/** The config's items by id. */
export function itemsById(config: GameConfig): Map<number, ItemInfo> {
  const items = new Map<number, ItemInfo>();
  for (const item of config.items) {
    items.set(Number(item.id), itemInfo(item));
  }
  return items;
}
