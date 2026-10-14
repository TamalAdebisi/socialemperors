// The card for the thing selected on the map, at the bottom middle (above
// the dock on a phone): its name, what it's doing, and what can be done
// with it, with the buttons of the Flash client's info panel. Selling (or
// removing) asks first. It also asks the player things ("Tap where it goes").

import { ICONS, type IconName } from "./icons.ts";

export interface ActionChoices {
  name: string;
  /** What it's doing ("ready in 2 h 13 min"), or "". */
  detail: string;
  /** Each action: what to call when it's chosen, or null when it can't be done to this thing. */
  move: (() => void) | null;
  turn: (() => void) | null;
  store: (() => void) | null;
  sell: (() => void) | null;
  /** What selling gives back, to show before asking ("12 gold"), or "" for nothing. */
  refund: string;
  /** Let one of the units inside out (null when nobody's inside). */
  letOut?: (() => void) | null;
  close: () => void;
}

export class ActionBar {
  private readonly bar: HTMLElement;
  /** The line under the name shown by show(), to change in place (a countdown); null while a prompt shows. */
  private detail: HTMLElement | null = null;
  private tiles: HTMLElement | null = null;

  constructor() {
    this.bar = document.createElement("nav");
    this.bar.className = "actions";
    this.bar.setAttribute("aria-label", "Selected");
    this.bar.hidden = true;
    document.body.appendChild(this.bar);
  }

  show(choices: ActionChoices): void {
    this.bar.replaceChildren();
    this.bar.classList.remove("asking");
    const name = document.createElement("span");
    name.className = "actions-name";
    name.textContent = choices.name;
    const detail = document.createElement("span");
    detail.className = "actions-detail";
    detail.textContent = choices.detail;
    this.detail = detail;
    const tiles = document.createElement("span");
    tiles.className = "actions-tiles";
    this.tiles = tiles;
    this.bar.append(name, detail, tiles);
    this.button("Let out", choices.letOut ?? null, "Let out", "population");
    this.button("Move", choices.move, "Move", "move");
    this.button("Turn", choices.turn, "Turn", "turn");
    this.button("Store", choices.store, "Store", "store");
    // Selling what gives nothing back (a rock, a free decoration) is just removing it.
    const sell = choices.sell;
    const verb = choices.refund ? "Sell" : "Remove";
    this.button(verb, sell && (() => this.confirm(`${verb} ${choices.name}${choices.refund ? ` for ${choices.refund}` : ""}?`, verb, sell)),
      verb, "remove");
    tiles.hidden = tiles.childElementCount === 0;
    this.closeButton(choices.close);
    this.bar.hidden = false;
  }

  /** Change the line show() put up, leaving its buttons be (they'd lose a click being replaced). */
  describe(text: string): void {
    if (this.detail && this.detail.textContent !== text) {
      this.detail.textContent = text;
    }
  }

  /** A message with ways out, like "Tap where it goes" with Cancel. */
  prompt(text: string, actions: { label: string; run: () => void }[]): void {
    this.bar.replaceChildren();
    this.bar.classList.add("asking");
    this.detail = null;
    const message = document.createElement("span");
    message.className = "actions-name";
    message.textContent = text;
    const choices = document.createElement("span");
    choices.className = "actions-choices";
    this.tiles = choices;
    this.bar.append(message, choices);
    for (const action of actions) {
      this.button(action.label, action.run);
    }
    this.bar.hidden = false;
  }

  hide(): void {
    this.bar.hidden = true;
    this.bar.replaceChildren();
    this.detail = null;
    this.tiles = null;
  }

  private confirm(question: string, verb: string, yes: () => void): void {
    this.prompt(question, [
      { label: verb, run: yes },
      { label: "Cancel", run: () => this.hide() },
    ]);
  }

  /** A button in the card's row; with `icon`, the info panel's picture over its name. */
  private button(label: string, run: (() => void) | null, title = label, icon?: IconName): void {
    if (run === null) {
      return;
    }
    const button = document.createElement("button");
    button.type = "button";
    if (icon) {
      button.className = "picture-button";
      button.innerHTML = `<img src="${ICONS[icon]}" alt=""><span></span>`;
      button.querySelector("span")!.textContent = label;
    } else {
      button.className = "button tiny gold";
      button.textContent = label;
    }
    if (title !== label) {
      button.setAttribute("aria-label", title);
    }
    button.addEventListener("click", run);
    (this.tiles ?? this.bar).append(button);
  }

  /** The game's close button, in the card's corner. */
  private closeButton(run: () => void): void {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "actions-close";
    button.setAttribute("aria-label", "Close");
    button.innerHTML = `<img src="${ICONS.close}" alt="">`;
    button.addEventListener("click", run);
    this.bar.append(button);
  }
}
