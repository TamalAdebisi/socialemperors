// The tournament's enrolled armies, matches and results. The server has
// already paid a finished room's prize, or for the weekly one pays it when
// the week ends: Done only acknowledges the room and reloads the town. This
// view never gives resources or changes a chosen team.
import type { ItemInfo } from "../rules/config.ts";
import { TEAM_SLOTS, tournamentDeadline, tournamentFinished, tournamentLeaderboard, tournamentPlayerScore, tournamentPrize,
  tournamentRankPrize, tournamentWeekOver, type TournamentKind, type TournamentPlayer, type TournamentPrize,
  type TournamentRoom } from "../rules/tournaments.ts";
import { iconImage } from "./icons.ts";
import "./tournamentResults.css";

export interface TournamentResultArt {
  items: Map<number, ItemInfo>;
  words: (id: number) => string;
  pictureUrl: (file: string) => string;
  thumbnail: (id: number) => string;
}

export interface TournamentResultsParts extends TournamentResultArt {
  room: TournamentRoom;
  kind: TournamentKind;
  me: string;
  /** Services/navigation are owned by the containing tournament window. */
  play: (victimId: string) => Promise<void>;
  acknowledge: () => Promise<void>;
  refresh: () => Promise<void>;
  leave: () => Promise<void>;
  profile?: (userId: string) => Promise<void>;
  /** Server-adjusted seconds, when the containing game has them. */
  now?: () => number;
}

function text<K extends keyof HTMLElementTagNameMap>(tag: K, value: string, className = ""): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  element.textContent = value;
  element.className = className;
  return element;
}

function word(parts: TournamentResultArt, id: number, value?: string | number): string {
  return parts.words(id).replace("#0#", String(value ?? "")).trim();
}

function clock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor(s / 60) % 60).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function thumb(parts: TournamentResultArt, id: number): HTMLImageElement {
  const image = new Image();
  image.src = parts.thumbnail(id);
  image.alt = parts.items.get(id)?.name ?? String(id);
  image.title = image.alt;
  return image;
}

function prizeContents(prize: TournamentPrize, parts: TournamentResultArt): HTMLElement {
  const contents = text("div", "", "tournament-prize");
  for (const [resource, icon] of [["g", "gold"], ["c", "cash"]] as const) {
    const amount = Number(prize[resource]) || 0;
    if (amount > 0) {
      const reward = text("span", `${amount.toLocaleString("en-US")} `);
      reward.append(iconImage(icon));
      contents.append(reward);
    }
  }
  for (const [id, rawCount] of Object.entries(prize.u ?? {})) {
    const count = Number(rawCount) || 0;
    if (count > 0) contents.append(thumb(parts, Number(id)), text("span", `${count} × ${parts.items.get(Number(id))?.name ?? id}`));
  }
  return contents;
}

/** Weekly prize information is also available before entering a room. */
export function renderTournamentPrizes(kind: TournamentKind, parts: TournamentResultArt): HTMLElement {
  const section = text("section", "", "tournament-weekly-prizes");
  section.append(text("h3", word(parts, 1294)), text("p", word(parts, 1295)));
  const list = text("ol", "", "tournament-prize-list");
  for (const [index, prize] of kind.prize.slice(0, 10).entries()) {
    const row = text("li", "");
    row.append(text("strong", `#${index + 1}`), prizeContents(prize, parts));
    list.append(row);
  }
  section.append(list);
  return section;
}

/** Embedded in the tournament panel; update preserves the selected tab. */
export class TournamentResultsView {
  readonly element = text("section", "", "tournament-results");
  private readonly parts: TournamentResultsParts;
  private room: TournamentRoom;
  private tab: "matches" | "results";
  private playerId: string;
  private busy = false;
  private disposed = false;
  private timer: ReturnType<typeof setInterval>;
  private nextDeadlineRefresh = 0;
  private failure = "";

  constructor(parts: TournamentResultsParts) {
    this.parts = parts;
    this.room = parts.room;
    this.tab = this.finished ? "results" : "matches";
    this.playerId = parts.me;
    this.render();
    this.timer = setInterval(() => this.tick(), 1000);
  }

  update(room: TournamentRoom): void {
    const wasFinished = this.finished;
    this.room = room;
    if (!wasFinished && this.finished) this.tab = "results";
    if (!room.players.some((player) => player.user_id === this.playerId)) this.playerId = this.parts.me;
    this.render();
  }

  destroy(): void {
    this.disposed = true;
    clearInterval(this.timer);
  }

  private get finished(): boolean { return tournamentFinished(this.room); }
  private get weekly(): boolean { return Number(this.parts.kind.weekly_tournaments) >= 1; }
  private word(id: number, value?: string | number): string { return word(this.parts, id, value); }

  private button(label: string, run: () => void, className = "button small"): HTMLButtonElement {
    const button = text("button", label, className);
    button.type = "button";
    button.disabled = this.busy;
    button.addEventListener("click", run);
    return button;
  }

