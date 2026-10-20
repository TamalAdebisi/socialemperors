// What the browser tests play with: a new player with a new town, open in
// the new client, and the ways to tap, read and check it.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const DESKTOP = { width: 1280, height: 800 };
export const PHONE = { width: 390, height: 844 };
/** The test server's Discord link (SE_DISCORD_URL), as the live game's would be: never opened. */
export const DISCORD = "https://discord.gg/e2e-example";
/** The test server's admin (SE_ADMINS): the account a test signs up with this name opens /admin. */
export const ADMIN = "e2eadmin";

// Playwright's requests do not pick up the shell's proxy automatically.
// Cloud runners need it for the art bucket; the throwaway server stays local.
const proxyServer = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
const network = proxyServer ? { proxy: { server: proxyServer, bypass: "localhost,127.0.0.1" } } : {};

/**
 * Enough trees, rocks and wild animals for a town (rules/nature.ts), in the
 * wild corners at the top of the map: with them, none grow on the player's
 * land when the town opens, where they'd stand in a test's way (or be
 * caught by a unit and walk off). A few trees and rocks can be cut before
 * more grow. And a villager (a woman: the tests' own are men), far off,
 * so the game doesn't give the town one near the middle (rules/cleanup.ts).
 */
const FULL_WILD = [
  ...Array.from({ length: 200 }, (_, i) => [19, i % 20, Math.floor(i / 20), "b"]),
  ...Array.from({ length: 24 }, (_, i) => [73, 80 + (i % 20), Math.floor(i / 20), "b"]),
  ...Array.from({ length: 24 }, (_, i) => [69, 80 + (i % 20), 2 + Math.floor(i / 20), "b"]),
  // Sheep, cows and horses, apart from the trees.
  ...[505, 504, 571].flatMap((id, row) => Array.from({ length: 7 }, (_, i) => [id, 2 * i, 12 + 2 * row, "u"])),
  [501, 30, 5, "u"],
].map(([id, x, y, type]) => ({ cmd: "buy", args: [id, x, y, 0, 0, 1, 1, type] }));

/**
 * A new account with a new town, open in the new client. Its own browser
 * window, as its own visitor. `wild`: let trees and rocks grow as for a new
 * player, rather than starting with enough. `dock`: let the town be given its
 * harbour (and zeppelin tower) as it opens, rather than starting with them.
 * `name`: the account's name (ADMIN for the admin, once a run) instead of a
 * new one. `darts`: show the "Free dart" offer as the town opens, which other
 * tests hold back. `game`: false for the site's own pages only: the town is made,
 * but neither set up nor opened. `scale`: screen pixels per page pixel (2 for
 * a Retina laptop's screen), on a desktop.
 */
export async function newPlayer(browser, base, out, visitor, { viewport = DESKTOP, phone = false, scale = null, lessons = false, wild = false, camp = false, dock = false, raids = false, darts = false, name: username = null, game = true } = {}) {
  const context = await browser.newContext({
    ...network,
    viewport, locale: "en-US", extraHTTPHeaders: { "X-E2E-Visitor": visitor },
    ...(phone ? { deviceScaleFactor: 3, isMobile: true, hasTouch: true } : {}),
    ...(scale ? { deviceScaleFactor: scale } : {}),
  });
  await serveArt(context);
  // Ordinary feature fixtures hold raids; recurring-raids opts into the real scheduler.
  // Combat checks bring specific raids with hurry/bring.
  // Darts rounds run every week now: their "Free dart" offer on opening would
  // cover what a test presses, so only the darts test (`darts`) sees it.
  await context.addInitScript(([raids, darts]) => {
    window.seCalm = !raids;
    window.seNoDartsOffer = !darts;
  }, [raids, darts]);
  const page = await context.newPage();
  const player = new Player(page, base, out, viewport);
  const name = username ?? `e2e${Date.now() % 1e9}${Math.floor(Math.random() * 100)}`;
  const signUp = await page.request.post(base + "/register", { form: { username: name, password: `${name}-password`, csrf: await player.csrf() } });
  if (!signUp.ok()) throw new Error(`signing up failed: ${signUp.status()}`);
  await page.request.post(base + "/new", { form: { PLAYER: "client", csrf: await player.csrf() }, maxRedirects: 0 });
  player.name = name;
  if (!game) {
    await player.readSettings();
    return player;
  }
  if (!lessons || !wild || !camp || !dock) {
    await player.readSettings();
  }
  if (!dock) {
    // A human town is given a harbour as it opens, and from level 30 a zeppelin tower, near
    // tile (59, 59) where tests build (rules/dock.ts); most tests start with both in the far corner.
    await player.send([{ cmd: "buy", args: [224, 44, 44, 0, 0, 1, 1, "b"] }, { cmd: "buy", args: [299, 48, 44, 0, 0, 1, 1, "b"] }]);
  }
  if (!wild) {
    await player.send(FULL_WILD);
  }
  if (!camp) {
    // A new town gets its first troll camp at once (homeCamps.ts); most tests start
    // as if its chest had just been opened instead (1 point of experience), which
    // starts the 10-minute wait for the next.
    await player.send([{ cmd: "collect_treasure", args: [0, 1, 3, 0, 0, 0] }]);
  }
  // Other feature tests start with the tutorial completed in their fixture.
  // Fresh-player tutorial tests keep the real mandatory flow.
  if (!lessons) await player.send([{ cmd: "complete_tutorial", args: [33] }]);
  await player.open();
  return player;
}

