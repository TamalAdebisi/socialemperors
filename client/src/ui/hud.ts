// What's always on screen, in HTML over the map (CLIENT.md, "The menus:
// rail and dock"): the level with a bar to the next, and the resources as
// dark pills with the game's own icons (short numbers on a phone: 12.4k);
// the way back to the classic game and full screen; and the fast-collect
// glove, which collects every ready building at once. Messages slide in at
// the top, not over the middle of the town.

import type { Level } from "../rules/levels.ts";
import type { Town } from "../rules/town.ts";
import { short } from "./format.ts";
import { ICONS } from "./icons.ts";

const numbers = new Intl.NumberFormat("en-US");

export interface HudActions {
  classicUrl: string;
  /** Showing another player's town. */
  visiting?: boolean;
  /** The levels table, for how far the town is from the next. */
  levels?: Level[];
  /** The town's people and the room for them. */
  population?: (town: Town) => { current: number; max: number };
}

export interface Hud {
  /** Show the town's numbers again (after a sale...). */
  update(town: Town): void;
  /** Offer the glove: collect everything ready. */
  offerCollectAll(run: () => void): void;
  /** How many buildings are ready: the glove shows when there are any, with the count. */
  ready(count: number): void;
}

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
      <a class="button tiny gold" data-classic href="">Classic game</a>
      <button class="button tiny gold" type="button" data-fullscreen>Full screen</button>
    </div>`;
  const who = town.townName ? `${town.name} · ${town.townName}` : town.name;
  const level = bar.querySelector<HTMLElement>(".hud-level")!;
  if (actions.visiting) {
    const visiting = bar.querySelector<HTMLElement>(".hud-visiting")!;
    visiting.textContent = `Visiting ${who}`;
    visiting.hidden = false;
    bar.querySelector<HTMLElement>("[data-home]")!.hidden = false;
    bar.classList.add("visiting");
  }
  const update = (t: Town) => {
    bar.querySelector(".hud-level-number")!.innerHTML = `<span class="hud-level-word">Level </span>${t.level}`;
    // How far from this level's experience to the next one's.
    const from = actions.levels?.[t.level - 1]?.xp ?? 0;
    const to = actions.levels?.[t.level]?.xp;
    const done = to === undefined ? 1 : Math.min(Math.max((t.xp - from) / (to - from), 0), 1);
    bar.querySelector<HTMLElement>(".hud-xp-done")!.style.width = `${Math.round(done * 100)}%`;
    level.dataset.tip = (actions.visiting ? "" : `${who}: `) + (to === undefined ? `${numbers.format(t.xp)} XP, the last level`
      : `${numbers.format(t.xp)} of ${numbers.format(to)} XP for level ${t.level + 1}`);
    if (actions.population) {
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
  bar.querySelector<HTMLAnchorElement>("[data-classic]")!.href = actions.classicUrl;

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
  document.body.appendChild(bar);

  // The glove: the Flash client's fast-collect button, here collecting everything ready at once.
  const glove = document.createElement("button");
  glove.type = "button";
  glove.className = "collect-all";
  glove.hidden = true;
  glove.setAttribute("aria-label", "Collect all");
  glove.title = "Collect all (C)";
  glove.innerHTML = `<img src="${ICONS["fast-collect"]}" alt=""><span class="menu-count"></span>`;
  document.body.appendChild(glove);
  let offered = false;
  return {
    update,
    offerCollectAll(run) {
      offered = true;
      glove.addEventListener("click", run);
      window.addEventListener("keydown", (e) => {
        if (e.key.toLowerCase() === "c" && !e.ctrlKey && !e.metaKey && !e.altKey && !glove.hidden) {
          run();
        }
      });
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
