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
import { DISCORD, newPlayer } from "./lib.mjs";

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
  SE_DISCORD_URL: DISCORD };
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
const server = spawn(process.env.PYTHON || "python3", ["server.py"], { cwd: ROOT, env, stdio: ["ignore", logStream, logStream] });

const results = [];
let browser;
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
      await Promise.all(players.map((player) => player.shot("failure").catch(() => {})));
    } finally {
      await Promise.all(players.map((player) => player.close().catch(() => {})));
    }
  }
} finally {
  await browser?.close();
  server.kill();
  if (flags.has("--keep")) {
    console.log(`Kept the data folder: ${data}`);
  } else {
    rmSync(data, { recursive: true, force: true });
  }
}

const failed = results.filter((result) => !result.ok);
console.log(`\n${results.length - failed.length} of ${results.length} passed${failed.length ? `; failed: ${failed.map((r) => r.name).join(", ")}` : ""}. Screenshots: ${output}/`);
process.exit(failed.length ? 1 : 0);