// The live bucket only lets the game's own site read its art, so a page on
// this computer can't. When the test server uses it, the test windows fetch
// the art themselves instead, and keep a copy for the next run.
// What each kind of file is, for the browser: Ruffle (the classic game) needs its
// script and WebAssembly named as such.
const TYPES = {
  ".json": "application/json", ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg",
  ".js": "text/javascript", ".wasm": "application/wasm", ".swf": "application/x-shockwave-flash",
  ".mp3": "audio/mpeg", ".xml": "text/xml",
};
const ART_CACHE = join(dirname(dirname(fileURLToPath(import.meta.url))), ".tools", "art-cache");

async function serveArt(context) {
  const live = process.env.SE_E2E_LIVE_ASSETS;
  if (!live) return;
  await context.route(`${live}/**`, async (route) => {
    const url = route.request().url();
    const file = join(ART_CACHE, new URL(url).pathname);
    let body = existsSync(file) ? readFileSync(file) : null;
    let status = 200;
    if (!body) {
      const response = await context.request.get(url).catch(() => null);
      status = response?.status() ?? 502;
      if (status === 200) {
        body = await response.body();
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, body);
      }
    }
    const type = TYPES[extname(file)] ?? "application/octet-stream";
    await route.fulfill({ status, body: body ?? "", headers: { "content-type": type, "access-control-allow-origin": "*" } });
  });
}

export class Player {
  constructor(page, base, out, viewport) {
    this.page = page;
    this.base = base;
    this.out = out;
    this.viewport = viewport;
    /** Errors the page reported: a test fails on any. */
    this.problems = [];
    /** The same player in other windows (onPhone). */
    this.companions = [];
    page.on("pageerror", (error) => this.problems.push(error.stack ?? error.message));
    page.on("console", (message) => {
      // A missing picture is the art's business (the shop draws its own then), not the client's.
      if (message.type() === "error" && !message.text().includes("404")) this.problems.push(message.text());
    });
  }

  async csrf() {
    await this.page.goto(this.base + "/");
    return this.page.locator('input[name="csrf"]').first().getAttribute("value");
  }

  /** The page's settings (who the player is, where the server is), without opening the game. */
  async readSettings() {
    const html = await (await this.page.request.get(this.base + "/client.html")).text();
    this.settings = JSON.parse(html.match(/<script id="se-settings" type="application\/json">([\s\S]*?)<\/script>/)[1]);
  }

  /** The new client, once the town is drawn. */
  async open() {
    await this.page.goto(this.base + "/client.html");
    await this.loaded();
    this.settings = JSON.parse(await this.page.locator("#se-settings").textContent());
  }

  async reload() {
    await this.page.reload();
    await this.loaded();
  }

  async loaded() {
    await this.page.waitForFunction(() => {
      const status = document.querySelector(".status");
      return status && status.hidden;
    }, null, { timeout: 60_000 });
    await this.wait(800);  // signs come up with the first refresh
    // A town set up with experience past its level opens with the level-up window over the map,
    // as the Flash client did; tests go on past it, as a player would (e2e/tests/levelup.mjs looks at it).
    await this.closeLevelUps();
  }

