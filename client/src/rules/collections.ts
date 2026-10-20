// Collection pieces (CLIENT.md, "Collection pieces"), as the Flash client
// drops them (our notes, our words: docs/original/no-button.md, rule 65).
// Each of the game's 23 collections of 5 has its pieces drop from one
// source each (a harvest, a fallen enemy, a boss, an attack on a town, a
// chest, a hardcore or god island), some rarer than others. A tree or rock
// harvested, and an enemy fallen in a fight (battleSource), roll for one.
// The piece is the player's at once, and the server hears `add_collectable`
// (collection, piece). The collections window exchanges these saved counts
// through collectionBook.ts. No drawing here.

import type { Command } from "../net/commands.ts";

/** A piece: its collection (1 to 23) and which of the five (1 to 5). */
export interface Piece {
  collection: number;
  piece: number;
}

/**
 * Where a piece drops: a tree or rock harvested; one of the enemy's own
 * race fallen (trolls, for a human); a boss fallen; an enemy fallen
 * attacking a town; a quest's treasure chest opened; anything on a
 * hardcore or god island.
 */
export type Source = "harvest" | "mobs" | "boss" | "assault" | "chest" | "hardcore";

/** How rare a piece is, rarest first, and the roll out of 100 it comes under: 0.5, 2.5 and 4. */
const EPIC = 0, RARE = 1, UNCOMMON = 2;
const BELOW = [0.5, 2.5, 4];

/** Each collection's five pieces: where each drops, and how rare it is. */
const five = (source: Source, rarity: number): [Source, number][] => Array.from({ length: 5 }, () => [source, rarity]);
/** Collections 15 to 20: a piece from each place, the last from a boss. */
const fromEverywhere = (first: Source, rarity: number, fourth = rarity): [Source, number][] =>
  [[first, rarity], ["mobs", rarity], ["assault", rarity], ["chest", fourth], ["boss", fourth]];
const SOURCES: [Source, number][][] = [
  [],
  five("harvest", UNCOMMON),  // 1 the Pyramid
  five("harvest", UNCOMMON),  // 2 the Treasure Chest
  five("harvest", UNCOMMON),  // 3 the Garden
  five("harvest", UNCOMMON),  // 4 the Golden Fountain
  five("harvest", UNCOMMON),  // 5 the Frozen Mammoth
  [...five("mobs", RARE).slice(0, 4), ["boss", RARE]],  // 6 the Axethrower
  [...five("assault", RARE).slice(0, 4), ["boss", RARE]],  // 7 the Penguin
  [...five("assault", RARE).slice(0, 4), ["boss", RARE]],  // 8 the Yeti
  [...five("mobs", EPIC).slice(0, 4), ["boss", EPIC]],  // 9 the War Troll
  [["assault", EPIC], ["assault", EPIC], ["mobs", EPIC], ["mobs", EPIC], ["boss", EPIC]],  // 10 the Wizard
  five("harvest", UNCOMMON),  // 11 the Crocodile Pit
  five("harvest", UNCOMMON),  // 12 the Life Tree
  five("harvest", UNCOMMON),  // 13 the Guillotine
  five("harvest", UNCOMMON),  // 14 the Prison
  fromEverywhere("harvest", UNCOMMON, RARE),  // 15 the Soldier Statue
  fromEverywhere("harvest", RARE),  // 16 the dog
  fromEverywhere("harvest", RARE),  // 17 the cat
  fromEverywhere("harvest", RARE),  // 18 the skeleton
  fromEverywhere("harvest", EPIC),  // 19 the Ravager Troll
  fromEverywhere("harvest", EPIC),  // 20 the High Elf
  five("hardcore", RARE),  // 21 the Golden Bahamut
  five("hardcore", RARE),  // 22 the Red Bahamut
  five("hardcore", EPIC),  // 23 the Bahamut Heart
];

/** The same, by source and rarity: what a roll there can give. */
const DROPS = new Map<Source, Piece[][]>();
SOURCES.forEach((pieces, collection) => pieces.forEach(([source, rarity], i) => {
  if (!DROPS.has(source)) {
    DROPS.set(source, BELOW.map(() => []));
  }
  DROPS.get(source)![rarity].push({ collection, piece: i + 1 });
}));

