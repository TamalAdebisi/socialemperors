// Collection pieces (CLIENT.md, "Collection pieces"), as the Flash client
// drops them at home (our notes, our words: docs/original/no-button.md,
// rule 65): a tree or rock harvested in a human town now and then gives a
// piece of one of the game's 23 collections of 5. Out of 100 harvests, on
// average, half a piece is one of the rarest kind, 2 a rare one and 1.5 an
// uncommon one: 4 in all. The piece is the player's at once, and the server
// hears `add_collectable` (collection, piece). The collections window exchanges these saved counts
// through collectionBook.ts. No drawing here.

import type { Command } from "../net/commands.ts";

/** A piece: its collection (1 to 23) and which of the five (1 to 5). */
export interface Piece {
  collection: number;
  piece: number;
}

const ALL_FIVE = (collection: number): Piece[] => [1, 2, 3, 4, 5].map((piece) => ({ collection, piece }));

/**
 * What a harvest can drop, rarest first, and below which roll out of 100
 * each comes: the rarest under 0.5, rare under 2.5, uncommon under 4.
 */
const HARVEST_DROPS: { below: number; pieces: Piece[] }[] = [
  // The Ravager Troll's and the High Elf's first pieces.
  { below: 0.5, pieces: [{ collection: 19, piece: 1 }, { collection: 20, piece: 1 }] },
  // The dog's, the cat's and the skeleton's first pieces.
  { below: 2.5, pieces: [{ collection: 16, piece: 1 }, { collection: 17, piece: 1 }, { collection: 18, piece: 1 }] },
  // All of the Pyramid, the Treasure Chest, the Garden, the Golden Fountain, the Frozen Mammoth,
  // the Crocodile Pit, the Life Tree, the Guillotine and the Prison; the Soldier Statue's first.
  { below: 4, pieces: [1, 2, 3, 4, 5, 11, 12, 13, 14].flatMap(ALL_FIVE).concat({ collection: 15, piece: 1 }) },
];

/** The piece a harvest drops, or none: never in a troll town. `random` gives numbers from 0 to 1, as Math.random. */
export function harvestLoot(race: string, random: () => number = Math.random): Piece | null {
  if (race === "t") {
    return null;
  }
  const roll = random() * 100;
  const drops = HARVEST_DROPS.find((drop) => roll < drop.below);
  if (!drops) {
    return null;
  }
  return drops.pieces[Math.floor(random() * drops.pieces.length)];
}

/** Telling the server a piece was found. */
export function addPiece(found: Piece): Command {
  return { cmd: "add_collectable", args: [found.collection, found.piece] };
}

/** The game's text lines for a piece's name and its collection's (the first 20 collections; the Bahamuts' are elsewhere). */
export function pieceLines(found: Piece): { piece: number; collection: number } | null {
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
