import type { Command } from "../net/commands.ts";
import type { ItemInfo } from "../rules/config.ts";
import type { Point } from "../rules/geometry.ts";
import { clockText } from "../rules/nest.ts";
import { SUPREME_DRAGON, TEMPLE_OFFERINGS, canOffer, claimTemple, offerAtTemple,
  readTemple, templeSeconds, writeTemple, type TempleChange, type TempleOffering } from "../rules/temple.ts";
import type { PlacedItem, Town } from "../rules/town.ts";
import { iconImage } from "./icons.ts";
import { Panel } from "./panel.ts";
import "./temple.css";

const ART = {
  illustration: new URL("./art/temple/illustration.webp", import.meta.url).href,
  selected: new URL("./art/temple/selected.webp", import.meta.url).href,
  tick: new URL("./art/temple/tick.webp", import.meta.url).href,
  button: new URL("./art/temple/button.webp", import.meta.url).href,
};

export interface TempleParts {
  town: Town;
  items: Map<number, ItemInfo>;
  privateState: Record<string, unknown>;
  /** Shared with the Academy, so buying or offering mana updates both. */
  magic: { mana: number };
  syncMana: () => void;
  line: (id: number) => string;
  thumbnail: (item: ItemInfo) => string;
  clock: () => number;
  available: () => boolean;
  send: (commands: Command[]) => Promise<boolean>;
  removed: (unit: PlacedItem) => void;
  prepareRemoval: (unit: PlacedItem) => Point;
  arrived: (unit: PlacedItem) => void;
  changed: () => void;
  spent: (resource: string, amount: number) => void;
}

/** The original freely selected offerings, timer, laws and sacrifice confirmation. */
export class TempleWindow {
  private readonly panel = new Panel("temple", "", { className: "temple-window", onClose: () => clearInterval(this.ticking) });
  private building: PlacedItem | null = null;
  private selected = 0;
  private ticking: ReturnType<typeof setInterval> | undefined;
  private showing: "temple" | "help" | "confirm" = "temple";
  private busy = false;
  private failed = false;
  private notice = "";
  private drawn = "";
  private waiting = false;
  private readonly parts: TempleParts;

  constructor(parts: TempleParts) { this.parts = parts; }

  open(building: PlacedItem): void {
    this.building = building;
    this.selected = TEMPLE_OFFERINGS.findIndex((_, i) => !this.state().done.includes(i));
    if (this.selected < 0) this.selected = 0;
    this.showing = "temple";
    this.waiting = templeSeconds(this.state(), this.parts.clock()) > 0;
    this.notice = "";
    this.drawn = "";
    this.panel.open();
    this.render();
    clearInterval(this.ticking);
    this.ticking = setInterval(() => this.render(), 1000);
  }

  private state() { return readTemple(this.parts.privateState); }
  private word(id: number, fallback = ""): string { return this.parts.line(id) || fallback; }