  private async action(run: () => Promise<void>): Promise<void> {
    if (this.busy || this.disposed) return;
    this.busy = true;
    this.failure = "";
    this.render();
    try {
      await run();
    } catch (error) {
      this.failure = error instanceof Error ? error.message : "Couldn't update your tournament. Please try again.";
    } finally {
      this.busy = false;
      if (!this.disposed) {
        this.render();
        this.element.querySelector(".tournament-error")?.scrollIntoView({ block: "nearest" });
      }
    }
  }

  private render(): void {
    this.element.replaceChildren();
    this.element.setAttribute("aria-busy", String(this.busy));
    const heading = text("div", "", "tournament-results-heading");
    if (Number(this.room.private) === 1) heading.append(text("h3", `${this.room.owner}'s tournament`));
    if (!this.finished) {
      heading.append(text("p", "", "tournament-deadline"));
      const mine = this.room.players.find((player) => player.user_id === this.parts.me);
      if (mine) {
        const score = tournamentPlayerScore(mine);
        heading.append(text("p", `Your score: ${score.points.toFixed(2)} · ${score.matches} / ${mine.matches.length} matches · ${clock(score.seconds)}`, "tournament-score-stats"));
      }
    }
    if (heading.childElementCount) this.element.append(heading);
    if (this.finished) this.element.append(this.outcome());
    if (this.failure) {
      const error = text("p", this.failure, "tournament-error");
      error.setAttribute("role", "alert");
      this.element.append(error);
    }
    const tabs = text("div", "", "tournament-results-tabs");
    tabs.setAttribute("role", "group");
    tabs.setAttribute("aria-label", "Tournament details");
    for (const [tab, id] of [["matches", 1204], ["results", 1202]] as const) {
      const pick = this.button(this.word(id), () => { this.tab = tab; this.render(); });
      pick.setAttribute("aria-pressed", String(this.tab === tab));
      tabs.append(pick);
    }
    this.element.append(tabs, this.tab === "matches" ? this.matches() : this.results());
    const controls = text("div", "", "tournament-tools");
    controls.append(this.button("Refresh", () => void this.action(this.parts.refresh)));
    if (!this.finished) controls.append(this.button(this.word(1228), () => void this.action(this.parts.leave)));
    this.element.append(controls);
    this.updateClock();
  }

  private outcome(): HTMLElement {
    const outcome = text("section", "", "tournament-outcome");
    const prize = tournamentPrize(this.room, this.parts.kind, this.parts.me);
    outcome.dataset.won = String(prize !== null);
    outcome.append(text("h3", this.word(1208)));
    if (this.weekly && !tournamentWeekOver(this.room)) {
      // Everybody can still play this week: prizes follow the final ranking.
      const ends = Number(this.room.ranking?.ends);
      const when = new Date(ends * 1000).toLocaleString(undefined, { weekday: "long", hour: "2-digit", minute: "2-digit" });
      outcome.append(text("p", `The week's top 10 win their prizes when the week ends${Number.isFinite(ends) ? `, ${when}` : ""}.`));
      const hoped = tournamentRankPrize(this.room, this.parts.kind, this.parts.me);
      if (hoped) outcome.append(text("p", "Keep your place to win:", "rows-note"), prizeContents(hoped, this.parts));
    } else if (prize) {
      outcome.append(text("p", "Congratulations! Your tournament prize has been awarded."), prizeContents(prize, this.parts));
      if (Object.keys(prize.u ?? {}).length) outcome.append(text("p", "Your prize units are in Storage.", "rows-note"));
    } else outcome.append(text("p", this.word(1209)));
    if (this.weekly && this.room.ranking) outcome.append(text("p", this.word(1257, this.room.ranking.user.rank)));
    outcome.append(this.button("Done", () => void this.action(this.parts.acknowledge), "button small gold"));
    return outcome;
  }

  private player(player: TournamentPlayer): HTMLElement {
    const card = text("div", "", "tournament-player");
    const bot = this.parts.kind.weekly_opponent?.[player.user_id];
    const portrait = text("span", "", "portrait");
    if (bot?.picture) {
      const image = new Image();
      image.src = this.parts.pictureUrl(bot.picture);
      image.alt = "";
      portrait.append(image);
    } else portrait.textContent = player.user_name.trim().charAt(0).toUpperCase() || "?";
    const details = text("span", "", "tournament-player-details");
    const name = player.user_name + (player.user_id === this.parts.me ? " (you)" : "");
    if (this.parts.profile && !bot) {
      details.append(this.button(name, () => void this.action(() => this.parts.profile!(player.user_id)), "button tiny plain"));
    } else details.append(text("strong", name));
    details.append(text("small", this.word(1207, player.level) + (Number(player.abandonned) === 1 ? " · Left tournament" : "")));
    card.append(portrait, details);
    return card;
  }

