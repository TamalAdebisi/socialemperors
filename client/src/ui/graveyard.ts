// The graveyards and the Altar of Heroes (CLIENT.md, "The graveyard"), the
// windows their Open buttons show, as in the Flash client. The Graveyard
// brings fallen units back, for potions or for half their price; the
// Heroes' Graveyard brings heroes back for gold; the Altar sells heroes for
// cash. Each one stands beside its building. The rules are in
// rules/graveyard.ts; the commands are the Flash client's, sent at once:
// resurrect_hero, graveyard_buy_potions and buy_cash.

import type { ItemInfo } from "../rules/config.ts";
import { cantRevive, graveyardUnits, heroPrice, HEROES, revivalPrice, shortPrice, standBeside, unbury, type Dead } from "../rules/graveyard.ts";
import type { PlacedItem, Town } from "../rules/town.ts";
import { iconImage, type IconName } from "./icons.ts";
import { Panel } from "./panel.ts";

export interface GraveParts {
  town: Town;
  items: Map<number, ItemInfo>;
  /** Everybody fallen, heroes too (the save's deadHeroes): the windows take from it. */
  dead: Dead;
  /** The save's potions. */
  potions: { count: number };
  /** The potion pack (the config's GRAVEYARD_POTIONS): this many for this much cash. */
  pack: { amount: number; cash: number };
  thumbnail: (item: ItemInfo) => string;
  /** A hero's portrait, as the hero windows show it (buildingthumbs/<art>_altar.png). */
  heroPicture: (item: ItemInfo) => string;
  /** A command for the server, sent at once as the Flash client sends these. */
  send: (cmd: string, ...args: unknown[]) => void;
  /** Someone is back on the map: drawn, heard, with what it cost rising over it. */
  arrived: (placed: PlacedItem, lines: { text: string; resource: "gold" | "food" | "cash" | "xp" }[]) => void;
  /** Money or potions changed: redraw what shows them. */
  changed: () => void;
}

/** The picture, the name and a line under it: the start of every row here. */
function row(picture: string, name: string, line: string, className = ""): { row: HTMLLIElement; text: HTMLElement } {
  const item = document.createElement("li");
  item.className = `row grave-row ${className}`.trim();
  const image = document.createElement("img");
  image.className = "grave-picture";
  image.src = picture;
  image.alt = "";
  image.draggable = false;
  const text = document.createElement("span");
  text.className = "row-text";
  const strong = document.createElement("strong");
  strong.textContent = name;
  const small = document.createElement("small");
  small.textContent = line;
  text.append(strong, small);
  item.append(image, text);
  return { row: item, text };
}

/** A button with prices and their icons. */
function priceButton(prices: [number, IconName][], label: string, className: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `button tiny ${className}`;
  for (const [amount, icon] of prices) {
    button.append(shortPrice(amount), iconImage(icon));
  }
  button.setAttribute("aria-label", label);
  return button;
}

/** The Graveyard's window: the fallen of the town's race, six to a page in the original, here a list; the potions below. */
export class GraveyardWindow {
  private readonly panel = new Panel("graveyard", "Graveyard", { className: "list-window graveyard" });
  private readonly parts: GraveParts;
  private building: PlacedItem | null = null;
  private said = "";

  constructor(parts: GraveParts) {
    this.parts = parts;
  }

  open(building: PlacedItem): void {
    this.building = building;
    this.said = "";
    this.render();
    this.panel.open();
  }

  private tell(text: string): void {
    this.said = text;
    this.render();
  }

  private render(): void {
    const { parts } = this;
    const about = document.createElement("p");
    about.className = "rows-note";
    about.textContent = "Here you can revive your units you've lost in battles! Half their price, or potions.";
    const said = document.createElement("p");
    said.className = "rows-note grave-said";
    said.setAttribute("role", "status");
    said.textContent = this.said;

    const list = document.createElement("ul");
    list.className = "rows";
    const fallen = graveyardUnits(parts.dead, parts.items, parts.town.race);
    for (const { item, count } of fallen) {
      const { row: line } = row(parts.thumbnail(item), item.name, `×${count}`);
      const price = revivalPrice(item);
      const buttons = document.createElement("span");
      buttons.className = "grave-buttons";
      const potions = priceButton([[price.potions, "potion"]], `Resurrect ${item.name} for ${price.potions} potions`, "plain");
      // As the Flash client: the potion button only works with enough potions.
      potions.disabled = parts.potions.count < price.potions;
      potions.addEventListener("click", () => this.revive(item, true));
      const prices: [number, IconName][] = price.cash > 0 ? [[price.cash, "cash"]] : [[price.food, "food"], [price.gold, "gold"]];
      const pay = priceButton(prices, `Resurrect ${item.name} for ${prices.map(([n, r]) => `${n} ${r}`).join(" and ")}`, "gold");
      pay.addEventListener("click", () => this.revive(item, false));
      const label = document.createElement("small");
      label.textContent = "Resurrect for";
      buttons.append(label, potions, pay);
      line.append(buttons);
      list.append(line);
    }
    if (fallen.length === 0) {
      const empty = document.createElement("li");
      empty.className = "rows-note";
      empty.textContent = "You have no dead units!";
      list.append(empty);
    }

    const foot = document.createElement("div");
    foot.className = "mana-head grave-potions";
    const pill = document.createElement("span");
    pill.className = "pill-dark mana-pill";
    pill.append("Available", iconImage("potion", "potions"), String(parts.potions.count));
    const buy = priceButton([[parts.pack.cash, "cash"]], `Buy ${parts.pack.amount} potions for ${parts.pack.cash} cash`, "plain");
    buy.prepend(`Buy ${parts.pack.amount} ${parts.pack.amount === 1 ? "potion" : "potions"} for `);
    buy.addEventListener("click", () => this.buyPotions());
    foot.append(pill, buy);
    this.panel.body.replaceChildren(about, said, list, foot);
  }

