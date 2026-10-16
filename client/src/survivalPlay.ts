// The Survival Arena played in the new client (CLIENT.md, "Survival"), as
// the Flash client plays it: the arena's map, the player's 30 strongest
// units (copies: the town keeps its own) round the relic in the middle,
// the waves (rules/survival.ts), the bar with the time held, the enemies
// killed and the relic's life, and the results. It talks to the server as
// the Flash client does: game_status as the arena loads, start_survival on
// Start (a life used), end_survival when the results are taken; leaving
// early sends nothing more.

import { Application, Container } from "pixi.js";

import { BattleControls } from "./battleControls.ts";
import { CommandSender } from "./net/commands.ts";
import type { GameServer, PageSettings } from "./net/server.ts";
import { Battle, ENEMY, FPS, NEUTRAL, SELF, type Fighter } from "./rules/battle.ts";
import { itemsById, type GameConfig } from "./rules/config.ts";
import { MAP_TILES, BLOCKS, BLOCK_TILES, mapArea, unitPoint, type Point } from "./rules/geometry.ts";
import { armyOf } from "./rules/quest.ts";
import { Specials, type SpecialsTable } from "./rules/specials.ts";
import specialsTable from "./rules/specials-table.json" with { type: "json" };
import {
  ARMY_AT, SURVIVAL, Survival, livesLeft, prizeOf, survivalArmy, survivalMap, type SurvivalNews,
} from "./rules/survival.ts";
import { readTown } from "./rules/town.ts";
import { finalWindow } from "./questPlay.ts";
import { Sound } from "./sound.ts";
import { showStatus } from "./ui/hud.ts";
import { Pause } from "./ui/pause.ts";
import { ArtLibrary } from "./view/art.ts";
import { BattleView } from "./view/battleView.ts";
import { Camera } from "./view/camera.ts";

const SEA = 0x2e94e6;
const SPEEDS = [1, 2, 3];
/** The game's words (localization_strings). */
const WORDS = {
  title: 1150, help: 1151, attacked: 1152, destroyed: 1153, won: 1168, wonText: 1169, again: 1170, time: 1171, leave: 1172,
  boss: 1175, wave: 1176,
} as const;
/** After the relic falls, the results this much later. */
const END_DELAY = 3;

function goHome(): void {
  location.assign("/client.html");
}

/** "m:ss" (or "h:mm:ss"), as the bar shows the time held. */
export function clockText(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}