  private matches(): HTMLElement {
    const section = text("section", "", "tournament-matches");
    if (!this.weekly) {
      const players = text("div", "", "tournament-player-tabs");
      players.setAttribute("role", "group");
      players.setAttribute("aria-label", "Players' matches");
      for (const player of this.room.players) {
        const pick = this.button(player.user_id === this.parts.me ? "Your matches" : player.user_name,
          () => { this.playerId = player.user_id; this.render(); });
        pick.setAttribute("aria-pressed", String(this.playerId === player.user_id));
        players.append(pick);
      }
      section.append(players);
    }
    const player = this.room.players.find((entry) => entry.user_id === this.playerId);
    if (!player) return section;
    section.append(text("h4", this.word(1205, player.user_name)));
    const list = text("ul", "", "tournament-match-list");
    for (const match of player.matches) {
      const opponent = this.room.players.find((entry) => entry.user_id === match.victim_id);
      if (!opponent) continue;
      const row = text("li", "", "tournament-match");
      row.dataset.victim = match.victim_id;
      row.dataset.attacker = player.user_id;
      row.append(this.player(opponent));
      if (match.finished || this.finished) {
        row.append(text("p", `${this.word(match.attacker_won ? 1197 : 1198)} · +${Number(match.attacker_points).toFixed(2)} ${this.word(1196).toLowerCase()}`, "tournament-match-result"));
      } else if (player.user_id === this.parts.me && Number(player.abandonned) !== 1) {
        if (match.date_started !== null) row.append(text("p", "An unfinished attempt is recorded. Starting again restarts this match.", "rows-note"));
        const play = this.button(this.word(1199),
          () => void this.action(() => this.parts.play(opponent.user_id)), "button small gold");
        play.setAttribute("aria-label", `Start match against ${opponent.user_name}`);
        row.append(play);
      } else row.append(text("p", this.word(1200)));
      list.append(row);
    }
    const team = text("section", "", "tournament-team-box");
    team.append(text("h4", this.word(1201, player.user_name)));
    const slots = text("ol", "", "tournament-team");
    for (let index = 0; index < TEAM_SLOTS; index++) {
      const slot = text("li", "");
      const id = Number(player.team[index]) || 0;
      if (id > 0) slot.append(thumb(this.parts, id));
      else slot.setAttribute("aria-label", `Empty place ${index + 1}`);
      slots.append(slot);
    }
    team.append(slots);
    section.append(list, team);
    return section;
  }

  private results(): HTMLElement {
    const section = text("section", "", "tournament-ranking");
    section.append(text("h4", this.word(1194)));
    const rows = text("ol", "", "tournament-scoreboard");
    if (this.weekly && this.room.ranking) {
      const ranking = this.room.ranking;
      section.append(text("p", this.word(1258, ranking.total_user)));
      for (const [key, player] of Object.entries(ranking.top).sort(([a], [b]) => Number(a) - Number(b))) {
        const rank = Number(key);
        const row = text("li", "", "tournament-score-row");
        row.dataset.player = player.user_id;
        row.append(text("strong", `#${rank}`));
        if (this.parts.profile) row.append(this.button(player.user_name,
          () => void this.action(() => this.parts.profile!(player.user_id)), "button tiny plain tournament-rank-name"));
        else row.append(text("strong", player.user_name, "tournament-rank-name"));
        row.append(this.scoreStats(Number(player.points), Number(player.time), Number(player.matches)));
        if (rank >= 1 && rank <= 10 && this.parts.kind.prize[rank - 1]) row.append(prizeContents(this.parts.kind.prize[rank - 1], this.parts));
        rows.append(row);
      }
      section.append(rows);
      const mine = text("section", "", "tournament-your-rank");
      mine.append(text("h4", this.word(1257, ranking.user.rank)),
        this.scoreStats(Number(ranking.user.points), Number(ranking.user.time), Number(ranking.user.matches)));
      const rank = Number(ranking.user.rank);
      if (rank >= 1 && rank <= 10 && this.parts.kind.prize[rank - 1]) mine.append(prizeContents(this.parts.kind.prize[rank - 1], this.parts));
      section.append(mine);
    } else {
      for (const [index, score] of tournamentLeaderboard(this.room).entries()) {
        const row = text("li", "", "tournament-score-row");
        row.dataset.player = score.player.user_id;
        row.append(text("strong", `#${index + 1}`), this.player(score.player), this.scoreStats(score.points, score.seconds, score.matches));
        rows.append(row);
      }
      section.append(rows);
    }
    return section;
  }

  private scoreStats(points: number, seconds: number, matches: number): HTMLElement {
    return text("p", `${this.word(1196)}: ${points.toFixed(2)} · ${this.word(1195)}: ${matches} · ${this.word(1206)}: ${clock(seconds)}`, "tournament-score-stats");
  }

  private updateClock(): number {
    const deadline = tournamentDeadline(this.room, this.parts.kind) ?? 0;
    const seconds = deadline - (this.parts.now?.() ?? Date.now() / 1000);
    const display = this.element.querySelector(".tournament-deadline");
    if (display) display.textContent = `${this.word(1203)} ${clock(seconds)}`;
    return seconds;
  }

  private tick(): void {
    if (this.disposed || this.finished) return;
    if (this.updateClock() <= 0 && !this.busy && Date.now() >= this.nextDeadlineRefresh) {
      // The original retries every two minutes after the nominal deadline;
      // completion and prizes always come from the server response.
      this.nextDeadlineRefresh = Date.now() + 120_000;
      void this.action(this.parts.refresh);
    }
  }
}
