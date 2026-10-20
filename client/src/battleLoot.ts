// Collection pieces found in a fight (CLIENT.md, "Collection pieces"): a
// quest, an attack on a town, a raid or camp at home. The rules decide
// whether an enemy's fall (or a quest's chest) gives one, and which
// (rules/collections.ts); this shows its picture popping up from it, says
// what it is, and tells the server. The original flew it to the collection
// panel; ours shows it where it fell, as a harvest's.

import type { CommandSender } from "./net/commands.ts";
import type { Fighter } from "./rules/battle.ts";
import { addPiece, battleSource, loot, pieceFrame, pieceLines, type Fight, type Piece } from "./rules/collections.ts";
import { showMessage } from "./ui/hud.ts";
import type { BattleView } from "./view/battleView.ts";

export interface LootParts {
  fight: Fight;
  /** The player's town's race: a troll town finds none. */
  race: string;
  view: BattleView;
  commands: CommandSender;
  /** The game's sheet of piece pictures, and its text lines. */
  sheet: string;
  line: (id: number) => string;
  /** A piece found, for the town's collections window. */
  found?: (piece: Piece) => void;
}

/** How long the message of a piece found stays. */
const SAID_MS = 3000;

export class BattleLoot {
  private readonly parts: LootParts;
  /** Numbers from 0 to 1, as Math.random (the browser tests choose them). */
  random: () => number = Math.random;
  private said: ReturnType<typeof setTimeout> | null = null;

  constructor(parts: LootParts) {
    this.parts = parts;
  }

  /**
   * An enemy fell, or the chest was opened: maybe a piece, the player's at
   * once. Call it only when the original rolls (a quest's or an attack's
   * kill that paid gold, a boss, the chest; any enemy unit at home).
   */
  roll(fighter: Fighter, prefix = ""): Piece | null {
    const { fight, race, view, commands, sheet } = this.parts;
    const source = battleSource(fight, fighter.item, race);
    const piece = source ? loot(source, race, this.random) : null;
    if (!piece) {
      return null;
    }
    // Sent at once, as a spell is: the original sent it even in a fight, so it stays found if the fight is left.
    const told = addPiece(piece);
    commands.add(told.cmd, ...told.args);
    void commands.flush();
    this.parts.found?.(piece);
    view.pop(fighter, sheet, pieceFrame(piece));
    const lines = pieceLines(piece);
    const name = lines && this.parts.line(lines.piece);
    if (name) {
      this.say(`${prefix}You found a collection piece: ${name}, of ${this.parts.line(lines.collection)}.`);
    }
    return piece;
  }

  private say(text: string): void {
    showMessage(text);
    if (this.said) {
      clearTimeout(this.said);
    }
    this.said = setTimeout(() => {
      this.said = null;
      showMessage("");
    }, SAID_MS);
  }
}
