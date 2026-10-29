// The Soul Mixer uses the original later window's art and queue contract.
// Its archived content tables are required before any cash or units move.
import type { Command } from "../net/commands.ts";
import type { ItemInfo } from "../rules/config.ts";
import { SOUL_MIXER, claimMix, legacyMixWarning, mixRemaining, mixSpeedUpCash, mixingChoices, nextPowerup, powerupMix, previewMix, speedMix, startMix,
  type MixPreview, type MixerRules, type MixerState } from "../rules/soulMixer.ts";
import { letOut } from "../rules/work.ts";
import type { PlacedItem, Town } from "../rules/town.ts";
import { foodText } from "../rules/speedUps.ts";
import { duration } from "./format.ts";
import { Panel } from "./panel.ts";
import "./soulMixer.css";

interface MixerParts {
  town: Town;
  items: Map<number, ItemInfo>;
  rules: MixerRules;
  state: MixerState;
  clock: () => number;
  assets: string;
  thumbnail: (item: ItemInfo) => string;
  /** The unit drawn from its sprite sheet (view/unitPreview.ts): its silhouette keeps its shape. */
  preview?: (item: ItemInfo, canvas: HTMLCanvasElement, active: () => boolean, missing: () => void) => () => void;
  line: (id: number, fallback: string) => string;
  send: (command: Command) => void;
  changed: () => void;
  enter: (unit: PlacedItem, building: PlacedItem) => boolean;
  arrived: (unit: PlacedItem) => void;
  tell: (message: string) => void;
}

export class SoulMixerWindow {
  private readonly parts: MixerParts;
  private readonly panel = new Panel("soul-mixer", "Soul Mixer", { className: "list-window soul-mixer", onClose: () => this.stopClock() });
  private building: PlacedItem | null = null;
  private readonly previews = new WeakMap<PlacedItem, MixPreview>();
  private readonly parentKeys = new WeakMap<PlacedItem, string>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private mode: "main" | "help" | "choose" | "confirm" = "main";

  constructor(parts: MixerParts) {
    this.parts = parts;
    parts.town.soulMixerReady = parts.rules.missing.length === 0;
    for (const building of parts.town.items) {
      if (building.item.id === SOUL_MIXER && parts.state.queues.has(building.queueId ?? "")) building.soulMixing = true;
    }
  }

  buttonFor(building: PlacedItem): { label: string; icon: "open-soul-mixer"; run: () => void } | null {
    return building.item.id === SOUL_MIXER ? { label: "Soul Mixer", icon: "open-soul-mixer", run: () => this.open(building) } : null;
  }

  open(building: PlacedItem): void {
    this.building = building;
    this.syncParents();
    this.render();
    this.panel.open();
    this.stopClock();
    this.timer = setInterval(() => this.tick(), 1000);
  }

