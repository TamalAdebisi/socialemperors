// What's always on screen, in HTML over the map (CLIENT.md, "The menus:
// rail and dock"): the level with a bar to the next, and the resources as
// dark pills with the game's own icons (short numbers on a phone: 12.4k);
// full screen; and in the bottom
// right corner, as on the Flash client's bar, the pointer with its tools
// (the bulldozer and the fast-collect glove), the square tool (selecting
// units with a box), and Collect all, which collects every ready building
// at once.
// Messages slide in at the top, not over the middle of the town. The
// site's own links, as on the classic page's bar (Everybody with what waits
// there, Empires, Log out), are in a Menu by Full screen.

import type { Level } from "../rules/levels.ts";
import type { Town } from "../rules/town.ts";
import { short } from "./format.ts";
import { ICONS } from "./icons.ts";

const numbers = new Intl.NumberFormat("en-US");

/** What the music and sound buttons switch (the page's Sound). */
export interface SoundSwitches {
  readonly musicPlaying: boolean;
  readonly effectsPlaying: boolean;
  setMusic(on: boolean): void;
  setEffects(on: boolean): void;
  onChange(listener: () => void): void;
}

export interface HudActions {
  classicUrl: string;
  /** Showing another player's town: their name (the numbers stay the player's own). */
  visiting?: string;
  /** The levels table, for how far the town is from the next. */
  levels?: Level[];
  /** Music and sound effects: their on/off buttons. */
  sound?: SoundSwitches;
  /** The town's people and the room for them. */
  population?: (town: Town) => { current: number; max: number };
  /** Pausing (ui/pause.ts): its button goes before the music's. */
  pause?: { button(): HTMLButtonElement };
  /** The site's links (the classic page's bar): what waits on the Everybody page, who's signed in, the form token for Log out. */
  site?: { news: number; username: string; csrf: string };
}

/** How often the Everybody count is asked again while the game is in view, as the classic page's: two minutes. */
const NEWS_MS = 120_000;

/** The pointer's tools, as on the Flash client's bar: the pointer itself, the bulldozer, the glove. */
export type Tool = "pointer" | "remove" | "collect";

export interface Hud {
  /** Show the town's numbers again (after a sale...). */
  update(town: Town): void;
  /** Offer the glove: collect everything ready. */
  offerCollectAll(run: () => void): void;
  /** Offer the square tool (its button; Space is the editor's). */
  offerSquareTool(run: () => void): void;
  /** Offer the pointer's tools: its button opens a menu of them, or, with one on, puts it down. */
  offerTools(choose: (tool: Tool) => void): void;
  /** Show which tool is on: the pointer's button reads Cancel while the bulldozer or the glove is. */
  tool(tool: Tool): void;
  /** Light the square tool's button while it's on. */
  squareTool(on: boolean): void;
  /** How many buildings are ready: the glove shows when there are any, with the count. */
  ready(count: number): void;
  /** Offer the bank: a + on the gold and cash pills. */
  offerBank(open: () => void): void;
  /** Visiting: the helps left today, as the Flash client's rays beside the neighbour's name. */
  helpsLeft(count: number): void;
  /** At home: the level, which carries the town's name, opens `rename` when tapped (the Flash client's top bar named the town there). */
  offerRename(rename: () => void): void;
}

/** The most a neighbour's buildings can be helped on a visit: one ray each. */
const RAYS = 5;

const RESOURCES = ["gold", "wood", "food", "stone", "cash"] as const;

