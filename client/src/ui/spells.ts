// Spells in the new client's windows (CLIENT.md, "Spells"): the Wizardry
// Academy, where they're learnt (the Flash client's spell book window); the
// Wizard's mana bank; and the spell book at the bottom left in battle,
// whose spells are aimed with the game's own marker and cast with a tap.
// The rules are in rules/magic.ts; the commands are the Flash client's:
// buy_magic, buy_mana_new and use_magic, each sent at once.

import type { GameConfig } from "../rules/config.ts";
import { knownSpells, learn, learnProblem, manaForLevels, rankOf, readMagic, readSpells, type MagicState, type SpellInfo } from "../rules/magic.ts";
import type { Town } from "../rules/town.ts";
import { iconImage } from "./icons.ts";
import { Panel } from "./panel.ts";

const numbers = new Intl.NumberFormat("en-US");

export interface MagicParts {
  spells: SpellInfo[];
  state: MagicState;
  level: () => number;
  money: () => { gold: number; cash: number };
  /** Take gold or cash from the town (and show it); false when there isn't enough. */
  pay: (resource: "gold" | "cash", amount: number) => boolean;
  /** A command for the server, sent at once as the Flash client sends these. */
  send: (cmd: string, ...args: unknown[]) => void;
  town: number;
  /** The spell's picture (images_new/<art>.jpg). */
  pictureUrl: (spell: SpellInfo) => string;
  /** The mana bank: this much mana for this much gold, or cash. */
  bank: { amount: number; gold: number; cash: number };
  /** Something changed (mana, gold or cash): redraw what shows it. */
  changed: () => void;
  /** A battle mode may show a learnt spell but forbid casting it. */
  canCast?: (spell: SpellInfo) => boolean;
}

/** The parts for a town: its gold and cash pay, the config's spells and prices, the save's mana. */
export function magicParts(config: GameConfig, privateState: Record<string, unknown> | undefined, town: Town, assetsUrl: string,
  send: (cmd: string, ...args: unknown[]) => void, changed: () => void): MagicParts {
  const state = readMagic(privateState);
  // Levels gone up since the save was read bring their mana here too, as in the Flash client.
  const start = Number(config.globals?.START_LEVEL_MANA_REWARD) || 36;
  const perLevel = Number(config.globals?.MANA_REWARD_PER_LEVEL) || 2;
  const level = () => {
    state.level ??= town.level;
    if (town.level > state.level) {
      state.mana += manaForLevels(state.level, town.level, start, perLevel);
      state.level = town.level;
    }
    return town.level;
  };
  level();
  return {
    spells: readSpells(config),
    state,
    level,
    town: town.id,
    bank: {
      amount: Number(config.globals?.MANA_PER_PURCHASE) || 5,
      gold: Number(config.globals?.COST_MANA_GOLD) || 20000,
      cash: Number(config.globals?.COST_MANA_CASH) || 1,
    },
    money: () => ({ gold: town.gold, cash: town.cash }),
    pay: (resource, amount) => {
      if (town[resource] < amount) {
        return false;
      }
      town[resource] -= amount;
      return true;
    },
    send,
    pictureUrl: (spell) => `${assetsUrl}/images_new/${spell.art}.jpg`,
    changed,
  };
}

/** Buy mana with gold or cash: the Wizard's Resources Bank. */
function buyMana(parts: MagicParts, withCash: boolean): string {
  const price = withCash ? parts.bank.cash : parts.bank.gold;
  if (!parts.pay(withCash ? "cash" : "gold", price)) {
    return withCash ? "Not enough cash." : "Not enough gold.";
  }
  parts.state.mana += parts.bank.amount;
  parts.send("buy_mana_new", parts.town, withCash ? 1 : 0);
  parts.changed();
  return `${parts.bank.amount} mana bought.`;
}

