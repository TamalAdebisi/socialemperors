import { DartsGame, roundStart } from "../rules/darts.ts";
import type { ItemInfo } from "../rules/config.ts";
import type { Town } from "../rules/town.ts";
import type { Command } from "../net/commands.ts";
import { Panel } from "./panel.ts";

const BALLOON = new URL("./art/darts-balloon.webp", import.meta.url).href;
const TARGET = new URL("./art/darts-target.webp", import.meta.url).href;

interface Parts {
  game: DartsGame; town: Town; items: Map<number,ItemInfo>; clock: () => number;
  words: (id: number, fallback: string) => string;
  thumbnail: (item: ItemInfo) => string;
  send: (commands: Command[]) => void;
  changed: () => void;
}

export class DartsWindow {
  private readonly panel = new Panel("army", "Darts", { className: "darts" });
  private readonly parts: Parts;
  private armed = false;
  private last: { won: number; bonus: number | null } | null = null;

  constructor(parts: Parts) { this.parts = parts; }

  /** Opening checks the original date schedule and daily free throw. */
  open(armed = false): void {
    this.parts.send(this.parts.game.opening(this.parts.clock(), Math.floor(performance.now())));
    this.armed = armed; this.last = null;
    this.render(); this.panel.open();
  }

  offer(): void {
    const box = document.createElement("section"); box.className = "quest-window notice darts-offer";
    box.setAttribute("role", "dialog"); box.setAttribute("aria-label", "Free dart");
    const heading = document.createElement("h2"); heading.textContent = "Darts";
    const text = document.createElement("p");
    text.textContent = this.parts.words(1365, "A free dart is waiting for you!");
    const buttons = document.createElement("div"); buttons.className = "quest-buttons";
    buttons.append(this.button("Play", () => { box.remove(); this.open(true); }),
      this.button("Later", () => box.remove()));
    box.append(heading,text,buttons); document.body.append(box);
  }

  private render(): void {
    const { game, clock, words } = this.parts;
    const { current, next } = game.schedule(clock());
    const note = document.createElement("p"); note.className = "rows-note";
    if (!current) {
      note.textContent = words(1362, "Come back soon for more darts!");
      this.panel.body.replaceChildren(note); return;
    }
    const help = document.createElement("details");
    const summary = document.createElement("summary"); summary.textContent = "Help";
    const about = document.createElement("p"); about.textContent = words(1350,
      "Pop balloons to win units. One dart is free each day. Discover all six prizes for the extra reward.");
    help.append(summary,about);
    if (next) {
      const changes = document.createElement("p"); changes.className = "rows-note";
      changes.textContent = `Next round: ${new Date(roundStart(next.start_date)*1000).toLocaleDateString()}`;
      help.append(changes);
    }
    const end = game.shot.length === 25;
    note.textContent = end ? words(1362,"Come back soon for more darts!") : this.armed
      ? words(1359,"Choose a balloon to throw your dart.") : game.free ? "Your free dart is ready." : "One free dart each day.";
    const play = this.button(game.free ? "Play free" : `Play for ${game.cashCost} cash`, () => {
      this.armed = true; this.last = null; this.render();
    });
    play.disabled = end || (!game.free && this.parts.town.cash < game.cashCost);
    play.hidden = this.armed;
    const board = document.createElement("div"); board.className = `darts-board${this.armed ? " armed" : ""}`;
    board.setAttribute("aria-label", "Balloons");
    for (let index = 0; index < 25; index++) {
      const popped = game.shot.includes(index);
      const button = this.button(popped ? "" : String(index+1), () => {
        const result = game.shoot(this.parts.town,index,clock());
        if (!result) { this.open(); return; }
        this.parts.send(result.commands); this.parts.changed();
        this.last = result; this.armed = false; this.render();
      });
      button.dataset.balloon = String(index);
      button.className = `darts-balloon${popped ? " popped" : ""}`;
      button.setAttribute("aria-label", `${popped ? "Popped balloon" : "Balloon"} ${index+1}`);
      const picture = new Image(); picture.alt = "";
      const item = popped ? this.parts.items.get(current.items[game.prizes[index]]) : null;
      picture.src = item ? this.parts.thumbnail(item) : BALLOON;
      button.prepend(picture);
      if (!popped && this.armed) {
        const target = new Image(); target.src = TARGET; target.alt = ""; target.className = "darts-target";
        button.append(target);
      }
      button.disabled = popped || !this.armed;
      board.append(button);
    }
    const prizes = document.createElement("ul"); prizes.className = "darts-prizes";
    for (let index = 0; index < 6; index++) {
      const item = game.discovered.has(index) ? this.parts.items.get(current.items[index]) : null;
      const rarity = index < 2 ? words(1353,"Rare") : index < 4 ? words(1354,"Uncommon") : words(1355,"Common");
      const row = document.createElement("li");
      if (item) row.append(this.picture(item));
      row.append(`${rarity}: ${item?.name ?? "?"}`); prizes.append(row);
    }
    const extra = document.createElement("p");
    const reward = this.parts.items.get(current.extra_item);
    if (reward) extra.append(this.picture(reward));
    extra.append(`${words(1351,"Discover all six for the extra reward")}: ${reward?.name ?? current.extra_item}${game.extra ? " — Won!" : ""}`);
    const result = document.createElement("p"); result.className = "darts-result"; result.setAttribute("role", "status");
    if (this.last) {
      const won = this.parts.items.get(this.last.won);
      if (won) result.append(this.picture(won));
      result.append(`You won ${won?.name ?? this.last.won}. It is now in Storage.`);
      if (this.last.bonus) result.append(` Extra reward: ${this.parts.items.get(this.last.bonus)?.name ?? this.last.bonus}, also in Storage!`);
    }
    this.panel.body.replaceChildren(help,note,play,result,board,prizes,extra);
  }

  private picture(item: ItemInfo): HTMLImageElement {
    const image = new Image(); image.src = this.parts.thumbnail(item); image.alt = "";
    image.className = "collection-reward"; return image;
  }

  private button(label: string, run: () => void): HTMLButtonElement {
    const button = document.createElement("button"); button.type = "button";
    button.className = "button tiny gold"; button.textContent = label;
    button.addEventListener("click", run); return button;
  }
}
