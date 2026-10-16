// A visible selection and a way out of it on mouse and touch screens alike.
import type { Fighter } from "../rules/battle.ts";

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
    const unit = units.length === 1 ? units[0] : null;
    this.summary.textContent = unit
      ? `${unit.item.name} · ${Math.ceil(unit.life)}/${unit.maxLife} health · ${unit.attack} attack`
      : `${units.length} units selected`;
    const key = units.map((u) => u.key).join(",");
    if (key === this.drawn) return;
    this.drawn = key;
    this.roster.replaceChildren();
    if (units.length < 2) return;
    for (const chosen of units) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "portrait";
      button.setAttribute("aria-label", `Inspect ${chosen.item.name}`);
      button.title = chosen.item.name;
      const image = document.createElement("img");
      image.src = this.picture(chosen.item.art);
      image.alt = "";
      button.append(image);
      button.addEventListener("click", () => this.select([chosen]));
      this.roster.append(button);
    }
  }

  remove(): void { this.element.remove(); }
}
