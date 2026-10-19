// A visible selection and a way out of it on mouse and touch screens alike.
// Several units show one portrait per kind, with how many: a click keeps
// only that kind, Shift-click (or right-click, or a long press on a phone
// that offers one) drops it (CLIENT.md, "Selecting units in a battle").
import type { Fighter } from "../rules/battle.ts";
import { byKind } from "../rules/group.ts";

/** What the controls are, for the mouse's tooltip. */
const HOW = "Double-click a unit: all of its kind. Shift-click adds or takes away; Shift-drag a box to add those in it. "
  + "Shift+1–9 keeps a group, 1–9 picks it again (twice: go to it).";

export class BattleSelection {
  private readonly element = document.createElement("section");
  private readonly summary = document.createElement("span");
  private readonly roster = document.createElement("div");
  private drawn = "";
  private readonly select: (units: Fighter[]) => void;
  private readonly picture: (name: string) => string;

  constructor(select: (units: Fighter[]) => void, picture: (name: string) => string) {
    this.select = select;
    this.picture = picture;
    this.element.className = "battle-selection";
    this.element.setAttribute("aria-label", "Selected units");
    this.element.hidden = true;
    this.summary.title = HOW;
    this.roster.className = "battle-selection-roster";
    const clear = document.createElement("button");
    clear.type = "button";
    clear.className = "button tiny plain";
    clear.textContent = "Deselect";
    clear.title = "Clear selection (Escape)";
    clear.addEventListener("click", () => select([]));
    this.element.append(this.summary, clear, this.roster);
    document.body.append(this.element);
  }

  update(units: Fighter[]): void {
    this.element.hidden = units.length === 0;
    const kinds = byKind(units);
    const unit = units.length === 1 ? units[0] : null;
    this.summary.textContent = unit
      ? `${unit.item.name} · ${Math.ceil(unit.life)}/${unit.maxLife} health · ${unit.attack} attack`
      : kinds.length === 1 ? `${units.length} × ${kinds[0].item.name}` : `${units.length} units selected`;
    const key = units.map((u) => `${u.key}:${u.item.id}`).join(",");
    if (key === this.drawn) return;
    this.drawn = key;
    this.roster.replaceChildren();
    if (units.length < 2) return;
    for (const kind of kinds) {
      const { item } = kind;
      const count = kind.units.length;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "portrait";
      // One kind alone: its portrait picks one of them, to look at.
      const only = kinds.length === 1;
      button.setAttribute("aria-label", only ? `Inspect ${item.name}` : `Only ${item.name} (${count})`);
      button.title = only ? item.name : `${item.name} × ${count}: click for only these; Shift-click or right-click to drop them`;
      const image = document.createElement("img");
      image.src = this.picture(item.art);
      image.alt = "";
      button.append(image);
      if (count > 1) {
        const badge = document.createElement("span");
        badge.className = "count";
        badge.textContent = String(count);
        button.append(badge);
      }
      const drop = () => this.select(units.filter((u) => u.item.id !== item.id));
      button.addEventListener("click", (e) => {
        if (e.shiftKey && !only) drop();
        else this.select(only ? [kind.units[0]] : kind.units);
      });
      button.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        if (!only) drop();
      });
      this.roster.append(button);
    }
  }

  remove(): void { this.element.remove(); }
}
