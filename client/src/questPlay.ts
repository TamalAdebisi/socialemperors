// A quest island played in the new client (CLIENT.md, "Quests"): the
// start window with its stars, the battle itself (rules/battle.ts and
// rules/quest.ts, drawn by view/battleView.ts), the player's orders, the
// bar at the top, and the results. It talks to the server as the Flash
// client does: game_status and start_quest at the start, end_quest at the
// end, and nothing in between.

import { Application, Container } from "pixi.js";

import { BattleControls } from "./battleControls.ts";
import { CommandSender } from "./net/commands.ts";
import type { GameServer, PageSettings } from "./net/server.ts";
import { Battle, FPS, type Fighter } from "./rules/battle.ts";
import { itemsById, type ItemInfo } from "./rules/config.ts";
import { mapArea, unitPoint, type Point } from "./rules/geometry.ts";
import islandData from "./rules/islands.json" with { type: "json" };
import {
  MIN_LEVEL_QUESTS, Quest, TEAM_SLOTS, armyOf, difficulties, islandGround, islandLock, lastTeam, playedHere, teamArmy,
  teamChoices, teamProblem, teamSlots, type Island,
} from "./rules/quest.ts";
import { Specials, type SpecialsTable } from "./rules/specials.ts";
import specialsTable from "./rules/specials-table.json" with { type: "json" };
import { readTown } from "./rules/town.ts";
import { Sound } from "./sound.ts";
import { iconImage } from "./ui/icons.ts";
import { showMessage, showStatus } from "./ui/hud.ts";
import { Pause } from "./ui/pause.ts";
import { ArtLibrary } from "./view/art.ts";
import { BattleView } from "./view/battleView.ts";
import { Camera } from "./view/camera.ts";

export const ISLANDS = islandData.islands as unknown as Island[];
/** The sea around an island: the Flash client's blue. */
const SEA = 0x2e94e6;
/** Faster play: the battle steps this many times as often. */
const SPEEDS = [1, 2, 3];

/** Where the island window opens on the way home. */
export function homeUrl(): string {
  return "/client.html?islands=1";
}

