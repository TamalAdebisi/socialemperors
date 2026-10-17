import "./dragonRiders.css";
import type { Command } from "../net/commands.ts";
import type { ItemInfo } from "../rules/config.ts";
import { inConstruction } from "../rules/construction.ts";
import { DRAGON_TAMING, RIDER_ACADEMY, RIDER_IDS, dragonMatches, matchingDragon, recoverRider, recoveryLeft, riderKinds,
  riderState, saveRider, trainRider, type RiderKind, type RiderState } from "../rules/dragonRiders.ts";
import { clockText } from "../rules/nest.ts";
import type { PlacedItem, Town } from "../rules/town.ts";
import { freeTileNear, letOut } from "../rules/work.ts";
import { iconImage } from "./icons.ts";
import { Panel } from "./panel.ts";
import { RiderAdventure } from "./riderAdventure.ts";

const pictures = import.meta.glob<string>("./art/riders/*.webp", { eager: true, query: "?url", import: "default" });
const art = (name: string) => pictures[`./art/riders/${name}.webp`] ?? "";
let fastTrain = false; // The original keeps this only for the current page session.

interface RiderParts {
  town: Town;
  items: Map<number, ItemInfo>;
  saved: Record<string, unknown>;
  globals: Record<string, unknown>;
  line: (id: number) => string;
  thumbnail: (item: ItemInfo) => string;
  riderPicture: (item: ItemInfo) => string;
  assets: string;
  clock: () => number;
  send: (commands: Command[]) => void;
  arrived: (placed: PlacedItem) => void;
  changed: () => void;
  bank: () => void;
  tell: (text: string) => void;
  paused: (pause: boolean) => void;
}

function text(tag: string, value: string, className = ""): HTMLElement {
  const element = document.createElement(tag);
  element.textContent = value;
  element.className = className;
  return element;
}
function button(value: string, run: () => void, className = ""): HTMLButtonElement {
  const element = document.createElement("button");
  element.type = "button";
  element.className = `button rider-button ${className}`;
  element.textContent = value;
  element.addEventListener("click", run);
  return element;
}
function image(url: string, label = "", className = ""): HTMLImageElement {
  const element = document.createElement("img");
  element.src = url;
  element.alt = label;
  element.className = className;
  element.draggable = false;
  return element;
}

export class DragonRidersWindow {
  private panel = new Panel("dragon-riders", "", { className: "rider-window", onClose: () => { clearInterval(this.timer); this.adventure.close(); } });
  private building: PlacedItem | null = null;
  private kinds: RiderKind[];
  private matches;
  private timer: ReturnType<typeof setInterval> | undefined;
  private drawn = "";
  private help = false;
  private adventure: RiderAdventure;
  private parts: RiderParts;

  constructor(parts: RiderParts) {
    this.parts = parts;
    this.kinds = riderKinds(parts.globals);
    this.matches = dragonMatches(parts.globals);
    this.adventure = new RiderAdventure(parts.assets, parts.paused);
  }

  windowOf(building: PlacedItem): { label: string; icon: "open-rider-training" | "open-dragon-taming"; run: () => void } | null {
    if (![RIDER_ACADEMY, DRAGON_TAMING].includes(building.item.id)) return null;
    return { label: "Open", icon: building.item.id === RIDER_ACADEMY ? "open-rider-training" : "open-dragon-taming", run: () => this.open(building) };
  }

  open(building: PlacedItem): void {
    this.building = building;
    if (!this.usable()) return;
    this.help = false;
    this.drawn = "";
    this.panel.title = this.word(building.item.id === RIDER_ACADEMY ? 1271 : 1279);
    this.panel.open();
    this.render();
    clearInterval(this.timer);
    this.timer = setInterval(() => this.render(), 1000);
  }

  private word(id: number, ...values: (string | number)[]): string {
    return values.reduce<string>((line, value, index) => line.replaceAll(`#${index}#`, String(value)), this.parts.line(id));
  }

  private apply(state: RiderState, commands: Command[]): void {
    if (!this.usable()) return;
    saveRider(this.parts.saved, state);
    this.parts.send(commands);
    this.drawn = "";
    this.render();
  }

  private render(): void {
    const building = this.building;
    if (!building || !this.panel.isOpen || !this.usable() || this.help) return;
    const state = riderState(this.parts.saved);
    const left = recoveryLeft(state, this.parts.clock());
    const key = JSON.stringify([state, left > 0, building.units]);
    if (this.drawn === key) {
      const timer = this.panel.body.querySelector(".rider-time");
      if (timer) timer.textContent = clockText(left);
      return;
    }
    this.drawn = key;
    this.panel.body.replaceChildren();
    this.panel.body.append(button("Help", () => this.showHelp(), "rider-help"));
    if (building.item.id === DRAGON_TAMING) this.taming(building);
    else if (!state.number) this.picker();
    else this.training(state, this.kinds[state.number - 1]!);
  }

