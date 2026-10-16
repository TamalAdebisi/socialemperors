// The tournament list and shared team box, in the same panel/sheet as the
// other windows. Entry, existing rooms and friends' creation stay in classic.
import type { ItemInfo } from "../rules/config.ts";
import { complexUnits, restoredTournamentTeam, TEAM_SLOTS, tournamentCards, tournamentTeamProblem,
  type TournamentCard, type TournamentInfo, type TournamentRules, type TournamentTab } from "../rules/tournaments.ts";
import { iconImage } from "./icons.ts";
import { Panel } from "./panel.ts";

export interface TournamentParts {
  rules: TournamentRules;
  items: Map<number, ItemInfo>;
  info: () => Promise<TournamentInfo>;
  choices: () => [number, number][];
  savedTeam: () => unknown;
  saveTeam: (team: number[]) => Promise<boolean>;
  words: (id: number) => string;
  pictureUrl: (file: string) => string;
  thumbnail: (id: number) => string;
  helpSeen: () => boolean;
  sawHelp: () => void;
  classicUrl: string;
  flush: () => Promise<boolean>;
}

function text<K extends keyof HTMLElementTagNameMap>(tag: K, value: string, className = ""): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  element.textContent = value;
  element.className = className;
  return element;
}
function button(label: string, run: () => void, className = "button small"): HTMLButtonElement {
  const element = text("button", label, className);
  element.type = "button";
  element.addEventListener("click", run);
  return element;
}
function clock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 86400)}d ${String(Math.floor(s / 3600) % 24).padStart(2, "0")}:${String(Math.floor(s / 60) % 60).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export class TournamentWindow {
  private readonly panel: Panel;
  private readonly parts: TournamentParts;
  private info: TournamentInfo | null = null;
  private team: number[] = [];
  private tab: TournamentTab = "everyday";
  private editing = false;
  private busy = false;
  private generation = 0;
  private fetchedAt = 0;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(parts: TournamentParts) {
    this.parts = parts;
    this.panel = new Panel("battle", "Tournaments", { className: "list-window tournament-window", onClose: () => {
      this.generation++;
      if (this.timer !== null) clearInterval(this.timer);
      this.timer = null;
    } });
  }

  async open(): Promise<void> {
    const generation = ++this.generation;
    this.editing = false;
    this.info = null;
    this.panel.title = "Tournaments";
    this.panel.body.replaceChildren(text("p", "Loading tournaments…"), this.classic("Open tournaments in classic"));
    this.panel.open();
    try {
      const info = await this.parts.info();
      if (generation !== this.generation) return;
      this.info = info;
      this.fetchedAt = Date.now();
      // A current room belongs to the later slices. In particular, do not
      // rewrite its team or silently clean a finished tournament.
      if (!info.tournament) {
        this.team = restoredTournamentTeam(this.parts.savedTeam(), this.parts.choices());
        if (!await this.parts.saveTeam(this.team)) throw new Error("Team not saved");
        if (generation !== this.generation) return;
      }
      this.render(true);
      if (!info.tournament && !this.parts.helpSeen()) {
        this.help();
        this.parts.sawHelp();
      }
      if (this.timer !== null) clearInterval(this.timer);
      this.timer = setInterval(() => this.countdowns(), 1000);
    } catch {
      if (generation !== this.generation) return;
      this.panel.body.replaceChildren(text("p", "Couldn't load or save your tournament details. Please try again.", "tournament-error"),
        button("Try again", () => void this.open()), this.classic("Open tournaments in classic"));
    }
  }

  private word(id: number, value?: string | number): string {
    return this.parts.words(id).replace("#0#", String(value ?? "")).trim();
  }

  /** Always flush before handing the same empire to classic. */
  private classic(label: string): HTMLAnchorElement {
    const link = text("a", label, "button small gold tournament-classic");
    link.href = this.parts.classicUrl;
    link.addEventListener("click", async (event) => {
      event.preventDefault();
      if (this.busy) return;
      this.busy = true;
      try {
        if (await this.parts.flush()) location.assign(link.href);
        else this.error("Your changes couldn't be saved. Reload before opening classic.");
      } finally {
        this.busy = false;
      }
    });
    return link;
  }

  private render(resetScroll = false): void {
    if (resetScroll) this.panel.body.scrollTop = 0;
    this.panel.title = this.editing ? this.word(1456) : "Tournaments";
    this.panel.body.replaceChildren();
    if (this.editing) {
      this.renderEditor();
      return;
    }
    const info = this.info!;
    if (info.tournament) {
      const room = info.tournament;
      const kind = this.parts.rules.kinds.find((kind) => String(kind.id) === String(room.tournament_type_id));
      this.panel.body.append(text("h3", kind?.name ?? "Your tournament"),
        text("p", room.date_finished !== null ? "Your tournament has finished." : room.date_ready !== null ? "Your tournament is ready." : "Your tournament is waiting for players.", "tournament-current"),
        this.classic("Continue your tournament in classic"),
        text("p", "Waiting rooms, matches and results are played in the classic game, on the same empire.", "rows-note"));
      return;
    }
    const bar = text("div", "", "tournament-tools");
    bar.append(button("Help", () => this.help()), button("Refresh", () => void this.open()));
    const tabs = text("div", "", "tournament-tabs");
    tabs.setAttribute("role", "group");
    tabs.setAttribute("aria-label", "Tournament lists");
    for (const [tab, label] of [["everyday", "Everyday"], ["weekly", "Weekly"], ["own", "Your own"]] as const) {
      const pick = button(label, () => { this.tab = tab; this.render(true); });
      pick.setAttribute("aria-pressed", String(this.tab === tab));
      tabs.append(pick);
    }
    const cards = tournamentCards(this.parts.rules, info, this.tab);
    const list = text("ul", "", "tournament-cards");
    for (const card of cards) list.append(this.card(card));
    if (!cards.length) list.append(text("li", this.tab === "weekly" ? "No weekly tournament available." : "No friends' tournaments waiting for you."));
    if (this.tab === "own") {
      const create = text("li", "", "tournament-card");
      create.append(this.picture("tournament_friends.jpg"), text("strong", this.word(1263)), text("p", this.word(1266)), this.classic("Create in classic"));
      list.append(create);
    }
    const box = text("section", "", "tournament-team-box");
    box.setAttribute("aria-label", this.word(1211));
    box.append(text("h3", this.word(1211)), this.slots(false), button("Edit team", () => {
      this.team = restoredTournamentTeam(this.parts.savedTeam(), this.parts.choices());
      this.editing = true;
      this.render(true);
    }));
    this.panel.body.append(bar, tabs, list, box,
      text("p", "Entering, matches and results continue in the classic game. Your saved team is shared.", "rows-note"));
    this.countdowns();
  }

  private picture(file: string): HTMLImageElement {
    const image = new Image();
    image.src = this.parts.pictureUrl(file);
    image.alt = "";
    image.className = "tournament-picture";
    return image;
  }

  private card(card: TournamentCard): HTMLLIElement {
    const row = text("li", "", "tournament-card");
    row.dataset.tournament = card.key;
    row.append(this.picture(card.kind.picture), text("strong", card.name));
    const fee = text("p", `${this.word(1237, card.kind.cost)} `, "tournament-fee");
    fee.append(iconImage(card.kind.resource_type === "c" ? "cash" : "gold"));
    row.append(fee);
    if (card.prize) {
      const prize = text("div", `${this.word(1236)}: `, "tournament-prize");
      for (const [resource, icon] of [["g", "gold"], ["c", "cash"]] as const) {
        if (Number(card.prize[resource]) > 0) prize.append(`${card.prize[resource]} `, iconImage(icon));
      }
      for (const [id, count] of Object.entries(card.prize.u ?? {})) {
        prize.append(this.thumb(Number(id)), text("span", `${count} × ${this.parts.items.get(Number(id))?.name ?? id}`));
      }
      row.append(prize);
    }
    if (card.weekly) {
      const timer = text("p", "", "tournament-countdown");
      timer.dataset.seconds = String(card.weekly.seconds);
      timer.dataset.label = this.word(card.weekly.open ? 1260 : 1259);
      row.append(timer, text("p", this.word(1295)));
      // Rank/prize windows are a later slice, still reachable in classic.
      row.append(this.classic(card.weekly.open ? "Enter / prizes in classic" : "View in classic"));
    } else row.append(this.classic("Enter in classic"));
    return row;
  }

  private countdowns(): void {
    const elapsed = (Date.now() - this.fetchedAt) / 1000;
    for (const timer of this.panel.body.querySelectorAll<HTMLElement>(".tournament-countdown")) {
      const left = Number(timer.dataset.seconds) - elapsed;
      timer.textContent = left > 0 ? `${timer.dataset.label} ${clock(left)}` : "Refresh to check availability.";
    }
  }

  private thumb(id: number): HTMLImageElement {
    const image = new Image();
    image.src = this.parts.thumbnail(id);
    image.alt = this.parts.items.get(id)?.name ?? String(id);
    image.title = image.alt;
    return image;
  }

  private slots(edit: boolean): HTMLOListElement {
    const slots = text("ol", "", "tournament-team");
    for (let i = 0; i < TEAM_SLOTS; i++) {
      const id = this.team[i];
      const slot = text("li", "");
      if (id) {
        if (edit) {
          const remove = button("", () => { this.team[i] = 0; this.render(); }, "tournament-unit");
          remove.setAttribute("aria-label", `Remove ${this.parts.items.get(id)?.name}`);
          remove.append(this.thumb(id));
          slot.append(remove);
        } else slot.append(this.thumb(id));
      } else slot.setAttribute("aria-label", `Empty place ${i + 1}`);
      slots.append(slot);
    }
    return slots;
  }

  private renderEditor(): void {
    const choices = this.parts.choices();
    const count = this.team.filter(Boolean).length;
    this.panel.body.append(text("h3", `${this.word(1454)}: ${count} / ${TEAM_SLOTS}`, "tournament-selected"), this.slots(true),
      text("p", `Dragons, gods and colossi: ${complexUnits(this.team, this.parts.items)} / ${this.parts.rules.complexLimit}`),
      text("h3", this.word(1455)));
    const units = text("div", "", "tournament-choices");
    for (const [id, n] of choices) {
      const item = this.parts.items.get(id)!;
      const left = n - this.team.filter((chosen) => chosen === id).length;
      const add = button("", () => {
        const slot = this.team.indexOf(0);
        if (slot >= 0 && left > 0) this.team[slot] = id;
        this.render();
      }, "tournament-choice");
      add.setAttribute("aria-label", `Add ${item.name}`);
      add.dataset.unit = String(id);
      add.disabled = left <= 0 || count === TEAM_SLOTS;
      add.append(this.thumb(id), text("span", item.name), text("small", `×${left}`));
      units.append(add);
    }
    if (!choices.length) units.append(text("p", "You have no eligible units yet."));
    const actions = text("div", "", "tournament-tools");
    const save = button("Save team", () => void this.save(), "button small gold");
    save.disabled = this.busy || (count === 0 && choices.length > 0);
    actions.append(save, button("Reset", () => { this.team = Array(TEAM_SLOTS).fill(0); this.render(); }),
      button("Cancel", () => { this.team = restoredTournamentTeam(this.parts.savedTeam(), choices); this.editing = false; this.render(true); }));
    this.panel.body.append(units, actions);
    if (this.busy) {
      for (const control of this.panel.body.querySelectorAll("button")) control.disabled = true;
    }
  }

  private async save(): Promise<void> {
    if (this.busy) return;
    const problem = tournamentTeamProblem(this.team, this.parts.choices(), this.parts.items, this.parts.rules);
    if (problem) {
      this.error(problem === "complex" ? this.word(1233, this.parts.rules.complexLimit) : problem === "empty" ? this.word(1213) : "Your available units have changed. Reopen the team box and choose again.");
      return;
    }
    this.busy = true;
    const generation = this.generation;
    this.render();
    try {
      if (await this.parts.saveTeam([...this.team])) {
        if (generation === this.generation) { this.editing = false; this.render(true); }
      } else this.error("Your team couldn't be saved. Reload and try again.");
    } catch {
      this.error("Your team couldn't be saved. Reload and try again.");
    } finally {
      this.busy = false;
    }
  }

  private error(message: string): void {
    this.panel.body.querySelector(".tournament-error")?.remove();
    const error = text("p", message, "tournament-error");
    error.setAttribute("role", "alert");
    this.panel.body.append(error);
    error.scrollIntoView({ block: "nearest" });
  }

  private help(): void {
    this.panel.body.querySelector(".tournament-help")?.remove();
    const box = text("div", "", "survival-help-box tournament-help");
    box.setAttribute("role", "note");
    const banned = [...this.parts.rules.banned].map((id) => this.parts.items.get(id)?.name ?? String(id)).join(", ");
    box.append(text("strong", this.word(1229)), text("p", this.word(1230, banned)), button("OK", () => box.remove(), "button small gold"));
    this.panel.body.prepend(box);
  }
}
