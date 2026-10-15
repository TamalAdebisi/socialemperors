// The troll camps of the home town (CLIENT.md, "Troll camps"), as the
// Flash client builds them: 4 hours after the last camp's chest was
// opened, a camp is put up on the border of the map (the ring of land the
// player never owns), walled, with its soldiers and towers, and a chest or
// a prison that opens once no enemy unit is left anywhere on the map.
// Opening it pays by level (and frees the prisoners); the next camp comes
// 4 hours later. Ten of the thirty camps are laid out by the original's own
// code, and those are built here (rules/camps.json); the others are
// scripted stories, played in the classic game for now.
//
// Everything placed is saved with a free `buy`, as the Flash client saves
// it, so both clients see the same camp.

import type { ItemInfo } from "./config.ts";
import type { Point } from "./geometry.ts";
import campData from "./camps.json" with { type: "json" };
import { enemyIds } from "./raids.ts";

/** A camp comes this long (seconds) after the last chest was opened. */
export const CAMP_PERIOD = 4 * 3600;
/** The camps there are: the next after the last is the first. */
const CAMPS = 30;
const MAP = 100;
/** Tiles of the border ring: the outer big tiles, never the player's. */
const INNER_FROM = 20;
const INNER_TO = 80;

interface CampEntry {
  kind: "square" | "layout";
  races: string[];
  chest: { id?: number; byRace?: Record<string, number> };
  freed: Record<string, { id?: number; villager?: boolean; count?: number; at: [number, number] }[]>;
  popup: { startTitle: number; startText: number; endTitle: number; endText: number };
  popupImage: Record<string, string>;
  infoTip: number | Record<string, number | null> | null;
  square?: { size: number; wallId: number; walls: string[]; bottomRow?: { only: number }; gap?: string };
  buildings?: { id: number; count: number | string }[];
  towers?: { id: number; count: number | string; at?: [number, number][] }[];
  items?: { dx: number; dy: number; role: string; template: number; w: number; h: number }[];
}

const DATA = campData as unknown as {
  levelTables: {
    enemyWall: Record<string, [number, number][]>;
    enemyTower: Record<string, [number, number][]>;
    enemyHouse: Record<string, number[]>;
  };
  camps: Record<string, CampEntry>;
};

/** The camps built in this client. */
export const BUILT_HERE = new Set(Object.keys(DATA.camps).map(Number));

/** Whether a camp is due: 4 hours since the last chest. */
export function campDue(lastTreasure: number, now: number): boolean {
  return now - (Number(lastTreasure) || 0) >= CAMP_PERIOD;
}

/** A camp the player's race doesn't get moves on to one it does, as the original moves it. */
export function correctCamp(id: number, race: string): number {
  if (race === "t") {
    if (id === 0 || id >= 15) return 1;
    if (id === 3 || id === 4) return 5;
    if (id >= 6 && id <= 9) return 10;
    if (id === 11) return 12;
    return id;
  }
  if (id === 9) return 10;
  if (id === 11) return 12;
  return id;
}

export function nextCamp(id: number): number {
  return (id + 1) % CAMPS;
}

/**
 * What a chest pays, by level. The original gave nothing at exactly level 26
 * (its table left that level out); here it pays as from 27
 * (DECISIONS.md, "Troll camps").
 */
export function campReward(level: number): { gold: number; xp: number } {
  if (level <= 5) return { gold: 250, xp: 50 };
  if (level <= 10) return { gold: 350, xp: 60 };
  if (level <= 15) return { gold: 450, xp: 70 };
  if (level <= 20) return { gold: 550, xp: 80 };
  if (level <= 25) return { gold: 650, xp: 90 };
  return { gold: 750, xp: 100 };
}

/** On the border ring. */
export function onBorder(x: number, y: number): boolean {
  return x < INNER_FROM || x >= INNER_TO || y < INNER_FROM || y >= INNER_TO;
}

const CHEST = 811;
/** Buildings on the border that are nobody's (the rest there are enemies): farms, chests, scenery, keys, nature, lost items. */
const NOBODYS_ON_BORDER = new Set([122, 811, 1011, 812, 125, 126, 127, 128, 911]);

/**
 * Whose a thing in the home town is, as the original decides when it
 * loads: by race (the other race's are enemies), and on the border any
 * building is an enemy but chests, fields, nature and scenery.
 */
export function sideAtHome(race: string, item: ItemInfo, x: number, y: number): "self" | "enemy" | "nobody" {
  if (!item.isUnit && onBorder(x, y)) {
    return NOBODYS_ON_BORDER.has(item.subcategory) ? "nobody" : "enemy";
  }
  if (item.race === "n") return "nobody";
  if (item.race === "e") return "enemy";
  if (item.race === "a" || item.race === race) return "self";
  return item.race === "h" || item.race === "t" ? "enemy" : "nobody";
}

export function isChest(item: ItemInfo): boolean {
  return item.subcategory === CHEST;
}