  private button(label: string, run: () => void): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "button temple-button";
    button.style.backgroundImage = `url("${ART.button}")`;
    button.textContent = label;
    button.addEventListener("click", run);
    return button;
  }

  private name(offering: TempleOffering): string {
    return offering.kind === "resource" ? `${offering.amount.toLocaleString("en-US")} ${offering.resource}`
      : this.parts.items.get(offering.item)?.name ?? String(offering.item);
  }

  private stepText(offering: TempleOffering, done: boolean, available: boolean): string {
    const text = offering.kind === "resource" ? this.word(done ? 1415 : available ? 1419 : 1387)
      : offering.kind === "collection" ? this.word(done ? 1418 : available ? 1422 : 1391)
      : this.word(done ? (offering.item === 853 || offering.item === 875 ? 1417 : 1416)
        : available ? (offering.item === 853 || offering.item === 875 ? 1421 : 1420)
          : (offering.item === 853 || offering.item === 875 ? 1398 : 1389));
    return text.replaceAll("#0#", this.name(offering));
  }

  private render(): void {
    this.parts.syncMana();
    const state = this.state(), seconds = templeSeconds(state, this.parts.clock());
    if (this.waiting && seconds === 0) {
      this.selected = Math.max(0, TEMPLE_OFFERINGS.findIndex((_, index) => !state.done.includes(index)));
    }
    this.waiting = seconds > 0;
    const available = this.parts.available() && !!this.building && this.parts.town.items.includes(this.building);
    const fingerprint = JSON.stringify([this.showing, this.selected, state, this.busy, this.failed, this.notice, available,
      TEMPLE_OFFERINGS.map((offering) => canOffer(this.parts.town, this.parts.magic.mana, offering)), seconds > 0]);
    if (fingerprint === this.drawn) {
      const clock = this.panel.body.querySelector(".temple-countdown");
      if (clock) clock.textContent = clockText(seconds);
      return;
    }
    this.drawn = fingerprint;
    this.panel.title = this.word(this.showing === "help" ? 1366 : 1394, "Supreme Bahamut Dragon Temple");
    if (this.showing === "help") {
      const help = document.createElement("p");
      help.className = "temple-help";
      help.textContent = this.word(1367);
      this.panel.body.replaceChildren(help, this.button("Back", () => { this.showing = "temple"; this.render(); }));
      return;
    }
    if (this.showing === "confirm") {
      const question = document.createElement("p");
      question.className = "temple-confirm";
      question.textContent = this.word(1368).replaceAll("#0#", this.name(TEMPLE_OFFERINGS[this.selected]));
      const buttons = document.createElement("div");
      buttons.className = "temple-confirm-buttons";
      buttons.append(this.button("Yes", () => void this.offer(true)), this.button("No", () => { this.showing = "temple"; this.render(); }));
      this.panel.body.replaceChildren(question, buttons);
      return;
    }
    const progress = document.createElement("div");
    progress.className = "temple-progress";
    const caption = document.createElement("span");
    caption.textContent = `${this.word(1395, "Progress")} ${state.done.length}/${TEMPLE_OFFERINGS.length}`;
    const bar = document.createElement("progress");
    bar.max = TEMPLE_OFFERINGS.length;
    bar.value = state.done.length;
    bar.setAttribute("aria-label", this.word(1395, "Progress"));
    const help = this.button("Help", () => { this.showing = "help"; this.render(); });
    progress.append(caption, bar, help);
    const strip = document.createElement("div");
    strip.className = "temple-offerings";
    strip.setAttribute("aria-label", "Temple offerings");
    TEMPLE_OFFERINGS.forEach((offering, index) => {
      const done = state.done.includes(index), can = canOffer(this.parts.town, this.parts.magic.mana, offering);
      const slot = document.createElement("button");
      slot.type = "button";
      slot.className = `temple-offering${done ? " done" : can ? "" : " unavailable"}`;
      slot.dataset.step = String(index);
      slot.setAttribute("aria-label", `${this.name(offering)}${done ? ", offered" : ""}`);
      slot.setAttribute("aria-pressed", String(index === this.selected));
      slot.title = this.stepText(offering, done, can);
      slot.disabled = this.busy || this.failed;
      const figure = document.createElement("span");
      figure.className = "temple-offering-picture";
      if (offering.kind === "resource") figure.append(iconImage(offering.resource), offering.amount >= 1000 ? "100k" : String(offering.amount));
      else {
        const image = document.createElement("img"), item = this.parts.items.get(offering.item);
        image.src = item ? this.parts.thumbnail(item) : "";
        image.alt = "";
        figure.append(image);
      }
      if (index === this.selected) figure.style.backgroundImage = `url("${ART.selected}")`;
      if (done) {
        const tick = document.createElement("img");
        tick.className = "temple-offering-tick";
        tick.src = ART.tick;
        tick.alt = "Offered";
        figure.append(tick);
      }
      const label = document.createElement("span");
      label.textContent = offering.kind === "resource" ? offering.resource : this.name(offering);
      slot.append(figure, label);
      slot.addEventListener("click", () => { this.selected = index; this.render(); });
      strip.append(slot);
    });
    const information = document.createElement("p");
    information.className = "temple-information";
    information.textContent = this.stepText(TEMPLE_OFFERINGS[this.selected], state.done.includes(this.selected),
      canOffer(this.parts.town, this.parts.magic.mana, TEMPLE_OFFERINGS[this.selected]));
    const picture = document.createElement("img");
    picture.src = ART.illustration;
    picture.alt = this.parts.items.get(SUPREME_DRAGON)?.name ?? "Supreme Bahamut Dragon";
    picture.className = "temple-illustration";
    const stats = document.createElement("p");
    stats.className = "temple-stats";
    const dragon = this.parts.items.get(SUPREME_DRAGON);
    stats.append(iconImage("stat-life"), String(dragon?.life ?? ""), iconImage("stat-attack"), String(dragon?.attack ?? ""));
    const action = document.createElement("div");
    action.className = "temple-action";
    if (seconds > 0) {
      const timer = document.createElement("p"), clock = document.createElement("strong");
      timer.append(`${this.word(1393, "Next Step in:")} `);
      clock.className = "temple-countdown";
      clock.textContent = clockText(seconds);
      timer.append(clock);
      action.append(timer);
    } else {
      const complete = state.done.length === TEMPLE_OFFERINGS.length;
      const offering = TEMPLE_OFFERINGS[this.selected];
      const button = this.button(complete ? this.word(1397, "Get Dragon") : this.word(offering.kind === "dragon" ? 1390 : 1388, "Offering"),
        () => complete ? void this.claim() : void this.offer());
      button.classList.add("temple-offer");
      button.disabled = this.busy || this.failed || !available || (!complete && (state.done.includes(this.selected) || !canOffer(this.parts.town, this.parts.magic.mana, offering)));
      action.append(button);
      if (complete) information.textContent = this.word(1396);
    }
    const notice = document.createElement("p");
    notice.className = "temple-notice";
    notice.setAttribute("role", "status");
    notice.textContent = this.failed ? "Your changes couldn't be confirmed. Reload before continuing." : this.busy ? "Saving…"
      : !available ? "The temple is unavailable during a battle or after it leaves the map." : this.notice;
    this.panel.body.replaceChildren(progress, strip, information, picture, stats, action, notice);
  }

  private usable(): boolean {
    return !this.busy && !this.failed && this.parts.available() && !!this.building && this.parts.town.items.includes(this.building);
  }

  private async offer(confirmed = false): Promise<void> {
    if (!this.usable()) return;
    const offering = TEMPLE_OFFERINGS[this.selected];
    if (offering.kind === "dragon" && !confirmed) { this.showing = "confirm"; this.render(); return; }
    this.parts.syncMana();
    const change = offerAtTemple(this.parts.town, this.parts.magic, this.state(), this.selected, this.parts.clock(), this.parts.prepareRemoval);
    this.showing = "temple";
    if (!change) { this.notice = this.word(1423, "You can't do that step!"); this.render(); return; }
    if (offering.kind === "resource") this.parts.spent(offering.key, offering.amount);
    await this.apply(change);
  }

  private async claim(): Promise<void> {
    if (!this.usable()) return;
    const change = claimTemple(this.parts.town, this.parts.items, this.building!, this.state(), this.parts.clock());
    if (change && await this.apply(change)) this.panel.close();
  }

  private async apply(change: TempleChange): Promise<boolean> {
    writeTemple(this.parts.privateState, change.state);
    if (change.removed) this.parts.removed(change.removed);
    if (change.placed) this.parts.arrived(change.placed);
    this.parts.changed();
    this.busy = true;
    this.render();
    try { this.failed = !await this.parts.send(change.commands); } catch { this.failed = true; }
    this.busy = false;
    this.render();
    return !this.failed;
  }
}
