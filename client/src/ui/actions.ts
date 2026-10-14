// The bar at the bottom of the screen for the thing selected on the map:
// its name and what can be done with it. Selling (or removing) asks first.

export interface ActionChoices {
  name: string;
  /** Each action: what to call when it's chosen, or null when it can't be done to this thing. */
  move: (() => void) | null;
  turn: (() => void) | null;
  store: (() => void) | null;
  sell: (() => void) | null;
  /** What selling gives back, to show before asking ("12 gold"), or "" for nothing. */
  refund: string;
  close: () => void;
}

export class ActionBar {
  private readonly bar: HTMLElement;
  /** The name shown by show(), to change in place (a countdown); null while a prompt shows. */
  private name: HTMLElement | null = null;

  constructor() {
    this.bar = document.createElement("nav");
    this.bar.className = "actions";
    this.bar.hidden = true;
    document.body.appendChild(this.bar);
  }

  show(choices: ActionChoices): void {
    this.bar.replaceChildren();
    const name = document.createElement("span");
    name.className = "actions-name";
    name.textContent = choices.name;
    this.bar.append(name);
    this.name = name;
    this.button("Move", choices.move);
    this.button("Turn", choices.turn);
    this.button("Store", choices.store);
    // Selling what gives nothing back (a rock, a free decoration) is just removing it.
    const sell = choices.sell;
    const verb = choices.refund ? "Sell" : "Remove";
    this.button(verb, sell && (() => this.confirm(`${verb} ${choices.name}${choices.refund ? ` for ${choices.refund}` : ""}?`, verb, sell)));
    this.button("✕", choices.close, "Close");
    this.bar.hidden = false;
  }

  /** Change the name show() put up, leaving its buttons be (they'd lose a click being replaced). */
  rename(text: string): void {
    if (this.name && this.name.textContent !== text) {
      this.name.textContent = text;
    }
  }

  /** A message with ways out, like "Tap where it goes" with Cancel. */
  prompt(text: string, actions: { label: string; run: () => void }[]): void {
    this.bar.replaceChildren();
    this.name = null;
    const message = document.createElement("span");
    message.className = "actions-name";
    message.textContent = text;
    this.bar.append(message);
    for (const action of actions) {
      this.button(action.label, action.run);
    }
    this.bar.hidden = false;
  }

  hide(): void {
    this.bar.hidden = true;
    this.bar.replaceChildren();
    this.name = null;
  }

  private confirm(question: string, verb: string, yes: () => void): void {
    this.prompt(question, [
      { label: verb, run: yes },
      { label: "Cancel", run: () => this.hide() },
    ]);
  }

  private button(label: string, run: (() => void) | null, title = label): void {
    if (run === null) {
      return;
    }
    const button = document.createElement("button");
    button.type = "button";
    button.className = label === "✕" ? "button tiny plain" : "button tiny gold";
    button.textContent = label;
    if (title !== label) {
      button.setAttribute("aria-label", title);  // what a screen reader says for "✕"
    }
    button.addEventListener("click", run);
    this.bar.append(button);
  }
}