  private revive(item: ItemInfo, withPotions: boolean): void {
    const { parts } = this;
    const { town } = parts;
    if (!this.building || !town.items.includes(this.building)) {
      return;  // stored or sold meanwhile: the Flash client's buttons do nothing then
    }
    const why = cantRevive(town, item, parts.items);
    if (why) {
      this.tell(why);
      return;
    }
    const price = revivalPrice(item);
    const lines: Parameters<GraveParts["arrived"]>[1] = [];
    if (withPotions) {
      if (parts.potions.count < price.potions) {
        return;
      }
      parts.potions.count -= price.potions;
    } else {
      // Each price in turn, food first, as the Flash client checks them.
      for (const [resource, amount] of [["food", price.food], ["gold", price.gold], ["cash", price.cash]] as const) {
        if (town[resource] < amount) {
          this.tell(`Not enough ${resource}: it takes ${amount}.`);
          return;
        }
      }
      for (const [resource, amount] of [["food", price.food], ["gold", price.gold], ["cash", price.cash]] as const) {
        if (amount > 0) {
          town[resource] -= amount;
          lines.push({ text: `−${amount} ${resource}`, resource });
        }
      }
    }
    const placed = standBeside(town, item, this.building);
    unbury(parts.dead, item.id);
    parts.send("resurrect_hero", item.id, placed.tx, placed.ty, town.id, withPotions ? "1" : "0");
    parts.arrived(placed, lines);
    parts.changed();
    // The window stays open: several can come back in a row.
    this.tell(`${item.name} is back.`);
  }

  private buyPotions(): void {
    const { parts } = this;
    if (parts.town.cash < parts.pack.cash) {
      // The original's words for this are missing from the game's texts: ours.
      this.tell(`You don't have enough cash to buy potions: it takes ${parts.pack.cash}.`);
      return;
    }
    parts.town.cash -= parts.pack.cash;
    parts.potions.count += parts.pack.amount;
    parts.send("graveyard_buy_potions");
    parts.changed();
    this.tell(`+${parts.pack.amount} ${parts.pack.amount === 1 ? "potion" : "potions"}.`);
  }
}

/** The Heroes' Graveyard's window: all eight heroes, how many have fallen, and their price in gold. */
export class HeroGraveWindow {
  private readonly panel = new Panel("heroes-grave", "Heroes' Graveyard", { className: "list-window graveyard" });
  private readonly parts: GraveParts;
  private building: PlacedItem | null = null;
  private said = "";

  constructor(parts: GraveParts) {
    this.parts = parts;
  }

  open(building: PlacedItem): void {
    this.building = building;
    this.said = "";
    this.render();
    this.panel.open();
  }

  private render(): void {
    const { parts } = this;
    const said = document.createElement("p");
    said.className = "rows-note grave-said";
    said.setAttribute("role", "status");
    said.textContent = this.said;
    const list = document.createElement("ul");
    list.className = "rows";
    for (const id of HEROES) {
      const hero = parts.items.get(id);
      if (!hero) {
        continue;
      }
      const count = parts.dead.get(id) ?? 0;
      const { row: line } = row(parts.heroPicture(hero), hero.name, `×${count}`, "hero-row");
      const price = heroPrice(hero);
      const buttons = document.createElement("span");
      buttons.className = "grave-buttons";
      const button = priceButton([[price, "gold"]], `Resurrect ${hero.name} for ${price} gold`, "gold");
      button.prepend("Resurrect ");
      button.disabled = count === 0;
      button.addEventListener("click", () => this.revive(hero));
      buttons.append(button);
      line.append(buttons);
      list.append(line);
    }
    const foot = document.createElement("p");
    foot.className = "rows-note";
    foot.textContent = "This building allows you to revive your dead heroes.";
    this.panel.body.replaceChildren(said, list, foot);
  }

