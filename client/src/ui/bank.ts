// The bank (bank.py, the same as on the classic game's page): 2,000 of a
// resource for 1 cash, up to 5 cash a day, and the game's own trade the
// other way, cash for gold. It opens from the + on the gold and cash pills.
// The trades go to the server at once, so first the town's waiting
// commands go, so the bank counts what the player sees.

import { ICONS } from "./icons.ts";
import { Panel } from "./panel.ts";

const numbers = new Intl.NumberFormat("en-US");
const RESOURCES = [["g", "Gold", "gold"], ["w", "Wood", "wood"], ["f", "Food", "food"], ["s", "Stone", "stone"]] as const;

/** What the server's bank says (GET /bank). */
interface BankState {
  cash: number;
  resources: Record<string, number>;
  per_cash: number;
  per_day: number;
  left_today: number;
  gold_for_cash: [number, number];
  ok?: string;
  error?: string;
}

export interface BankParts {
  empire: string;
  csrf: string;
  /** Send the town's waiting commands; false when they couldn't go. */
  flush: () => Promise<boolean>;
  /** The bank changed the town's numbers: cash, and the resources by letter. */
  changed: (cash: number, resources: Record<string, number>) => void;
  /** The game's own trade: cash for gold, as a command (exchange_cash_new); false when there isn't the cash. */
  cashForGold: () => boolean;
}

export class BankWindow {
  private readonly panel = new Panel("bank", "Bank", { className: "list-window bank" });
  private readonly parts: BankParts;
  private amount = 1;
  private state: BankState | null = null;

  constructor(parts: BankParts) {
    this.parts = parts;
  }

  async open(): Promise<void> {
    this.panel.open();
    this.say("Counting your treasury…");
    if (!(await this.parts.flush())) {
      this.say("The bank can't be reached right now. Please try again in a moment.");
      return;
    }
    await this.ask("GET");
  }

  private async ask(method: "GET" | "POST", resource = ""): Promise<void> {
    if (method === "POST" && !(await this.parts.flush())) {
      this.render("The bank can't be reached right now. Please try again in a moment.");
      return;
    }
    const url = `/bank?empire=${encodeURIComponent(this.parts.empire)}`;
    try {
      const response = await fetch(url, method === "GET" ? {} : {
        method: "POST", body: new URLSearchParams({ csrf: this.parts.csrf, resource, cash: String(this.amount) }),
      });
      const state = (await response.json()) as BankState;
      if (state.cash === undefined) {
        this.say(state.error ?? "The bank can't be reached right now.");
        return;
      }
      this.state = state;
      this.parts.changed(state.cash, state.resources);
      this.render(state.ok ?? state.error ?? "");
    } catch {
      this.say("The bank can't be reached right now. Please try again in a moment.");
    }
  }

  private say(text: string): void {
    const p = document.createElement("p");
    p.className = "rows-note";
    p.textContent = text;
    this.panel.body.replaceChildren(p);
  }

  private render(message: string): void {
    const state = this.state!;
    this.amount = Math.max(1, Math.min(this.amount, Math.max(state.left_today, 1)));
    const intro = document.createElement("p");
    intro.className = "rows-note";
    intro.innerHTML = `The bank trades <b>${numbers.format(state.per_cash)}</b> of one resource for <b>1 cash</b>, up to ${state.per_day} cash a day: <b>${state.left_today}</b> left today.`;

    const amount = document.createElement("div");
    amount.className = "bank-amount";
    amount.innerHTML = `<span>Cash to get</span>`;
    const less = this.button("−", () => this.step(-1), "One less");
    const more = this.button("+", () => this.step(1), "One more");
    const shown = document.createElement("output");
    shown.textContent = String(this.amount);
    amount.append(less, shown, more);

    const list = document.createElement("ul");
    list.className = "rows";
    for (const [letter, name, icon] of RESOURCES) {
      const have = state.resources[letter] ?? 0;
      const price = this.amount * state.per_cash;
      const row = document.createElement("li");
      row.className = "row";
      row.innerHTML = `<img class="row-icon" src="${ICONS[icon]}" alt=""><span class="row-text"><strong></strong><small></small></span>`;
      row.querySelector("strong")!.textContent = name;
      row.querySelector("small")!.textContent = `You have ${numbers.format(have)}`;
      const trade = this.button(`${numbers.format(price)} for ${this.amount} cash`, () => void this.ask("POST", letter),
        `Trade ${numbers.format(price)} ${name.toLowerCase()} for ${this.amount} cash`);
      trade.disabled = have < price || state.left_today < this.amount;
      row.append(trade);
      list.append(row);
    }

    const [cash, gold] = state.gold_for_cash;
    const other = document.createElement("div");
    other.className = "row";
    other.innerHTML = `<img class="row-icon" src="${ICONS.cash}" alt=""><span class="row-text"><strong>Cash for gold</strong><small></small></span>`;
    other.querySelector("small")!.textContent = `The game's own trade: ${cash} cash for ${numbers.format(gold)} gold`;
    other.append(this.button(`${numbers.format(gold)} gold`, () => {
      if (this.parts.cashForGold()) {
        state.cash -= cash;
        state.resources.g = (state.resources.g ?? 0) + gold;
        this.render(`${cash} cash for ${numbers.format(gold)} gold.`);
      } else {
        this.render(`Not enough cash: it takes ${cash}.`);
      }
    }, `Trade ${cash} cash for ${numbers.format(gold)} gold`));

    const note = document.createElement("p");
    note.className = "rows-note bank-message";
    note.setAttribute("role", "status");
    note.textContent = message;
    const more_ = document.createElement("p");
    more_.className = "rows-note";
    more_.textContent = "Cash also comes from levelling up, the daily bonus, Monday's chest and every new continent.";
    this.panel.body.replaceChildren(intro, amount, list, other, note, more_);
  }

  private step(by: number): void {
    const state = this.state!;
    this.amount = Math.max(1, Math.min(this.amount + by, Math.max(state.left_today, 1)));
    this.render("");
  }

  private button(label: string, run: () => void, aria = label): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "button tiny gold";
    button.textContent = label;
    if (aria !== label) {
      button.setAttribute("aria-label", aria);
    }
    button.addEventListener("click", run);
    return button;
  }
}