/** The two ways to buy mana, as buttons; `told` hears what happened. */
function manaButtons(parts: MagicParts, told: (text: string) => void): HTMLElement {
  const row = document.createElement("div");
  row.className = "mana-bank";
  for (const withCash of [false, true]) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "button small plain";
    const price = withCash ? parts.bank.cash : parts.bank.gold;
    button.append(`${numbers.format(price)}`, iconImage(withCash ? "cash" : "gold", withCash ? "cash" : "gold"), "→",
      `${parts.bank.amount}`, iconImage("mana", "mana"));
    button.setAttribute("aria-label", `Buy ${parts.bank.amount} mana for ${numbers.format(price)} ${withCash ? "cash" : "gold"}`);
    button.addEventListener("click", () => told(buyMana(parts, withCash)));
    row.append(button);
  }
  return row;
}

function picture(parts: MagicParts, spell: SpellInfo, className: string): HTMLImageElement {
  const image = document.createElement("img");
  image.className = className;
  image.src = parts.pictureUrl(spell);
  image.alt = "";
  image.draggable = false;
  return image;
}

/** A spell's rank as the game's stars: 1 to 3 lit. */
function stars(rank: number): HTMLElement {
  const row = document.createElement("span");
  row.className = "spell-stars";
  for (let i = 1; i <= 3; i++) {
    row.append(iconImage(i <= rank ? "star-on" : "star-off"));
  }
  row.setAttribute("aria-label", `Rank ${rank} of 3`);
  return row;
}

/** The Wizardry Academy's window: every spell, learnt or not, and the mana bank. */
export class SpellsWindow {
  private readonly panel = new Panel("spells", "Wizardry Academy", { className: "list-window spells" });
  private readonly parts: MagicParts;
  private said = "";

  constructor(parts: MagicParts) {
    this.parts = parts;
  }

  open(): void {
    this.said = "";
    this.render();
    this.panel.open();
  }

  close(): void {
    this.panel.close();
  }

  private tell(text: string): void {
    this.said = text;
    this.render();
  }

  private render(): void {
    const { parts } = this;
    const head = document.createElement("div");
    head.className = "mana-head";
    const pill = document.createElement("span");
    pill.className = "pill-dark mana-pill";
    pill.append(iconImage("mana", "Mana"), numbers.format(parts.state.mana));
    pill.title = "Your mana: each cast takes some";
    head.append(pill, manaButtons(parts, (text) => this.tell(text)));
    const said = document.createElement("p");
    said.className = "rows-note spell-said";
    said.setAttribute("role", "status");
    said.textContent = this.said;

    const list = document.createElement("ul");
    list.className = "rows";
    for (const spell of parts.spells) {
      const casts = parts.state.casts[String(spell.id)];
      const known = casts !== undefined;
      const row = document.createElement("li");
      row.className = "row spell-row";
      const text = document.createElement("span");
      text.className = "row-text";
      const name = document.createElement("strong");
      name.textContent = spell.name;
      const about = document.createElement("small");
      about.textContent = spell.description;
      const facts = document.createElement("small");
      facts.className = "spell-facts";
      facts.append(iconImage("mana", "mana"), `${spell.mana}`);
      const [a1, a2, a3] = spell.areas;
      if (a3 > 1) {
        facts.append(` · area ${a1}, ${a2}, ${a3}`);
      }
      text.append(name, about, facts);
      row.append(picture(parts, spell, "spell-picture"), text);
      if (known) {
        const rank = rankOf(Number(casts));
        const next = rank === 1 ? 25 : rank === 2 ? 50 : 0;
        const done = document.createElement("span");
        done.className = "spell-known";
        done.append(stars(rank));
        const count = document.createElement("small");
        count.textContent = next ? `Cast ${casts} times: ${next - Number(casts)} more to rank ${rank + 1}` : `Cast ${casts} times`;
        done.append(count);
        row.append(done);
      } else {
        const buttons = document.createElement("span");
        buttons.className = "spell-learn";
        for (const withCash of [false, true]) {
          const button = document.createElement("button");
          button.type = "button";
          button.className = `button tiny ${withCash ? "plain" : "gold"}`;
          button.append(numbers.format(withCash ? spell.cash : spell.gold), iconImage(withCash ? "cash" : "gold"));
          button.setAttribute("aria-label", `Learn ${spell.name} for ${numbers.format(withCash ? spell.cash : spell.gold)} ${withCash ? "cash" : "gold"}`);
          // Gold only from the spell's level (the Flash client greys it out); cash any time.
          const locked = !withCash && parts.level() < spell.level;
          button.disabled = locked;
          if (locked) {
            button.title = `From level ${spell.level}`;
          }
          button.addEventListener("click", () => this.learn(spell, withCash));
          buttons.append(button);
        }
        if (parts.level() < spell.level) {
          const level = document.createElement("small");
          level.textContent = `Level ${spell.level}`;
          buttons.append(level);
        }
        row.append(buttons);
      }
      list.append(row);
    }
    this.panel.body.replaceChildren(head, said, list);
  }

