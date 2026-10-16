// The gifts window (CLIENT.md, "Neighbours"), the classic page's own
// (templates/_gifts.html, the server's gifts.py), in the panel like every
// window here: gifts friends sent, waiting to be taken into storage; today's
// free gift for a friend; and giving from storage. The Flash client's Send
// gift and its empty gift box opened this window through the page; here the
// Neighbours window has Gifts, and it opens by itself when gifts wait as the
// town opens, as the classic page does. What it changes in the town (gifts
// taken, things given away) shows once the town loads again, as there.

import { ICONS } from "./icons.ts";
import { Panel } from "./panel.ts";

interface Gift { id: number; name: string; count?: number; sender?: string; level?: number }
interface Friend { id: number; username: string; sent_today?: boolean }

/** What the server says (GET /gifts/game). */
interface GiftsState {
  waiting: Gift[];
  friends: Friend[];
  free: Gift[];
  next_free?: Gift | null;
  storage: Gift[];
  ok?: string;
  error?: string;
}

export interface GiftsParts {
  empire: string;
  csrf: string;
  /** Send the town's waiting commands first, so the server's storage is the one on screen; false when they couldn't go. */
  flush: () => Promise<boolean>;
  /** The town changed on the server (gifts taken, things given): load it again. */
  reload: () => void;
}

type Tab = "waiting" | "free" | "give";

export class GiftsWindow {
  private readonly panel = new Panel("gifts", "Gifts", { className: "list-window gifts-window", onClose: () => this.closed() });
  private readonly parts: GiftsParts;
  private state: GiftsState | null = null;
  private tab: Tab = "waiting";
  private changed = false;
  private said = "";

  constructor(parts: GiftsParts) {
    this.parts = parts;
  }

  /** How many gifts wait (asked of the server); 0 when it can't be reached. */
  async waiting(): Promise<number> {
    const reply = await this.ask("GET").catch(() => null);
    return reply?.waiting?.length ?? 0;
  }

  async open(tab: Tab = "waiting"): Promise<void> {
    this.panel.open();
    this.say("Opening your gifts…");
    if (!(await this.parts.flush())) {
      this.say("Gifts can't be reached right now. Please try again in a moment.");
      return;
    }
    const reply = await this.ask("GET").catch(() => null);
    if (!reply || reply.error || !reply.waiting) {
      this.say(reply?.error ?? "Gifts can't be reached right now. Please try again in a moment.");
      return;
    }
    this.state = reply;
    this.said = "";
    this.tab = tab === "waiting" && reply.waiting.length === 0 ? "free" : tab;
    this.render();
  }

  private closed(): void {
    if (this.changed) {
      this.changed = false;
      this.parts.reload();
    }
  }

  private say(text: string): void {
    const p = document.createElement("p");
    p.className = "rows-note";
    p.setAttribute("role", "status");
    p.textContent = text;
    this.panel.body.replaceChildren(p);
  }

  private async ask(method: "GET" | "POST", data: Record<string, string> = {}): Promise<GiftsState> {
    const url = `/gifts/game?empire=${encodeURIComponent(this.parts.empire)}`;
    const body = method === "POST" ? new URLSearchParams({ ...data, csrf: this.parts.csrf }) : undefined;
    const response = await fetch(url, { method, cache: "no-store", body });
    return await response.json() as GiftsState;
  }

  private async act(data: Record<string, string>, changes: boolean): Promise<void> {
    this.panel.body.querySelectorAll("button").forEach((b) => { b.disabled = true; });
    if (data.action === "give" && !(await this.parts.flush())) {
      this.said = "Gifts can't be reached right now. Please try again in a moment.";
      this.render();
      return;
    }
    const reply = await this.ask("POST", data).catch(() => null);
    if (!reply?.waiting) {
      this.said = reply?.error ?? "Gifts can't be reached right now. Please try again in a moment.";
    } else {
      this.state = reply;
      if (reply.ok && changes) {
        this.changed = true;
      }
      this.said = reply.ok ? reply.ok + (changes ? " Your town updates when this window closes." : "") : reply.error ?? "";
    }
    this.render();
  }