  private picker(): void {
    const body = this.panel.body;
    body.append(text("h3", this.word(1272)));
    const list = text("div", "", "rider-choices");
    const compatible = text("div", "", "rider-compatible");
    const preview = (kind: RiderKind) => {
      compatible.replaceChildren(text("h3", this.word(1273)), text("p", this.word(1291, [15, 20, 25][kind.number - 1]!, [100, 150, 200][kind.number - 1]!)));
      const portraits = text("div", "", "rider-dragons");
      const ids = new Set(this.matches.filter((match) => match.rider === kind.number).map((match) => match.dragon));
      // The original's config item order, up to 48 portraits.
      for (const item of [...this.parts.items.values()].filter((item) => ids.has(item.id)).slice(0, 48)) {
        const portrait = image(this.parts.thumbnail(item), item.name);
        portrait.title = item.name;
        portraits.append(portrait);
      }
      compatible.append(portraits);
    };
    for (const kind of this.kinds) {
      const item = this.parts.items.get(kind.item);
      if (!item) continue;
      const card = text("div", "", "rider-choice");
      card.tabIndex = 0;
      card.addEventListener("mouseenter", () => preview(kind));
      card.addEventListener("focus", () => preview(kind));
      const portrait = button(item.name, () => preview(kind), "rider-preview");
      portrait.replaceChildren(image(this.parts.riderPicture(item), item.name));
      const choose = button(this.word(1269), () => {
        if (!this.usable() || riderState(this.parts.saved).number !== 0 || this.parts.town.level < kind.level) return;
        this.apply({ number: kind.number, step: 0, since: 0 }, [{ cmd: "rider_select", args: [kind.number] }]);
      }, "rider-choose");
      choose.setAttribute("aria-label", `Train ${item.name}`);
      choose.disabled = this.parts.town.level < kind.level;
      card.append(portrait, text("strong", item.name), choose);
      if (choose.disabled) card.append(text("small", `Unlock at level ${kind.level}`));
      list.append(card);
    }
    body.append(list, compatible);
  }

  private training(state: RiderState, kind: RiderKind): void {
    const item = this.parts.items.get(kind.item)!;
    const left = recoveryLeft(state, this.parts.clock());
    const body = this.panel.body;
    body.append(text("h3", item.name));
    const progress = text("div", "", "rider-progress");
    const bar = text("span", "", "rider-progress-bar");
    const fill = text("span", "", "rider-progress-fill");
    fill.style.width = `${Math.min(1, state.step / kind.steps) * 100}%`;
    bar.append(fill);
    progress.append(text("span", this.word(1275)), bar, text("strong", `${state.step}/${kind.steps}`, "rider-count"));
    const picture = image(art(`rider${kind.number}-level${Math.min(state.step + 1, kind.steps + 1)}`), "", "rider-progress-picture");
    body.append(progress, picture, text("p", this.word(1278)));
    const done = state.step >= kind.steps;
    const action = button(this.word(done ? 1270 : 1269), () => {
      if (recoveryLeft(riderState(this.parts.saved), this.parts.clock()) > 0) return;
      if (done) this.claim(kind);
      else void this.adventure.open(state.step + 1, kind.number, () => this.success(kind), () => {});
    }, "rider-action");
    action.disabled = left > 0;
    body.append(action);
    if (left > 0) {
      const timer = text("div", "", "rider-recovery");
      const recover = button(this.word(1277, kind.cash), () => this.recover(kind), "rider-recover");
      recover.append(iconImage("cash"));
      timer.append(text("span", this.word(1276)), text("strong", clockText(left), "rider-time"), recover);
      body.append(timer);
    } else if (fastTrain && !done) body.append(button("Fast train", () => this.success(kind), "rider-fast"));
  }

  private success(kind: RiderKind): void {
    if (!this.usable()) return;
    const next = trainRider(kind, riderState(this.parts.saved), this.parts.clock());
    if (next) this.apply(next.state, next.commands);
  }

  private recover(kind: RiderKind): void {
    if (!this.usable()) return;
    const state = riderState(this.parts.saved);
    if (state.number !== kind.number) return;
    if (!recoveryLeft(state, this.parts.clock())) return;
    const next = recoverRider(kind, state, this.parts.clock(), this.parts.town.cash);
    if (!next) { this.parts.bank(); return; }
    fastTrain = true;
    this.parts.town.cash -= kind.cash;
    this.parts.changed();
    this.apply(next.state, next.commands);
  }