/**
 * The piece a roll from `source` gives, or none: never in a troll town.
 * Out of 100 rolls, on average, half a piece of the rarest kind, 2 rare and
 * 1.5 uncommon; a boss or a chest always gives one, a rare one 4 times in
 * 5. A hardcore or god island's rolls give nothing half the time more. A
 * rarity the source has no pieces of gives a commoner one. `random` gives
 * numbers from 0 to 1, as Math.random.
 */
export function loot(source: Source, race: string, random: () => number = Math.random): Piece | null {
  if (race === "t") {
    return null;
  }
  const roll = random() * (source === "boss" || source === "chest" ? BELOW[RARE] : 100);
  let rarity = BELOW.findIndex((below) => roll < below);
  const kept = source !== "hardcore" || random() < 0.5;
  if (rarity < 0 || !kept) {
    return null;
  }
  for (const drops = DROPS.get(source)!; rarity < drops.length; rarity++) {
    if (drops[rarity].length) {
      return drops[rarity][Math.floor(random() * drops[rarity].length)];
    }
  }
  return null;
}

/** The piece a harvest drops, or none. */
export function harvestLoot(race: string, random: () => number = Math.random): Piece | null {
  return loot("harvest", race, random);
}

/** The fights that drop pieces: a quest (on a hardcore or god island, or another), an attack on a town, a raid or camp at home. */
export type Fight = "quest" | "hardcore" | "attack" | "home";

const SUBCAT = { boss: 84, tree: 125, stone: 126, goldRock: 127 };
const OCTOPUS = 548, KRAKEN = 549, TREASURE_CHEST = 82;

/**
 * Where a piece from a fallen enemy (or an opened chest) comes from, as the
 * Flash client decides it, or null for none: anything attacking a town, or
 * on a hardcore or god island, from there; else the enemy's own race (the
 * trolls, for a human), the sea monsters, a boss, the Treasure Chest. A
 * human soldier on an island, or another of the islands' prizes, gives none.
 */
export function battleSource(fight: Fight, enemy: { id: number; race: string; subcategory: number }, playerRace: string): Source | null {
  if (fight === "attack") {
    return "assault";
  }
  if (fight === "hardcore") {
    return "hardcore";
  }
  if (enemy.race === (playerRace === "t" ? "h" : "t") || enemy.id === OCTOPUS || enemy.id === KRAKEN) {
    return "mobs";
  }
  if (enemy.id === TREASURE_CHEST) {
    return "chest";
  }
  if (enemy.subcategory === SUBCAT.boss) {
    return "boss";
  }
  if (enemy.subcategory === SUBCAT.tree || enemy.subcategory === SUBCAT.stone || enemy.subcategory === SUBCAT.goldRock) {
    return "harvest";
  }
  return null;
}

/** Telling the server a piece was found. */
export function addPiece(found: Piece): Command {
  return { cmd: "add_collectable", args: [found.collection, found.piece] };
}

/** The game's text lines for a piece's name and its collection's. The Bahamuts' are elsewhere, their collections' names in another order. */
export function pieceLines(found: Piece): { piece: number; collection: number } | null {
  if (found.collection >= 21 && found.collection <= 23) {
    return { piece: 1369 + (found.collection - 21) * 5 + (found.piece - 1), collection: [1385, 1384, 1386][found.collection - 21] };
  }
  if (found.collection < 1 || found.collection > 20) {
    return null;
  }
  return { piece: 340 + (found.collection - 1) * 5 + (found.piece - 1), collection: 319 + found.collection };
}

/** Where a piece's picture is in the game's sheet of them (images_new/collectibles_new.png): a row per collection, 60 pixels square. */
export const PIECE_SIZE = 60;
export function pieceFrame(found: Piece): { x: number; y: number; width: number; height: number } {
  return { x: (found.piece - 1) * PIECE_SIZE, y: (found.collection - 1) * PIECE_SIZE, width: PIECE_SIZE, height: PIECE_SIZE };
}