export async function playQuest(settings: PageSettings, server: GameServer, questId: string): Promise<void> {
  showStatus("Sailing to the island…");
  const [config, info, map] = await Promise.all([server.gameConfig(), server.playerInfo(), server.playerInfo({ user: questId })]);
  const items = itemsById(config);
  const town = readTown(info, items);
  const index = ISLANDS.findIndex((island) => String(island.quest) === questId);
  const island = ISLANDS[index];
  const privateState = (info.privateState ?? {}) as Record<string, unknown>;
  const questTimes = ((info.map as unknown as { questTimes?: Record<string, number> }).questTimes ?? {}) as Record<string, number>;
  const ranks = (privateState.questsRank ?? {}) as Record<string, number>;
  const stop = (text: string) => {
    showStatus("");
    finalWindow(text, [{ label: "Back home", run: () => location.assign(homeUrl()) }]);
  };
  if (!island) {
    stop("There's no such island.");
    return;
  }
  if (!playedHere(island)) {
    stop("This island is played in the classic game for now.");
    return;
  }
  let army = armyOf(town);
  const lock = islandLock(island, index, Number(privateState.unlockedQuestIndex ?? 0), town.level,
    Array.isArray(questTimes) ? undefined : questTimes[questId], info.timestamp);
  if (town.level < MIN_LEVEL_QUESTS) {
    stop(`Quests open at level ${MIN_LEVEL_QUESTS}.`);
    return;
  }
  if (!lock.open) {
    stop(lock.until ? "Your army is still resting from its last attack on this island." : `${lock.why}.`);
    return;
  }
  if (army.length === 0) {
    stop("You need an army to sail: train some units first.");
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
  const camera = new Camera(world, mapArea(), unitPoint(island.landing[0], island.landing[1]));
  camera.resize(app.screen.width, app.screen.height);
  camera.attach(app.canvas);
  app.renderer.on("resize", (width: number, height: number) => camera.resize(width, height));
  app.ticker.add((ticker) => camera.update(ticker.deltaMS));

  const commands = new CommandSender(settings, { clock: () => info.timestamp, onFailure: (reason) => showStatus(reason) });
  const sound = new Sound(settings.assetsUrl, town.race, "QUESTS.mp3");
  const art = new ArtLibrary(settings.artUrl);
  const name = items.get(island.item)?.name ?? "The island";

  // The island, as its file lays it out, behind the start window.
  const random = Math.random;
  let quest: Quest | null = null;
  const battle = new Battle({ ground: islandGround(island), random, onDeath: (fighter) => {
    const paid = quest?.killed(fighter);
    if (paid && (paid.gold || paid.xp)) {
      view.rise(fighter, [{ text: `+${paid.gold}`, colour: 0xf2c14e }, ...(paid.xp ? [{ text: `+${paid.xp} XP`, colour: 0x7fb2ff }] : [])]);
    }
  } });
  quest = new Quest({ island, battle, items, layout: map.map.items, level: town.level, random });
  // Special moves (rules/specials.ts): the heroes' by themselves, the special units' on buttons.
  const specials = new Specials(battle, specialsTable as unknown as SpecialsTable, items, random);
  const view = new BattleView(art, battle, (effect) => sound.play(effect));
  world.addChild(view.root);
  await view.drawGround(items.get(island.terrain), island.shape);
  await view.load((done, total) => showStatus(`Sailing to the island… ${Math.round((100 * done) / total)}%`));
  app.ticker.add((ticker) => view.update(ticker.deltaMS, camera.scale));
  showStatus("");
  // As the Flash client: the island is shown, then the quest starts.
  commands.add("game_status", "LOAD_MAP", "NORM", "QUEST");
  void commands.flush();

  // The start window: the island, the army, the stars; Start battle.
  const stars = difficulties(Number(ranks[questId] ?? 0));
  const savedTeam = ((privateState.teams ?? {}) as Record<string, unknown>).quest;
  const picked = await startWindow(name, army, items, stars, settings,
    island.team ? { island, start: lastTeam(savedTeam, teamChoices(army, items)) } : null);
  const difficulty = picked?.difficulty ?? null;
  if (picked && island.team) {
    // As the Flash client: the team is kept on the server, and it alone sails.
    army = teamArmy(picked.team);
    commands.add("set_attack_team", "quest", JSON.stringify(teamSlots(picked.team)));
  }
  if (difficulty === null) {
    commands.add("game_status", "LOAD_MAP", "QUEST", "NORM");
    await commands.flush();
    location.assign(homeUrl());
    return;
  }
  quest.begin(difficulty, army);
  if (quest.boss) {
    // As the original: the camera goes to show a path opening, a dragon falling.
    quest.boss.onLook = (tile) => camera.lookAt(unitPoint(tile.x, tile.y));
  }
  const missing = await view.load((done, total) => showStatus(`The army lands… ${Math.round((100 * done) / total)}%`));
  showStatus(missing.length ? `Some pictures aren't available yet (${missing.length}); they show as outlines.` : "");
  if (missing.length) {
    setTimeout(() => showStatus(""), 5000);
  }
  commands.add("start_quest", questId, town.id);
  void commands.flush();
  const started = performance.now();

  // The player's hands (battleControls.ts): picking units, orders, spells, special moves; the chest first.
  const controls = new BattleControls({
    battle, view, camera, world, items, town, config, privateState, settings, commands, sound, specials, random,
    tapFirst: (tapped) => {
      if (finished || !quest!.canCollect(tapped)) {
        return finished;
      }
      const chest = tapped === quest!.chest;
      quest!.collect(tapped!);
      sound.play("collect");
      showMessage(chest ? "The treasure is yours!" : quest!.remaining > 0 ? `${tapped!.item.name}: ${quest!.remaining} to go` : "The way is open!");
      setTimeout(() => showMessage(""), 2500);
      return true;
    },
  });
  const bar = new QuestBar(island, quest, {
    selectAll: () => controls.selectAll(),
    speed: () => {
      speed = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
      return speed;
    },
    leave: () => {
      if (quest!.state === "fighting") {
        askLeave();
      }
    },
  });
  bar.add(new Pause(app.ticker).button("hud-sound"));
  controls.onSelect = () => bar.update();
  let speed = 1;
  let owed = 0;
  let finished = false;
  // For the browser tests (e2e/tests/quest.mjs): where things are on screen, to tap them as a player would.
  (window as unknown as Record<string, unknown>).seQuest = {
    battle, quest, view, magic: controls.magic, specials,
    select: (units: Fighter[]) => controls.select(units),
    lookAt: (tile: Point) => camera.lookAt(unitPoint(tile.x, tile.y)),
    tileScreen: (tile: Point) => {
      const p = world.toGlobal(unitPoint(tile.x, tile.y));
      return { x: p.x, y: p.y };
    },
    screenOf: (fighter: Fighter) => {
      const p = world.toGlobal(fighter.isUnit ? { x: fighter.at.x, y: fighter.at.y - 30 } : { x: fighter.at.x, y: fighter.at.y - 40 });
      return { x: p.x, y: p.y };
    },
  };
  // While the question is asked, the battle waits, as in the original.
  let asking = false;
  const askLeave = () => {
    asking = true;
    finalWindow("Leave the island? The battle will be lost, and the units who fell stay lost.", [
      { label: "Stay and fight", run: () => {
        asking = false;
      } },
      { label: "Leave", danger: true, run: () => {
        asking = false;
        quest!.leave();
      } },
    ], true);
  };

  app.ticker.add((ticker) => {
    if (!finished && !asking) {
      // The battle keeps the Flash client's 30 frames a second, whatever the screen's rate.
      owed += Math.min(ticker.deltaMS, 250) * speed;
      const step = 1000 / FPS;
      while (owed >= step) {
        owed -= step;
        battle.step();
        quest!.step();
        specials.step();
      }
      if (quest!.isOver()) {
        finished = true;
        controls.stop();
        quest!.settle();
        void results(quest!, (performance.now() - started) / 1000);
      }
    }
    bar.update();
    controls.update();
  });

  async function results(run: Quest, seconds: number): Promise<void> {
    // Sent at once, so nothing is lost if the page closes on the results.
    const rewards = bossRewards(run, town.race);
    commands.add("end_quest", JSON.stringify(run.report(town.id, seconds, rewards)));
    void commands.flush();
    const won = run.state === "won";
    const lost = run.lost();
    const body = document.createElement("div");
    body.className = "quest-results";
    const earned = document.createElement("p");
    earned.className = "quest-earned";
    earned.append(iconImage("gold"), `${run.gold.toLocaleString()}`, iconImage("xp"), `${run.xp.toLocaleString()}`);
    body.append(earned);
    const fallen = document.createElement("p");
    fallen.className = "quest-fallen";
    fallen.textContent = lost.length ? "Units lost:" : "No units lost.";
    body.append(fallen);
    if (lost.length) {
      const list = document.createElement("ul");
      list.className = "quest-lost";
      for (const [id, count] of lost) {
        const item = items.get(id);
        const row = document.createElement("li");
        const picture = document.createElement("img");
        picture.src = `${settings.assetsUrl}/buildingthumbs/${item?.art ?? ""}.jpg`;
        picture.alt = "";
        row.append(picture, `${count} × ${item?.name ?? "unit"}`);
        list.append(row);
      }
      body.append(list);
    }
    finalWindow(won ? "Victory!" : run.voluntary ? "You left the island." : "Defeat…", [
      { label: "Back home", run: async () => {
        await commands.flush();
        commands.add("game_status", "LOAD_MAP", "QUEST", "NORM");
        await commands.flush();
        location.assign(homeUrl());
      } },
    ], false, body);
  }
}

/** What a boss island gives on a win, for the player's people: { item id: how many }. */
function bossRewards(run: Quest, race: string): Record<string, number> {
  const rewards: Record<string, number> = {};
  for (const id of run.island.itemRewards?.[race] ?? []) {
    rewards[id] = (rewards[id] ?? 0) + 1;
  }
  return rewards;
}

/** The start window: resolves to the stars chosen (and the team, on the islands that take one), or null to go home. */
function startWindow(name: string, army: [number, number][], items: Map<number, ItemInfo>,
  stars: { allowed: number[]; chosen: number }, settings: PageSettings,
  teamOf: { island: Island; start: number[] } | null): Promise<{ difficulty: number; team: number[] } | null> {
  return new Promise((resolve) => {
    let chosen = stars.chosen;
    const team = [...(teamOf?.start ?? [])];
    const thumbnail = (id: number) => {
      const item = items.get(id);
      const picture = document.createElement("img");
      picture.src = `${settings.assetsUrl}/buildingthumbs/${item?.art ?? ""}.jpg`;
      picture.alt = "";
      picture.title = item?.name ?? "";
      return picture;
    };
    const body = document.createElement("div");
    body.className = "quest-start";
    const sailing = document.createElement("p");
    const units = document.createElement("ul");
    units.className = "quest-army";
    const slots = document.createElement("ul");
    slots.className = "quest-team";
    const problem = document.createElement("p");
    problem.className = "quest-problem";
    let warned = false;
    const choices = teamOf ? teamChoices(army, items) : army;
    const paintArmy = () => {
      units.replaceChildren();
      for (const [id, n] of choices) {
        const left = n - team.filter((t) => t === id).length;
        const row = document.createElement("li");
        row.append(thumbnail(id), `${left}`);
        if (teamOf) {
          // Tap a kind to add one to the team.
          const add = document.createElement("button");
          add.type = "button";
          add.className = "quest-pick";
          add.disabled = left <= 0 || team.length >= TEAM_SLOTS;
          add.setAttribute("aria-label", `Add a ${items.get(id)?.name ?? "unit"}`);
          add.append(...row.childNodes);
          add.addEventListener("click", () => {
            team.push(id);
            warned = false;
            paint();
          });
          row.replaceChildren(add);
        }
        units.append(row);
      }
    };
    const paintTeam = () => {
      slots.replaceChildren();
      for (let i = 0; i < TEAM_SLOTS; i++) {
        const slot = document.createElement("li");
        const id = team[i];
        if (id) {
          // Tap one in the team to take it out.
          const out = document.createElement("button");
          out.type = "button";
          out.className = "quest-pick";
          out.setAttribute("aria-label", `Take out a ${items.get(id)?.name ?? "unit"}`);
          out.append(thumbnail(id));
          out.addEventListener("click", () => {
            team.splice(i, 1);
            warned = false;
            paint();
          });
          slot.append(out);
        }
        slots.append(slot);
      }
    };
    const paint = () => {
      if (teamOf) {
        sailing.textContent = `Pick your team: ${team.length} of ${TEAM_SLOTS}.`;
        paintTeam();
      } else {
        const count = army.reduce((sum, [, n]) => sum + n, 0);
        sailing.textContent = `Your army is ready: ${count} unit${count === 1 ? "" : "s"}.`;
      }
      paintArmy();
      problem.textContent = "";
    };
    const label = document.createElement("p");
    label.className = "quest-difficulty-label";
    label.textContent = "Difficulty";
    const row = document.createElement("div");
    row.className = "quest-stars";
    const buttons: HTMLButtonElement[] = [];
    const paintStars = () => buttons.forEach((b, i) => {
      (b.firstChild as HTMLImageElement).src = iconImage(i < chosen ? "star-on" : "star-off").src;
      b.setAttribute("aria-pressed", String(i + 1 === chosen));
    });
    for (const n of [1, 2, 3]) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "quest-star";
      button.append(iconImage("star-off", `${n} star${n > 1 ? "s" : ""}`));
      button.disabled = !stars.allowed.includes(n);
      button.title = button.disabled ? `Win this island on ${n - 1} star${n > 2 ? "s" : ""} first` : `${n} star${n > 1 ? "s" : ""}`;
      button.addEventListener("click", () => {
        chosen = n;
        paintStars();
      });
      buttons.push(button);
      row.append(button);
    }
    paint();
    paintStars();
    body.append(sailing, ...(teamOf ? [slots] : []), units, label, row, problem);
    finalWindow(name, [
      { label: "Back home", run: () => resolve(null) },
      { label: "Start battle", gold: true, keep: true, run: () => {
        if (teamOf) {
          const why = teamProblem(team, teamOf.island, items);
          if (why) {
            problem.textContent = why;
            return false;
          }
          if (team.length < TEAM_SLOTS && !warned) {
            // As the Flash client asks: sure, with fewer than 20?
            warned = true;
            problem.textContent = `Only ${team.length} of ${TEAM_SLOTS} picked. Press Start battle again to sail anyway.`;
            return false;
          }
        }
        resolve({ difficulty: chosen, team });
        return true;
      } },
    ], false, body);
  });
}