/** Which camp a chest or prison finishes. */
export function campOfChest(chestId: number): number | null {
  for (const [id, camp] of Object.entries(DATA.camps)) {
    if (camp.chest.id === chestId || Object.values(camp.chest.byRace ?? {}).includes(chestId)) {
      return Number(id);
    }
  }
  return null;
}

/** The localisation ids of a camp's windows, its picture, and its chest's line. */
export function campTexts(id: number, race: string): { start: [number, number]; end: [number, number]; picture: string; tip: number | null } | null {
  const camp = DATA.camps[String(id)];
  if (!camp) {
    return null;
  }
  const tip = typeof camp.infoTip === "number" || camp.infoTip === null ? camp.infoTip : camp.infoTip[race] ?? null;
  return {
    start: [camp.popup.startTitle, camp.popup.startText],
    end: [camp.popup.endTitle, camp.popup.endText],
    picture: camp.popupImage[race] ?? camp.popupImage.h,
    tip,
  };
}

/** A thing a camp puts on the map. */
export interface CampPiece {
  id: number;
  x: number;
  y: number;
  unit: boolean;
}

/** The tiles taken on the map, so pieces go on free ones; `take` marks a piece's footprint. */
export interface Ground {
  free: (x: number, y: number) => boolean;
  take: (x: number, y: number, w: number, h: number) => void;
}

function inMap(x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < MAP && y < MAP;
}

/** The tile itself if free, else a random free tile on the first ring around it (up to 5) that has one. */
function nearestFree(ground: Ground, x: number, y: number, random: () => number): Point | null {
  if (inMap(x, y) && ground.free(x, y)) {
    return { x, y };
  }
  for (let ring = 1; ring <= 5; ring++) {
    const options: Point[] = [];
    for (let dy = -ring; dy <= ring; dy++) {
      for (let dx = -ring; dx <= ring; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) === ring && inMap(x + dx, y + dy) && ground.free(x + dx, y + dy)) {
          options.push({ x: x + dx, y: y + dy });
        }
      }
    }
    if (options.length) {
      return options[Math.floor(random() * options.length)];
    }
  }
  return null;
}

function byLevel(table: [number, number][], level: number): number {
  let id = table[0][1];
  for (const [from, which] of table) {
    if (level >= from) {
      id = which;
    }
  }
  return id;
}

/**
 * A camp, laid out: every piece with its id and tile, the chest among them.
 * `size` gives an item's footprint (for marking the ground).
 */
export function planCamp(id: number, level: number, race: string, random: () => number, ground: Ground,
  size: (id: number) => [number, number]): { pieces: CampPiece[]; chest: CampPiece } | null {
  const camp = DATA.camps[String(id)];
  if (!camp) {
    return null;
  }
  const pieces: CampPiece[] = [];
  let chest: CampPiece | null = null;
  const place = (pieceId: number, at: Point | null, unit = false): CampPiece | null => {
    if (!at) {
      return null;
    }
    const [w, h] = unit ? [1, 1] : size(pieceId);
    ground.take(at.x, at.y, w, h);
    const piece = { id: pieceId, x: at.x, y: at.y, unit };
    pieces.push(piece);
    return piece;
  };
  const soldiers = enemyIds(level, race);
  const chestId = camp.chest.id ?? camp.chest.byRace?.[race] ?? 82;
  if (camp.kind === "square") {
    // A 15 x 15 square near an edge, walled, things inside at random.
    const edge = Math.floor(random() * 4);
    const r = Math.floor(random() * MAP);
    let [cx, cy] = edge === 0 ? [10, r] : edge === 1 ? [90, r] : edge === 2 ? [r, 10] : [r, 90];
    if (cx - 7 < 1) cx += 8;
    if (cy - 7 < 1) cy += 8;
    if (cx + 7 > 98) cx -= 8;
    if (cy + 7 > 98) cy -= 8;
    const [x0, y0, x1, y1] = [cx - 7, cy - 7, cx + 7, cy + 7];
    const square = camp.square!;
    const walls = new Set(square.walls);
    for (let x = x0; x <= x1; x++) {
      if (walls.has("top")) place(square.wallId, { x, y: y0 });
      if (walls.has("bottom")) place(square.wallId, { x, y: y1 });
    }
    if (square.bottomRow) {
      place(square.bottomRow.only, { x: Math.floor((x0 + x1) / 2), y: y1 });
    }
    for (let y = y0 + 1; y <= y1 - 1; y++) {
      if (walls.has("left")) place(square.wallId, { x: x0, y });
      // The treasure village leaves a 3-tile way in on its right.
      if (walls.has("right") && !(square.gap && y >= y0 + 4 && y <= y0 + 6)) place(square.wallId, { x: x1, y });
    }
    const inner = () => nearestFree(ground, x0 + 1 + Math.floor(random() * 10), y0 + 1 + Math.floor(random() * 10), random);
    chest = place(chestId, inner());
    for (const building of camp.buildings ?? []) {
      for (let i = 0; i < count(building.count, level); i++) {
        place(building.id, inner());
      }
    }
    for (const tower of camp.towers ?? []) {
      if (tower.at) {
        for (const [dx, dy] of tower.at) {
          place(tower.id, nearestFree(ground, x0 + dx, y0 + dy, random));
        }
      } else {
        for (let i = 0; i < count(tower.count, level); i++) {
          place(tower.id, inner());
        }
      }
    }
    const units = id === 0 ? (level === 1 ? 3 : Math.max(Math.ceil(level / 4) + 1, 8)) : Math.max(Math.ceil(level / 4) + 4, 4);
    for (let i = 0; i < units; i++) {
      const at = nearestFree(ground, x0 + Math.floor(random() * 12), y0 + Math.floor(random() * 12), random);
      place(soldiers[Math.floor(random() * soldiers.length)], at, true);
    }
  } else {
    // A 20 x 20 layout, drawn in the original, along an edge.
    const r = Math.floor(random() * (MAP - 20));
    const edge = Math.floor(random() * 4);
    const [ox, oy] = edge === 0 ? [0, r] : edge === 1 ? [MAP - 20, r] : edge === 2 ? [r, 0] : [r, MAP - 20];
    const tables = DATA.levelTables;
    for (const item of camp.items ?? []) {
      const at = { x: ox + item.dx, y: oy + item.dy };
      switch (item.role) {
        case "wall":
          place(byLevel(tables.enemyWall[race] ?? tables.enemyWall.h, level), at);
          break;
        case "tower":
          place(byLevel(tables.enemyTower[race] ?? tables.enemyTower.h, level), at);
          break;
        case "house": {
          const houses = tables.enemyHouse[race] ?? tables.enemyHouse.h;
          place(houses[Math.floor(random() * houses.length)], at);
          break;
        }
        case "unit":
          place(soldiers[Math.floor(random() * soldiers.length)], at, true);
          break;
        case "chest":
          chest = place(chestId, at);
          break;
        default:
          place(item.template, at);
      }
    }
  }
  return chest ? { pieces, chest } : null;
}

