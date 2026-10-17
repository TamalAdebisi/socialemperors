// Tournaments share the town's panel/sheet. The server owns seats, fees,
// match results and rewards; closing this window never leaves a room.
import type { ItemInfo } from "../rules/config.ts";
import { complexUnits, restoredTournamentTeam, TEAM_SLOTS, tournamentCards, tournamentTeamProblem,
  tournamentCategory, tournamentEntryProblem, tournamentEntryWarning, tournamentReady,
  type TournamentCard, type TournamentInfo, type TournamentRules, type TournamentTab,
  type TournamentRoom, type TournamentEntryReply, type TournamentMutationReply } from "../rules/tournaments.ts";
import { iconImage } from "./icons.ts";
import { Panel } from "./panel.ts";
import { TournamentResultsView, renderTournamentPrizes } from "./tournamentResults.ts";
import type { PlayerProfile } from "./worldMap.ts";

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
  flush: () => Promise<boolean>;
  me: string;
  level: () => number;
  balance: (resource: string) => number;
  refreshTown: () => Promise<void>;
  command: (name: string, ...args: unknown[]) => void;
  spent: (resource: string, amount: number) => void;
  now: () => number;
  join: (type: string, category: number, team: number[], room?: string) => Promise<TournamentEntryReply>;
  create: (type: string, team: number[]) => Promise<TournamentEntryReply>;
  leave: (room: string) => Promise<TournamentMutationReply>;
  cancel: (room: string) => Promise<TournamentMutationReply>;
  clean: (room: string) => Promise<TournamentMutationReply>;
  play: (room: string, victim: string) => Promise<void>;
  fetchProfile: (player: string) => Promise<PlayerProfile | null>;
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
  private profileRequest = 0;
  private fetchedAt = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private creating = false;
  private selectedKind = "";
  private results: TournamentResultsView | null = null;
  private refreshFailed = false;
  private waitingView = false;

  constructor(parts: TournamentParts) {
    this.parts = parts;
    this.panel = new Panel("battle", "Tournaments", { className: "list-window tournament-window", onClose: () => {
      this.generation++;
      if (this.timer !== null) clearInterval(this.timer);
      this.timer = null;
      this.results?.destroy();
      this.results = null;
    } });
  }

  async open(): Promise<void> {
    if (this.busy) return;
    this.results?.destroy();
    this.results = null;
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    const generation = ++this.generation;
    this.editing = false;
    this.creating = false;
    this.info = null;
    this.panel.title = "Tournaments";
    this.panel.body.replaceChildren(text("p", "Loading tournaments…"));
    this.panel.open();
    try {
      const info = await this.parts.info();
      if (generation !== this.generation) return;
      this.info = info;
      this.fetchedAt = Date.now();
      this.refreshFailed = false;
      this.waitingView = !!info.tournament && info.tournament.date_ready === null;
      await this.parts.refreshTown();
      if (generation !== this.generation) return;
      // Never rewrite the immutable army in a joined room.
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
        button("Try again", () => void this.open()));
    }
  }

  private word(id: number, value?: string | number): string {
    return this.parts.words(id).replace("#0#", String(value ?? "")).trim();
  }

  private render(resetScroll = false): void {
    this.profileRequest++;
    this.results?.destroy();
    this.results = null;
    if (resetScroll) this.panel.body.scrollTop = 0;
    this.panel.title = this.editing ? this.word(1456) : "Tournaments";
    this.panel.body.replaceChildren();
    if (this.editing) {
      this.renderEditor();
      return;
    }
    const info = this.info!;
    if (info.tournament) {
      this.room(info.tournament);
      return;
    }
    if (this.creating) {
      this.renderCreation();
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
      create.append(this.picture("tournament_friends.jpg"), text("strong", this.word(1263)), text("p", this.word(1266)),
        button("Create tournament", () => void this.beginCreation(), "button small gold"));
      list.append(create);
    }
    const box = text("section", "", "tournament-team-box");
    box.setAttribute("aria-label", this.word(1211));
    box.append(text("h3", this.word(1211)), this.slots(false), button("Edit team", () => void this.openEditor()));
    this.panel.body.append(bar, tabs, list, box);
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
      row.append(button("Prizes", () => {
        this.panel.body.querySelector(".tournament-prize-preview")?.remove();
        const preview = text("section", "", "tournament-prize-preview");
        preview.append(renderTournamentPrizes(card.kind, this.parts), button("Close prizes", () => preview.remove()));
        this.panel.body.prepend(preview);
        preview.scrollIntoView({ block: "nearest" });
      }));
    }
    if (this.creating) {
      const choose = button("Choose type", () => { this.selectedKind = String(card.kind.id); this.render(); });
      choose.setAttribute("aria-pressed", String(this.selectedKind === String(card.kind.id)));
      row.append(choose);
    } else {
      const enter = button("Enter tournament", () => void this.enter(card), "button small gold");
      enter.disabled = !!card.weekly && !card.weekly.open;
      row.append(enter);
    }
    return row;
  }

  private countdowns(): void {
    const elapsed = (Date.now() - this.fetchedAt) / 1000;
    for (const timer of this.panel.body.querySelectorAll<HTMLElement>(".tournament-countdown")) {
      const left = Number(timer.dataset.seconds) - elapsed;
      timer.textContent = left > 0 ? `${timer.dataset.label} ${clock(left)}` : "Refresh to check availability.";
    }
    const refresh = this.panel.body.querySelector(".tournament-room-refresh");
    if (refresh) {
      const left = Math.max(0, 60 - Math.floor(elapsed));
      refresh.textContent = this.refreshFailed ? "Couldn't refresh. Use Refresh to try again." : `Refresh in ${left}s`;
      if (left === 0 && !this.busy && !this.refreshFailed) void this.refresh().catch(() => {});
    }
  }

  private thumb(id: number): HTMLImageElement {
    const image = new Image();
    image.src = this.parts.thumbnail(id);
    image.alt = this.parts.items.get(id)?.name ?? String(id);
    image.title = image.alt;
    return image;
  }

  private renderCreation(): void {
    this.panel.title = "Create tournament";
    const list = text("ul", "", "tournament-cards");
    for (const card of tournamentCards(this.parts.rules, this.info!, "everyday")) list.append(this.card(card));
    const actions = text("div", "", "tournament-tools");
    const create = button("Create tournament", () => {
      const card = tournamentCards(this.parts.rules, this.info!, "everyday").find((c) => String(c.kind.id) === this.selectedKind);
      if (card) void this.enter(card, true);
    }, "button small gold");
    create.disabled = !this.selectedKind;
    actions.append(create, button("Cancel", () => { this.creating = false; this.render(true); }));
    this.panel.body.append(text("p", "Choose a tournament for your friends. At least three player neighbours are needed."), list, actions);
  }

  private async beginCreation(): Promise<void> {
    if (this.busy) return;
    const generation = this.generation;
    this.setBusy(true);
    try {
      await this.parts.refreshTown();
      if (generation !== this.generation || !this.validate(false)) return;
      if (tournamentEntryWarning(this.team) === "short" && !confirm(this.word(1214))) return;
      this.creating = true;
      this.selectedKind = "";
      this.render(true);
    } catch {
      if (generation === this.generation) this.error("Couldn't refresh your available units. Please try again before creating a tournament.");
    } finally {
      this.setBusy(false);
    }
  }

  private async openEditor(): Promise<void> {
    if (this.busy) return;
    const generation = this.generation;
    this.setBusy(true);
    try {
      await this.parts.refreshTown();
      if (generation !== this.generation) return;
      this.team = restoredTournamentTeam(this.parts.savedTeam(), this.parts.choices());
      this.editing = true;
      this.render(true);
    } catch {
      if (generation === this.generation) this.error("Couldn't refresh your available units. Please try opening the team box again.");
    } finally {
      this.setBusy(false);
    }
  }

  private validate(weekly: boolean): boolean {
    const problem = tournamentEntryProblem(this.team, this.parts.choices(), this.parts.items, this.parts.rules, weekly);
    if (problem) {
      this.error(problem === "complex" ? this.word(1233, this.parts.rules.complexLimit)
        : problem === "empty" ? this.word(1213) : "Your available units have changed. Reopen the team box and choose again.");
    }
    return !problem;
  }

  /** The service takes the fee. The original command is bookkeeping only. */
  private async enter(card: TournamentCard, create = false): Promise<void> {
    if (this.busy) return;
    const { kind } = card;
    const generation = this.generation;
    this.setBusy(true);
    try {
      await this.parts.refreshTown();
      if (generation !== this.generation || !this.validate(!!card.weekly)) return;
      const warning = tournamentEntryWarning(this.team, card.weekly ? card.weekly.seconds - (Date.now() - this.fetchedAt) / 1000 : undefined);
      if (!create && warning && !confirm(this.word(warning === "short" ? 1214 : 1298))) return;
      if (this.parts.balance(kind.resource_type) < Number(kind.cost)) {
        this.error(`Not enough ${kind.resource_type === "c" ? "cash" : "gold"} for this tournament.`);
        return;
      }
      this.parts.command("tournament_substract_resources", kind.resource_type, Number(kind.cost), String(kind.id), create || this.tab === "own" ? 1 : 0);
      if (!await this.parts.flush()) throw new Error("Your team couldn't be saved. Reload before entering.");
      if (generation !== this.generation) return;
      let reply: TournamentEntryReply;
      let confirmedEntry = false;
      try {
        reply = create ? await this.parts.create(String(kind.id), [...this.team])
          : await this.parts.join(String(kind.id), tournamentCategory(this.parts.level()), [...this.team], this.tab === "own" ? card.key : "");
        confirmedEntry = reply.result === "OK";
      } catch {
        // An entry may have succeeded before its answer was lost. Read the
        // saved room instead of repeating the fee or assuming it failed.
        const current = await this.parts.info();
        if (!current.tournament) throw new Error("Entry couldn't be confirmed. Refresh before trying again.");
        reply = { ...current, result: "OK" };
      }
      if (reply.result !== "OK" && reply.resources?.refund) {
        this.parts.command("tournament_refund_resources", kind.resource_type, Number(kind.cost));
      }
      // A reconciled room might have been joined in another tab. Only the
      // service's own success confirms this particular entry fee was paid.
      if (confirmedEntry) this.parts.spent(kind.resource_type, Number(kind.cost));
      let balanceFailed = false;
      try { await this.parts.refreshTown(); } catch { balanceFailed = true; }
      if (generation !== this.generation) return;
      if (reply.result === "OK") {
        this.info = reply;
        this.creating = false;
        this.waitingView = !!reply.tournament && reply.tournament.date_ready === null;
        this.fetchedAt = Date.now();
        this.render(true);
      } else {
        this.info = await this.parts.info();
        if (generation !== this.generation) return;
        this.fetchedAt = Date.now();
        this.creating = false;
        this.render(true);
        this.error(reply.result === "NOFRIENDS" ? this.word(1252) : reply.result === "NOTEAM" ? "Your team is not eligible. Edit your team and try again." : "This tournament is no longer available, or you cannot afford its entry fee. Please check the refreshed list.");
        if (reply.result === "NOFRIENDS") this.invite(false);
      }
      if (balanceFailed) this.error("Your tournament state is saved, but your town's balance could not refresh. Please use Refresh before spending again.");
    } catch (error) {
      if (generation === this.generation) this.error(error instanceof Error ? error.message : "Entry couldn't be confirmed. Please refresh.");
    } finally {
      this.setBusy(false);
    }
  }

  private room(room: TournamentRoom): void {
    const kind = this.parts.rules.kinds.find((kind) => String(kind.id) === String(room.tournament_type_id));
    if (!kind) {
      this.panel.body.append(text("p", "This tournament type is unavailable."));
      return;
    }
    this.panel.title = kind.name;
    const ready = tournamentReady(room, kind);
    if ((ready && !this.waitingView) || room.date_finished !== null) {
      this.results = new TournamentResultsView({ ...this.parts, room, kind,
        play: (victim) => this.parts.play(room.tournament_id, victim),
        acknowledge: () => this.exitRoom(room, true), refresh: () => this.refresh(), leave: () => this.exitRoom(room),
        profile: (player) => this.profile(player),
      });
      this.panel.body.append(this.results.element);
      return;
    }
    const body = text("section", "", "tournament-room");
    body.append(this.picture(kind.picture), text("h3", ready ? this.word(1192) : "Waiting for players", "tournament-current"));
    const seats = text("ol", "", "tournament-seats");
    for (let i = 0; i < Number(kind.num_players || 4); i++) {
      const player = room.players[i];
      const seat = text("li", "", "tournament-seat");
      if (player) {
        const bot = kind.weekly_opponent?.[player.user_id];
        if (bot) {
          const image = this.picture(String(bot.picture));
          image.className = "tournament-portrait";
          seat.append(image);
        } else seat.append(text("span", (player.user_name || "?").slice(0, 1).toUpperCase(), "tournament-initial"));
        const name = bot ? text("strong", player.user_name) : button(player.user_name, () => {
          void this.profile(player.user_id).catch(() => this.error("Couldn't load this player's profile. Please try again."));
        }, "button tiny plain");
        seat.append(name, text("small", `Level ${player.level}${player.country ? ` · ${player.country}` : ""}`));
      } else seat.append(text("span", "", "tournament-empty-seat"), text("strong", `Player ${i + 1}`), text("small", "Waiting…"));
      seats.append(seat);
    }
    const controls = text("div", "", "tournament-tools");
    controls.append(button("Refresh", () => void this.refresh().catch(() => {})));
    const owner = String(room.private) === "1" && room.owner_id === this.parts.me && !ready;
    controls.append(button(owner ? "Cancel tournament" : "Leave tournament", () => void this.exitRoom(room).catch((e: unknown) => this.error(String(e)))));
    if (owner) controls.append(button("Invite friends", () => this.invite(true)));
    const start = button("Start tournament", () => { this.waitingView = false; this.render(true); }, "button small gold");
    start.disabled = !ready;
    controls.append(start);
    const mine = room.players.find((p) => p.user_id === this.parts.me);
    this.team = mine?.team ?? Array(TEAM_SLOTS).fill(0);
    body.append(seats, text("p", ready ? this.word(1193) : `Empty seats get computer players after ${String(room.private) === "1" ? "24 hours" : "30 minutes"}. You can close this window and come back.`),
      text("p", "", "tournament-room-refresh"), controls, text("h3", this.word(1211)), this.slots(false));
    this.panel.body.append(body);
    this.countdowns();
  }

  /** Reconcile external entrants, host cancellation, timeouts and prizes. */
  private async refresh(): Promise<void> {
    if (this.busy) return;
    const generation = this.generation;
    this.setBusy(true);
    try {
      const next = await this.parts.info();
      await this.parts.refreshTown();
      if (generation !== this.generation) return;
      const changedRoom = this.info?.tournament?.tournament_id !== next.tournament?.tournament_id;
      this.info = next;
      this.fetchedAt = Date.now();
      this.refreshFailed = false;
      this.panel.body.querySelectorAll(".tournament-error").forEach((error) => error.remove());
      if (!next.tournament) {
        this.team = restoredTournamentTeam(this.parts.savedTeam(), this.parts.choices());
        if (changedRoom && !await this.parts.saveTeam(this.team)) throw new Error("Team not saved");
        if (generation !== this.generation) return;
        this.waitingView = false;
      } else if (changedRoom) this.waitingView = next.tournament.date_ready === null;
      if (this.results && next.tournament && !changedRoom) this.results.update(next.tournament);
      else this.render();
    } catch {
      this.refreshFailed = true;
      if (generation === this.generation) this.error("Couldn't refresh your tournament. Your last saved room is still shown; try Refresh again.");
      throw new Error("Couldn't refresh your tournament. Please try again.");
    } finally {
      this.setBusy(false);
    }
  }

  private async exitRoom(room: TournamentRoom, clean = false): Promise<void> {
    if (this.busy) return;
    const cancel = String(room.private) === "1" && room.owner_id === this.parts.me && room.date_ready === null;
    if (!clean && !confirm(this.word(cancel ? 1253 : 1231))) return;
    const generation = this.generation;
    this.setBusy(true);
    try {
      if (!await this.parts.flush()) throw new Error("Save failed. Reload before leaving.");
      const reply = clean ? await this.parts.clean(room.tournament_id) : cancel ? await this.parts.cancel(room.tournament_id) : await this.parts.leave(room.tournament_id);
      const kind = this.parts.rules.kinds.find((k) => String(k.id) === room.tournament_type_id);
      if (reply.resources?.refund && kind) this.parts.command("tournament_refund_resources", kind.resource_type, Number(kind.cost));
      const next = await this.parts.info();
      await this.parts.refreshTown();
      if (generation !== this.generation) return;
      this.info = next;
      this.waitingView = !!next.tournament && next.tournament.date_ready === null;
      this.team = restoredTournamentTeam(this.parts.savedTeam(), this.parts.choices());
      if (!next.tournament && !await this.parts.saveTeam(this.team)) throw new Error("Team not saved");
      if (generation !== this.generation) return;
      this.fetchedAt = Date.now();
      this.render(true);
    } catch {
      // Leave, cancel and clean are safe to repeat for this saved room. Keep
      // it visible on failure so the user can reconcile with Refresh.
      throw new Error("Couldn't confirm the change. Refresh your tournament before trying again.");
    } finally {
      this.setBusy(false);
    }
  }

  private invite(tournament: boolean): void {
    this.panel.body.querySelector(".tournament-invite")?.remove();
    const box = text("section", "", "survival-help-box tournament-invite");
    const link = text("a", "Open Everybody", "button small gold");
    link.href = "/friends";
    link.target = "_blank";
    link.rel = "noopener";
    const community = "Other players' empires are neighbours automatically. No friend requests needed. ";
    box.append(text("h3", "Invite friends"), text("p", community + (tournament
      ? "They find this waiting room under Tournaments → Your own. Ask them to join there. Empty seats get computer players after a day."
      : "You need at least three player neighbours to create a tournament. Find players on Everybody.")),
    link, button("OK", () => box.remove()));
    this.panel.body.prepend(box);
    box.scrollIntoView({ block: "nearest" });
  }

  private async profile(player: string): Promise<void> {
    const generation = this.generation;
    const room = this.info?.tournament?.tournament_id;
    const request = ++this.profileRequest;
    const current = () => generation === this.generation && request === this.profileRequest
      && room === this.info?.tournament?.tournament_id;
    let shown: PlayerProfile | null;
    try {
      shown = await this.parts.fetchProfile(player);
    } catch (error) {
      if (current()) throw error;
      return;
    }
    // A refresh can replace the room without closing this window. A later
    // profile choice or closing the shown profile also supersedes this read.
    if (!current()) return;
    this.panel.body.querySelector(".tournament-profile")?.remove();
    const box = text("section", "", "survival-help-box tournament-profile");
    box.append(text("h3", shown?.name ?? "Emperor"));
    const lines = shown ? [`Level ${shown.level ?? 1}`, `Honour: ${shown.honor_points ?? 0}`,
      `Attacks won: ${shown.attacks_won ?? 0} · lost: ${shown.attacks_lost ?? 0}`] : ["No profile for this empire."];
    box.append(...lines.map((line) => text("p", line)), button("Close profile", () => {
      this.profileRequest++;
      box.remove();
    }));
    this.panel.body.prepend(box);
    box.scrollIntoView({ block: "nearest" });
  }

  private setBusy(busy: boolean): void {
    this.busy = busy;
    // Preserve every control's own disabled rule across a pending request.
    for (const control of this.panel.body.querySelectorAll("button")) {
      if (busy) { control.dataset.wasDisabled = String(control.disabled); control.disabled = true; }
      else if (control.dataset.wasDisabled !== undefined) {
        control.disabled = control.dataset.wasDisabled === "true";
        delete control.dataset.wasDisabled;
      }
    }
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
    save.disabled = count === 0 && choices.length > 0;
    actions.append(save, button("Reset", () => { this.team = Array(TEAM_SLOTS).fill(0); this.render(); }),
      button("Cancel", () => { this.team = restoredTournamentTeam(this.parts.savedTeam(), choices); this.editing = false; this.render(true); }));
    this.panel.body.append(units, actions);
    if (this.busy) this.setBusy(true);
  }

  private async save(): Promise<void> {
    if (this.busy) return;
    const generation = this.generation;
    this.setBusy(true);
    try {
      await this.parts.refreshTown();
      if (generation !== this.generation) return;
      // Keep the edited selection while updating the available copies. A
      // sale in this town or another tab must be caught before it is saved.
      this.render();
      const problem = tournamentTeamProblem(this.team, this.parts.choices(), this.parts.items, this.parts.rules);
      if (problem) {
        this.error(problem === "complex" ? this.word(1233, this.parts.rules.complexLimit) : problem === "empty" ? this.word(1213) : "Your available units have changed. Reopen the team box and choose again.");
        return;
      }
      if (await this.parts.saveTeam([...this.team])) {
        if (generation === this.generation) { this.editing = false; this.render(true); }
      } else if (generation === this.generation) this.error("Your team couldn't be saved. Reload and try again.");
    } catch {
      if (generation === this.generation) this.error("Your available units or team couldn't be saved. Reload and try again.");
    } finally {
      this.setBusy(false);
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