/** A window in the middle of the screen with a title, maybe a body, and buttons; each button closes it. */
export function finalWindow(title: string, buttons: { label: string; run: () => unknown; gold?: boolean; danger?: boolean; keep?: boolean }[],
  small = false, body?: HTMLElement): void {
  const box = document.createElement("section");
  box.className = `quest-window${small ? " small" : ""}`;
  box.setAttribute("role", "dialog");
  const heading = document.createElement("h2");
  heading.textContent = title;
  box.append(heading);
  if (body) {
    box.append(body);
  }
  const row = document.createElement("div");
  row.className = "quest-buttons";
  for (const choice of buttons) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `button ${choice.gold ? "gold" : choice.danger ? "danger" : "plain"}`;
    button.textContent = choice.label;
    button.addEventListener("click", () => {
      // A button that may keep the window open (a question first) says so by returning false.
      if (choice.keep) {
        if (choice.run() !== false) {
          box.remove();
        }
        return;
      }
      box.remove();
      choice.run();
    });
    row.append(button);
  }
  box.append(row);
  document.body.append(box);
  (row.lastElementChild as HTMLButtonElement | null)?.focus();
}

/** The bar at the top in battle: what's been earned, what's left to beat, and the buttons. */
class QuestBar {
  private readonly gold = document.createElement("span");
  private readonly xp = document.createElement("span");
  private readonly left = document.createElement("span");
  private readonly speedButton = document.createElement("button");
  private readonly selectButton = document.createElement("button");
  private buttons!: HTMLElement;
  private readonly island: Island;
  private readonly quest: Quest;
  private readonly actions: { selectAll: () => void; speed: () => number; leave: () => void };

