// The player's hands in a battle, on an island (questPlay.ts) or in their
// own town under attack (homeDefence.ts): picking units (Shift adds, Space
// takes them all, Escape lets go; a double click takes every unit of that
// kind, a Shift-drag box adds the units in it, numbers keep groups),
// sending them somewhere or at an enemy, the spell book and its aiming, and
// a special unit's buttons. CLIENT.md, "Selecting units in a battle".

import type { Container } from "pixi.js";

import type { CommandSender } from "./net/commands.ts";
import type { PageSettings } from "./net/server.ts";
import { ENEMY, SELF, SUBCAT, type Battle, type Fighter } from "./rules/battle.ts";
import type { GameConfig, ItemInfo } from "./rules/config.ts";
import { tileUnder, unitPoint, type Point } from "./rules/geometry.ts";
import { BATTLE_DOUBLE_CLICK_MS, DOUBLE_CLICK_MS, pickWith, sameItem } from "./rules/group.ts";
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
  /** A mode-specific pointer (the repair bucket at home), or "" to use the shared attack/default pointer. */
  cursorFor?: (hovered: Fighter | null, selected: Fighter[]) => string;
  /** Mana and gold changed (the town's numbers at the top, at home). */
  changed?: () => void;
  /** False: no spell book (spying). */
  spells?: boolean;
  /** The original tournament book disables Crack and Black Hole. */
  tournament?: boolean;
}

/** A group's number pressed twice within this long: the camera goes to the group. */
const AGAIN_MS = 500;
/** How long a word about a group stays at the top. */
const SAID_MS = 2000;

export class BattleControls {
  private readonly parts: ControlParts;
  /** The last of the player's units tapped, and when: a second tap on it soon after is a double click. */
  private lastTap: { unit: Fighter; at: number } | null = null;
  /** Groups kept with Shift and a number (1 to 9), and picked again with the number. */
  private readonly groups = new Map<number, Fighter[]>();
  private lastRecall: { group: number; at: number } | null = null;
  private said = 0;
  /** The camera's box, as it was before the battle (the town's, at home): given back at the end. */
  private readonly cameraBefore: Pick<Camera, "onPress" | "onBox">;
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
    this.cameraBefore = { onPress: parts.camera.onPress, onBox: parts.camera.onBox };
    parts.camera.onTap = (at, touch, shift, time) => this.tap(at, shift, time, touch);
    parts.camera.onPress = (_at, _touch, shift) => this.startsBox(shift);
    parts.camera.onBox = (from, to, done) => this.dragBox(from, to, done);
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

  /** Every living unit of the player's. */
  private ownUnits(): Fighter[] {
    return this.parts.battle.fighters.filter((f) => f.side === SELF && f.isUnit && !f.dead);
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
    this.parts.view.showBox(null);
    this.parts.camera.onPress = this.cameraBefore.onPress;
    this.parts.camera.onBox = this.cameraBefore.onBox;
    this.pointerAt = null;
    this.parts.camera.setCursor("");
    window.removeEventListener("keydown", this.keys, true);
  }

  private tap(at: Point, shift = false, time = performance.now(), touch = false): void {
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
    const own = tapped && tapped.side === SELF && tapped.isUnit ? tapped : null;
    const last = this.lastTap;
    this.lastTap = own ? { unit: own, at: time } : null;
    // A finger has no Shift to click on and off quickly with: it keeps the original's second.
    if (own && last?.unit === own && time - last.at < (touch ? DOUBLE_CLICK_MS : BATTLE_DOUBLE_CLICK_MS)) {
      // Tapped again soon after: the double click, every unit of its kind (with Shift, added to the others).
      this.lastTap = null;
      this.select(pickWith(this.selected, sameItem(own, this.ownUnits()), shift));
      sound.play("click");
      return;
    }
    if (own) {
      // A unit of the player's: it alone, or added to (or taken from) the others with Shift.
      const now = new Set(shift ? this.selected : []);
      if (shift && now.has(own)) {
        now.delete(own);
      } else {
        now.add(own);
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

  /**
   * A press on the map with Shift held: its drag draws a box to pick units
   * instead of moving the map. Unlike the town's, a drag from a unit still
   * moves the map: in a battle the army covers much of the ground.
   */
  private startsBox(shift: boolean): boolean {
    return shift && !this.stopped && !this.book?.isAiming;
  }

  /** The box being drawn (screen points), and let go: the player's units in it join those selected, as Shift adds. */
  private dragBox(from: Point, to: Point, done: boolean): void {
    const { view, camera, sound } = this.parts;
    if (!done && !this.stopped) {
      view.showBox(camera.toMap(from), camera.toMap(to));
      return;
    }
    view.showBox(null);
    // A few pixels across is a slip, not a box: the tap that follows does the work.
    if (this.stopped || Math.abs(to.x - from.x) <= 3 || Math.abs(to.y - from.y) <= 3) {
      return;
    }
    const picked = view.unitsIn(from, to).filter((f) => f.side === SELF);
    this.select(pickWith(this.selected, picked, true));
    if (picked.length > 0) sound.play("click");
  }

  /** Shift and a number: the units selected become that group (none selected: it's emptied). */
  private keepGroup(group: number): void {
    const units = this.selected;
    if (units.length === 0) {
      this.groups.delete(group);
      this.say(`Group ${group} emptied`);
      return;
    }
    this.groups.set(group, units);
    this.say(`Group ${group}: ${units.length} unit${units.length === 1 ? "" : "s"} kept. Press ${group} to pick them again`);
  }

  /** A number: its group is selected again, those still standing; pressed twice, the camera goes to them. */
  private pickGroup(group: number): void {
    const units = (this.groups.get(group) ?? []).filter((f) => !f.dead && f.side === SELF && f.isUnit);
    if (units.length === 0) {
      this.say(`Group ${group} is empty: select units, then Shift+${group} keeps them`);
      return;
    }
    const now = performance.now();
    const again = this.lastRecall?.group === group && now - this.lastRecall.at < AGAIN_MS;
    this.lastRecall = { group, at: now };
    this.select(units);
    this.parts.sound.play("click");
    if (again) {
      const middle = units.reduce((sum, f) => ({ x: sum.x + f.at.x / units.length, y: sum.y + f.at.y / units.length }), { x: 0, y: 0 });
      this.parts.camera.lookAt(middle);
    } else {
      this.say(`Group ${group}: ${units.length} unit${units.length === 1 ? "" : "s"}`);
    }
  }

  /** A word at the top for a moment, taken away only if nothing has replaced it. */
  private say(text: string): void {
    showMessage(text);
    const said = ++this.said;
    setTimeout(() => {
      if (said === this.said && document.querySelector(".message")?.textContent === text) showMessage("");
    }, SAID_MS);
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
    const digit = /^(?:Digit|Numpad)([1-9])$/.exec(e.code);
    if (digit && !this.stopped) {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.shiftKey) {
        this.keepGroup(Number(digit[1]));
      } else {
        this.pickGroup(Number(digit[1]));
      }
    } else if (e.key === "Escape") {
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
