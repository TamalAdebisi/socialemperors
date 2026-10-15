// A special unit's buttons in battle (CLIENT.md, "Special moves"): with
// one such unit selected (a dragon, a god, a colossus...), its moves as
// the game's own pictures at the bottom of the screen, as on the Flash
// client's portrait panel. A button waiting out the shared cooldown shows
// its seconds; the LIMIT shows its bar filling, and lights up when full.

import type { Fighter } from "../rules/battle.ts";
import type { ButtonView, Specials } from "../rules/specials.ts";

export class SpecialButtons {
  private readonly element = document.createElement("div");
  private readonly specials: Specials;
  private readonly pictureUrl: (name: string) => string;
  private readonly told: (text: string) => void;
  private unit: Fighter | null = null;
  /** What's drawn now, so the buttons are only rebuilt when it changes. */
  private drawn = "";

  constructor(specials: Specials, pictureUrl: (name: string) => string, told: (text: string) => void) {
    this.specials = specials;
    this.pictureUrl = pictureUrl;
    this.told = told;
    this.element.className = "special-buttons";
    this.element.hidden = true;
    this.element.setAttribute("aria-label", "Special moves");
    document.body.append(this.element);
  }

  /** Off the screen for good: the battle is over. */
  remove(): void {
    this.unit = null;
    this.element.remove();
  }

  /** The units selected: buttons show for one special unit alone. */
  select(units: Fighter[]): void {
    this.unit = units.length === 1 && this.specials.entryOf(units[0]) ? units[0] : null;
    this.update();
  }

  /** Called every frame: the buttons are made once for a unit; after that only what they say changes. */
  update(): void {
    const unit = this.unit && !this.unit.dead ? this.unit : null;
    const views = unit ? this.specials.buttons(unit) : [];
    const shape = JSON.stringify([unit?.key, views.map((view) => view.slot)]);
    if (shape !== this.drawn) {
      this.drawn = shape;
      this.element.hidden = views.length === 0;
      this.element.replaceChildren(...views.map((view) => this.button(unit!, view)));
    }
    const limit = unit?.limitMax ? Math.floor((100 * (unit.limit ?? 0)) / unit.limitMax) : 0;
    views.forEach((view, i) => this.show(this.element.children[i] as HTMLButtonElement, view, limit));
  }

  private button(unit: Fighter, view: ButtonView): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `special-button${view.limit ? " limit" : ""}`;
    if (view.limit) {
      const word = document.createElement("span");
      word.className = "special-limit-word";
      word.textContent = "LIMIT";
      const bar = document.createElement("span");
      bar.className = "special-limit-bar";
      bar.append(document.createElement("span"));
      button.append(word, bar);
    } else {
      const picture = document.createElement("img");
      picture.src = this.pictureUrl(view.picture);
      picture.alt = "";
      picture.draggable = false;
      const wait = document.createElement("span");
      wait.className = "special-wait";
      button.append(picture, wait);
    }
    button.addEventListener("click", () => {
      const why = this.specials.press(unit, view.slot);
      if (why) {
        this.told(why);
      }
      this.update();
    });
    return button;
  }

  /** A button's state now: ready or waiting (its seconds), and the LIMIT bar. */
  private show(button: HTMLButtonElement, view: ButtonView, limit: number): void {
    const ready = view.wait === 0 && view.why === "";
    const title = ready ? view.name : `${view.name}: ${view.why || `ready in ${view.wait} s`}`;
    if (button.title !== title) {
      button.title = title;
      button.setAttribute("aria-label", title);
    }
    button.classList.toggle("waiting", !ready);
    const wait = button.querySelector(".special-wait");
    if (wait) {
      wait.textContent = view.wait ? String(view.wait) : "";
    }
    const filled = button.querySelector<HTMLElement>(".special-limit-bar span");
    if (filled) {
      filled.style.width = `${limit}%`;
    }
  }
}
