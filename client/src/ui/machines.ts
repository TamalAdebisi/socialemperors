// The special buildings' original time packets and island looks, fitted
// into the shared panel/sheet. Changes save before a travelling reload.
import { machineRules, packDuration, skinUnlocked, timePackets, TIME_MACHINE, TIME_MACHINE_HELP, WEATHER_MACHINE, WEATHER_SKINS, WEATHER_PICTURES } from "../rules/machines.ts";
import type { GameConfig } from "../rules/config.ts";
import type { PlacedItem, Town } from "../rules/town.ts";
import { iconImage, type IconName } from "./icons.ts";
import { Panel } from "./panel.ts";

const PACK_PICTURES = [
  new URL("./art/time-packet-0.webp", import.meta.url).href,
  new URL("./art/time-packet-1.webp", import.meta.url).href,
  new URL("./art/time-packet-2.webp", import.meta.url).href,
  new URL("./art/time-packet-3.webp", import.meta.url).href,
  new URL("./art/time-packet-4.webp", import.meta.url).href,
  new URL("./art/time-packet-5.webp", import.meta.url).href,
];

export interface MachineParts {
  town: Town;
  config: GameConfig;
  saved: Record<string, unknown>;
  words: (id: number) => string;
  picture: (name: string) => string;
  send: (cmd: string, ...args: unknown[]) => Promise<boolean>;
  changed: () => void;
  travel: (message: string) => void;
}

function button(label: string, run: () => void, price?: number): HTMLButtonElement {
  const made = document.createElement("button");
  made.type = "button";
  made.className = "button small plain";
  made.textContent = label;
  if (price !== undefined) made.append(` ${price}`, iconImage("cash"));
  made.addEventListener("click", run);
  return made;
}

export class Machines {
  private readonly time = new Panel("time-machine", "Time Machine", { className: "list-window machine-window time-machine" });
  private readonly weather = new Panel("weather-machine", "Weather Machine", { className: "list-window machine-window weather-machine" });
  private readonly rules;
  private readonly counts;
  private building: PlacedItem | null = null;
  private busy = false;
  private said = "";
  private help = false;
  private failed = false;

  private readonly parts: MachineParts;

  constructor(parts: MachineParts) {
    this.parts = parts;
    this.rules = machineRules(parts.config);
    this.counts = timePackets(parts.saved.countTimePacket, this.rules.packs.length);
  }

  windowOf(placed: PlacedItem): { label: string; run: () => void; icon?: IconName } | null {
    if (placed.item.id !== TIME_MACHINE && placed.item.id !== WEATHER_MACHINE) return null;
    return { label: placed.item.id === TIME_MACHINE ? "Open" : "Set weather", icon: placed.item.id === TIME_MACHINE ? "open-time-machine" : "open-weather-machine", run: () => this.open(placed) };
  }

  private open(building: PlacedItem): void {
    this.building = building;
    this.said = "";
    if (building.item.id === TIME_MACHINE) {
      const seen = Array.isArray(this.parts.saved.helpMap) ? this.parts.saved.helpMap : [];
      this.help = !seen.includes(TIME_MACHINE_HELP);
      if (this.help) {
        this.parts.saved.helpMap = [...seen, TIME_MACHINE_HELP];
        void this.parts.send("set_help_map", TIME_MACHINE_HELP);
      }
      this.renderTime();
      this.time.open();
    } else {
      this.renderWeather();
      this.weather.open();
    }
  }

  private valid(): boolean {
    return !this.busy && this.building !== null && this.parts.town.items.includes(this.building);
  }

  private status(): HTMLParagraphElement {
    const said = document.createElement("p");
    said.className = "rows-note machine-status";
    said.setAttribute("role", "status");
    said.textContent = this.said;
    if (this.failed) {
      said.append(" ", button("Reload saved town", () => this.parts.travel("Loading your Empire...")));
    }
    return said;
  }

  private renderTime(): void {
    const { parts } = this;
    this.time.title = parts.words(1439);
    const intro = document.createElement("p");
    intro.className = "rows-note";
    intro.textContent = parts.words(1440);
    const help = button("?", () => { this.help = !this.help; this.renderTime(); });
    help.setAttribute("aria-label", "Time Machine Help");
    const list = document.createElement("ul");
    list.className = "rows machine-packets";
    this.rules.packs.forEach((pack, index) => {
      const row = document.createElement("li");
      row.className = "row machine-packet";
      row.dataset.packet = String(index);
      const label = document.createElement("span");
      label.className = "row-text";
      const name = document.createElement("strong");
      name.textContent = `Forwards ${packDuration(pack)}`;
      const owned = document.createElement("small");
      owned.className = "machine-owned";
      owned.textContent = `Available: ${this.counts[index]}`;
      label.append(name, owned);
      const buy = button("Buy", () => void this.buyTime(index), pack.price);
      buy.setAttribute("aria-label", `Buy ${packDuration(pack)} for ${pack.price} cash`);
      const use = button("Use", () => void this.useTime(index));
      use.setAttribute("aria-label", `Use ${packDuration(pack)}`);
      buy.disabled = use.disabled = this.busy;
      const picture = new Image();
      picture.className = "machine-hourglass";
      picture.src = PACK_PICTURES[index];
      picture.alt = "";
      row.append(picture, label, buy, use);
      list.append(row);
    });
    const helpBox = document.createElement("div");
    helpBox.className = "machine-help rows-note";
    helpBox.hidden = !this.help;
    const title = document.createElement("h3");
    title.textContent = parts.words(1457);
    const text = document.createElement("p");
    text.textContent = parts.words(1458);
    helpBox.append(title, text, button("OK", () => { this.help = false; this.renderTime(); }));
    this.time.body.replaceChildren(intro, help, helpBox, this.status(), list);
  }

