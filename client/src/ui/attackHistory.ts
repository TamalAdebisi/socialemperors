// The Battle Results window (CLIENT.md, "Attacking players"): the last ten
// attacks the player made, or received, newest first, as the Flash
// client's attack history: the date, the opponent, won or lost, the gold,
// and +INFO for the battle's report (both armies, alive and dead, what was
// won, the units lost for good) with Take Revenge!!. An attack received
// and not yet seen is marked new; on coming home to one, the window opens
// by itself on the attacks received, with the game's "Attacked!" notice,
// and the server is told they've been seen (clean_attacks).

import type { ItemInfo } from "../rules/config.ts";
import type { AttackEntry, Row } from "../rules/pvp.ts";
import { iconImage } from "./icons.ts";
import { Panel } from "./panel.ts";

/** The game's words (localization_strings). */
const WORDS = {
  won: 446, lost: 447, info: 638, title: 640, footer: 641, date: 642, opponent: 643, result: 644, gold: 645,
  attacked: 646, attackedBody: 647, attackedFooter: 648, report: 649, alive: 650, dead: 651, yourArmy: 653, enemyArmy: 654,
  yourLosses: 655, noLosses: 656, youWon: 657, youWin: 660, youLose: 661, defended: 662, fell: 663, revenge: 1132, ok: 605,
} as const;
/** The history shows this many of each. */
const SHOWN = 10;

export interface HistoryParts {
  /** The save's privateState: attacksSent and attacksReceived, kept up to date here. */
  privateState: Record<string, unknown>;
  words: (id: number) => string;
  items: Map<number, ItemInfo>;
  thumbnail: (item: ItemInfo) => string;
  /** Where Take Revenge!! goes: an attack on that player. */
  attackUrl: (pid: string) => string;
  /** Attacks received have been seen: tell the server (clean_attacks). */
  seen: () => void;
  /** The window opened (a goal asks for it). */
  opened: () => void;
}

interface Description {
  oponent?: { name?: string; user_id?: string };
  win?: number;
  resources?: { g?: number; x?: number };
  resources_victim?: { g?: number };
  attacker_units?: Row[];
  victim_units?: Row[];
}

type Entry = AttackEntry & { description?: Description; attacker_id?: string; victim_id?: string };

/** Attacks with a report, newest first, the last ten. */
export function lastAttacks(entries: unknown): Entry[] {
  return (Array.isArray(entries) ? entries as Entry[] : []).filter((e) => e && e.description)
    .sort((a, b) => Number(b.time) - Number(a.time)).slice(0, SHOWN);
}

/** Whether an attack received is waiting to be seen. */
export function attackedWhileAway(privateState: Record<string, unknown>): boolean {
  return (Array.isArray(privateState.attacksReceived) ? privateState.attacksReceived as Entry[] : []).some((e) => e && e.viewPending != null);
}

/** Counts in a report's rows: how many came, fell, and fell for good. */
function counts(rows: Row[] | undefined): { came: number; fell: number; lost: number } {
  let came = 0;
  let fell = 0;
  let lost = 0;
  for (const row of rows ?? []) {
    came += Number(row[1]) || 0;
    fell += Number(row[2]) || 0;
    lost += (Number(row[2]) || 0) - (Number(row[3]) || 0);
  }
  return { came, fell, lost };
}

export class AttackHistoryWindow {
  private readonly panel = new Panel("battle-results", "Battle Results", { className: "list-window attack-history" });
  private readonly parts: HistoryParts;
  private tab: "sent" | "received" = "sent";

  constructor(parts: HistoryParts) {
    this.parts = parts;
  }

  toggle(): void {
    if (this.panel.isOpen) {
      this.panel.toggle();
      return;
    }
    this.open("sent");
  }

  /** Open on made or received attacks; `attacked`: coming home to an attack, with the notice. */
  open(tab: "sent" | "received", attacked = false): void {
    this.tab = tab;
    this.list();
    if (attacked) {
      this.notice();
    }
    if (!this.panel.isOpen) {
      this.panel.toggle();
    }
    this.parts.opened();
  }

  private word(id: number): string {
    return this.parts.words(id);
  }

