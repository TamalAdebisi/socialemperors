// Attacking another player's town in the new client (CLIENT.md, "Attacking
// players"), as the Flash client's assault plays it: the start corner, the
// defender's town as a battlefield (rules/pvp.ts) with its soldiers
// following the town's defence plan (rules/defencePlans.ts), the player's
// army and orders, the bar at the top, and the results. It talks to the
// server as the Flash client does: attack_player and game_status as the
// town loads, end_attack at the end, and nothing in between but spells.

import { Application, Container } from "pixi.js";

import { rememberAttack } from "./attacksMade.ts";
import { BattleControls } from "./battleControls.ts";
import { CommandSender } from "./net/commands.ts";
import type { GameServer, PageSettings } from "./net/server.ts";
import { Battle, ENEMY, FPS, NEUTRAL, SELF, type Fighter } from "./rules/battle.ts";
import { itemsById, type GameConfig, type ItemInfo } from "./rules/config.ts";
import { DefencePlan, planOf } from "./rules/defencePlans.ts";
import { MAP_TILES, mapArea, skinColour, unitPoint, type Point } from "./rules/geometry.ts";
import {
  EAGLE, MIN_LEVEL_PVP, ODIN_STATUE, attackerShare, attacksLeft, defenderTenth, eagleLife, eaglesOf, isTarget, killWorth, placeOf, recover,
  report, spyingsLeft, startPoints, type AttackEntry, type Row,
} from "./rules/pvp.ts";
import { armyOf } from "./rules/quest.ts";
import { Specials, type SpecialsTable } from "./rules/specials.ts";
import specialsTable from "./rules/specials-table.json" with { type: "json" };
import { inConstruction } from "./rules/construction.ts";
import { readTown } from "./rules/town.ts";
import { finalWindow } from "./questPlay.ts";
import { Sound } from "./sound.ts";
import { iconImage } from "./ui/icons.ts";
import { showMessage, showStatus } from "./ui/hud.ts";
import { GameLoop } from "./gameLoop.ts";
import { Pause } from "./ui/pause.ts";
import { ArtLibrary } from "./view/art.ts";
import { BattleView } from "./view/battleView.ts";
import { Camera } from "./view/camera.ts";
import { TownView } from "./view/townView.ts";

const SPEEDS = [1, 2, 3];
/** The town hall's sub-category: its fall wins the battle. */
const TOWN_HALL = 135;

/** Home again: the player's own town; after spying, with the world map open at that continent, as the Flash client goes back. */
function goHome(continent?: number): void {
  location.assign(continent ? `/client.html?world=${continent}` : "/client.html");
}

/**
 * `island`: from the world map, the island attacked (its place and continent), which the
 * report carries so the server can count it beaten (worlds.py). `spy`: a spy visit
 * instead (spy_player): the player's eagle alone flies over their town, to look at
 * it while its defences shoot at it; nothing is won or lost, and no report is sent.
 */
