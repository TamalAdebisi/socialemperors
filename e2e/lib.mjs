// What the browser tests play with: a new player with a new town, open in
// the new client, and the ways to tap, read and check it.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const DESKTOP = { width: 1280, height: 800 };
export const PHONE = { width: 390, height: 844 };

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
 */
export async function newPlayer(browser, base, out, visitor, { viewport = DESKTOP, phone = false, lessons = false, wild = false, camp = false, dock = false } = {}) {
  const context = await browser.newContext({
    viewport, locale: "en-US", extraHTTPHeaders: { "X-E2E-Visitor": visitor },
    ...(phone ? { deviceScaleFactor: 3, isMobile: true, hasTouch: true } : {}),
  });
  await serveArt(context);
  // No siege at random as the town opens (homeDefence.ts): tests bring raids when they want them.
  await context.addInitScript(() => {
    window.seCalm = true;
  });
  const page = await context.newPage();
  const player = new Player(page, base, out, viewport);
  const name = `e2e${Date.now() % 1e9}${Math.floor(Math.random() * 100)}`;
  const signUp = await page.request.post(base + "/register", { form: { username: name, password: `${name}-password`, csrf: await player.csrf() } });
  if (!signUp.ok()) throw new Error(`signing up failed: ${signUp.status()}`);
  await page.request.post(base + "/new", { form: { PLAYER: "client", csrf: await player.csrf() }, maxRedirects: 0 });
  player.name = name;
  if (!wild || !camp || !dock) {
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
    // starts the 4-hour wait for the next.
    await player.send([{ cmd: "collect_treasure", args: [0, 1, 3, 0, 0, 0] }]);
  }
  await player.open();
  // A new player is asked about Arthur's lessons first; most tests skip them, as a player may.
  if (!lessons) {
    const sent = page.waitForResponse((r) => r.url().endsWith("/command.php"));
    await player.press("Skip them");
    await sent;
  }
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
    page.on("pageerror", (error) => this.problems.push(error.message));
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

  /**
   * Clicks the map at a point. Where the selected thing's card covers the
   * map (the original's panel covered the same strip), the click reaches the
   * map behind it, as a player would after moving the map a little: the
   * tests' tiles stay where they were. Buttons on the card are pressed with
   * press() and locators, never with this.
   */
  async click(point) {
    const covered = await this.page.evaluate(({ x, y }) => {
      const card = document.querySelector(".actions.card:not([hidden])");
      if (!card || !card.contains(document.elementFromPoint(x, y))) return false;
      card.style.visibility = "hidden";
      return true;
    }, point);
    await this.page.mouse.click(point.x, point.y);
    if (covered) await this.page.evaluate(() => document.querySelector(".actions")?.style.removeProperty("visibility"));
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
   * guess, and the grass between them selects nothing. The point that worked.
   */
  async select([tx, ty], wanted) {
    const ok = typeof wanted === "function" ? wanted : (text) => text.startsWith(wanted);
    // Start from nothing selected, so what was selected before can't pass for it.
    if (await this.bar()) await this.page.keyboard.press("Escape");
    for (let up = 10; up <= 220; up += 15) {
      const point = this.screenOf(tx, ty, up);
      await this.click(point);
      const text = await this.bar();
      if (ok(text)) return { point, text };
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
   * for each pixel: a screenshot, read back by the page (no picture library here).
   */
  async pixels(box) {
    const png = await this.page.screenshot({ clip: box });
    const data = await this.page.evaluate(async (base64) => {
      const image = new Image();
      image.src = `data:image/png;base64,${base64}`;
      await image.decode();
      const canvas = new OffscreenCanvas(image.width, image.height);
      const context = canvas.getContext("2d");
      context.drawImage(image, 0, 0);
      return Array.from(context.getImageData(0, 0, image.width, image.height).data);
    }, png.toString("base64"));
    const pixels = [];
    for (let i = 0; i < data.length; i += 4) pixels.push([data[i], data[i + 1], data[i + 2]]);
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