  /** OK on each level-up window showing (ui/levelUp.ts), one after another. */
  async closeLevelUps() {
    for (let i = 0; i < 40 && await this.page.locator(".level-window").count(); i++) {
      await this.page.locator(".level-ok").click();
    }
  }

  wait(ms) {
    return this.page.waitForTimeout(ms);
  }

  async close() {
    await Promise.all(this.companions.map((other) => other.close()));
    await this.page.context().close();
  }

  /** The same player signed in on a phone, in a window of its own. */
  async onPhone() {
    const mine = this.page.context();
    const context = await mine.browser().newContext({
      ...network,
      viewport: PHONE, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: "en-US",
    });
    await context.addCookies(await mine.cookies());
    await serveArt(context);
    const phone = new Player(await context.newPage(), this.base, this.out, PHONE);
    this.companions.push(phone);
    await phone.open();
    return phone;
  }

  shot(name) {
    return this.page.screenshot({ path: join(this.out, `${name}.png`) });
  }

  // ---- Where things are -----------------------------------------------------

  /** The screen point `up` pixels (at zoom 1) above tile (tx, ty)'s bottom corner, with the camera where it starts. */
  screenOf(tx, ty, up = 15) {
    const { width, height } = this.viewport;
    const zoom = 0.7 * Math.min(Math.max(Math.min(width / 760, height / 600), 0.6), 3);
    return {
      x: width / 2 + (54 * (tx - ty) + 84) * zoom,
      y: height / 2 + (27 * (tx + ty) - 54 - up - 2679) * zoom,
    };
  }

  /** Clicks at a screen point, with the same visible controls as a player. */
  async click(point) {
    await this.page.mouse.click(point.x, point.y);
    await this.wait(250);
  }

  async hover([tx, ty]) {
    const point = this.screenOf(tx, ty);
    await this.page.mouse.move(point.x, point.y);
    await this.wait(250);
  }

  /** Taps tile (tx, ty)'s spot, for placing and moving. */
  async tapTile([tx, ty]) {
    await this.hover([tx, ty]);
    await this.click(this.screenOf(tx, ty));
  }

  /**
   * Taps ever higher above a tile until the action bar shows what's wanted
   * (text it starts with, or a test): pictures stand higher or lower than a
   * guess, and the grass between them selects nothing. Prefer a point
   * still visible after the card opens, so a later click can reach it too.
   */
  async select([tx, ty], wanted) {
    const ok = typeof wanted === "function" ? wanted : (text) => text.startsWith(wanted);
    // Start from nothing selected, so what was selected before can't pass for it.
    if (await this.bar()) await this.page.keyboard.press("Escape");
    for (let up = 10; up <= 220; up += 15) {
      const point = this.screenOf(tx, ty, up);
      await this.click(point);
      const text = await this.bar();
      if (ok(text)) {
        // The taller panel can cover the feet we just clicked. Find a
        // visible pixel of the same picture without sending another click.
        const candidates = Array.from({ length: 15 }, (_, i) => this.screenOf(tx, ty, 10 + i * 15));
        const visible = await this.page.evaluate(({ point, candidates }) => {
          const view = window.seHome?.parts.view;
          const selected = view?.itemAt(point);
          return selected && candidates.find((at) => document.elementFromPoint(at.x, at.y)?.tagName === "CANVAS"
            && view.itemAt(at) === selected);
        }, { point, candidates });
        return { point: visible || point, text };
      }
    }
    throw new Error(`nothing right above ${tx}, ${ty}; the bar says "${await this.bar()}"`);
  }

  // ---- What's on screen -----------------------------------------------------

  button(label) {
    return this.page.getByRole("button", { name: label, exact: true });
  }

  /** A button of the rail (or the dock), by its name. */
  async menu(label) {
    await this.page.locator(`.menus button[aria-label="${label}"]`).click();
    await this.wait(300);
  }

  async press(label) {
    await this.button(label).click();
    await this.wait(300);
  }