  private revive(hero: ItemInfo): void {
    const { parts } = this;
    const { town } = parts;
    if (!this.building || !town.items.includes(this.building) || (parts.dead.get(hero.id) ?? 0) === 0) {
      return;
    }
    const price = heroPrice(hero);
    if (town.gold < price) {
      this.said = `Not enough gold: it takes ${price}.`;
      this.render();
      return;
    }
    // As the Flash client: no check on room for people here, and the hero's experience comes again.
    town.gold -= price;
    town.xp += hero.xp;
    const placed = standBeside(town, hero, this.building);
    unbury(parts.dead, hero.id);
    parts.send("resurrect_hero", hero.id, placed.tx, placed.ty, town.id);
    parts.arrived(placed, [{ text: `−${price} gold`, resource: "gold" }, { text: `+${hero.xp} XP`, resource: "xp" }]);
    parts.changed();
    this.panel.close();  // the original closes it after each one
  }
}

/** The Altar of Heroes' window: the eight heroes for cash, each from its level. */
export class AltarWindow {
  private readonly panel = new Panel("altar", "Altar of Heroes", { className: "list-window graveyard" });
  private readonly parts: GraveParts;
  private building: PlacedItem | null = null;
  private said = "";

  constructor(parts: GraveParts) {
    this.parts = parts;
  }

  open(building: PlacedItem): void {
    this.building = building;
    this.said = "";
    this.render();
    this.panel.open();
  }

  private render(): void {
    const { parts } = this;
    const said = document.createElement("p");
    said.className = "rows-note grave-said";
    said.setAttribute("role", "status");
    said.textContent = this.said;
    const list = document.createElement("ul");
    list.className = "rows";
    for (const id of HEROES) {
      const hero = parts.items.get(id);
      if (!hero) {
        continue;
      }
      const facts = `Attack ${hero.attack} · Life ${hero.life} · Range ${hero.attackRange}`;
      const { row: line } = row(parts.heroPicture(hero), hero.name, facts, "hero-row");
      const buttons = document.createElement("span");
      buttons.className = "grave-buttons";
      const locked = parts.town.level < hero.minLevel;
      const button = priceButton([[hero.cashCost, "cash"]], `Get ${hero.name} for ${hero.cashCost} cash`, "plain");
      button.prepend("Get Hero! ");
      button.disabled = locked;
      button.addEventListener("click", () => this.buy(hero));
      buttons.append(button);
      if (locked) {
        const level = document.createElement("small");
        level.textContent = `Level ${hero.minLevel}`;
        buttons.append(level);
      }
      line.append(buttons);
      list.append(line);
    }
    const foot = document.createElement("p");
    foot.className = "rows-note";
    foot.textContent = "This building allows you to invoke powerful heroes.";
    this.panel.body.replaceChildren(said, list, foot);
  }

  private buy(hero: ItemInfo): void {
    const { parts } = this;
    const { town } = parts;
    if (!this.building || !town.items.includes(this.building) || town.level < hero.minLevel) {
      return;
    }
    if (town.cash < hero.cashCost) {
      this.said = `Not enough cash: ${hero.name} takes ${hero.cashCost}.`;
      this.render();
      return;
    }
    // As the Flash client: cash and the hero's experience, no check on room for people.
    town.cash -= hero.cashCost;
    town.xp += hero.xp;
    const placed = standBeside(town, hero, this.building);
    parts.send("buy_cash", hero.id, placed.tx, placed.ty, 0, town.id);
    parts.arrived(placed, [{ text: `−${hero.cashCost} cash`, resource: "cash" }, { text: `+${hero.xp} XP`, resource: "xp" }]);
    parts.changed();
    this.panel.close();
  }
}

/** The buildings with these windows, and which window each opens. */
export const GRAVEYARD_BUILDING = 486;
export const HEROES_GRAVE_BUILDING = 239;
export const ALTAR_BUILDING = 150;

/** All three windows for a town, and the Open button for a building that has one. */
export class Graveyards {
  readonly graveyard: GraveyardWindow;
  readonly heroes: HeroGraveWindow;
  readonly altar: AltarWindow;

  constructor(parts: GraveParts) {
    this.graveyard = new GraveyardWindow(parts);
    this.heroes = new HeroGraveWindow(parts);
    this.altar = new AltarWindow(parts);
  }

  /** The selected building's Open button, or null. */
  windowOf(placed: PlacedItem): { label: string; run: () => void } | null {
    switch (placed.item.id) {
      case GRAVEYARD_BUILDING:
        return { label: "Open", run: () => this.graveyard.open(placed) };
      case HEROES_GRAVE_BUILDING:
        return { label: "Open", run: () => this.heroes.open(placed) };
      case ALTAR_BUILDING:
        return { label: "Open", run: () => this.altar.open(placed) };
    }
    return null;
  }
}