  private async buyTime(index: number): Promise<void> {
    if (!this.valid()) return;
    const price = this.rules.packs[index].price;
    if (this.parts.town.cash < price) {
      this.said = `Not enough cash: it takes ${price}.`;
      this.renderTime();
      return;
    }
    this.parts.town.cash -= price;
    this.counts[index]++;
    this.parts.saved.countTimePacket = this.counts;
    this.parts.changed();
    await this.save("buy_time_packet", [index], () => this.renderTime());
  }

  private async useTime(index: number): Promise<void> {
    if (!this.valid()) return;
    if (!this.counts[index]) {
      this.said = this.parts.words(1453);
      this.renderTime();
      return;
    }
    await this.save("time_ff", [index], () => this.renderTime(), `${this.parts.words(1447)} ${packDuration(this.rules.packs[index])}`);
  }

  private renderWeather(): void {
    const { parts } = this;
    const list = document.createElement("ul");
    list.className = "rows machine-looks";
    const names = [535, 536, 537, 538, 539, 1115];
    WEATHER_SKINS.forEach((skin, index) => {
      const row = document.createElement("li");
      row.className = "row machine-look";
      row.dataset.skin = String(skin);
      const label = document.createElement("strong");
      label.className = "row-text";
      label.textContent = parts.words(names[index]);
      const unlocked = skinUnlocked(parts.saved.unlockedSkins, skin);
      const selected = parts.town.skin === skin;
      const select = button(selected ? "Selected" : unlocked ? "Select" : "Unlock", () => void this.chooseSkin(skin), unlocked ? undefined : this.rules.skinPrice);
      select.setAttribute("aria-label", selected ? `${label.textContent}: selected` : unlocked ? `Select ${label.textContent}` : `Unlock ${label.textContent} for ${this.rules.skinPrice} cash`);
      select.disabled = selected || this.busy;
      const picture = new Image();
      picture.className = "machine-theme";
      picture.src = parts.picture(WEATHER_PICTURES[index]);
      picture.alt = "";
      row.append(picture, label, select);
      list.append(row);
    });
    this.weather.body.replaceChildren(this.status(), list);
  }

  private async chooseSkin(skin: number): Promise<void> {
    if (!this.valid() || skin === this.parts.town.skin) return;
    if (!skinUnlocked(this.parts.saved.unlockedSkins, skin)) {
      if (this.parts.town.cash < this.rules.skinPrice) {
        this.said = `Not enough cash: it takes ${this.rules.skinPrice}.`;
        this.renderWeather();
        return;
      }
      this.parts.town.cash -= this.rules.skinPrice;
      this.parts.saved.unlockedSkins = { ...(this.parts.saved.unlockedSkins as Record<string, unknown> ?? {}), [skin]: "true" };
      this.parts.changed();
      if (!await this.save("unlock_skin", [String(skin)], () => this.renderWeather())) return;
      await this.save("set_skin", [this.parts.town.id, String(skin)], () => this.renderWeather(), "Loading your Empire...");
    } else {
      await this.save("set_skin", [this.parts.town.id, String(skin)], () => this.renderWeather(), "Loading your Empire...");
    }
  }

  private async save(command: string, args: unknown[], render: () => void, travelling?: string): Promise<boolean> {
    this.busy = true;
    this.said = "";
    render();
    let saved = false;
    try { saved = await this.parts.send(command, ...args); } catch { /* A failed batch stays queued for recovery. */ }
    if (saved && travelling) {
      this.parts.travel(travelling);
      return true;
    }
    this.busy = !saved;
    this.failed = !saved;
    if (!saved) this.said = "Your changes couldn't be saved. Reload before continuing.";
    render();
    // A player can close this panel and open the other machine while a
    // purchase saves. Refresh whichever is visible so it becomes usable.
    if (this.time.isOpen) this.renderTime();
    if (this.weather.isOpen) this.renderWeather();
    return saved;
  }
}