export async function playAttack(settings: PageSettings, server: GameServer, victimId: string, victimTown: number,
  island?: { posicion: number; nivel: number }, spy = false): Promise<void> {
  showStatus("Marching to their town…");
  const [config, mine, theirs] = await Promise.all([server.gameConfig(), server.playerInfo(),
    server.playerInfo({ user: victimId, town: victimTown })]);
  const items = itemsById(config);
  const town = readTown(mine, items);
  const enemy = readTown(theirs, items);
  const privateState = (mine.privateState ?? {}) as Record<string, unknown>;
  const stop = (text: string) => {
    showStatus("");
    finalWindow(text, [{ label: "Back home", run: goHome }]);
  };
  const statue = town.items.some((p) => p.item.id === ODIN_STATUE);
  const count = attacksLeft((privateState.attacksSent ?? []) as AttackEntry[], mine.timestamp, statue, Number(privateState.tsAttacksReset) || 0);
  const army = armyOf(town);
  const eagles = eaglesOf(town, (p) => !inConstruction(p, mine.timestamp * 1000));
  const spyings = spyingsLeft((privateState.spyings ?? []) as AttackEntry[], mine.timestamp, Number(privateState.tsSpyingsReset) || 0);
  const wait = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.ceil((seconds % 3600) / 60);
    return `${h ? `${h} h ` : ""}${m} min`;
  };
  if (victimId === settings.userId) {
    stop("That's your own empire.");
    return;
  }
  if (town.level < MIN_LEVEL_PVP) {
    stop(`Attacks on other players open at level ${MIN_LEVEL_PVP}.`);
    return;
  }
  if (spy && !eagles) {
    stop("You need an Eagles building to spy.");
    return;
  }
  if (spy && spyings.left <= 0) {
    stop(`No eagles left: they come back in ${wait(spyings.wait)}.`);
    return;
  }
  if (!spy && count.left <= 0) {
    stop(`No attacks left: they come back in ${wait(count.wait)}.`);
    return;
  }
  if (!spy && army.length === 0) {
    stop("You need an army to attack: train some units first.");
    return;
  }

  const app = new Application();
  await app.init({
    resizeTo: window, background: skinColour(enemy.skin), resolution: Math.min(window.devicePixelRatio || 1, 2), autoDensity: true,
    antialias: false, preference: "webgl", sharedTicker: true,
  });
  const loop = new GameLoop(app.ticker);
  document.getElementById("stage")!.appendChild(app.canvas);
  document.body.style.background = `#${skinColour(enemy.skin).toString(16).padStart(6, "0")}`;
  document.body.classList.add("questing");
  const world = new Container();
  app.stage.addChild(world);
  const corners = startPoints();
  const camera = new Camera(world, mapArea(), unitPoint(corners[0].tile.x, corners[0].tile.y));
  camera.resize(app.screen.width, app.screen.height);
  camera.attach(app.canvas);
  app.renderer.on("resize", (width: number, height: number) => camera.resize(width, height));
  loop.add((ms) => camera.update(ms));

  const commands = new CommandSender(settings, { clock: () => mine.timestamp, onFailure: (reason) => showStatus(reason) });
  const sound = new Sound(settings.assetsUrl, town.race, "ASSAULTS.mp3");
  const art = new ArtLibrary(settings.artUrl);
  const name = String((theirs.playerInfo as { name?: string }).name ?? "Their town");

  // The attack (or the spy visit) counts from here, as the Flash client's button; then the start corner, before the town loads.
  commands.add(spy ? "spy_player" : "attack_player", victimId);
  void commands.flush();
  const start = spy ? await spyWindow(config) : await cornerWindow(name);
  camera.lookAt(unitPoint(start.x, start.y));

  // The town, drawn as a town; the battle over it.
  const townView = new TownView(art, items, enemy);
  world.addChild(townView.root);
  await townView.build((done, total) => showStatus(`Marching to their town… ${Math.round((100 * done) / total)}%`));
  loop.add((ms) => townView.tick(ms, camera.scale));
  townView.setFighting(true);
  commands.add("game_status", "LOAD_MAP", "NORM", "ASSA");
  void commands.flush();

  const random = Math.random;
  let gold = 0;
  let xp = 0;
  let townHallGold = 0;
  let defenderGold = 0;
  let won = false;
  let voluntary = false;
  const victimRows = new Map<number, Row>();
  const attackerRows = new Map<number, Row>();
  const targets = new Set<Fighter>();
  const battle = new Battle({ ground: new Uint8Array(MAP_TILES * MAP_TILES).fill(1), random, onDeath: (fighter) => {
    if (fighter.summoned) {
      return;  // summoned things are worth nothing and count for nothing
    }
    if (fighter.side === ENEMY) {
      const paid = killWorth(fighter.item, enemy.level);
      if (gold < 20000) {
        gold = Math.min(gold + paid.gold, 20000);
        xp += paid.xp;
      }
      if (fighter.item.subcategory === TOWN_HALL) {
        townHallGold = paid.gold;
        won = true;
      }
      if (targets.delete(fighter)) {
        victimRows.get(fighter.item.id)![2]++;
      }
      if (paid.gold || paid.xp) {
        view.rise(fighter, [...(paid.gold ? [{ text: `+${paid.gold}`, colour: 0xf2c14e }] : []), { text: `+${paid.xp} XP`, colour: 0x7fb2ff }]);
      }
    } else if (fighter.side === SELF && fighter.item.attack > 0) {
      const row = attackerRows.get(fighter.item.id);
      if (row) {
        row[2]++;
        defenderGold += defenderTenth(fighter.item);
      }
    }
  } });
  // The defender's town: what fights is theirs, the rest nobody's, some of it cleared away.
  let hasTownHall = false;
  for (const placed of enemy.items) {
    const place = placeOf(placed.item, placed.tx, placed.ty, enemy.race);
    if (place === "cleared") {
      continue;
    }
    const fighter = battle.add(placed.item, placed.tx, placed.ty, place === "enemy" ? ENEMY : NEUTRAL, { tag: placed });
    if (!placed.item.isUnit) {
      fighter.facing = placed.orientation;
    }
    if (place === "enemy" && isTarget(placed.item, placed.tx, placed.ty, enemy.race)) {
      targets.add(fighter);
      const row = victimRows.get(placed.item.id) ?? [placed.item.id, 0, 0, 0];
      row[1]++;
      victimRows.set(placed.item.id, row);
    }
    hasTownHall ||= placed.item.subcategory === TOWN_HALL;
  }
  // The army, each on the nearest free tile to the corner picked; spying, the eagle alone, its life by the Eagles building.
  let armySize = 0;
  let eagle: Fighter | null = null;
  if (spy) {
    const item = items.get(EAGLE)!;
    const tile = battle.freeTileNear(start, true) ?? start;
    const life = eagleLife(eagles!.item, item);
    // It only looks: no attacking, as the Flash client lets nothing else be tapped while spying.
    eagle = battle.add(item, tile.x, tile.y, SELF, { condition: "defensive", life, maxLife: life, attack: 0 });
  }
  for (const [id, n] of spy ? [] : army) {
    const item = items.get(id);
    if (!item) {
      continue;
    }
    for (let i = 0; i < n; i++) {
      const tile = battle.freeTileNear(start, true);
      if (!tile) {
        break;
      }
      battle.add(item, tile.x, tile.y, SELF, { condition: "aggressive" });
      armySize++;
      if (item.attack > 0) {
        const row = attackerRows.get(id) ?? [id, 0, 0, 0];
        row[1]++;
        attackerRows.set(id, row);
      }
    }
  }
  const plan = new DefencePlan(battle, ENEMY, planOf((theirs.privateState as Record<string, unknown> | undefined)?.strategy), armySize);
  const specials = new Specials(battle, specialsTable as unknown as SpecialsTable, items, random);
  const view = new BattleView(art, battle, (effect) => sound.play(effect));
  view.skin = enemy.skin;
  world.addChild(view.root);
  await view.load((done, total) => showStatus(`The army arrives… ${Math.round((100 * done) / total)}%`));
  loop.add((ms) => view.update(ms, camera.scale));
  showStatus("");
  const started = performance.now();

  const controls = new BattleControls({
    battle, view, camera, world, items, town, config, privateState, settings, commands, sound, specials, random,
    spells: !spy,
    // Destination taps send the eagle there; its own picture can be inspected.
    tapFirst: eagle ? (_tapped, tile) => {
      if (!eagle!.dead) {
        battle.moveTo([eagle!], tile);
        sound.play("place");
      }
      return true;
    } : undefined,
  });
  if (eagle) {
    controls.select([eagle]);
  }
  let speed = 1;
  let owed = 0;
  let finished = false;
  let asking = false;
  const fighting = () => eagle ? (eagle.dead ? 0 : 1)
    : battle.fighters.filter((f) => f.side === SELF && f.isUnit && !f.dead && f.item.attack > 0).length;
  const bar = new AttackBar(name, spy, {
    selectAll: () => controls.selectAll(),
    speed: () => {
      speed = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
      return speed;
    },
    leave: () => {
      if (finished) {
        return;
      }
      asking = true;
      finalWindow(spy ? "Call your eagle home?" : "End the attack? It counts as lost, and the units who fell stay lost.", [
        { label: spy ? "Keep spying" : "Keep fighting", run: () => {
          asking = false;
        } },
        { label: spy ? "Come home" : "End it", danger: true, run: () => {
          asking = false;
          voluntary = true;
        } },
      ], true);
    },
  });
  bar.add(new Pause(loop).button("hud-sound"));
  // For the browser tests (e2e/tests/attack.mjs).
  (window as unknown as Record<string, unknown>).seAttack = {
    battle, targets, view, plan,
    select: (units: Fighter[]) => controls.select(units),
    lookAt: (tile: Point) => camera.lookAt(unitPoint(tile.x, tile.y)),
    screenOf: (fighter: Fighter) => {
      const p = world.toGlobal(fighter.isUnit ? { x: fighter.at.x, y: fighter.at.y - 30 } : { x: fighter.at.x, y: fighter.at.y - 40 });
      return { x: p.x, y: p.y };
    },
  };
  if (!hasTownHall && !spy) {
    // The defender has none: the town is the attacker's at once, for nothing, as the original says.
    asking = true;
    finalWindow(`${name} has no town hall: the town is yours, but there's nothing to win.`, [{ label: "OK", run: () => {
      asking = false;
      won = true;
    } }], true);
  }
  showMessage(spy ? "Tap where your eagle should fly: their defences will shoot at it." : `${targets.size} targets: their town hall wins it.`);
  setTimeout(() => showMessage(""), 3000);

  loop.add((ms) => {
    if (!finished && !asking) {
      owed += Math.min(ms, 250) * speed;
      const step = 1000 / FPS;
      while (owed >= step) {
        owed -= step;
        battle.step();
        plan.step();
        specials.step();
      }
      if (won || voluntary || fighting() === 0) {
        finished = true;
        controls.stop();
        void (spy ? spyResults() : results((performance.now() - started) / 1000));
      }
    }
    bar.update(gold, xp, targets.size);
    controls.update();
  });

  /** The spy visit over: nothing won or lost; home, to the world map at their continent. */
  function spyResults(): void {
    rememberAttack({ victim: victimId, voluntary, spy: true });
    finalWindow(eagle!.dead ? "Your eagle fell, but it saw their town." : "Your eagle is back home.", [
      { label: "Back home", run: async () => {
        await commands.flush();
        commands.add("game_status", "LOAD_MAP", "ASSA", "NORM");
        await commands.flush();
        goHome(island?.nivel ?? -1);
      } },
    ]);
  }

  async function results(seconds: number): Promise<void> {
    const attacker = { name: String((mine.playerInfo as { name?: string }).name ?? ""), level: town.level, user_id: settings.userId,
      world_id: Number((mine.playerInfo as { world_id?: number }).world_id ?? 0), map: town.id, race: town.race };
    const rows = recover([...attackerRows.values()], attackerShare(town.level), random);
    const victimSent = recover([...victimRows.values()], 95, random);
    const victim = { user_id: victimId, name, level: enemy.level, map: String(victimTown), race: enemy.race, ...(island ?? {}) };
    const sent = report({ attacker, victim, gold, xp, attackerRows: rows, victimRows: victimSent, won, seconds, voluntary,
      townHallGold, defenderGold, noTownHall: !hasTownHall, items });
    // Sent at once, so nothing is lost if the page closes on the results (as the islands).
    commands.add("end_attack", JSON.stringify(sent), ...(hasTownHall ? [] : [true]));
    void commands.flush();
    rememberAttack({ victim: victimId, voluntary, level: enemy.level, mine: town.level });
    const body = document.createElement("div");
    body.className = "quest-results";
    const earned = document.createElement("p");
    earned.className = "quest-earned";
    earned.append(iconImage("gold"), `${sent.resources.g.toLocaleString()}`, iconImage("xp"), `${sent.resources.x.toLocaleString()}`,
      ` · honour ${sent.honor}`);
    body.append(earned);
    const lost = rows.filter((r) => r[2] - r[3] > 0);
    const fallen = document.createElement("p");
    fallen.className = "quest-fallen";
    fallen.textContent = lost.length ? "Units lost:" : "No units lost.";
    body.append(fallen);
    if (lost.length) {
      const list = document.createElement("ul");
      list.className = "quest-lost";
      for (const [id, , killed, back] of lost) {
        const item: ItemInfo | undefined = items.get(id);
        const row = document.createElement("li");
        const picture = document.createElement("img");
        picture.src = `${settings.assetsUrl}/buildingthumbs/${item?.art ?? ""}.jpg`;
        picture.alt = "";
        row.append(picture, `${killed - back} × ${item?.name ?? "unit"}`);
        list.append(row);
      }
      body.append(list);
    }
    finalWindow(won ? "Congratulations! You won the attack." : voluntary ? "You left the battle." : "Too bad: your army fell.", [
      { label: "Back home", run: async () => {
        await commands.flush();
        commands.add("game_status", "LOAD_MAP", "ASSA", "NORM");
        await commands.flush();
        goHome();
      } },
    ], false, body);
  }
}

