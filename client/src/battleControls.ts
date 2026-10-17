// The player's hands in a battle, on an island (questPlay.ts) or in their
// own town under attack (homeDefence.ts): picking units (Shift adds, Space
// takes them all, Escape lets go), sending them somewhere or at an enemy,
// the spell book and its aiming, and a special unit's buttons.

import type { Container } from "pixi.js";

import type { CommandSender } from "./net/commands.ts";
import type { PageSettings } from "./net/server.ts";
import { ENEMY, SELF, SUBCAT, type Battle, type Fighter } from "./rules/battle.ts";
import type { GameConfig, ItemInfo } from "./rules/config.ts";
import { tileUnder, unitPoint, type Point } from "./rules/geometry.ts";
import { areaOf, castSpell, magicOpen, marked, rankOf, spend, type MagicState, type SpellInfo } from "./rules/magic.ts";
import type { Specials } from "./rules/specials.ts";
import type { Town } from "./rules/town.ts";
import { tournamentSpellAllowed } from "./rules/tournamentBattle.ts";
import type { Sound } from "./sound.ts";
import { showMessage } from "./ui/hud.ts";
import { CURSORS } from "./ui/icons.ts";
import { SpecialButtons } from "./ui/specialButtons.ts";
import { BattleSelection } from "./ui/battleSelection.ts";
import { SpellBook, magicParts } from "./ui/spells.ts";
import type { BattleView } from "./view/battleView.ts";
import type { Camera } from "./view/camera.ts";

export interface ControlParts {
  battle: Battle;
  view: BattleView;
  camera: Camera;
  world: Container;
  items: Map<number, ItemInfo>;
  town: Town;
  config: GameConfig;
  privateState: Record<string, unknown> | undefined;
  settings: PageSettings;
  commands: CommandSender;
  sound: Sound;
  specials: Specials;
  random: () => number;
  /** A tap the battle's owner looks at first (the island's chest, a building to repair): true when it took it. */
  tapFirst?: (tapped: Fighter | null, tile: Point, selected: Fighter[]) => boolean;
  /** The mouse pointer over a fighter with these selected (the repair bucket at home), or "" for the usual. */
  cursorFor?: (hovered: Fighter | null, selected: Fighter[]) => string;
  /** Mana and gold changed (the town's numbers at the top, at home). */
  changed?: () => void;
  /** False: no spell book (spying). */
  spells?: boolean;
  /** The original tournament book disables Crack and Black Hole. */
  tournament?: boolean;
}

export class BattleControls {
  private readonly parts: ControlParts;
  readonly magic: MagicState;
  private readonly book: SpellBook | null;
  private readonly moves: SpecialButtons;
  private readonly selection: BattleSelection;
  private aimAt: Point | null = null;
  private hovering = false;
  private pointerAt: Point | null = null;
  private stopped = false;
  private readonly keys = (e: KeyboardEvent) => this.key(e);
  /** Told when the selection changes (the island's bar). */
  onSelect: () => void = () => {};

  constructor(parts: ControlParts) {
    this.parts = parts;
    const { config, privateState, town, settings, commands, view } = parts;
    const spells = magicParts(config, privateState, town, settings.assetsUrl, (cmd, ...args) => {
      commands.add(cmd, ...args);
      void commands.flush();
    }, () => parts.changed?.());
    this.magic = spells.state;
    if (parts.tournament) spells.canCast = (spell) => tournamentSpellAllowed(spell.id);
    this.book = parts.spells !== false && magicOpen(town.race, town.level) ? new SpellBook(spells, (spell) => {
      this.aimAt = null;
      if (spell) {
        this.select([], false);
      } else {
        view.aim(null);
      }
      this.updateCursor();
    }) : null;
    this.moves = new SpecialButtons(parts.specials, (name) => `${settings.assetsUrl}/buildingthumbs/${name}.jpg`, (text) => {
      showMessage(text);
      setTimeout(() => showMessage(""), 2000);
    });
    this.selection = new BattleSelection((units) => this.select(units), (name) => `${settings.assetsUrl}/buildingthumbs/${name}.jpg`);
    parts.camera.onTap = (at, _touch, shift) => this.tap(at, shift);
    parts.camera.onHover = (at) => this.hover(at);
    parts.camera.onLeave = () => {
      this.pointerAt = null;
      view.hover(null);
      parts.camera.setCursor("");
    };
    // Combat shortcuts win over the town's A (Army) and Space (box tool).
    window.addEventListener("keydown", this.keys, true);
  }

  get selected(): Fighter[] {
    return [...this.parts.view.selected].filter((f) => !f.dead && f.side === SELF && f.isUnit);
  }

  select(units: Fighter[], cancelAim = true): void {
    if (cancelAim) this.book?.stopAiming();
    this.parts.view.aim(null);
    this.aimAt = null;
    this.parts.view.selected = new Set(units);
    this.moves.select(this.selected);
    this.selection.update(units);
    this.updateCursor();
    this.onSelect();
  }

  /** Every unit of the player's that can fight (at home, villagers stay out of it). */
  selectAll(): void {
    this.select(this.parts.battle.fighters.filter((f) => f.side === SELF && f.isUnit && !f.dead && f.attack > 0
      && f.item.subcategory !== SUBCAT.peasant));
  }

  /** Every frame: the buttons' seconds and bars. */
  update(): void {
    if (!this.stopped) {
      this.moves.update();
      this.selection.update([...this.parts.view.selected].filter((f) => !f.dead || f.ruined));
      this.updateCursor();
    }
  }