export async function playSurvival(settings: PageSettings, server: GameServer, questId: string): Promise<void> {
  showStatus("Into the arena…");
  const [config, info, arena] = await Promise.all([server.gameConfig(), server.playerInfo(), server.playerInfo({ user: questId })]);
  const items = itemsById(config);
  const town = readTown(info, items);
  const map = survivalMap(questId);
  const privateState = (info.privateState ?? {}) as Record<string, unknown>;
  const words = new Map(((config.localization_strings ?? []) as { id: number; text: string }[]).map((l) => [Number(l.id), l.text]));
  const word = (id: number, value?: string | number) => (words.get(id) ?? "").replace("#0#", String(value ?? ""));
  const stop = (text: string) => {
    showStatus("");
    finalWindow(text, [{ label: "Back home", run: goHome }]);
  };
  const lives = livesLeft(privateState.survivalVidaTimeStamp, privateState.survivalVidasExtra, info.timestamp,
    Number(config.globals?.SURVIVAL_HOURS_LIVE_REGENERATE) || 3);
  const army = survivalArmy(armyOf(town), items);
  const open = ((privateState.survivalMaps ?? {}) as Record<string, unknown>)[questId] !== undefined;
  if (!map || !map.available || !open) {
    stop("This arena can't be played.");
    return;
  }
  if (lives.left <= 0) {
    stop("No lives left: one comes back every few hours, or buy one in the Survival window.");
    return;
  }
  if (army.length === 0) {
    stop("You need an army for the arena: train some units first.");
    return;
  }

  const app = new Application();
  await app.init({
    resizeTo: window, background: SEA, resolution: Math.min(window.devicePixelRatio || 1, 2), autoDensity: true,
    antialias: false, preference: "webgl", sharedTicker: true,
  });
  document.getElementById("stage")!.appendChild(app.canvas);
  document.body.style.background = `#${SEA.toString(16)}`;
  document.body.classList.add("questing");
  const world = new Container();
  app.stage.addChild(world);
  const camera = new Camera(world, mapArea(), unitPoint(ARMY_AT.x, ARMY_AT.y));
  camera.resize(app.screen.width, app.screen.height);
  camera.attach(app.canvas);
  app.renderer.on("resize", (width: number, height: number) => camera.resize(width, height));
  app.ticker.add((ticker) => camera.update(ticker.deltaMS));

  const commands = new CommandSender(settings, { clock: () => info.timestamp, onFailure: (reason) => showStatus(reason) });
  const sound = new Sound(settings.assetsUrl, town.race, "QUESTS.mp3");
  const art = new ArtLibrary(settings.artUrl);

  // The arena: its relic the player's, its walls and statues nobody's; the army round the middle.
  const random = Math.random;
  let survival: Survival | null = null;
  let relicDownAt: number | null = null;
  const battle = new Battle({ ground: arenaGround(), random, onDeath: (fighter) => {
    if (fighter.side === ENEMY) {
      survival?.killedOne(fighter);
    }
  } });
  let relic: Fighter | null = null;
  for (const [id, x, y, orientation] of arena.map.items as unknown as [number, number, number, number][]) {
    const item = items.get(Number(id));
    if (!item || item.isUnit) {
      continue;
    }
    const fighter = battle.add(item, Number(x), Number(y), Number(id) === SURVIVAL.relic ? SELF : NEUTRAL);
    fighter.facing = Number(orientation) || 0;
    if (Number(id) === SURVIVAL.relic) {
      relic = fighter;
    }
  }
  if (!relic) {
    stop("This arena has no relic to guard.");
    return;
  }
  for (const [id, n] of army) {
    const item = items.get(id)!;
    for (let i = 0; i < n; i++) {
      const tile = battle.freeTileNear(ARMY_AT, true);
      if (tile) {
        battle.add(item, tile.x, tile.y, SELF, { free: true });
      }
    }
  }
  const specials = new Specials(battle, specialsTable as unknown as SpecialsTable, items, random);
  const view = new BattleView(art, battle, (effect) => sound.play(effect));
  world.addChild(view.root);
  await view.drawGround(items.get(map.terrain), SURVIVAL.shape);
  await view.load((done, total) => showStatus(`Into the arena… ${Math.round((100 * done) / total)}%`));
  app.ticker.add((ticker) => view.update(ticker.deltaMS, camera.scale));
  showStatus("");
  commands.add("game_status", "LOAD_MAP", "NORM", "QUEST");
  void commands.flush();

  // The game's start window, then Start uses a life.
  await startWindow(word(WORDS.title), word(WORDS.help));
  commands.add("start_survival");
  void commands.flush();

  const bar = new SurvivalBar(relic, {
    selectAll: () => controls.selectAll(),
    speed: () => {
      speed = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
      return speed;
    },
    leave: () => {
      if (relicDownAt !== null) {
        return;
      }
      asking = true;
      finalWindow(word(WORDS.leave), [
        { label: "Keep fighting", run: () => {
          asking = false;
        } },
        { label: "Leave", danger: true, run: async () => {
          // As the Flash client: leaving early sends no result (the life is spent).
          commands.add("game_status", "LOAD_MAP", "QUEST", "NORM");
          await commands.flush();
          goHome();
        } },
      ], true);
    },
  });
  bar.add(new Pause(app.ticker).button("hud-sound"));
  const say = (text: string) => bar.say(text);
  survival = new Survival({ map, battle, relic, items, random, news: (news: SurvivalNews) => {
    say(news.kind === "boss" ? word(WORDS.boss, news.number) : word(WORDS.wave, news.number));
  } });
  battle.onHurt.push((target) => {
    if (target === relic && !relic.dead) {
      say(word(WORDS.attacked));
    }
  });
  const controls = new BattleControls({
    battle, view, camera, world, items, town, config: config as GameConfig, privateState, settings, commands, sound, specials, random,
  });
  let speed = 1;
  let owed = 0;
  let asking = false;
  let ended = false;
  // For the browser tests (e2e/tests/survival.mjs).
  (window as unknown as Record<string, unknown>).seSurvival = { battle, survival, relic, lookAt: (tile: Point) => camera.lookAt(unitPoint(tile.x, tile.y)) };
  survival.start();

  app.ticker.add((ticker) => {
    if (!ended && !asking) {
      owed += Math.min(ticker.deltaMS, 250) * speed;
      const step = 1000 / FPS;
      while (owed >= step) {
        owed -= step;
        battle.step();
        specials.step();
        survival!.step();
        if (relic!.dead && relicDownAt === null) {
          relicDownAt = battle.frame;
          say(word(WORDS.destroyed));
          controls.stop();
        }
        if (relicDownAt !== null && battle.frame - relicDownAt >= END_DELAY * FPS) {
          ended = true;
          results();
          break;
        }
      }
    }
    bar.update(survival!.seconds, survival!.killed);
    controls.update();
  });

  function results(): void {
    const seconds = survival!.seconds;
    const won = prizeOf(map!, seconds);
    const body = document.createElement("div");
    body.className = "quest-results survival-results";
    const line = document.createElement("p");
    line.className = "quest-earned";
    line.textContent = `${word(WORDS.time)} ${clockText(seconds)}`;
    body.append(line);
    if (won !== null) {
      const prize = document.createElement("p");
      prize.className = "survival-prize";
      const picture = new Image();
      picture.src = `${settings.assetsUrl}/buildingthumbs/${items.get(won)?.art ?? ""}.jpg`;
      picture.alt = "";
      prize.append(picture, items.get(won)?.name ?? "A unit");
      body.append(prize);
    }
    finalWindow(won !== null ? `${word(WORDS.won)} ${word(WORDS.wonText)}` : word(WORDS.again), [
      { label: "OK", gold: true, run: async () => {
        // As the Flash client: the prize in storage (the server's own reckoning), and home.
        commands.add("end_survival", map!.quest, seconds, won !== null ? JSON.stringify({ [won]: 1 }) : "null");
        await commands.flush();
        commands.add("game_status", "LOAD_MAP", "QUEST", "NORM");
        await commands.flush();
        goHome();
      } },
    ], false, body);
  }
}

