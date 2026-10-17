// Play the shipped adventure unchanged. Only our tiny loader connects its
// original parent callbacks to the town; no original source is copied here.
const BRIDGE = new URL("./art/riders/adventure.swf", import.meta.url).href;
interface RufflePlayer extends HTMLElement {
  load(options: Record<string, unknown>): Promise<void>;
  ruffle(): { callExternalInterface(name: string, ...args: unknown[]): unknown; suspend(): void };
}
type RuffleWindow = Window & { RufflePlayer?: { newest(): { createPlayer(): RufflePlayer } };
  seRiderAdventure?: (event: string, level: number, session: string) => void };
let loading: Promise<void> | undefined;
let nextSession = 0;

function loadRuffle(assets: string): Promise<void> {
  if ((window as RuffleWindow).RufflePlayer?.newest) return Promise.resolve();
  return loading ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `${assets}/ruffle/0.7.1/ruffle.js`;
    script.integrity = "sha384-6NrmfJx+zTZZPW41eipMGvyVrfvsDKenrh0v/YJ+nJq0WzzLvOHX6GCcQQ1GbIic";
    script.crossOrigin = "anonymous";
    script.addEventListener("load", () => resolve());
    script.addEventListener("error", () => { loading = undefined; reject(new Error("The adventure could not be loaded. Please try again.")); });
    document.head.append(script);
  });
}

export class RiderAdventure {
  private overlay: HTMLElement | null = null;
  private player: RufflePlayer | null = null;
  private keys = new Set<number>();
  private finished: (() => void) | null = null;
  private assets: string;
  private paused: (pause: boolean) => void;

  constructor(assets: string, paused: (pause: boolean) => void) { this.assets = assets; this.paused = paused; }

  async open(level: number, rider: number, won: () => void, closed: () => void): Promise<void> {
    this.close();
    const overlay = document.createElement("section");
    overlay.className = "rider-adventure";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-label", `Dragon rider adventure ${level}`);
    overlay.dataset.level = String(level);
    const session = String(++nextSession);
    overlay.dataset.session = session;
    const box = document.createElement("div");
    box.className = "rider-adventure-box";
    const close = document.createElement("button");
    close.type = "button";
    close.className = "button rider-adventure-close";
    close.textContent = "Close adventure";
    close.addEventListener("click", () => this.close());
    const status = document.createElement("p");
    status.className = "rider-adventure-status";
    status.setAttribute("role", "status");
    status.textContent = "Loading adventure…";
    const stage = document.createElement("div");
    stage.className = "rider-adventure-stage";
    const controls = document.createElement("div");
    controls.className = "rider-adventure-controls";
    controls.setAttribute("aria-label", "Adventure keys");
    for (const [label, code] of [["←", 37], ["↑", 38], ["→", 39], ["1", 49], ["2", 50], ["3", 51], ["4", 52], ["5", 53], ["6", 54], ["Pause", 56]] as const) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "button";
      button.textContent = label;
      button.setAttribute("aria-label", `Adventure key ${label}`);
      button.addEventListener("pointerdown", (event) => { event.preventDefault(); button.setPointerCapture(event.pointerId); this.key(code, true); });
      for (const kind of ["pointerup", "pointercancel", "lostpointercapture"]) button.addEventListener(kind, () => this.key(code, false));
      controls.append(button);
    }
    box.append(close, status, stage, controls);
    overlay.append(box);
    document.body.append(overlay);
    this.overlay = overlay;
    this.finished = closed;
    this.paused(true);
    window.addEventListener("keydown", this.keyboard, true);
    window.addEventListener("keyup", this.keyboard, true);
    window.addEventListener("blur", this.release);
    (window as RuffleWindow).seRiderAdventure = (event, completed, receivedSession) => {
      if (this.overlay !== overlay || completed !== level || receivedSession !== session) return;
      if (event === "ready") {
        overlay.dataset.ready = "true";
        status.textContent = "Move: ← → · Jump: ↑ · Attacks: 1–6 · Pause: 8";
      } else if (event === "won" || event === "lost") {
        // Let the movie finish its ExternalInterface call before destroying
        // its player. Recheck identity after yielding in case it was closed.
        queueMicrotask(() => {
          if (this.overlay !== overlay) return;
          this.close();
          if (event === "won") won();
        });
      } else if (event === "error") {
        status.textContent = "The adventure could not be loaded. Close it and try again.";
      }
    };
    try {
      await loadRuffle(this.assets);
      if (this.overlay !== overlay) return;
      const player = (window as RuffleWindow).RufflePlayer!.newest().createPlayer();
      this.player = player;
      stage.append(player);
      overlay.dataset.loading = "true";
      try {
        await player.load({ url: BRIDGE, autoplay: "on", allowScriptAccess: true, preferredRenderer: "webgl",
          backgroundColor: "#29201a", parameters: { level: String(level), rider: String(rider), session, game: `${this.assets}/swf/minigames/SagaOTDC.swf` } });
      } finally {
        overlay.dataset.loading = "false";
        if (this.overlay !== overlay) { player.ruffle().suspend(); overlay.remove(); }
      }
    } catch {
      if (this.overlay === overlay) status.textContent = "The adventure could not be loaded. Close it and try again.";
    }
  }

  close(): void {
    if (!this.overlay) return;
    this.release();
    this.player?.ruffle().suspend();
    // Ruffle can finish its first WASM initialization after a disconnected
    // element was destroyed. Keep a pending loader hidden until its promise
    // settles, then remove it, so its final instance is destroyed too.
    if (this.player && this.overlay.dataset.loading === "true") {
      this.overlay.classList.remove("rider-adventure");
      this.overlay.style.display = "none";
    } else this.overlay.remove();
    this.overlay = null;
    this.player = null;
    delete (window as RuffleWindow).seRiderAdventure;
    window.removeEventListener("keydown", this.keyboard, true);
    window.removeEventListener("keyup", this.keyboard, true);
    window.removeEventListener("blur", this.release);
    this.paused(false);
    const closed = this.finished;
    this.finished = null;
    closed?.();
  }

  private key(code: number, down: boolean): void {
    if (down) this.keys.add(code); else this.keys.delete(code);
    this.player?.ruffle().callExternalInterface("riderKey", code, down);
  }

  private release = (): void => { for (const code of this.keys) this.key(code, false); };
  private keyboard = (event: KeyboardEvent): void => {
    if (!this.overlay) return;
    event.stopImmediatePropagation();
    if (event.key === "Escape" && event.type === "keydown") { event.preventDefault(); this.close(); return; }
    const key = event.key.toLowerCase();
    const code = ({ arrowleft: 37, a: 65, arrowup: 38, w: 87, arrowright: 39, d: 68 } as Record<string, number>)[key]
      ?? (/^[1-689]$/.test(key) ? key.charCodeAt(0) : undefined);
    if (code !== undefined) { event.preventDefault(); this.key(code, event.type === "keydown"); }
  };
}
