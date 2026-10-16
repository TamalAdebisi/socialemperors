// Explicit pausing (CLIENT.md, "Pausing"): the pause button by the music
// and sound buttons stops the game. Switching tabs keeps it running.
// A dark curtain and the game's own
// GAME PAUSED say so; RESUME, or any key let go, starts it again. While
// paused nothing moves: units, fights, animations. Timers for work and
// training are the server's clock and carry on, as in the original.

import type { GameLoop } from "../gameLoop.ts";

import { ICONS } from "./icons.ts";

export class Pause {
  private readonly ticker: GameLoop;
  private curtain: HTMLElement | null = null;

  constructor(ticker: GameLoop) {
    this.ticker = ticker;
    window.addEventListener("keyup", () => this.resume());
  }

  get paused(): boolean {
    return this.curtain !== null;
  }

  pause(): void {
    if (this.curtain) {
      return;
    }
    this.ticker.stop();
    const curtain = document.createElement("div");
    curtain.className = "pause-curtain";
    curtain.setAttribute("role", "dialog");
    curtain.setAttribute("aria-label", "Game paused");
    const words = document.createElement("img");
    words.className = "pause-words";
    words.src = ICONS["game-paused"];
    words.alt = "GAME PAUSED";
    words.draggable = false;
    const resume = document.createElement("button");
    resume.type = "button";
    resume.className = "pause-resume";
    resume.setAttribute("aria-label", "Resume");
    resume.innerHTML = `<img src="${ICONS.resume}" alt="">`;
    resume.addEventListener("click", () => this.resume());
    curtain.append(words, resume);
    document.body.append(curtain);
    this.curtain = curtain;
    resume.focus();
  }

  resume(): void {
    if (!this.curtain) {
      return;
    }
    this.curtain.remove();
    this.curtain = null;
    this.ticker.start();
  }

  /** The pause button, for the top bar. */
  button(className = "hud-sound"): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.setAttribute("aria-label", "Pause");
    button.dataset.tip = "Pause";
    button.innerHTML = `<img src="${ICONS.pause}" alt="">`;
    button.addEventListener("click", () => this.pause());
    return button;
  }
}
