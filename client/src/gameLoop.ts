// Browsers stop drawing hidden tabs. Keep simulation time separate from
// drawing, and replay throttled timer time in small steps so walks and
// battles keep their ordinary speed. The Pause button still stops both.
import type { Ticker } from "pixi.js";

interface LoopHost {
  now(): number;
  hidden(): boolean;
  every(run: () => void): void;
  visibility(run: () => void): void;
}

const browser: LoopHost = {
  now: () => performance.now(),
  hidden: () => document.hidden,
  every: (run) => { window.setInterval(run, 250); },
  visibility: (run) => { document.addEventListener("visibilitychange", run); },
};

export class GameLoop {
  private readonly ticker: Ticker;
  private readonly host: LoopHost;
  private readonly steps: ((ms: number) => void)[] = [];
  private backgroundAt: number | null = null;
  private resumedAt: number | null = null;
  private running = true;

  constructor(ticker: Ticker, host: LoopHost = browser) {
    this.ticker = ticker;
    this.host = host;
    if (host.hidden()) this.backgroundAt = host.now();
    ticker.add((frame) => {
      if (!this.running) return;
      if (host.hidden() || this.backgroundAt !== null) {
        this.catchUp();
      } else {
        // The first drawn frame can include time already handled by the
        // background timer. Count only the time since that catch-up.
        const ms = this.resumedAt === null ? frame.deltaMS : Math.min(frame.deltaMS, Math.max(0, host.now() - this.resumedAt));
        this.resumedAt = null;
        this.step(ms);
      }
    });
    host.every(() => this.catchUp());
    host.visibility(() => {
      if (!this.running) return;
      if (host.hidden() && this.backgroundAt === null) this.backgroundAt = host.now();
      this.catchUp();
    });
  }

  add(step: (ms: number) => void): void {
    this.steps.push(step);
  }

  stop(): void {
    this.running = false;
    this.backgroundAt = null;
    this.resumedAt = null;
    this.ticker.stop();
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.backgroundAt = this.host.hidden() ? this.host.now() : null;
    this.ticker.start();
  }

  private step(ms: number): void {
    for (const step of this.steps) step(ms);
  }

  private catchUp(): void {
    if (!this.running || this.backgroundAt === null) return;
    const now = this.host.now();
    // Bound each batch after a long browser suspension; retain the rest
    // for following turns instead of freezing the page or discarding time.
    for (let i = 0; i < 100 && this.backgroundAt < now; i++) {
      const ms = Math.min(100, now - this.backgroundAt);
      this.backgroundAt += ms;
      this.step(ms);
      if (!this.running) return;
    }
    if (!this.host.hidden() && this.backgroundAt >= now) {
      this.backgroundAt = null;
      this.resumedAt = now;
    }
  }
}