/** The spy visit's start, as the Flash client's: its words, and Start Spying; the eagle sets off from the first corner. */
function spyWindow(config: GameConfig): Promise<Point> {
  const words = new Map(((config.localization_strings ?? []) as { id: number; text: string }[]).map((l) => [Number(l.id), l.text]));
  return new Promise((resolve) => {
    const body = document.createElement("p");
    body.textContent = words.get(473) ?? "Your eagle is ready to spy.";
    finalWindow(words.get(472) ?? "Preparing to spy", [{ label: words.get(474) ?? "Start spying", gold: true, run: () => resolve(startPoints()[0].tile) }],
      false, body);
  });
}

/** The start corner: a little map of the island's 5 x 5 blocks, the 16 on the border to pick from. */
function cornerWindow(name: string): Promise<Point> {
  return new Promise((resolve) => {
    const points = startPoints();
    let picked = points[0];
    const body = document.createElement("div");
    body.className = "attack-corners";
    const grid = document.createElement("div");
    grid.className = "attack-grid";
    const cells: HTMLButtonElement[] = [];
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 5; x++) {
        const point = points.find((p) => p.block.x === x && p.block.y === y);
        const cell = document.createElement("button");
        cell.type = "button";
        cell.className = "attack-cell";
        cell.disabled = !point;
        if (point) {
          cell.setAttribute("aria-label", `Start at block ${x}, ${y}`);
          cell.addEventListener("click", () => {
            picked = point;
            cells.forEach((c) => c.classList.toggle("picked", c === cell));
          });
        }
        cell.classList.toggle("picked", point === picked);
        cells.push(cell);
        grid.append(cell);
      }
    }
    const line = document.createElement("p");
    line.textContent = "Pick where your army starts, round the edge of their island.";
    body.append(line, grid);
    finalWindow(`Attack ${name}`, [{ label: "Start the battle", gold: true, run: () => resolve(picked.tile) }], false, body);
  });
}