  private spawn(item: ItemInfo, consumed: number[] = [], after: Command[] = []): boolean {
    if (!this.usable()) return false;
    const building = this.building!;
    const tile = freeTileNear(this.parts.town, building);
    if (!tile) { this.parts.tell(`There's no room around ${building.item.name}.`); return false; }
    const commands: Command[] = consumed.map((id) => ({ cmd: "pop_unit", args: [building.tx, building.ty, this.parts.town.id, id] }));
    if (consumed.length) { building.units = []; building.unitsInside = 0; building.startedAt = null; }
    const placed: PlacedItem = { item, tx: tile.x, ty: tile.y, orientation: 0, unitsInside: 0, units: [], startedAt: null, workTime: 0 };
    this.parts.town.items.push(placed);
    commands.push({ cmd: "buy", args: [item.id, tile.x, tile.y, 0, this.parts.town.id, 1, 1, "u"] });
    commands.push(...after);
    this.parts.send(commands);
    this.parts.arrived(placed);
    this.parts.changed();
    return true;
  }

  private claim(kind: RiderKind): void {
    const state = riderState(this.parts.saved);
    if (state.number !== kind.number || state.step < kind.steps || recoveryLeft(state, this.parts.clock()) > 0) return;
    // Reward and reset share the same batch, including retries or page exit.
    if (!this.spawn(this.parts.items.get(kind.item)!, [], [{ cmd: "rider_select", args: ["0"] }])) return;
    saveRider(this.parts.saved, { number: 0, step: 0, since: -1 });
    this.panel.close();
  }

  private taming(building: PlacedItem): void {
    const units = building.units ?? [];
    const match = matchingDragon(units, this.matches);
    const body = this.panel.body;
    body.append(text("h3", this.word(1280)));
    const slots = text("div", "", "rider-taming-slots");
    for (const isRider of [true, false]) {
      const id = units.find((id) => RIDER_IDS.some((rider) => rider === id) === isRider);
      const item = id === undefined ? undefined : this.parts.items.get(id);
      const slot = text("div", "", "rider-taming-slot");
      slot.append(image(item ? isRider ? this.parts.riderPicture(item) : this.parts.thumbnail(item) : art(isRider ? "rider-empty" : "dragon-empty"), "", "rider-taming-picture"),
        text("strong", item?.name ?? (isRider ? "Dragon Rider" : "Dragon")));
      if (item) slot.append(button(this.word(1268), () => {
        if (!this.usable()) return;
        const index = (building.units ?? []).indexOf(item.id);
        if (index < 0) { this.drawn = ""; this.render(); return; }
        const out = letOut(this.parts.town, building, this.parts.items, index);
        if (!out) { this.parts.tell(`There's no room around ${building.item.name}.`); return; }
        this.parts.send(out.commands);
        this.parts.arrived(out.unit);
        this.parts.changed();
        this.panel.close();
      }, "rider-take-out"));
      slots.append(slot);
    }
    body.append(slots, text("p", this.word(match ? 1282 : units.length === 2 ? 1283 : 1281), "rider-taming-info"));
    const tamed = match && this.parts.items.get(match.tamed);
    if (tamed) {
      const dragon = this.parts.items.get(match.dragon)!;
      const result = text("div", "", "rider-taming-result");
      result.append(image(this.parts.thumbnail(tamed), ""), text("strong", tamed.name),
        text("p", `Attack ${tamed.attack} · Health ${tamed.life} · Range ${tamed.attackRange} · Delay ${tamed.attackInterval}`),
        text("p", `${this.word(1290)} +${tamed.attack - dragon.attack} attack · +${tamed.life - dragon.life} health`));
      body.append(result);
    } else body.append(image(art("result-empty"), "", "rider-taming-empty-result"));
    body.append(button(this.word(1267), () => {
      if (!this.usable()) return;
      const current = matchingDragon(building.units ?? [], this.matches);
      const item = current && this.parts.items.get(current.tamed);
      if (!current || !item) { this.parts.tell(this.word((building.units?.length ?? 0) === 2 ? 1283 : 1284)); return; }
      void this.adventure.open(8, riderState(this.parts.saved).number, () => {
        const winning = matchingDragon(building.units ?? [], this.matches);
        if (winning?.tamed === current.tamed && this.parts.town.items.includes(building) && this.spawn(item, [...building.units!])) this.panel.close();
      }, () => {});
    }, "rider-tame"));
  }

  private showHelp(): void {
    if (!this.usable()) return;
    this.help = true;
    const taming = this.building?.item.id === DRAGON_TAMING;
    const words = text("p", this.word(taming ? 1285 : riderState(this.parts.saved).number ? 1287 : 1286), "rider-help-text");
    this.panel.body.replaceChildren(words, button("Back", () => { this.help = false; this.drawn = ""; this.render(); }));
  }

  private usable(): boolean {
    const building = this.building;
    if (building && this.parts.town.items.includes(building) && !building.ruined && !inConstruction(building, Date.now())) return true;
    this.panel.close();
    return false;
  }
}