  private render(): void {
    const state = this.state!;
    const tabs = document.createElement("div");
    tabs.className = "gifts-tabs";
    tabs.setAttribute("role", "tablist");
    const tab = (which: Tab, label: string) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "button tiny gold";
      b.setAttribute("role", "tab");
      b.setAttribute("aria-selected", String(which === this.tab));
      b.textContent = label;
      b.addEventListener("click", () => {
        this.tab = which;
        this.said = "";
        this.render();
      });
      return b;
    };
    tabs.append(tab("waiting", `For you${state.waiting.length ? ` (${state.waiting.length})` : ""}`), tab("free", "Free gift"), tab("give", "From storage"));
    const body = this.tab === "waiting" ? this.waitingTab(state) : this.tab === "free" ? this.freeTab(state) : this.giveTab(state);
    const message = document.createElement("p");
    message.className = "gifts-message";
    message.setAttribute("role", "status");
    message.textContent = this.said;
    const friends = document.createElement("p");
    friends.className = "rows-note";
    friends.innerHTML = '<a href="/friends" target="_blank" rel="noopener">Friends page</a>: add friends, answer requests.';
    this.panel.body.replaceChildren(tabs, body, message, friends);
  }

  private waitingTab(state: GiftsState): HTMLElement {
    const box = document.createElement("section");
    if (state.waiting.length === 0) {
      box.append(note("No gifts waiting. Your friends' gifts arrive here."));
      return box;
    }
    const list = document.createElement("ul");
    list.className = "rows";
    for (const gift of state.waiting) {
      const row = document.createElement("li");
      row.className = "row";
      const text = document.createElement("span");
      text.className = "row-text";
      const name = document.createElement("strong");
      name.textContent = gift.name + ((gift.count ?? 1) > 1 ? ` × ${gift.count}` : "");
      const from = document.createElement("small");
      from.textContent = `from ${gift.sender ?? "a friend"}`;
      text.append(name, from);
      const take = button("Take", () => void this.act({ action: "take", gift: String(gift.id) }, true));
      take.setAttribute("aria-label", `Take ${gift.name}`);
      row.append(text, take);
      list.append(row);
    }
    box.append(list);
    if (state.waiting.length > 1) {
      box.append(button("Take them all", () => void this.act({ action: "take", gift: "all" }, true)));
    }
    return box;
  }

  private freeTab(state: GiftsState): HTMLElement {
    const box = document.createElement("section");
    box.className = "gifts-form";
    if (state.friends.length === 0) {
      box.innerHTML = '<p class="rows-note">Gifts go to friends. <a href="/friends" target="_blank" rel="noopener">Add friends</a> first.</p>';
      return box;
    }
    const open = state.friends.filter((f) => !f.sent_today);
    const friend = select("For", open.map((f) => [String(f.id), f.username]));
    const item = select("Gift", state.free.map((g) => [String(g.id), g.name]));
    const send = button("Send", () => void this.act({ action: "free", friend: friend.value, item: item.value }, false), true);
    send.disabled = open.length === 0 || state.free.length === 0;
    let text = open.length === 0 ? "You've sent every friend today's gift. More tomorrow!" : "One free gift a day for each friend.";
    if (state.next_free) {
      text += ` Next to open: a ${state.next_free.name} at level ${state.next_free.level}.`;
    }
    box.append(friend.parentElement!, item.parentElement!, send, note(text));
    return box;
  }

  private giveTab(state: GiftsState): HTMLElement {
    const box = document.createElement("section");
    box.className = "gifts-form";
    if (state.friends.length === 0 || state.storage.length === 0) {
      box.append(note(state.friends.length ? "Your storage is empty." : "Gifts go to friends: add friends first."));
      return box;
    }
    const friend = select("For", state.friends.map((f) => [String(f.id), f.username]));
    const item = select("From your storage", state.storage.map((g) => [String(g.id), `${g.name} (${g.count ?? 1})`]));
    const count = document.createElement("input");
    count.type = "number";
    count.min = "1";
    count.value = "1";
    const limit = () => {
      const most = state.storage.find((g) => String(g.id) === item.value)?.count ?? 1;
      count.max = String(most);
      count.value = String(Math.min(Math.max(Number(count.value) || 1, 1), most));
    };
    item.addEventListener("change", limit);
    count.addEventListener("change", limit);
    limit();
    const label = document.createElement("label");
    label.append("How many", count);
    const give = button("Give", () => void this.act({ action: "give", friend: friend.value, item: item.value, count: count.value }, true), true);
    box.append(friend.parentElement!, item.parentElement!, label, give, note("It leaves your storage and goes to your friend's gifts."));
    return box;
  }
}

function note(text: string): HTMLElement {
  const p = document.createElement("p");
  p.className = "rows-note";
  p.textContent = text;
  return p;
}

function button(label: string, run: () => void, gift = false): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.className = `button small${gift ? " gold" : ""}`;
  if (gift) {
    b.innerHTML = `<img class="icon" src="${ICONS.storage}" alt="">`;
  }
  b.append(label);
  b.addEventListener("click", run);
  return b;
}

function select(label: string, options: [string, string][]): HTMLSelectElement {
  const holder = document.createElement("label");
  holder.append(label);
  const box = document.createElement("select");
  for (const [value, text] of options) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = text;
    box.append(option);
  }
  holder.append(box);
  return box;
}