  /** The battle is over: the book and buttons go, and taps are no longer the battle's. */
  stop(): void {
    this.stopped = true;
    this.book?.stopAiming();
    this.book?.hide();
    this.moves.select([]);
    this.moves.remove();
    this.selection.remove();
    this.parts.view.selected = new Set();
    this.pointerAt = null;
    this.parts.camera.setCursor("");
    window.removeEventListener("keydown", this.keys, true);
  }

  private tap(at: Point, shift = false): void {
    if (this.stopped) {
      return;
    }
    const { battle, view, camera, sound } = this.parts;
    const tile = tileUnder(camera.toMap(at));
    const aiming = this.book?.isAiming;
    if (aiming) {
      // With a mouse the marker follows it, so a click casts; on a touch
      // screen the first tap shows where it would fall, a second there casts.
      if (this.hovering || (this.aimAt && this.aimAt.x === tile.x && this.aimAt.y === tile.y)) {
        this.cast(aiming, tile);
      } else {
        this.aimOver(tile);
      }
      return;
    }
    const tapped = view.fighterAt(at);
    if (!tapped) view.groundClick(camera.toMap(at));
    if (tapped && tapped.side === SELF && tapped.isUnit) {
      // A unit of the player's: it alone, or added to (or taken from) the others with Shift.
      const now = new Set(shift ? this.selected : []);
      if (shift && now.has(tapped)) {
        now.delete(tapped);
      } else {
        now.add(tapped);
      }
      this.select([...now]);
      sound.play("click");
      return;
    }
    if (this.parts.tapFirst?.(tapped, tile, this.selected)) {
      return;
    }
    const chosen = this.selected;
    // Scenery and friendly buildings are inspected, never movement orders.
    if (tapped && (tapped.side !== ENEMY || chosen.length === 0)) {
      this.select([tapped]);
      sound.play("click");
      return;
    }
    if (chosen.length === 0) {
      this.select([]);
      return;
    }
    if (tapped && tapped.side === ENEMY) {
      battle.attackWith(chosen, tapped);
    } else {
      battle.moveTo(chosen, tile);
    }
    sound.play("place");
  }

  private hover(at: Point): void {
    if (this.stopped) {
      return;
    }
    const { view, camera } = this.parts;
    this.hovering = true;
    this.pointerAt = at;
    if (this.book?.isAiming) {
      this.aimOver(tileUnder(camera.toMap(at)));
      view.hover(null);
      this.updateCursor();
      return;
    }
    this.updateCursor();
  }

  /** Keep the action pointer in step with selection, deaths and spell aiming, even without mouse movement. */
  private updateCursor(): void {
    // Fighters and the camera can move under a stationary mouse. Use the
    // same current hit test as a click, rather than retaining an old target.
    const hovered = this.pointerAt && !this.stopped && !this.book?.isAiming
      ? this.parts.view.fighterAt(this.pointerAt) : null;
    this.parts.view.hover(hovered);
    const selected = this.selected;
    const special = this.parts.cursorFor?.(hovered, selected);
    const attack = hovered?.side === ENEMY && !hovered.dead && selected.some((unit) => unit.attack > 0);
    this.parts.camera.setCursor(this.stopped || this.book?.isAiming ? "" : special || (attack ? CURSORS.attack : ""));
  }

  private key(e: KeyboardEvent): void {
    if (e.ctrlKey || e.metaKey || e.altKey || document.body.classList.contains("panel-open")) return;
    if (e.target instanceof HTMLElement && e.target.closest("input, textarea, select, [contenteditable=true], [role=dialog]")) return;
    // A backdrop click can move focus to body. The visible dialog still
    // owns shortcuts; mounted panels hidden directly or by an ancestor do not.
    if ([...document.querySelectorAll('[role="dialog"], [role="alertdialog"]')]
      .some((dialog) => dialog.getClientRects().length > 0)) return;
    if (e.key === "Escape") {
      e.stopImmediatePropagation();
      this.select([]);
    } else if (e.key === " " || e.key.toLowerCase() === "a") {
      if (e.key === " " && e.target instanceof HTMLButtonElement) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      this.selectAll();
    }
  }

  private aimOver(tile: Point): void {
    const spell = this.book?.isAiming;
    if (!spell) {
      return;
    }
    this.aimAt = tile;
    // The marker shows the spell's area at its rank now (the cast itself may reach the next).
    const rank = rankOf(Number(this.magic.casts[String(spell.id)] ?? 0));
    this.parts.view.aim({ tile, area: areaOf(spell, rank), lit: marked(this.parts.battle, spell, rank, tile) });
  }

  private cast(spell: SpellInfo, tile: Point): void {
    if (this.parts.tournament && !tournamentSpellAllowed(spell.id)) return;
    const { battle, items, random, view, commands, sound } = this.parts;
    const rank = spend(spell, this.magic);
    castSpell(battle, spell, rank, tile, { items, random });
    // As the Flash client: the spell's name and its mana rise from the tile, and the server hears at once.
    view.riseAt(unitPoint(tile.x, tile.y), [{ text: spell.name, colour: 0xff5a4a }, { text: `-${spell.mana}`, colour: 0x5ec8ff }]);
    commands.add("use_magic", spell.id);
    void commands.flush();
    sound.play("place");
    this.book!.cast();
    this.parts.changed?.();
  }
}