  private learn(spell: SpellInfo, withCash: boolean): void {
    const { parts } = this;
    const why = learnProblem(spell, parts.state, parts.level(), parts.money(), withCash);
    if (why || !parts.pay(withCash ? "cash" : "gold", withCash ? spell.cash : spell.gold)) {
      this.tell(why || "Not enough to pay.");
      return;
    }
    learn(spell, parts.state);
    parts.send("buy_magic", spell.id, parts.town, withCash ? 1 : 0);
    parts.changed();
    this.tell(`${spell.name} learnt, with ${spell.mana} mana for its first cast.`);
  }
}

/**
 * The spell book in battle, at the bottom left: the book, the mana left,
 * and when the book is open, the spells learnt. Picking one starts aiming;
 * the book (or Escape) cancels. Too little mana opens the mana bank.
 */
export class SpellBook {
  private readonly parts: MagicParts;
  private readonly element = document.createElement("div");
  private readonly book = document.createElement("button");
  private readonly mana = document.createElement("button");
  private readonly list = document.createElement("ul");
  private readonly aim: (spell: SpellInfo | null) => void;
  private readonly academy: SpellsWindow;
  private readonly banks = new Set<HTMLElement>();
  private aiming: SpellInfo | null = null;

  /** `aim` hears the spell picked to aim, or null when aiming stops. */
  constructor(parts: MagicParts, aim: (spell: SpellInfo | null) => void) {
    this.parts = parts;
    this.aim = aim;
    // As in the Flash client, the book's "Open Book" opens the Academy's window, wherever the player is.
    this.academy = new SpellsWindow({ ...parts, changed: () => {
      parts.changed();
      this.update();
      if (!this.list.hidden) {
        this.fill();
      }
    } });
    this.element.className = "spell-book";
    this.book.type = "button";
    this.book.className = "spell-book-button";
    this.book.append(iconImage("spell-book"));
    const label = document.createElement("span");
    label.className = "spell-book-label";
    this.book.append(label);
    this.book.addEventListener("click", () => {
      if (this.aiming) {
        this.stopAiming();
      } else {
        this.toggle();
      }
    });
    this.mana.type = "button";
    this.mana.className = "pill-dark spell-mana";
    this.mana.addEventListener("click", () => this.openBank());
    this.list.className = "spell-list";
    this.list.hidden = true;
    this.element.append(this.list, this.book, this.mana);
    document.body.append(this.element);
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.aiming) {
        e.stopImmediatePropagation();
        this.stopAiming();
      }
    });
    this.update();
  }

  get isAiming(): SpellInfo | null {
    return this.aiming;
  }

  /** Off the screen: the battle is over. */
  hide(): void {
    this.element.remove();
    // These windows belong to this battle's book as well. Closing them
    // prevents new purchases after its final command flush has begun.
    this.academy.close();
    for (const bank of this.banks) bank.remove();
    this.banks.clear();
  }

  update(): void {
    const { state } = this.parts;
    this.mana.replaceChildren(iconImage("mana"), numbers.format(state.mana));
    this.mana.setAttribute("aria-label", `Mana: ${state.mana}. Buy more`);
    this.mana.title = "Your mana: tap to buy more";
    const label = this.book.querySelector(".spell-book-label")!;
    label.textContent = this.aiming ? "Cancel" : "Spells";
    this.book.setAttribute("aria-label", this.aiming ? `Stop aiming ${this.aiming.name}` : "Spell book");
    this.book.classList.toggle("cancel", this.aiming !== null);
  }

  private toggle(): void {
    if (this.list.hidden) {
      this.fill();
    }
    this.list.hidden = !this.list.hidden;
    this.book.setAttribute("aria-expanded", String(!this.list.hidden));
  }

  private fill(): void {
    const { parts } = this;
    this.list.replaceChildren();
    const known = knownSpells(parts.spells, parts.state);
    const open = document.createElement("li");
    open.className = "spell-open";
    const openButton = document.createElement("button");
    openButton.type = "button";
    openButton.className = "button tiny plain";
    openButton.textContent = "Open book";
    openButton.title = "Learn spells, buy mana";
    openButton.addEventListener("click", () => {
      this.list.hidden = true;
      this.academy.open();
    });
    open.append(openButton);
    if (known.length === 0) {
      const empty = document.createElement("li");
      empty.className = "spell-empty";
      empty.textContent = "No spells learnt yet.";
      this.list.append(empty, open);
      return;
    }
    for (const spell of known) {
      const item = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "spell-button";
      button.classList.toggle("short", parts.state.mana < spell.mana);
      button.title = `${spell.name}: ${spell.description}`;
      if (parts.canCast && !parts.canCast(spell)) {
        button.disabled = true;
        button.title = `${spell.name} cannot be used in tournaments.`;
      }
      button.setAttribute("aria-label", `Cast ${spell.name} (${spell.mana} mana)`);
      const cost = document.createElement("span");
      cost.className = "spell-cost";
      cost.textContent = String(spell.mana);
      button.append(picture(parts, spell, "spell-button-picture"), cost);
      button.addEventListener("click", () => {
        if (parts.state.mana < spell.mana) {
          // As the Flash client: not enough mana opens the bank.
          this.openBank(`${spell.name} takes ${spell.mana} mana.`);
          return;
        }
        this.list.hidden = true;
        this.aiming = spell;
        this.aim(spell);
        this.update();
      });
      item.append(button);
      this.list.append(item);
    }
    this.list.append(open);
  }

  stopAiming(): void {
    this.aiming = null;
    this.aim(null);
    this.update();
  }

  /** After a cast: aiming ends, the mana shows what's left. */
  cast(): void {
    this.stopAiming();
  }

  private openBank(why = ""): void {
    const box = document.createElement("section");
    box.className = "quest-window small";
    box.setAttribute("role", "dialog");
    const heading = document.createElement("h2");
    heading.textContent = "Wizard's Resources Bank";
    const text = document.createElement("p");
    text.textContent = `${why ? `${why} ` : ""}Get some mana to unleash your power! You have ${this.parts.state.mana}.`;
    const said = document.createElement("p");
    said.className = "spell-said";
    said.setAttribute("role", "status");
    const close = document.createElement("button");
    close.type = "button";
    close.className = "button gold";
    close.textContent = "Done";
    close.addEventListener("click", () => {
      box.remove();
      this.banks.delete(box);
    });
    const buttons = document.createElement("div");
    buttons.className = "quest-buttons";
    buttons.append(close);
    box.append(heading, text, manaButtons(this.parts, (message) => {
      said.textContent = message;
      text.textContent = `You have ${this.parts.state.mana} mana.`;
      this.update();
      if (!this.list.hidden) {
        this.fill();
      }
    }), said, buttons);
    document.body.append(box);
    this.banks.add(box);
    close.focus();
  }
}