export function showHud(town: Town, actions: HudActions): Hud {
  const bar = document.createElement("header");
  bar.className = "hud";
  bar.innerHTML = `
    <div class="hud-numbers">
      <span class="hud-level pill-light" tabindex="0">
        <img class="icon" src="${ICONS.xp}" alt="">
        <span class="hud-level-number"></span>
        <span class="hud-xp" aria-hidden="true"><span class="hud-xp-done"></span></span>
      </span>
      <ul class="hud-resources">
        ${RESOURCES.map((key) => `<li class="pill-dark" data-tip="${key[0].toUpperCase()}${key.slice(1)}" tabindex="0">
          <img class="icon" src="${ICONS[key]}" alt=""><span class="n-full" data-n="${key}"></span><span class="n-short" aria-hidden="true" data-short="${key}"></span>
        </li>`).join("")}
        <li class="pill-dark hud-people" data-tip="People: room for more by building houses" tabindex="0" hidden>
          <img class="icon" src="${ICONS.population}" alt=""><span data-people></span>
        </li>
      </ul>
    </div>
    <div class="hud-buttons">
      <span class="hud-visiting pill-light" hidden></span>
      <a class="button tiny gold" data-home href="/client.html" hidden>Back home</a>
      <button class="hud-sound" type="button" data-music hidden></button>
      <button class="hud-sound" type="button" data-effects hidden></button>
      <button class="button tiny gold" type="button" data-fullscreen>Full screen</button>
      <span class="site" hidden>
        <button class="button tiny gold site-button" type="button" aria-haspopup="menu" aria-expanded="false">Menu<span class="menu-count" data-site-news hidden></span></button>
        <span class="site-menu" role="menu" hidden>
          <a role="menuitem" href="/friends" target="_blank" rel="noopener" data-friends>Everybody<span class="menu-count" data-friends-news hidden></span></a>
          <a role="menuitem" href="/">Empires</a>
          <form method="post" action="/logout"><input type="hidden" name="csrf"><button role="menuitem" type="submit">Log out</button></form>
        </span>
      </span>
    </div>`;
  const who = (t: Town) => (t.townName ? `${t.name} · ${t.townName}` : t.name);
  const level = bar.querySelector<HTMLElement>(".hud-level")!;
  if (actions.visiting) {
    const visiting = bar.querySelector<HTMLElement>(".hud-visiting")!;
    visiting.textContent = `Visiting ${actions.visiting}`;
    const rays = document.createElement("span");
    rays.className = "hud-rays";
    rays.innerHTML = Array.from({ length: RAYS }, () => `<img src="${ICONS["help-ray"]}" alt="">`).join("");
    visiting.append(rays);
    visiting.hidden = false;
    bar.querySelector<HTMLElement>("[data-home]")!.hidden = false;
    bar.classList.add("visiting");
  }
  const update = (t: Town) => {
    bar.querySelector(".hud-level-number")!.innerHTML = `<span class="hud-level-word">Level </span>${t.level}`;
    // How far from this level's experience to the next one's.
    const from = actions.levels?.[t.level - 1]?.xp ?? 0;
    const to = actions.levels?.[t.level]?.xp;
    // Visiting, the bar is empty, as in the Flash client.
    const done = actions.visiting ? 0 : to === undefined ? 1 : Math.min(Math.max((t.xp - from) / (to - from), 0), 1);
    bar.querySelector<HTMLElement>(".hud-xp-done")!.style.width = `${Math.round(done * 100)}%`;
    level.dataset.tip = actions.visiting ? `${actions.visiting}: level ${t.level}` : `${who(t)}: ` + (to === undefined ? `${numbers.format(t.xp)} XP, the last level`
      : `${numbers.format(t.xp)} of ${numbers.format(to)} XP for level ${t.level + 1}`);
    if (actions.population && !actions.visiting) {
      const people = actions.population(t);
      const pill = bar.querySelector<HTMLElement>(".hud-people")!;
      pill.hidden = false;
      pill.querySelector("[data-people]")!.textContent = `${people.current}/${people.max}`;
      pill.setAttribute("aria-label", `${people.current} people, room for ${people.max}`);
    }
    for (const key of RESOURCES) {
      bar.querySelector(`[data-n="${key}"]`)!.textContent = numbers.format(t[key]);
      bar.querySelector(`[data-short="${key}"]`)!.textContent = short(t[key]);
    }
  };
  update(town);

  // Music and sound: the Flash client's own buttons, a note and a speaker, crossed out when off.
  const sound = actions.sound;
  if (sound) {
    const music = bar.querySelector<HTMLButtonElement>("[data-music]")!;
    const effects = bar.querySelector<HTMLButtonElement>("[data-effects]")!;
    const show = () => {
      music.innerHTML = `<img src="${ICONS[sound.musicPlaying ? "music-on" : "music-off"]}" alt="">`;
      music.setAttribute("aria-label", sound.musicPlaying ? "Music: on" : "Music: off");
      music.dataset.tip = sound.musicPlaying ? "Music on" : "Music off";
      effects.innerHTML = `<img src="${ICONS[sound.effectsPlaying ? "sound-on" : "sound-off"]}" alt="">`;
      effects.setAttribute("aria-label", sound.effectsPlaying ? "Sounds: on" : "Sounds: off");
      effects.dataset.tip = sound.effectsPlaying ? "Sounds on" : "Sounds off";
    };
    music.addEventListener("click", () => sound.setMusic(!sound.musicPlaying));
    effects.addEventListener("click", () => sound.setEffects(!sound.effectsPlaying));
    sound.onChange(show);
    show();
    music.hidden = effects.hidden = false;
  }

  if (actions.pause) {
    bar.querySelector("[data-music]")!.before(actions.pause.button());
  }

  const fullscreen = bar.querySelector<HTMLButtonElement>("[data-fullscreen]")!;
  if (!document.fullscreenEnabled) {
    fullscreen.hidden = true;  // iPhones don't allow it for a page
  }
  fullscreen.addEventListener("click", () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void document.documentElement.requestFullscreen();
    }
  });
  document.addEventListener("fullscreenchange", () => {
    fullscreen.textContent = document.fullscreenElement ? "Exit full screen" : "Full screen";
  });
  if (actions.site) {
    showSite(bar, actions.site);
  }
  document.body.appendChild(bar);

  // The bottom right corner, as on the Flash client's bar: the pointer, the square tool, then the glove.
  const corner = document.createElement("div");
  corner.className = "corner";
  document.body.appendChild(corner);
  // The pointer: its button opens a menu of tools above it, as the Flash client's did.
  const tools = document.createElement("div");
  tools.className = "tools";
  tools.hidden = true;
  tools.innerHTML = `
    <div class="tool-menu" role="menu" hidden>
      <button type="button" role="menuitem" data-tool="pointer"><img src="${ICONS.pointer}" alt=""><span>Pointer</span></button>
      <button type="button" role="menuitem" data-tool="remove"><img src="${ICONS.remove}" alt=""><span>Remove</span></button>
      <button type="button" role="menuitem" data-tool="collect"><img src="${ICONS["fast-collect"]}" alt=""><span>Fast collect</span></button>
    </div>
    <button type="button" class="pointer-tool" aria-label="Tools" title="Tools: the pointer, Remove, Fast collect"><img src="${ICONS.pointer}" alt=""></button>`;
  corner.appendChild(tools);
  const menu = tools.querySelector<HTMLElement>(".tool-menu")!;
  const pointer = tools.querySelector<HTMLButtonElement>(".pointer-tool")!;
  let toolOn: Tool = "pointer";
  const square = document.createElement("button");
  square.type = "button";
  square.className = "square-tool";
  square.hidden = true;
  square.setAttribute("aria-label", "Square tool: select several units");
  square.title = "Square tool: drag a box round your units (Space)";
  square.innerHTML = `<img src="${ICONS["square-tool"]}" alt="">`;
  // Under the mouse, the game's own picture names the key for it.
  square.addEventListener("pointerenter", () => { square.querySelector("img")!.src = ICONS["square-tool-space"]; });
  square.addEventListener("pointerleave", () => { square.querySelector("img")!.src = ICONS["square-tool"]; });
  corner.appendChild(square);

  // The glove: the Flash client's fast-collect button, here collecting everything ready at once.
  const glove = document.createElement("button");
  glove.type = "button";
  glove.className = "collect-all";
  glove.hidden = true;
  glove.setAttribute("aria-label", "Collect all");
  glove.title = "Collect all (C)";
  glove.innerHTML = `<img src="${ICONS["fast-collect"]}" alt=""><span class="menu-count"></span>`;
  corner.appendChild(glove);
  let offered = false;
  return {
    update,
    helpsLeft(count) {
      const rays = bar.querySelectorAll<HTMLElement>(".hud-rays img");
      rays.forEach((ray, i) => ray.classList.toggle("used", i >= count));
      bar.querySelector(".hud-rays")?.setAttribute("aria-label", `${count} helps left`);
    },
    offerRename(rename) {
      level.setAttribute("role", "button");
      level.setAttribute("aria-label", "Your town's name");
      level.classList.add("renames");
      level.addEventListener("click", rename);
      level.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          rename();
        }
      });
    },
    offerCollectAll(run) {
      offered = true;
      glove.addEventListener("click", run);
      window.addEventListener("keydown", (e) => {
        if (e.key.toLowerCase() === "c" && !e.ctrlKey && !e.metaKey && !e.altKey && !glove.hidden) {
          run();
        }
      });
    },
    offerSquareTool(run) {
      square.hidden = false;
      square.addEventListener("click", run);
    },
    squareTool(on) {
      square.classList.toggle("lit", on);
    },
    offerTools(choose) {
      tools.hidden = false;
      pointer.addEventListener("click", () => {
        if (toolOn !== "pointer") {
          choose("pointer");  // Cancel: back to the pointer
        } else {
          menu.hidden = !menu.hidden;
        }
      });
      menu.addEventListener("click", (e) => {
        const item = (e.target as HTMLElement).closest<HTMLElement>("[data-tool]");
        if (item) {
          menu.hidden = true;
          choose(item.dataset.tool as Tool);
        }
      });
      // A press anywhere else (the map moved, say) closes the menu, as in the Flash client.
      document.addEventListener("pointerdown", (e) => {
        if (!tools.contains(e.target as Node)) {
          menu.hidden = true;
        }
      });
      window.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
          menu.hidden = true;
        }
      });
    },
    tool(tool) {
      toolOn = tool;
      const cancel = tool !== "pointer";
      pointer.querySelector("img")!.src = cancel ? ICONS["pointer-cancel"] : ICONS.pointer;
      pointer.setAttribute("aria-label", cancel ? "Cancel: back to the pointer" : "Tools");
      pointer.classList.toggle("lit", cancel);
    },
    offerBank(open) {
      for (const key of ["gold", "cash"]) {
        const pill = bar.querySelector(`[data-n="${key}"]`)!.parentElement!;
        const plus = document.createElement("button");
        plus.type = "button";
        plus.className = "pill-plus";
        plus.setAttribute("aria-label", key === "cash" ? "Bank: get cash" : "Bank: get gold");
        plus.textContent = "+";
        plus.addEventListener("click", open);
        pill.append(plus);
      }
    },
    ready(count) {
      glove.hidden = !offered || count === 0;
      glove.querySelector(".menu-count")!.textContent = String(count);
    },
  };
}

