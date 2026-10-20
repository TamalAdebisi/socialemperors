// Browser tests for the new game client. Starts a game server on this
// computer, on a free port with a throwaway data folder, then plays each
// test in e2e/tests/ in Chromium (or WebKit) and says which passed.
//
//   node e2e/run.mjs              every test (builds the client first)
//   node e2e/run.mjs shop edit    only these
//   --no-build                    use client/dist as it is
//   --keep                        keep the data folder, and say where it is
//   --webkit                      use Safari's engine; output in work/e2e-webkit/
//
// Needs the server's Python packages (pip install -r requirements.txt; set
// PYTHON to use a particular python), Node 22, and Playwright with Chromium
// (npm i -g playwright, then npx playwright install chromium). Screenshots
// and the server's log go to e2e/out/. It makes accounts, so it only ever
// runs against its own server, never the live site.
// For --webkit, also install that engine: npx playwright install webkit.
// The art: art/sheets/ when tools/export_art.sh has made it here, or else the
// live art bucket, whose address goes in SE_E2E_LIVE_ASSETS. The repository is
// public, so it doesn't name the bucket: set that in your environment.

import { execSync, spawn, spawnSync } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { ADMIN, DISCORD, newPlayer, Player } from "./lib.mjs";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const TESTS = join(ROOT, "e2e", "tests");
// The art sheets: made on this computer by tools/export_art.sh, or else the live ones.
const LIVE_ASSETS = (process.env.SE_E2E_LIVE_ASSETS || "").replace(/\/+$/, "");
const borrowArt = !existsSync(join(ROOT, "art", "sheets")) && !process.env.SE_ASSETS_URL;

const args = process.argv.slice(2);
const flags = new Set(args.filter((arg) => arg.startsWith("--")));
const output = flags.has("--webkit") ? "work/e2e-webkit" : "e2e/out";
const OUT = join(ROOT, output);
const names = args.filter((arg) => !arg.startsWith("--"));
const all = readdirSync(TESTS).filter((file) => file.endsWith(".mjs")).map((file) => basename(file, ".mjs")).sort();
const chosen = names.length ? names : all;
for (const name of chosen) {
  if (!all.includes(name)) {
    console.error(`No test called ${name}. There are: ${all.join(", ")}`);
    process.exit(2);
  }
}
if (borrowArt && !LIVE_ASSETS) {
  console.error("No art to test with: make art/sheets with tools/export_art.sh, or set SE_E2E_LIVE_ASSETS to the live art bucket's address.");
  process.exit(2);
}