  /**
   * Sells what's at a point with the bulldozer (the pointer's Remove), as
   * the original does: it asks first for most things ("Sell" or "Remove"
   * then confirms), then the tool is put down again.
   */
  async bulldoze(point, confirm = /^(Sell|Remove)$/) {
    await this.page.locator(".pointer-tool").click();
    await this.page.locator('.tool-menu [data-tool="remove"]').click();
    await this.click(point);
    if (confirm) {
      const asked = this.page.locator(".actions.asking button", { hasText: confirm });
      if (await asked.count()) await asked.first().click();
    }
    await this.wait(300);
    await this.page.locator(".pointer-tool").click();
  }

  /**
   * The screen's colours in a box ({ x, y, width, height }), as [r, g, b]
   * for each pixel. Decode outside the game page: measuring the screen must
   * not add image uploads to the graphics context under test. Setup already
   * installs Pillow in the Python used by the local test server.
   */
  async pixels(box) {
    const png = await this.page.screenshot({ clip: box });
    const data = execFileSync(process.env.PYTHON || "python3", ["-c",
      'import io, sys; from PIL import Image; sys.stdout.buffer.write(Image.open(io.BytesIO(sys.stdin.buffer.read())).convert("RGB").tobytes())',
    ], { input: png, maxBuffer: 64 * 1024 * 1024 });
    const pixels = [];
    for (let i = 0; i < data.length; i += 3) pixels.push([data[i], data[i + 1], data[i + 2]]);
    return pixels;
  }

  /** The action bar's text, or "" when it's hidden. */
  async bar() {
    const bar = this.page.locator(".actions");
    return (await bar.isHidden()) ? "" : (await bar.textContent()).trim();
  }

  async barButtons() {
    const bar = this.page.locator(".actions");
    return (await bar.isHidden()) ? [] : (await bar.locator("button").allTextContents()).map((text) => text.trim());
  }

  /** Waits (up to 10 s) for a message at the top that matches, as messages wait their turn; the text. */
  async said(pattern) {
    const until = Date.now() + 10_000;
    let last = "";
    while (Date.now() < until) {
      last = await this.status();
      if (pattern.test(last)) return last;
      await this.wait(200);
    }
    throw new Error(`no message like ${pattern}; the last was "${last}"`);
  }

  /** The message at the top, or "" when there's none. */
  async status() {
    const message = this.page.locator(".message.shown");
    return (await message.count()) ? (await message.textContent()).trim() : "";
  }

  /** A card in the shop or storage, by the item's name. */
  card(name) {
    return this.page.locator(".shop-card", { has: this.page.locator(".shop-name", { hasText: new RegExp(`^${name}$`) }) });
  }

  // ---- The server's side ----------------------------------------------------

  /** Sends commands as the Flash client does, to set a town up. */
  async send(commands) {
    const response = await this.page.request.post(`${this.base}${this.settings.dynamicUrl}/command.php`, { form: {
      USERID: this.settings.userId, user_key: this.settings.userKey,
      data: "0".repeat(64) + ";" + JSON.stringify({ first_number: 0, commands, tries: 1, accessToken: "", publishActions: "0", ts: Math.floor(Date.now() / 1000) }),
    } });
    if (!response.ok()) throw new Error(`the server refused the commands: ${response.status()}`);
  }

  /** The town as the server has it saved, after the client's next batch of commands (every 3 seconds). */
  async saved({ waitForBatch = true } = {}) {
    if (waitForBatch) await this.wait(4000);
    const response = await this.page.request.post(`${this.base}${this.settings.dynamicUrl}/get_player_info.php`,
      { form: { USERID: this.settings.userId, user_key: this.settings.userKey } });
    return (await response.json()).map;
  }
}

/** Whether a saved town has item `id` at (x, y). */
export function has(map, id, [x, y]) {
  return map.items.some((item) => item[0] === id && item[1] === x && item[2] === y);
}

/** The saved item `id` at (x, y), if there is one. */
export function itemAt(map, id, [x, y]) {
  return map.items.find((item) => item[0] === id && item[1] === x && item[2] === y);
}

/** How many of item `id` a storage box holds: saves keep it as {id: count} or as a list by id. */
export function stored(box, id) {
  return Number((Array.isArray(box) ? box[id] : box?.[id]) ?? 0);
}
