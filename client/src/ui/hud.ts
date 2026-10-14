// The bar at the top of the screen, in HTML over the map (CLIENT.md: windows
// in HTML, sharp at any size): who is playing, their numbers, and buttons.

import type { Town } from "../rules/town.ts";

const numbers = new Intl.NumberFormat();

export interface HudActions {
  classicUrl: string;
  /** Showing another player's town. */
  visiting?: boolean;
}

export function showHud(town: Town, actions: HudActions): HTMLElement {
  const bar = document.createElement("header");
  bar.className = "hud";
  bar.innerHTML = `
    <div class="hud-player">
      <span class="hud-name"></span>
      <span class="hud-level" title="Level"></span>
    </div>
    <ul class="hud-resources">
      <li title="Gold"><span class="dot gold"></span><span data-n="gold"></span></li>
      <li title="Wood"><span class="dot wood"></span><span data-n="wood"></span></li>
      <li title="Food"><span class="dot food"></span><span data-n="food"></span></li>
      <li title="Stone"><span class="dot stone"></span><span data-n="stone"></span></li>
      <li title="Cash"><span class="dot cash"></span><span data-n="cash"></span></li>
    </ul>
    <div class="hud-buttons">
      <span class="hud-badge" title="This new client shows your town; to play, use the classic game">Preview: look only</span>
      <a class="hud-button" href="">Classic game</a>
      <button class="hud-button" type="button" data-fullscreen>Full screen</button>
    </div>`;
  const who = town.townName ? `${town.name} · ${town.townName}` : town.name;
  bar.querySelector(".hud-name")!.textContent = actions.visiting ? `Visiting ${who}` : who;
  bar.querySelector(".hud-level")!.textContent = `Level ${town.level}`;
  for (const key of ["gold", "wood", "food", "stone", "cash"] as const) {
    bar.querySelector(`[data-n="${key}"]`)!.textContent = numbers.format(town[key]);
  }
  bar.querySelector<HTMLAnchorElement>("a.hud-button")!.href = actions.classicUrl;

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
  return bar;
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