/** The message in the middle of the screen while loading, or when something fails. */
export function showStatus(text: string): void {
  let status = document.querySelector<HTMLElement>(".status");
  if (!status) {
    status = document.createElement("p");
    status.className = "status";
    document.body.appendChild(status);
  }
  status.textContent = text;
  status.hidden = text === "";
}

/** A message that slides in at the top for a moment ("" takes it away). */
export function showMessage(text: string): void {
  let message = document.querySelector<HTMLElement>(".message");
  if (!message) {
    message = document.createElement("p");
    message.className = "message";
    message.setAttribute("role", "status");
    document.body.appendChild(message);
  }
  if (text) {
    message.textContent = text;
    message.classList.add("shown");
  } else {
    message.classList.remove("shown");
  }
}

/**
 * The site's links in a Menu, as on the classic page's bar: Everybody (a new
 * tab, so the game plays on) with what waits there (requests, gifts, help;
 * asked again every two minutes and when the tab is back in view), Empires,
 * and Log out (a form, as the site's: another site can't log you out with a
 * link).
 */
function showSite(bar: HTMLElement, site: NonNullable<HudActions["site"]>): void {
  const holder = bar.querySelector<HTMLElement>(".site")!;
  const button = holder.querySelector<HTMLButtonElement>(".site-button")!;
  const menu = holder.querySelector<HTMLElement>(".site-menu")!;
  const friends = holder.querySelector<HTMLAnchorElement>("[data-friends]")!;
  holder.querySelector<HTMLInputElement>('input[name="csrf"]')!.value = site.csrf;
  const logOut = holder.querySelector<HTMLButtonElement>('form button')!;
  logOut.title = `Log out ${site.username}`;
  const news = (count: number) => {
    for (const badge of holder.querySelectorAll<HTMLElement>("[data-site-news], [data-friends-news]")) {
      badge.textContent = String(count);
      badge.hidden = count <= 0;
    }
    button.setAttribute("aria-label", count > 0 ? `Menu, ${count} waiting on the Everybody page` : "Menu");
    friends.setAttribute("aria-label", count > 0 ? `Everybody, ${count} waiting` : "Everybody");
  };
  news(site.news);
  const open = (on: boolean) => {
    menu.hidden = !on;
    button.setAttribute("aria-expanded", String(on));
  };
  button.addEventListener("click", () => open(button.getAttribute("aria-expanded") !== "true"));
  document.addEventListener("pointerdown", (event) => {
    if (!holder.contains(event.target as Node)) {
      open(false);
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !menu.hidden) {
      open(false);
    }
  });
  friends.addEventListener("click", () => open(false));
  const check = () => {
    if (document.hidden) {
      return;
    }
    fetch("/friends/news", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((reply: { news?: number } | null) => {
        if (typeof reply?.news === "number") {
          news(reply.news);
        }
      })
      .catch(() => {});
  };
  setInterval(check, NEWS_MS);
  document.addEventListener("visibilitychange", check);
  holder.hidden = false;
}
