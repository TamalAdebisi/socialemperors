// The Unit Warehouse's own box, separate from ordinary building occupants.
// Our source-reading notes are in docs/original/rules/warehouse.md.

import type { Command } from "../net/commands.ts";
import type { GameConfig, ItemInfo } from "./config.ts";
import { isTheirs } from "./editing.ts";
import type { PlacedItem, Town } from "./town.ts";
import { countOf, population } from "./training.ts";
import { freeTileNear } from "./work.ts";

export const UNIT_WAREHOUSE = 1284;
export const WAREHOUSE_PAGE = 18;

export interface WarehouseRules {
  start: number;
  maximum: number;
  price: number;
}

export function warehouseRules(config: GameConfig): WarehouseRules {
  const globals = config.globals as Record<string, unknown> | undefined;
  const capacities = globals?.WAREHOUSE_CAPACITIES;
  return {
    start: Array.isArray(capacities) ? Number(capacities[0]) || 50 : 50,
    maximum: Number(globals?.WAREHOUSE_MAX_CAPACITY) || 1000,
    price: Number(globals?.WAREHOUSE_CAPACITY_INCREASE_PRICE_SINGLE) || 2,
  };
}

export function warehouseUnits(town: Town): Map<number, number> {
  return town.warehouse ??= new Map();
}

export function warehouseCount(town: Town): number {
  return [...warehouseUnits(town).values()].reduce((sum, n) => sum + n, 0);
}

export function warehouseCapacity(town: Town, start = 50): number {
  return town.warehouseCapacity ?? start;
}

/** Every unit has its own portrait, rather than one card per kind. */
export function warehouseCards(town: Town, items: Map<number, ItemInfo>): ItemInfo[] {
  return [...warehouseUnits(town)].flatMap(([id, count]) => {
    const item = items.get(id);
    return item ? Array<ItemInfo>(count).fill(item) : [];
  });
}

export function buyWarehouseCapacity(town: Town, rules: WarehouseRules): Command | string {
  const capacity = warehouseCapacity(town, rules.start);
  if (capacity >= rules.maximum) return "The warehouse cannot grow any more.";
  if (town.cash < rules.price) return `Not enough cash: it takes ${rules.price}.`;
  town.cash -= rules.price;
  town.warehouseCapacity = capacity + 1;
  return { cmd: "buy_warehouse_capacity_single", args: [town.id] };
}

/** The kind's limit comes before population, including units in buildings.
 * Warehouse units and ordinary storage do not count towards either check. */
export function cantDeployWarehouse(town: Town, item: ItemInfo, items: Map<number, ItemInfo>): string | null {
  const owned = { ...town, items: town.items.filter((placed) => isTheirs(town, placed.item)) };
  if (item.unitsLimit > 0 && countOf(owned, item.id) >= item.unitsLimit) {
    return `That's as many ${item.name} as a town can have.`;
  }
  const people = population(town, items);
  if (people.current + item.population > people.max) {
    return "No room for more people: build houses.";
  }
  return null;
}

/** A warehouse's search stops after four rings, as its original call does. */
export function deployWarehouse(town: Town, item: ItemInfo, building: PlacedItem,
  items: Map<number, ItemInfo>): { unit: PlacedItem; command: Command } | string {
  if (building.item.id !== UNIT_WAREHOUSE || !town.items.includes(building)) return "The warehouse is no longer here.";
  const units = warehouseUnits(town);
  const count = units.get(item.id) ?? 0;
  if (count === 0) return `${item.name}: none left.`;
  const why = cantDeployWarehouse(town, item, items);
  if (why) return why;
  const tile = freeTileNear(town, building);
  if (!tile || Math.max(Math.abs(tile.x - building.tx), Math.abs(tile.y - building.ty)) > 4) {
    return "There's no room around the warehouse.";
  }
  if (count === 1) units.delete(item.id); else units.set(item.id, count - 1);
  const unit: PlacedItem = { item, tx: tile.x, ty: tile.y, orientation: 0, unitsInside: 0, units: [], startedAt: null, workTime: 0 };
  town.items.push(unit);
  return { unit, command: { cmd: "place_warehoused_item", args: [item.id, tile.x, tile.y, 0, town.id] } };
}

/** Putting away the warehouse moves its contents to town storage. Selling
 * or moving it leaves this separate box alone, as in the original. */
export function resetWarehouse(town: Town): Command {
  for (const [id, count] of warehouseUnits(town)) {
    town.store.set(id, (town.store.get(id) ?? 0) + count);
  }
  warehouseUnits(town).clear();
  return { cmd: "reset_warehouse", args: [town.id] };
}