function count(value: number | string, level: number): number {
  if (typeof value === "number") {
    return value;
  }
  // "max(ceil(level/3), 2)": the treasure village's towers.
  return Math.max(Math.ceil(level / 3), 2);
}

/** The prisoners a camp's prison frees when it opens: the player's from then on. */
export function freedUnits(id: number, race: string, chest: Point, random: () => number, ground: Ground): CampPiece[] {
  const camp = DATA.camps[String(id)];
  const freed: CampPiece[] = [];
  for (const entry of camp?.freed[race] ?? []) {
    for (let i = 0; i < (entry.count ?? 1); i++) {
      const unit = entry.villager ? (race === "t" ? [580, 581] : [500, 501])[Math.floor(random() * 2)] : entry.id!;
      const at = nearestFree(ground, chest.x + entry.at[0], chest.y + entry.at[1], random);
      if (at) {
        ground.take(at.x, at.y, 1, 1);
        freed.push({ id: unit, x: at.x, y: at.y, unit: true });
      }
    }
  }
  return freed;
}

/** The outer big tiles (1 to 25, 5 a row): the border ring. */
const BORDER_BLOCKS = [1, 2, 3, 4, 5, 6, 10, 11, 15, 16, 20, 21, 22, 23, 24, 25];

/**
 * Trolls standing about on the border, topped up when a camp comes: a few
 * clusters, fewer the more enemies there are already. They stand and fight
 * what comes near; they never march on the town.
 */
export function borderTrolls(enemyUnits: number, level: number, race: string, random: () => number, ground: Ground): CampPiece[] {
  const [least, most] = race === "t" ? [6, 10] : [3, 5];
  const clusters = Math.max(6 - Math.floor(enemyUnits / ((least + most) / 2)), 0);
  // One size for all of a call's clusters; the original never reaches the most.
  const size = least + Math.floor(random() * (most - least));
  const ids = enemyIds(level, race);
  const trolls: CampPiece[] = [];
  for (let c = 0; c < clusters; c++) {
    const block = BORDER_BLOCKS[Math.round(random() * (BORDER_BLOCKS.length - 1))];
    const bx = ((block - 1) % 5) * 20;
    const by = Math.floor((block - 1) / 5) * 20;
    const centre = { x: bx + Math.floor(random() * 20), y: by + Math.floor(random() * 20) };
    for (let i = 0; i < size; i++) {
      const at = nearestFree(ground, centre.x, centre.y, random);
      if (!at) {
        break;
      }
      ground.take(at.x, at.y, 1, 1);
      trolls.push({ id: ids[Math.round(random() * (ids.length - 1))], x: at.x, y: at.y, unit: true });
    }
  }
  return trolls;
}