/** The arena's ground: land on every block but the sea round it (survival.json's shape). */
function arenaGround(): Uint8Array {
  const grid = new Uint8Array(MAP_TILES * MAP_TILES);
  for (let y = 0; y < MAP_TILES; y++) {
    for (let x = 0; x < MAP_TILES; x++) {
      const block = Math.floor(y / BLOCK_TILES) * BLOCKS + Math.floor(x / BLOCK_TILES);
      grid[y * MAP_TILES + x] = SURVIVAL.shape[block] === SURVIVAL.water ? 0 : 1;
    }
  }
  return grid;
}

/** The game's "SURVIVAL MODE!!" window with its help, and Start. */
function startWindow(title: string, help: string): Promise<void> {
  return new Promise((resolve) => {
    const body = document.createElement("p");
    body.className = "survival-help";
    body.textContent = help;
    finalWindow(title, [{ label: "Start", gold: true, run: () => resolve() }], false, body);
  });
}

/** The bar at the top: the time held, the enemies killed, the relic's life, a line for what's happening, and the buttons. */
class SurvivalBar {
  private readonly time = document.createElement("span");
  private readonly kills = document.createElement("span");
  private readonly life = document.createElement("span");
  private readonly lifeFill = document.createElement("span");
  private readonly line = document.createElement("p");
  private readonly buttons = document.createElement("div");
  private readonly relic: Fighter;
  private quietAt = 0;

  constructor(relic: Fighter, actions: { selectAll: () => void; speed: () => number; leave: () => void }) {
    this.relic = relic;
    const bar = document.createElement("header");
    bar.className = "hud quest-hud survival-hud";
    const numbers = document.createElement("ul");
    numbers.className = "hud-resources";
    const pill = (value: HTMLElement, label: string) => {
      const item = document.createElement("li");
      item.className = "pill-dark";
      item.title = label;
      item.setAttribute("aria-label", label);
      item.append(value);
      numbers.append(item);
      return item;
    };
    pill(this.time, "Time held");
    pill(this.kills, "Enemies killed");
    const relicPill = pill(this.life, "The relic's life");
    relicPill.classList.add("survival-relic");
    this.lifeFill.className = "survival-relic-fill";
    relicPill.prepend(this.lifeFill);
    this.buttons.className = "hud-buttons";
    const select = document.createElement("button");
    select.type = "button";
    select.className = "button small plain";
    select.textContent = "Select all";
    select.title = "Select every unit (Space)";
    select.addEventListener("click", () => actions.selectAll());
    const speed = document.createElement("button");
    speed.type = "button";
    speed.className = "button small plain";
    speed.textContent = "Speed 1×";
    speed.addEventListener("click", () => {
      speed.textContent = `Speed ${actions.speed()}×`;
    });
    const home = document.createElement("button");
    home.type = "button";
    home.className = "hud-sound quest-home";
    home.title = "Leave the arena";
    const crown = new Image();
    crown.className = "icon";
    crown.alt = "Leave the arena";
    crown.src = new URL("./ui/art/my-town.webp", import.meta.url).href;
    home.append(crown);
    home.addEventListener("click", () => actions.leave());
    this.buttons.append(select, speed, home);
    this.line.className = "survival-line";
    this.line.setAttribute("role", "status");
    bar.append(numbers, this.buttons);
    document.body.append(bar, this.line);
  }

  add(button: HTMLElement): void {
    this.buttons.prepend(button);
  }

  /** A line under the bar for 5 seconds, as the Flash client shows them. */
  say(text: string): void {
    this.line.textContent = text;
    this.line.hidden = false;
    this.quietAt = performance.now() + 5000;
  }

  update(seconds: number, killed: number): void {
    this.time.textContent = `Time ${clockText(seconds)}`;
    this.kills.textContent = `Killed ${killed}`;
    const life = Math.max(Math.round(this.relic.life), 0);
    this.life.textContent = `Relic ${life}/${this.relic.maxLife}`;
    this.lifeFill.style.width = `${(100 * life) / this.relic.maxLife}%`;
    if (performance.now() > this.quietAt) {
      this.line.hidden = true;
    }
  }
}
