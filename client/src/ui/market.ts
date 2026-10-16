// The market's window (CLIENT.md, "The market"), opened by "Visit Market"
// on the market's card, as in the Flash client: six of the game's trade
// cards, buying wood, stone and food along the top and selling them below,
// each with its lot (100, 200 or 300 by the market's level), its price in
// gold and its button; then the trades left today. A trade happens at
// once, the prices change on every card, and the command goes with the
// town's others. The rules are rules/market.ts.

import type { Command } from "../net/commands.ts";
import { GOOD_NAMES, MARKET_GOODS, lotOf, priceOf, trade, tradesLeft, type Good, type MarketRules, type MarketState } from "../rules/market.ts";
import type { PlacedItem, Town } from "../rules/town.ts";
import { ICONS } from "./icons.ts";
import { Panel } from "./panel.ts";

/** The game's words: "Buy", "sell", "Trades left today:", and its two warnings. */
export interface MarketWords {
  buy: string;
  sell: string;
  tradesLeft: string;
  /** No trades left. */
  noTrades: string;
  /** Not the goods to sell: "You don't have enough wood to sell!" (the game's line names wood whatever the good). */
  noGoods: string;
}

export interface MarketParts {
  town: Town;
  rules: MarketRules;
  state: MarketState;
  /** The server's time, in seconds. */
  clock: () => number;
  words: MarketWords;
  send: (command: Command) => void;
  /** The town's gold and goods changed (the top bar). */
  changed: () => void;
  /** A trade done, for the goals: the good and how much, sold as a negative amount. */
  traded: (good: Good, amount: number) => void;
  tell: (text: string) => void;
  /** Not the gold to buy: the bank, with why. */
  bank: (why: string) => void;
}

export class MarketWindow {
  private readonly panel = new Panel("market", "Market", { className: "market-window" });
  private readonly parts: MarketParts;
  private lot = 0;

  constructor(parts: MarketParts) {
    this.parts = parts;
  }

  /** The window's button for a market of the player's (not the allies' market), or null. */
  buttonFor(placed: PlacedItem): { label: string; icon: "open-market"; run: () => void } | null {
    if (lotOf(placed.item, this.parts.rules) === null) {
      return null;
    }
    return { label: "Visit Market", icon: "open-market", run: () => this.open(placed) };
  }

  open(placed: PlacedItem): void {
    this.lot = lotOf(placed.item, this.parts.rules) ?? this.parts.rules.lots[0];
    this.panel.title = placed.item.name;
    this.render();
    this.panel.open();
  }

  get isOpen(): boolean {
    return this.panel.isOpen;
  }

  private render(): void {
    const { rules, state, words } = this.parts;
    const grid = document.createElement("div");
    grid.className = "market-trades";
    for (const sell of [false, true]) {
      for (const good of MARKET_GOODS) {
        grid.append(this.card(good, sell));
      }
    }
    const left = document.createElement("p");
    left.className = "market-left";
    left.innerHTML = `<span></span> <b></b>`;
    left.querySelector("span")!.textContent = words.tradesLeft;
    left.querySelector("b")!.textContent = String(tradesLeft(rules, state));
    this.panel.body.replaceChildren(grid, left);
  }

  /** One of the game's trade cards: the lot and its good, the price in gold, Buy or sell. */
  private card(good: Good, sell: boolean): HTMLElement {
    const { rules, state, words } = this.parts;
    const name = GOOD_NAMES[good];
    const price = priceOf(rules, state, good, this.lot, sell);
    const card = document.createElement("div");
    card.className = `market-trade ${sell ? "sells" : "buys"}`;
    card.style.backgroundImage = `url("${ICONS["market-card"]}")`;
    card.innerHTML = `
      <p class="market-lot"><b></b><img alt=""></p>
      <p class="market-price"><b></b><img alt="gold"></p>
      <button class="market-do" type="button"></button>`;
    card.querySelector(".market-lot b")!.textContent = `${this.lot}x`;
    const picture = card.querySelector<HTMLImageElement>(".market-lot img")!;
    picture.src = ICONS[name];
    picture.alt = name;
    card.querySelector(".market-price b")!.textContent = String(price);
    card.querySelector<HTMLImageElement>(".market-price img")!.src = ICONS.gold;
    const button = card.querySelector<HTMLButtonElement>(".market-do")!;
    button.style.backgroundImage = `url("${ICONS["market-button"]}")`;
    button.textContent = sell ? words.sell : words.buy;
    button.setAttribute("aria-label", `${sell ? "Sell" : "Buy"} ${this.lot} ${name} for ${price} gold`);
    button.addEventListener("click", () => this.trade(good, sell));
    return card;
  }

  private trade(good: Good, sell: boolean): void {
    const { town, rules, state, words } = this.parts;
    const done = trade(town, state, rules, good, this.lot, sell, this.parts.clock());
    if ("refused" in done) {
      if (done.refused === "no-trades") {
        this.parts.tell(words.noTrades.trim());
      } else if (done.refused === "no-goods") {
        this.parts.tell(words.noGoods.replace("wood", GOOD_NAMES[good]));
      } else {
        this.parts.bank(`Not enough gold: it takes ${priceOf(rules, state, good, this.lot, false)}.`);
      }
      return;
    }
    this.parts.send(done.command);
    this.parts.traded(good, sell ? -this.lot : this.lot);
    this.parts.changed();
    this.render();
  }
}