  private list(): void {
    const { privateState } = this.parts;
    this.panel.title = this.word(WORDS.title);
    const tabs = document.createElement("nav");
    tabs.className = "shop-tabs";
    tabs.setAttribute("aria-label", "Attacks made or received");
    for (const [tab, label] of [["sent", "Attacks made"], ["received", "Attacks received"]] as const) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "shop-toggle";
      button.textContent = label;
      button.setAttribute("aria-pressed", String(this.tab === tab));
      button.addEventListener("click", () => {
        this.tab = tab;
        this.list();
      });
      tabs.append(button);
    }
    const sent = this.tab === "sent";
    const attacks = lastAttacks(sent ? privateState.attacksSent : privateState.attacksReceived);
    const table = document.createElement("table");
    table.className = "attack-table";
    const head = table.createTHead().insertRow();
    for (const id of [WORDS.date, WORDS.opponent, WORDS.result, WORDS.gold]) {
      const cell = document.createElement("th");
      cell.textContent = this.word(id);
      head.append(cell);
    }
    head.append(document.createElement("th"));
    const body = table.createTBody();
    for (const entry of attacks) {
      const d = entry.description!;
      const row = body.insertRow();
      row.className = "attack-row";
      const when = row.insertCell();
      when.textContent = new Date(Number(entry.time) * 1000).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
      const who = row.insertCell();
      who.textContent = d.oponent?.name ?? "Emperor";
      if (!sent && entry.viewPending != null) {
        const fresh = document.createElement("span");
        fresh.className = "attack-new";
        fresh.textContent = "New";
        who.append(" ", fresh);
      }
      const result = row.insertCell();
      result.className = d.win === 1 ? "attack-won" : "attack-lost";
      result.textContent = this.word(d.win === 1 ? WORDS.won : WORDS.lost);
      const gold = row.insertCell();
      gold.textContent = String(sent ? d.resources?.g ?? 0 : d.resources_victim?.g ?? 0);
      const more = row.insertCell();
      const button = document.createElement("button");
      button.type = "button";
      button.className = "button tiny gold";
      button.textContent = this.word(WORDS.info);
      button.setAttribute("aria-label", `More about the battle with ${who.firstChild?.textContent ?? ""}`);
      button.addEventListener("click", () => {
        delete entry.viewPending;
        this.report(entry, sent);
      });
      more.append(button);
    }
    const empty = document.createElement("p");
    empty.className = "rows-note";
    empty.textContent = attacks.length ? this.word(WORDS.footer) : sent ? "No attacks made yet." : "Nobody has attacked your empire.";
    this.panel.body.replaceChildren(tabs, ...(attacks.length ? [table] : []), empty);
  }

  /** The game's "Attacked!" notice over the list; the attacks are seen from now. */
  private notice(): void {
    const box = document.createElement("div");
    box.className = "attack-notice";
    box.setAttribute("role", "alert");
    const title = document.createElement("strong");
    title.textContent = this.word(WORDS.attacked);
    const text = document.createElement("p");
    text.textContent = `${this.word(WORDS.attackedBody)} ${this.word(WORDS.attackedFooter)}`;
    const ok = document.createElement("button");
    ok.type = "button";
    ok.className = "button small gold";
    ok.textContent = this.word(WORDS.ok);
    ok.addEventListener("click", () => box.remove());
    box.append(title, text, ok);
    this.panel.body.prepend(box);
    this.parts.seen();
  }

  /** One battle's report, from the side of the player: theirs is the attacker's when they attacked. */
  private report(entry: Entry, sent: boolean): void {
    const d = entry.description!;
    // The defender loses nothing for good on this server (DECISIONS.md), whatever the report says.
    const mine = sent ? counts(d.attacker_units) : { ...counts(d.victim_units), lost: 0 };
    const theirs = counts(sent ? d.victim_units : d.attacker_units);
    const won = d.win === 1;
    this.panel.title = this.word(WORDS.report);
    const back = document.createElement("button");
    back.type = "button";
    back.className = "button small plain attack-back";
    back.textContent = "‹ Back";
    back.addEventListener("click", () => this.list());
    const armies = document.createElement("div");
    armies.className = "attack-armies";
    const army = (label: string, name: string, alive: number, dead: number) => {
      const box = document.createElement("section");
      box.className = "attack-army";
      const title = document.createElement("strong");
      title.textContent = label;
      const who = document.createElement("small");
      who.textContent = name;
      const numbers = document.createElement("p");
      numbers.textContent = `${this.word(WORDS.alive)}: ${alive} · ${this.word(WORDS.dead)}: ${dead}`;
      box.append(title, who, numbers);
      return box;
    };
    // As the Flash client counts them: the player's dead are those lost for good; the enemy's, all that fell.
    armies.append(
      army(this.word(WORDS.yourArmy), "You", mine.came - mine.lost, mine.lost),
      army(this.word(WORDS.enemyArmy), d.oponent?.name ?? "Emperor", theirs.came - theirs.fell, theirs.fell),
    );
    const result = document.createElement("p");
    result.className = `attack-result ${won ? "attack-won" : "attack-lost"}`;
    result.textContent = this.word(sent ? (won ? WORDS.youWin : WORDS.youLose) : (won ? WORDS.defended : WORDS.fell));
    const earned = document.createElement("p");
    earned.className = "quest-earned";
    earned.append(`${this.word(WORDS.youWon)} `, iconImage("gold"), String(sent ? d.resources?.g ?? 0 : d.resources_victim?.g ?? 0));
    if (sent) {
      earned.append(iconImage("xp"), String(d.resources?.x ?? 0));
    }
    const losses = document.createElement("div");
    losses.className = "attack-losses";
    const lossTitle = document.createElement("strong");
    lossTitle.textContent = this.word(WORDS.yourLosses);
    losses.append(lossTitle);
    const gone = (sent ? d.attacker_units ?? [] : []).filter((r) => (Number(r[2]) || 0) - (Number(r[3]) || 0) > 0);
    if (gone.length === 0) {
      const none = document.createElement("p");
      none.textContent = this.word(WORDS.noLosses);
      losses.append(none);
    } else {
      const list = document.createElement("ul");
      list.className = "quest-lost";
      for (const [id, , killed, back_] of gone) {
        const item = this.parts.items.get(Number(id));
        const row = document.createElement("li");
        const picture = new Image();
        picture.alt = "";
        picture.src = item ? this.parts.thumbnail(item) : "";
        row.append(picture, `${killed - back_} × ${item?.name ?? "unit"}`);
        list.append(row);
      }
      losses.append(list);
    }
    const opponent = String((sent ? entry.victim_id : entry.attacker_id) ?? d.oponent?.user_id ?? "");
    const revenge = document.createElement("a");
    revenge.className = "button small danger attack-revenge";
    revenge.textContent = this.word(WORDS.revenge);
    revenge.href = this.parts.attackUrl(opponent);
    revenge.hidden = !opponent;
    this.panel.body.replaceChildren(back, armies, result, earned, losses, revenge);
  }
}