/** Playwright from this folder's packages, or else the one installed for everyone. */
async function playwright() {
  try {
    return await import("playwright");
  } catch {
    const global = execSync("npm root -g", { encoding: "utf8" }).trim();
    return createRequire(import.meta.url)(join(global, "playwright"));
  }
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

async function waitForServer(base, server, log) {
  const until = Date.now() + 90_000;
  while (Date.now() < until) {
    if (server.exitCode !== null) {
      throw new Error(`the server stopped (exit ${server.exitCode}):\n${readFileSync(log, "utf8").slice(-2000)}`);
    }
    try {
      if ((await fetch(base + "/")).ok) return;
    } catch {
      // not listening yet
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("the server didn't answer within 90 seconds");
}

if (!flags.has("--no-build")) {
  console.log("Building the client...");
  const build = spawnSync("npm", ["run", "build"], { cwd: join(ROOT, "client"), stdio: "inherit" });
  if (build.status !== 0) process.exit(build.status ?? 1);
}
if (!existsSync(join(ROOT, "client", "dist"))) {
  console.error("client/dist is missing: build the client, or leave out --no-build.");
  process.exit(2);
}

mkdirSync(OUT, { recursive: true });
const data = mkdtempSync(join(tmpdir(), "se-e2e-"));
const port = await freePort();
const base = `http://127.0.0.1:${port}`;
const env = { ...process.env, SE_DATA_DIR: data, SE_PORT: String(port), SE_BIND_HOST: "127.0.0.1",
  // Each test player says it's a different visitor, so the five new accounts an hour per visitor don't run out.
  SE_CLIENT_IP_HEADER: "X-E2E-Visitor",
  // Where players get in touch (SE_DISCORD_URL): every page shows its links (e2e/tests/contact.mjs).
  SE_DISCORD_URL: DISCORD,
  // Who may open the admin page (e2e/tests/admin-cash.mjs): nobody until a test signs up with this name.
  SE_ADMINS: ADMIN };
// Never the real database, whatever this shell has set.
for (const name of ["SE_DATABASE_URL", "SE_SUPABASE_URL", "SE_SUPABASE_KEY", "SE_SECRET_KEY", "SE_PUBLIC_URL", "SE_INVITE_CODE"]) {
  delete env[name];
}
if (borrowArt) {
  env.SE_ASSETS_URL = LIVE_ASSETS;
  process.env.SE_E2E_LIVE_ASSETS = LIVE_ASSETS;  // lib.mjs fetches it for the page
} else {
  delete process.env.SE_E2E_LIVE_ASSETS;  // the server has art of its own
}
const log = join(OUT, "server.log");
const logStream = createWriteStream(log);
await new Promise((resolve) => logStream.once("open", resolve));
const launchServer = () => spawn(process.env.PYTHON || "python3", ["server.py"], { cwd: ROOT, env, stdio: ["ignore", logStream, logStream] });
let server = launchServer();

/** Await the owned child's final normal flush before any offline edit or deletion. */
async function stopServer(child) {
  if (child.exitCode !== null || child.signalCode !== null) {
    if (child.exitCode !== 0 || child.signalCode !== null) throw new Error(`Server already exited uncleanly: ${child.exitCode}/${child.signalCode}.`);
    return;
  }
  const exited = new Promise((resolve) => child.once("exit", (code, signal) => resolve({ code, signal })));
  let deadline;
  const bounded = (milliseconds) => Promise.race([
    exited,
    new Promise((_, reject) => { deadline = setTimeout(() => reject(new Error("Owned server did not exit before its deadline.")), milliseconds); }),
  ]);
  let result;
  try {
    if (!child.kill("SIGTERM")) throw new Error("Could not signal the owned server.");
    result = await bounded(30_000);
  } catch (error) {
    clearTimeout(deadline);
    if (child.exitCode === null && child.signalCode === null) {
      child.kill("SIGKILL");
      try { await bounded(5_000); } finally { clearTimeout(deadline); }
    }
    throw error; // A forced stop is a failed verification, never a clean flush.
  } finally {
    clearTimeout(deadline);
  }
  if (result.code !== 0 || result.signal !== null) throw new Error(`Server exited uncleanly: ${result.code}/${result.signal}.`);
}


const results = [];
let browser;
let shutdownError = null;
try {
  await waitForServer(base, server, log);
  console.log(`Server on ${base}, data in ${data}${env.SE_ASSETS_URL ? `, art from ${env.SE_ASSETS_URL}` : ""}`);
  const { chromium, webkit } = await playwright();
  // Software WebGL: works without a graphics card.
  browser = flags.has("--webkit") ? await webkit.launch()
    : await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  let visitors = 0;
  for (const name of chosen) {
    const out = join(OUT, name);
    rmSync(out, { recursive: true, force: true });
    mkdirSync(out, { recursive: true });
    const players = [];
    const context = {
      base, out,
      newPlayer: async (options) => {
        const player = await newPlayer(browser, base, out, `10.0.${Math.floor(++visitors / 250)}.${visitors % 250 + 1}`, options);
        players.push(player);
        return player;
      },
    };
    // A save no command can make (old Soul Mixer work, a town rich enough to
    // free a chained god): this optional test-harness callback owns a
    // stop/edit/restart of this runner's isolated SQLite server only.
    if (["soul-mixer", "chained"].includes(name)) {
      let offlineBusy = false;
      context.offlineVillage = async (player, edit) => {
        const index = players.indexOf(player);
        if (offlineBusy || index < 0 || player.base !== base || typeof edit !== "function") {
          throw new Error("Offline fixture must target this case's own player, one at a time.");
        }
        offlineBusy = true;
        const playerContext = player.page.context();
        try {
          const instances = [];
          const visit = (one) => { instances.push(one); one.companions.forEach(visit); };
          players.forEach(visit);
          const pages = [...new Set(instances.flatMap((one) => one.page.context().pages()))];
          for (const page of pages) {
            if (page.isClosed()) continue;
            await page.evaluate(async () => {
              const sender = window.seHome?.parts.commands;
              if (!sender) return;
              if (!await sender.flush()) throw new Error("Cannot stop with unsaved fixture commands.");
              sender.stop();
            });
          }
          // Contexts retain the existing cookies; closing every page stops all
          // polling/beacons before the final server flush and offline edit.
          await Promise.all(pages.map((page) => page.close()));
          const owned = server;
          try {
            await stopServer(owned);
            const database = join(data, "socialempires.db");
            if (!existsSync(database)) throw new Error("The isolated fixture SQLite database is missing.");
            // No game modules, external database settings or shared save paths:
            // only one existing row in this runner-created mkdtemp database.
            const script = `
import json, sqlite3, sys
path, pid, mode = sys.argv[1:]
with sqlite3.connect(path, timeout=15) as connection:
    row = connection.execute("SELECT data FROM villages WHERE pid = ?", (pid,)).fetchone()
    if row is None:
        raise RuntimeError("The fixture player does not exist")
    if mode == "read":
        print(row[0])
    elif mode == "write":
        save = json.load(sys.stdin)
        if str(save.get("playerInfo", {}).get("pid")) != pid:
            raise RuntimeError("Cannot change fixture player identity")
        connection.execute("UPDATE villages SET data = ? WHERE pid = ?", (json.dumps(save), pid))
    else:
        raise RuntimeError("Unknown offline fixture operation")
`;
            const transfer = (mode, input) => {
              const result = spawnSync(process.env.PYTHON || "python3", ["-B", "-c", script, database, String(player.settings.userId), mode],
                { cwd: ROOT, input, encoding: "utf8", timeout: 20_000, maxBuffer: 8 * 1024 * 1024 });
              if (result.error || result.status !== 0) throw new Error(`Offline fixture ${mode} failed: ${result.error?.message ?? result.stderr}`);
              return result.stdout;
            };
            const save = JSON.parse(transfer("read"));
            const pid = save.playerInfo.pid;
            await edit(save);
            if (save.playerInfo.pid !== pid) throw new Error("Offline fixture cannot change the player identity.");
            transfer("write", JSON.stringify(save));
          } finally {
            // Always recover the runner after an offline validation failure.
            // Assignment happens before readiness checks, so final cleanup owns
            // the replacement child too. Reuse the open log fd: append only.
            if (owned.exitCode !== null || owned.signalCode !== null) {
              server = launchServer();
              await waitForServer(base, server, log);
            }
          }
          const resumed = new Player(await playerContext.newPage(), player.base, player.out, player.viewport);
          resumed.name = player.name;
          resumed.settings = player.settings;
          resumed.problems = player.problems;
          resumed.companions = player.companions;
          players[index] = resumed;
          await resumed.open();
          return resumed;
        } finally {
          offlineBusy = false;
        }
      };
    }

    const started = Date.now();
    process.stdout.write(`${name} ... `);
    try {
      const test = (await import(pathToFileURL(join(TESTS, `${name}.mjs`)).href)).default;
      await test(context);
      const problems = players.flatMap((player) => [player, ...player.companions]).flatMap((player) => player.problems);
      if (problems.length) throw new Error(`the page reported errors:\n  ${problems.join("\n  ")}`);
      results.push({ name, ok: true });
      console.log(`ok (${Math.round((Date.now() - started) / 1000)} s)`);
    } catch (error) {
      results.push({ name, ok: false });
      console.log(`FAILED (${Math.round((Date.now() - started) / 1000)} s)\n${error.stack ?? error}\n`);
      const problems = players.flatMap((player) => [player, ...player.companions]).flatMap((player) => player.problems);
      if (problems.length) console.log(`Page errors:\n  ${problems.join("\n  ")}\n`);
      await Promise.all(players.map((player) => player.shot("failure").catch(() => {})));
    } finally {
      await Promise.all(players.map((player) => player.close().catch(() => {})));
    }
  }
} finally {
  try {
    await browser?.close();
  } finally {
    try { await stopServer(server); }
    catch (error) { shutdownError = error; console.error(`Server shutdown failed: ${error.message}`); }
    if (flags.has("--keep") || shutdownError || (server.exitCode === null && server.signalCode === null)) {
      console.log(`Kept the data folder: ${data}`);
    } else {
      rmSync(data, { recursive: true, force: true });
    }
  }
}

const failed = results.filter((result) => !result.ok);
console.log(`\n${results.length - failed.length} of ${results.length} passed${failed.length ? `; failed: ${failed.map((r) => r.name).join(", ")}` : ""}. Screenshots: ${output}/`);
process.exit(failed.length || shutdownError ? 1 : 0);
