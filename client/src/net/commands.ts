// Sending the player's actions to the server, as the Flash client does
// (command.php): actions wait in a queue and go in a batch every 3 seconds,
// one batch at a time. A batch that fails is sent again, up to 3 tries.
//
// A batch is the form field "data": 64 characters (Social Point's
// signature, which our server doesn't check), ";" and then JSON:
//   {"first_number": how many commands were sent before this batch,
//    "commands": [{"cmd": "move", "args": [...]}, ...],
//    "tries": 1, 2 or 3, "ts": the client's clock (seconds),
//    "accessToken": "", "publishActions": "0"}   (Facebook's, unused)

import type { PageSettings } from "./server.ts";

export interface Command {
  cmd: string;
  args: unknown[];
}

interface Batch {
  firstNumber: number;
  commands: Command[];
  tries: number;
}

export interface CommandSenderOptions {
  /** The game's clock, in seconds (the server's time, as the town was loaded, plus time since). */
  clock: () => number;
  /** How a request is made: fetch, or a stand-in for tests. */
  post?: (url: string, body: URLSearchParams) => Promise<{ ok: boolean; status: number }>;
  /** Told when actions can't be saved (after 3 tries, or the game's token expired). */
  onFailure?: (reason: string) => void;
}

const SIGNATURE = "0".repeat(64);
const SEND_EVERY_MS = 3000;
const MAX_TRIES = 3;

export class CommandSender {
  private readonly settings: PageSettings;
  private readonly options: CommandSenderOptions;
  private queue: Command[] = [];
  private inFlight: Batch | null = null;
  private failed: Batch | null = null;
  private nextNumber = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private stopped = false;

  constructor(settings: PageSettings, options: CommandSenderOptions) {
    this.settings = settings;
    this.options = options;
  }

  /** Queue an action for the next batch. */
  add(cmd: string, ...args: unknown[]): void {
    this.queue.push({ cmd, args });
  }

  /** Actions not yet confirmed by the server. */
  get pending(): number {
    return this.queue.length + (this.inFlight?.commands.length ?? 0) + (this.failed?.commands.length ?? 0);
  }

  /** Send every 3 seconds, and whatever is left when the page is closed or hidden. */
  start(): void {
    this.timer = setInterval(() => void this.tick(), SEND_EVERY_MS);
    const leave = () => this.sendBeacon();
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        leave();
      }
    });
    window.addEventListener("pagehide", leave);
  }

  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
    }
    this.stopped = true;
  }

  /**
   * Send everything waiting now, and wait for the server to have it: before
   * something that reads the save outside the commands (the bank). False
   * when it couldn't all be sent.
   */
  async flush(): Promise<boolean> {
    for (let round = 0; round < 50 && this.pending > 0 && !this.stopped; round++) {
      if (this.inFlight !== null) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      } else {
        await this.tick();
      }
    }
    return this.pending === 0;
  }

  /** One round: send the failed batch again, or the queue as a new batch. */
  async tick(): Promise<void> {
    if (this.inFlight !== null || this.stopped) {
      return;
    }
    let batch = this.failed;
    this.failed = null;
    if (batch === null) {
      if (this.queue.length === 0) {
        return;
      }
      batch = { firstNumber: this.nextNumber, commands: this.queue, tries: 0 };
      this.nextNumber += this.queue.length;
      this.queue = [];
    }
    batch.tries++;
    this.inFlight = batch;
    let status = 0;
    try {
      status = (await this.post(this.body(batch))).status;
    } catch {
      status = 0;  // no answer: the network
    }
    this.inFlight = null;
    if (status === 200) {
      return;
    }
    this.failed = batch;  // again next round, unless we give up (it stays unsaved)
    if (status === 403) {
      this.giveUp("Your game session has expired. Reload the page to go on.");
    } else if (batch.tries >= MAX_TRIES) {
      this.giveUp("Your last changes couldn't be saved. Reload the page to see your town as it is.");
    }
  }

  private giveUp(reason: string): void {
    this.stop();
    this.options.onFailure?.(reason);
  }

  /** What's left, sent while the page goes away (the browser finishes it for us). */
  private sendBeacon(): void {
    const commands = [...(this.failed?.commands ?? []), ...this.queue];
    if (commands.length === 0 || this.stopped || typeof navigator.sendBeacon !== "function") {
      return;
    }
    const batch: Batch = { firstNumber: this.failed?.firstNumber ?? this.nextNumber, commands, tries: 1 };
    if (navigator.sendBeacon(this.url(), this.body(batch))) {
      this.nextNumber = batch.firstNumber + commands.length;
      this.failed = null;
      this.queue = [];
    }
  }

  /** The form the server reads: who we are, and the batch. */
  body(batch: Batch): URLSearchParams {
    const payload = {
      first_number: batch.firstNumber,
      commands: batch.commands,
      tries: batch.tries,
      accessToken: "",
      publishActions: "0",
      ts: Math.floor(this.options.clock()),
    };
    return new URLSearchParams({
      USERID: this.settings.userId,
      user_key: this.settings.userKey,
      data: `${SIGNATURE};${JSON.stringify(payload)}`,
    });
  }

  private url(): string {
    return `${this.settings.dynamicUrl}/command.php`;
  }

  private post(body: URLSearchParams): Promise<{ ok: boolean; status: number }> {
    if (this.options.post) {
      return this.options.post(this.url(), body);
    }
    // keepalive: a batch already on its way still arrives if the page is closed.
    return fetch(this.url(), { method: "POST", body, keepalive: true });
  }
}
