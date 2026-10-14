// The menu buttons (CLIENT.md, "The menus: rail and dock"): a rail down the
// left of a wide screen, a dock across the bottom of a phone. One row of
// buttons, the game's own pictures with their names under them; the style
// sheet stands it up or lays it down, and shows each button where it
// belongs (Quests and Battle on the rail, World in the dock). The button
// whose window is open is lit in gold; a red count says what's waiting.

import { onPanelChange } from "./panel.ts";

export interface MenuButton {
  key: string;
  label: string;
  icon: string;
  /** Where it shows: "rail" only on wide screens, "dock" only on phones. */
  only?: "rail" | "dock";
  run: () => void;
  /** A keyboard shortcut (a letter), shown in its tip. */
  shortcut?: string;
}

export class Menus {
  private readonly nav: HTMLElement;
  private readonly buttons = new Map<string, HTMLButtonElement>();

  constructor(buttons: MenuButton[]) {
    this.nav = document.createElement("nav");
    this.nav.className = "menus";
    this.nav.setAttribute("aria-label", "Menus");
    for (const spec of buttons) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "menu";
      if (spec.only) {
        button.dataset.only = spec.only;
      }
      button.innerHTML = `<img src="${spec.icon}" alt=""><span class="menu-label"></span><span class="menu-count" hidden></span>`;
      button.querySelector(".menu-label")!.textContent = spec.label;
      button.setAttribute("aria-label", spec.label);
      if (spec.shortcut) {
        button.title = `${spec.label} (${spec.shortcut.toUpperCase()})`;
      }
      button.addEventListener("click", () => spec.run());
      this.buttons.set(spec.key, button);
      this.nav.append(button);
    }
    // Letters as shortcuts, when nothing is being typed.
    window.addEventListener("keydown", (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || (e.target as Element)?.closest?.("input, textarea")) {
        return;
      }
      const spec = buttons.find((b) => b.shortcut === e.key.toLowerCase());
      if (spec && this.buttons.get(spec.key)!.getClientRects().length > 0) {
        spec.run();
      }
    });
    onPanelChange((open) => this.light(open?.key ?? null));
    document.body.appendChild(this.nav);
  }

  /** Light the button whose window is open (null: none). */
  light(key: string | null): void {
    for (const [name, button] of this.buttons) {
      button.setAttribute("aria-pressed", String(name === key));
    }
  }

  /** The red count on a button: what's waiting there (0 hides it). */
  count(key: string, n: number): void {
    const badge = this.buttons.get(key)?.querySelector<HTMLElement>(".menu-count");
    if (badge) {
      badge.textContent = n > 99 ? "99+" : String(n);
      badge.hidden = n <= 0;
    }
  }
}