/** The bar at the top: what's been won, the targets left, and the buttons. */
class AttackBar {
  private readonly gold = document.createElement("span");
  private readonly xp = document.createElement("span");
  private readonly left = document.createElement("span");
  private readonly buttons = document.createElement("div");
  private readonly spy: boolean;

  /** `spy`: a spy visit's bar: the targets in their town only, and the eagle called home. */
  constructor(name: string, spy: boolean, actions: { selectAll: () => void; speed: () => number; leave: () => void }) {
    this.spy = spy;
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
    if (!spy) {
      pill("gold", this.gold, "Gold won");
      pill("xp", this.xp, "Experience won");
    }
    pill(null, this.left, spy ? `Targets in ${name}'s town` : `Left to beat in ${name}'s town`);
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
    speed.title = "Play faster";
    speed.addEventListener("click", () => {
      speed.textContent = `Speed ${actions.speed()}×`;
    });
    const home = document.createElement("button");
    home.type = "button";
    home.className = "hud-sound quest-home";
    home.title = spy ? "Call the eagle home" : "End the attack";
    home.append(iconImage("my-town", home.title));
    home.addEventListener("click", () => actions.leave());
    this.buttons.append(...(spy ? [] : [select]), speed, home);
    bar.append(numbers, this.buttons);
    document.body.append(bar);
  }

  add(button: HTMLElement): void {
    this.buttons.prepend(button);
  }

  update(gold: number, xp: number, left: number): void {
    this.gold.textContent = gold.toLocaleString();
    this.xp.textContent = xp.toLocaleString();
    // The game's words: "#0# targets" spying, "#0# targets left" attacking.
    this.left.textContent = `${left} ${left === 1 ? "target" : "targets"}${this.spy ? "" : " left"}`;
  }
}
