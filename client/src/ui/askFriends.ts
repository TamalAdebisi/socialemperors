// Asking friends for help (CLIENT.md, "The nests"), as the classic page's
// Ask friends window does (templates/_help.html, helps.py): the friends,
// ticked if they can be asked, and Ask. Friends answer on their Friends
// page; their help is in the empire when the town loads again. It draws
// into a window of the caller's.

export interface AskParts {
  /** The empire asking, and the page's form key (settings). */
  empire: string;
  csrf: string;
}

/** What is asked about: the nest is kind "nest" with zeros. */
export interface Asked {
  kind: "nest" | "collect" | "staff";
  town: number;
  x: number;
  y: number;
  item: number;
}

interface Reply {
  what?: string;
  gone?: string;
  opens?: string;
  full?: string;
  ok?: string;
  error?: string;
  friends?: { id: number; username: string; state: string }[];
  answered?: string[];
}

const STATES: Record<string, string> = { asked: "asked", no_empire: "no empire yet", helped: "helped today" };

export class AskFriends {
  private readonly parts: AskParts;

  constructor(parts: AskParts) {
    this.parts = parts;
  }

  /** The friends to ask about `asked`, drawn into `box`; `back` returns to the window it came from. */
  show(box: HTMLElement, asked: Asked, back: () => void): void {
    box.replaceChildren();
    const status = document.createElement("p");
    status.className = "ask-status";
    status.setAttribute("role", "status");
    status.textContent = "Finding your friends…";
    const list = document.createElement("ul");
    list.className = "ask-friends";
    const ask = document.createElement("button");
    ask.type = "button";
    ask.className = "button small gold";
    ask.textContent = "Ask";
    ask.hidden = true;
    const backButton = document.createElement("button");
    backButton.type = "button";
    backButton.className = "button small";
    backButton.textContent = "Back";
    backButton.addEventListener("click", back);
    const buttons = document.createElement("div");
    buttons.className = "ask-buttons";
    buttons.append(ask, backButton);
    box.append(status, list, buttons);

    const picked = () => [...list.querySelectorAll<HTMLInputElement>("input:checked")].map((b) => b.value);
    const count = () => {
      const n = picked().length;
      ask.textContent = n > 1 ? `Ask ${n} friends` : "Ask";
      ask.disabled = n === 0;
    };
    const draw = (reply: Reply, said = "") => {
      const problem = reply.gone || reply.opens || reply.full;
      const friends = reply.friends ?? [];
      status.textContent = said || problem || (friends.length ? `Each friend who answers gives you ${reply.what}.` : "");
      list.replaceChildren();
      if (!problem && !reply.error && friends.length === 0) {
        const none = document.createElement("li");
        none.textContent = "No other accounts yet. New players will appear here automatically.";
        list.append(none);
      }
      for (const friend of problem ? [] : friends) {
        const row = document.createElement("li");
        const label = document.createElement("label");
        const tick = document.createElement("input");
        tick.type = "checkbox";
        tick.value = String(friend.id);
        tick.checked = false;  // choose recipients explicitly from the community
        tick.disabled = friend.state !== "can";
        const name = document.createElement("b");
        name.textContent = friend.username;
        label.append(tick, name);
        if (friend.state !== "can") {
          label.append(` · ${STATES[friend.state] ?? friend.state}`);
        }
        row.append(label);
        list.append(row);
      }
      ask.hidden = Boolean(problem) || friends.length === 0;
      count();
      if (reply.answered?.length) {
        const answered = document.createElement("p");
        answered.className = "ask-answered";
        answered.textContent = `Since your town loaded: ${reply.answered.join(". ")}. Load the town again to use it.`;
        list.append(answered);
      }
    };
    list.addEventListener("change", count);
    ask.addEventListener("click", () => {
      ask.disabled = true;
      void this.call("POST", asked, picked()).then((reply) => draw(reply, reply.ok ?? reply.error ?? ""));
    });
    void this.call("GET", asked, []).then((reply) => draw(reply, reply.error ?? ""));
  }

  private async call(method: "GET" | "POST", asked: Asked, friends: string[]): Promise<Reply> {
    const query = new URLSearchParams({ empire: this.parts.empire });
    const params = new URLSearchParams(Object.entries(asked).map(([k, v]) => [k, String(v)]));
    if (method === "POST") {
      params.append("csrf", this.parts.csrf);
      for (const friend of friends) {
        params.append("friend", friend);
      }
    }
    try {
      const response = await fetch(method === "GET" ? `/help/game?${query}&${params}` : `/help/game?${query}`,
        { method, cache: "no-store", body: method === "GET" ? undefined : params });
      return await response.json() as Reply;
    } catch {
      return { error: "Friends can't be reached right now. Please try again in a moment." };
    }
  }
}