  private stopClock(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private button(label: string, run: () => void, disabled = false): HTMLButtonElement {
    const button = document.createElement("button");
    button.className = "button";
    button.type = "button";
    button.textContent = label;
    button.disabled = disabled;
    button.addEventListener("click", run);
    return button;
  }

  private makePreview(): void {
    const preview = previewMix(this.parts.rules, this.building?.units ?? []);
    if (preview && this.building) this.previews.set(this.building, preview);
  }

  private syncParents(): boolean {
    const building = this.building;
    if (!building || building.soulMixing) return false;
    const key = (building.units ?? []).join(",");
    if (this.parentKeys.get(building) === key) return false;
    this.parentKeys.set(building, key);
    this.previews.delete(building);
    this.makePreview();
    return true;
  }

  /** Keep help/selection and focused buttons intact while the original wait ticks. */
  private tick(): void {
    if (!this.building || this.mode !== "main") return;
    if (this.syncParents()) { this.render(); return; }
    const queue = this.parts.state.queues.get(this.building.queueId ?? "");
    const item = queue && this.parts.items.get(queue.unit);
    if (!queue || !item) return;
    const remaining = mixRemaining(queue, item, this.parts.clock());
    const status = remaining === null ? "unknown" : remaining === 0 ? "ready" : "waiting";
    const time = this.panel.body.querySelector<HTMLElement>(".soul-mixer-time");
    if (time?.dataset.status !== status) { this.render(); return; }
    if (remaining !== null && remaining > 0) {
      time.textContent = `${this.parts.line(1622, "Remaining time")}: ${duration(remaining)}`;
      const button = this.panel.body.querySelector<HTMLButtonElement>(".soul-mixer-speed");
      if (button) button.textContent = `${this.parts.line(1621, "Speed up")} · ${foodText(mixSpeedUpCash(remaining))} food`;
    }
  }

  private render(): void {
    this.mode = "main";
    const building = this.building;
    if (!building) return;
    const { rules, state, items, line } = this.parts;
    const art = document.createElement("img");
    art.className = "soul-mixer-scene";
    art.src = `${this.parts.assets}/externalized/SoulMixer/SoulMixer-background.jpg`;
    art.alt = "";
    const content = document.createElement("div");
    content.className = "soul-mixer-content";
    const help = this.button("Help", () => this.help());
    content.append(help);
    const queue = state.queues.get(building.queueId ?? "");
    if (rules.missing.length && !queue) {
      const unavailable = document.createElement("p");
      unavailable.className = "soul-mixer-unavailable";
      unavailable.textContent = "The original Soul Mixer rules are unavailable. Your units and cash are safe.";
      content.append(unavailable);
      content.append(this.button(line(1618, "Select unit"), () => {}, true), this.button(line(1620, "Start mixing"), () => {}, true));
      this.panel.body.replaceChildren(art, content);
      return;
    }
    const parents = document.createElement("div");
    parents.className = "soul-mixer-parents";
    for (let index = 0; index < 2; index++) {
      const item = items.get(building.units?.[index] ?? 0);
      const card = document.createElement("div");
      const picture = document.createElement("img");
      picture.src = item ? this.parts.thumbnail(item) : `${this.parts.assets}/externalized/SoulMixer/SoulMixer-no-soul-126x126.jpg`;
      picture.alt = item?.name ?? line(1616, "No soul");
      const name = document.createElement("p");
      name.textContent = item?.name ?? line(1616, "No soul");
      card.append(picture, name);
      if (!queue) {
        card.append(this.button(`${line(1618, "Select unit")} ${index + 1}`, () => this.choose(index)));
        if (item) card.append(this.button(`Remove ${item.name}`, () => this.remove(index)));
      }
      parents.append(card);
    }
    content.append(parents);
    const preview = this.previews.get(building);
    const result = queue ? items.get(queue.unit) : preview?.unit;
    if (result) {
      const remaining = queue ? mixRemaining(queue, result, this.parts.clock()) : null;
      if (remaining !== 0 && this.parts.preview) {
        // Until it's ready, its shadow: the sprite blackened, so its shape shows (the wiki's "shadows").
        const canvas = document.createElement("canvas");
        canvas.className = "soul-mixer-result silhouette";
        canvas.setAttribute("role", "img");
        canvas.setAttribute("aria-label", "Mixed unit silhouette");
        content.append(canvas);
        this.parts.preview(result, canvas, () => canvas.isConnected && this.panel.isOpen, () => {
          // No sprite sheet for it: its picture, darkened, instead.
          const picture = document.createElement("img");
          picture.className = "soul-mixer-result silhouette";
          picture.src = this.parts.thumbnail(result);
          picture.alt = "Mixed unit silhouette";
          canvas.replaceWith(picture);
        });
      } else {
        const picture = document.createElement("img");
        picture.className = "soul-mixer-result" + (remaining === 0 ? "" : " silhouette");
        picture.src = this.parts.thumbnail(result);
        picture.alt = remaining === 0 ? result.name : "Mixed unit silhouette";
        content.append(picture);
      }
      if (queue) {
        const time = document.createElement("p");
        time.className = "soul-mixer-time";
        time.dataset.status = remaining === null ? "unknown" : remaining === 0 ? "ready" : "waiting";
        time.textContent = remaining === null ? "The original mixing time is unavailable." : remaining === 0 ? result.name : `${line(1622, "Remaining time")}: ${duration(remaining)}`;
        content.append(time);
        if (remaining === 0) content.append(this.button(line(1628, "Get unit"), () => this.claim()));
        else if (remaining !== null && !rules.missing.length) {
          const speed = this.button(`${line(1621, "Speed up")} · ${foodText(mixSpeedUpCash(remaining))} food`, () => this.speed());
          speed.classList.add("soul-mixer-speed");
          content.append(speed);
        }
      } else {
        content.append(this.button(line(1620, "Start mixing"), () => this.start()));
        const powerup = nextPowerup(rules, preview!);
        if (powerup) content.append(this.button(`${line(1619, "Power up")} · ${powerup.cash} cash`, () => this.powerup()));
      }
    }
    this.panel.body.replaceChildren(art, content);
  }

  private resetConfirmed(run: () => void): void {
    const preview = this.previews.get(this.building!);
    if (!preview?.upgrades) { run(); return; }
    const warning = document.createElement("p");
    this.mode = "confirm";
    warning.textContent = this.parts.line(1627, "Changing a soul loses the power-ups for this mix.");
    this.panel.body.replaceChildren(warning, this.button("Continue", run), this.button("Cancel", () => this.render()));
  }

  private choose(index: number): void {
    this.resetConfirmed(() => {
      if (!this.liveBuilding() || this.parts.rules.missing.length) return;
      this.mode = "choose";
      const list = document.createElement("div");
      list.className = "soul-mixer-choices";
      for (const unit of mixingChoices(this.parts.town, this.parts.rules)) {
        list.append(this.button(unit.item.name, () => {
          if ((this.building!.units?.length ?? 0) > index && !this.takeOut(index)) return;
          if (this.parts.enter(unit, this.building!)) {
            this.syncParents();
          }
          this.render();
        }));
      }
      if (!list.childElementCount) list.textContent = "No eligible units are standing in your town.";
      this.panel.body.replaceChildren(list, this.button("Back", () => this.render()));
    });
  }

  private takeOut(index: number): boolean {
    const building = this.liveBuilding();
    if (!building || building.soulMixing) return false;
    const out = letOut(this.parts.town, this.building!, this.parts.items, index);
    if (!out) { this.parts.tell("There is no free space beside the Soul Mixer."); return false; }
    out.commands.forEach(this.parts.send);
    this.parts.arrived(out.unit);
    this.previews.delete(this.building!);
    this.parentKeys.delete(this.building!);
    return true;
  }

  private remove(index: number): void {
    this.resetConfirmed(() => { this.takeOut(index); this.render(); });
  }

  private powerup(): void {
    const preview = this.checkedPreview();
    if (!preview) return;
    const warning = legacyMixWarning(this.parts.town, this.building!);
    const refused = warning ?? powerupMix(this.parts.town, this.parts.rules, preview);
    if (refused) this.parts.tell(refused);
    this.parts.changed();
    this.render();
  }

  private start(): void {
    const preview = this.checkedPreview();
    if (!preview) return;
    const commands = startMix(this.parts.town, this.building!, this.parts.rules, this.parts.state, preview, this.parts.clock());
    if (typeof commands === "string") this.parts.tell(commands);
    else { commands.forEach(this.parts.send); this.building!.soulMixing = true; }
    this.parts.changed();
    this.render();
  }

  /** Map arrivals/card removals can precede the next UI tick. Never charge or start an older pair's result. */
  private checkedPreview(): MixPreview | null {
    const building = this.liveBuilding();
    if (!building || building.soulMixing) return null;
    if (this.syncParents()) {
      this.render();
      this.parts.tell("Your selected souls changed. Check the new preview.");
      return null;
    }
    const preview = this.previews.get(building);
    if (!preview) { this.render(); this.parts.tell("Select two units first."); return null; }
    return preview;
  }

  private speed(): void {
    const building = this.liveBuilding();
    if (!building) return;
    const queue = this.parts.state.queues.get(building.queueId ?? "");
    const item = queue && this.parts.items.get(queue.unit);
    if (!queue || !item) return;
    const command = speedMix(this.parts.town, building, this.parts.state, item, this.parts.clock(), this.parts.rules);
    if (typeof command === "string") this.parts.tell(command); else this.parts.send(command);
    this.parts.changed();
    this.render();
  }

  private claim(): void {
    const building = this.liveBuilding();
    if (!building) return;
    const claimed = claimMix(this.parts.town, building, this.parts.state, this.parts.items, this.parts.clock());
    if (typeof claimed === "string") { this.parts.tell(claimed); return; }
    claimed.commands.forEach(this.parts.send);
    this.building!.soulMixing = false;
    claimed.units.forEach(this.parts.arrived);
    this.previews.delete(this.building!);
    this.parts.changed();
    this.panel.close();
  }

  private liveBuilding(): PlacedItem | null {
    if (this.building?.item.id === SOUL_MIXER && this.parts.town.items.includes(this.building)) return this.building;
    this.panel.close();
    return null;
  }

  private help(): void {
    this.mode = "help";
    const help = document.createElement("div");
    help.className = "soul-mixer-help";
    for (let step = 1; step <= 4; step++) {
      const picture = document.createElement("img");
      picture.src = `${this.parts.assets}/externalized/popup_elements/popup_help_soul_mixer/${step}.png`;
      picture.alt = `Soul Mixer help ${step}`;
      help.append(picture);
    }
    this.panel.body.replaceChildren(help, this.button("Back", () => this.render()));
  }
}