  constructor(island: Island, quest: Quest, actions: { selectAll: () => void; speed: () => number; leave: () => void }) {
    this.island = island;
    this.quest = quest;
    this.actions = actions;
    const bar = document.createElement("header");
    bar.className = "hud quest-hud";
    const numbers = document.createElement("ul");
    numbers.className = "hud-resources";
    const pill = (icon: "gold" | "xp" | null, value: HTMLElement, label: string) => {
      const item = document.createElement("li");
      item.className = "pill-dark";
      item.title = label;
      if (icon) {
        item.append(iconImage(icon, label));
      }
      item.append(value);
      numbers.append(item);
    };
    pill("gold", this.gold, "Gold won");
    pill("xp", this.xp, "Experience won");
    pill(null, this.left, "Left to beat");
    const buttons = document.createElement("div");
    buttons.className = "hud-buttons";
    this.selectButton.type = "button";
    this.selectButton.className = "button small plain";
    this.selectButton.textContent = "Select all";
    this.selectButton.title = "Select every unit (Space)";
    this.selectButton.addEventListener("click", () => this.selectAll());
    this.speedButton.type = "button";
    this.speedButton.className = "button small plain";
    this.speedButton.textContent = "Speed 1×";
    this.speedButton.title = "Play faster";
    this.speedButton.addEventListener("click", () => {
      this.speedButton.textContent = `Speed ${actions.speed()}×`;
    });
    const home = document.createElement("button");
    home.type = "button";
    home.className = "hud-sound quest-home";
    home.title = "Go home";
    home.append(iconImage("my-town", "Go home"));
    home.addEventListener("click", () => actions.leave());
    buttons.append(this.selectButton, this.speedButton, home);
    this.buttons = buttons;
    bar.append(numbers, buttons);
    document.body.append(bar);
    this.update();
  }

  selectAll(): void {
    this.actions.selectAll();
  }

  /** Another button, first in the row (the pause button). */
  add(button: HTMLElement): void {
    this.buttons.prepend(button);
  }

  update(): void {
    this.gold.textContent = this.quest.gold.toLocaleString();
    this.xp.textContent = this.quest.xp.toLocaleString();
    const n = this.quest.remaining;
    const what = this.island.win === "townhall" ? (n === 1 ? "town hall" : "town halls")
      : this.island.kind === "trolls" ? (n === 1 ? "troll" : "trolls") : (n === 1 ? "enemy" : "enemies");
    // A boss island counts its keys (power gems...) to collect; once they're in, the boss.
    const boss = this.quest.boss;
    this.left.textContent = this.quest.chest?.collectable ? "Open the treasure!" : boss ? boss.goal() : `${n} ${what} left`;
  }
}
