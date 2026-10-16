// Tournament armies fight as copies, through the original tournament services.
// The home army, storage and saved team are never changed by a battle.
import "./ui/tournamentBattle.css";
import { Application, Container } from "pixi.js";
import { BattleControls } from "./battleControls.ts";
import { CommandSender } from "./net/commands.ts";
import type { GameServer, PageSettings } from "./net/server.ts";
import { finalWindow } from "./questPlay.ts";
import { Battle, ENEMY, FPS, NEUTRAL, SELF, type Fighter } from "./rules/battle.ts";
import { itemsById } from "./rules/config.ts";
import { MAP_TILES, mapArea, skinColour, unitPoint, type Point } from "./rules/geometry.ts";
import { Specials, type SpecialsTable } from "./rules/specials.ts";
import specialsTable from "./rules/specials-table.json" with { type: "json" };
import { TOURNAMENT_END_DELAY, TournamentBattle, tournamentBout, tournamentPositions, type TournamentBattleResult } from "./rules/tournamentBattle.ts";
import { tournamentRules, type TournamentMatch, type TournamentRoom } from "./rules/tournaments.ts";
import { readTown } from "./rules/town.ts";
import { Sound } from "./sound.ts";
import { clockText } from "./survivalPlay.ts";
import { showStatus } from "./ui/hud.ts";
import { iconImage } from "./ui/icons.ts";
import { Pause } from "./ui/pause.ts";
import { ArtLibrary } from "./view/art.ts";
import { BattleView } from "./view/battleView.ts";
import { Camera } from "./view/camera.ts";
import { TownView } from "./view/townView.ts";

const SPEEDS = [1, 2, 3];
const goHome = () => location.assign("/client.html?tournaments=1");

export async function playTournament(settings: PageSettings, server: GameServer, roomId: string, victimId: string): Promise<void> {
  showStatus("Preparing the tournament match…");
  const [config, mine, info] = await Promise.all([server.gameConfig(), server.playerInfo(), server.tournamentInfo()]);
  const words = new Map(((config.localization_strings ?? []) as { id: number; text: string }[]).map((word) => [Number(word.id), word.text]));
  const word = (id: number, fallback: string) => words.get(id) ?? fallback;
  const stop = (text: string) => {
    showStatus("");
    finalWindow(text, [{ label: "Back to tournament", run: goHome }]);
  };
  const room = info.tournament;
  if (!room || room.tournament_id !== roomId) { stop("This tournament is no longer active."); return; }
  const pendingKey = `se.tournament.result.${settings.userId}.${roomId}.${victimId}`;
  const pending = readPending(pendingKey);
  const savedMatch = matchIn(room, settings.userId, victimId);
  const commands = new CommandSender(settings, { clock: () => mine.timestamp, onFailure: (reason) => showStatus(reason) });
  // A finish whose reply was lost can be retried, including after reloading.
  // The server stores a match once, so its saved outcome always takes priority.
  if (savedMatch?.finished) {
    clearPending(pendingKey);
    showStatus("");
    finishWindow(recorded(savedMatch), false);
    return;
  }
  if (pending && savedMatch && !Number(room.players.find((seat) => seat.user_id === settings.userId)?.abandonned)) {
    showStatus("");
    finishWindow(pending, true);
    return;
  }
  const bout = tournamentBout(room, settings.userId, victimId);
  const kind = tournamentRules(config).kinds.find((kind) => String(kind.id) === room.tournament_type_id);
  if (!bout || !kind) { stop("This match is no longer available. The tournament has its latest results."); return; }
  const items = itemsById(config);
  if ([...bout.player.team, ...bout.enemy.team].some((id) => id > 0 && !items.get(id)?.isUnit)
    || !bout.player.team.some((id) => id > 0) || !bout.enemy.team.some((id) => id > 0)) {
    stop("One of the saved armies could not be loaded. Please return to the tournament."); return;
  }
  const arena = readTown(await server.playerInfo({ user: String(kind.map_id) }), items);
  const town = readTown(mine, items);
  const privateState = mine.privateState as Record<string, unknown> | undefined;
  const app = new Application();
  await app.init({ resizeTo: window, background: skinColour(arena.skin), resolution: Math.min(window.devicePixelRatio || 1, 2),
    autoDensity: true, antialias: false, preference: "webgl", sharedTicker: true });
  document.getElementById("stage")!.appendChild(app.canvas);
  document.body.classList.add("questing", "tournament-playing");
  document.body.style.background = `#${skinColour(arena.skin).toString(16).padStart(6, "0")}`;
  const world = new Container();
  app.stage.addChild(world);
  const camera = new Camera(world, mapArea(), unitPoint(26, 50));
  camera.resize(app.screen.width, app.screen.height);
  camera.attach(app.canvas);
  app.renderer.on("resize", (width: number, height: number) => camera.resize(width, height));
  app.ticker.add((ticker) => camera.update(ticker.deltaMS));
  const sound = new Sound(settings.assetsUrl, town.race, "ASSAULTS.mp3");
  const art = new ArtLibrary(settings.artUrl);
  const ground = new TownView(art, items, arena);
  world.addChild(ground.root);
  const groundLoaded = await ground.build((done, total) => showStatus(`The tournament field… ${Math.round(100 * done / total)}%`));
  ground.setFighting(true);
  const random = Math.random;
  const battle = new Battle({ ground: new Uint8Array(MAP_TILES * MAP_TILES).fill(1), random, keepHealedTargets: true });
  for (const placed of arena.items) battle.add(placed.item, placed.tx, placed.ty, NEUTRAL, { facing: placed.orientation });
  const placeArmy = (team: number[], side: typeof SELF | typeof ENEMY) => tournamentPositions(team, side).map(({ id, tile }) => {
    const at = battle.freeTileNear(tile, true) ?? tile;
    return battle.add(items.get(id)!, at.x, at.y, side, { free: true });
  });
  const player = placeArmy(bout.player.team, SELF);
  const enemy = placeArmy(bout.enemy.team, ENEMY);
  const focus = (army: Fighter[]) => {
    const alive = army.filter((unit) => !unit.dead);
    if (alive.length) camera.lookAt(unitPoint(alive.reduce((sum, unit) => sum + unit.tx, 0) / alive.length,
      alive.reduce((sum, unit) => sum + unit.ty, 0) / alive.length));
  };
  // The armies begin outside the central field. A fixed field coordinate
  // leaves the player's initial army off the edge of a phone's view.
  focus(player);
  const match = new TournamentBattle(battle, player, enemy, { weekly: Number(kind.weekly_tournaments) >= 1,
    pointType: Number(room.point_type), playerSlots: bout.player.team.length, enemySlots: bout.enemy.team.length });
  const specials = new Specials(battle, specialsTable as unknown as SpecialsTable, items, random);
  const view = new BattleView(art, battle, (effect) => sound.play(effect));
  view.skin = arena.skin;
  world.addChild(view.root);
  const missing = await view.load((done, total) => showStatus(`The armies arrive… ${Math.round(100 * done / total)}%`));
  app.ticker.add((ticker) => view.update(ticker.deltaMS, camera.scale));
  if (groundLoaded.missing.length || missing.length) {
    stop("Some tournament artwork could not load. Please reopen the match to try again."); return;
  }
  commands.add("game_status", "LOAD_MAP", "NORM", "TOUR");
  if (!await commands.flush()) {
    showStatus("");
    finalWindow("The map could not be saved. Reload this match before starting.", [
      { label: "Back to tournament", run: goHome },
      { label: "Reload match", gold: true, run: () => location.reload() },
    ]);
    return;
  }
  showStatus("");
  await startWindow();
  focus(player);

  const controls = new BattleControls({ battle, view, camera, world, items, town, config, privateState,
    settings, commands, sound, specials, random, tournament: true });
  let speed = 1;
  let asking = false;
  let ended = false;
  let endingMs = 0;
  let owed = 0;
  const bar = new TournamentBar(bout.player.user_name, bout.enemy.user_name, {
    select: () => controls.selectAll(), focus: (self) => focus(self ? player : enemy),
    speed: () => { speed = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]; return speed; },
    leave: () => {
      if (asking || match.result) return;
      asking = true;
      const question = document.createElement("div");
      let unlock = () => {};
      finalWindow(word(1232, "Leave this match? It will count as lost, with no points."), [
        { label: "Keep fighting", run: () => { unlock(); asking = false; } },
        { label: "Leave match", danger: true, run: () => { unlock(); asking = false; match.surrender(); } },
      ], true, question);
      unlock = blockBehind(question.closest<HTMLElement>(".quest-window")!);
    },
  });
  bar.add(new Pause(app.ticker).button("hud-sound"));
  (window as unknown as Record<string, unknown>).seTournament = {
    battle, match, view, player, enemy,
    select: (units: Fighter[]) => controls.select(units),
    lookAt: (tile: Point) => camera.lookAt(unitPoint(tile.x, tile.y)),
    screenOf: (fighter: Fighter) => {
      const point = world.toGlobal({ x: fighter.at.x, y: fighter.at.y - 30 });
      return { x: point.x, y: point.y };
    },
  };
  match.start();
  bar.update(match);
  app.ticker.add((ticker) => {
    if (!ended && !asking) {
      if (!match.result) {
        owed += Math.min(ticker.deltaMS, 250) * speed;
        while (owed >= 1000 / FPS && !match.result) {
          owed -= 1000 / FPS;
          battle.step();
          specials.step();
          match.step();
        }
      }
      if (match.result) {
        if (endingMs === 0) {
          controls.stop();
        }
        endingMs += Math.min(ticker.deltaMS, 250);
        if (endingMs >= TOURNAMENT_END_DELAY * 1000 / FPS) {
          ended = true;
          finishWindow(match.result, true);
        }
      }
    }
    bar.update(match);
    controls.update();
  });

  async function startWindow(): Promise<void> {
    return new Promise((resolve) => {
      const body = document.createElement("div");
      const text = document.createElement("p");
      text.textContent = word(1187, "Your armies are ready. Start when you are ready to fight.");
      body.append(text);
      if (savedMatch && savedMatch.date_started !== null) {
        const restart = document.createElement("p");
        restart.className = "rows-note";
        restart.textContent = "Your unfinished match will restart with the same saved armies at full health. Its match timer starts again when you press Start.";
        body.append(restart);
      }
      const error = document.createElement("p");
      error.className = "rows-note";
      error.setAttribute("role", "status");
      body.append(error);
      let busy = false;
      finalWindow(word(1186, "Tournament match"), [
        { label: "Back to tournament", run: goHome },
        { label: "Start the match", gold: true, keep: true, run: () => {
          if (busy) return false;
          busy = true;
          const box = body.closest(".quest-window")!;
          const buttons = [...box.querySelectorAll("button")];
          buttons.forEach((button) => { button.disabled = true; });
          void (async () => {
            try {
              const latest = (await server.tournamentInfo()).tournament;
              const available = latest?.tournament_id === roomId && tournamentBout(latest, settings.userId, victimId);
              if (!available) {
                error.textContent = "This match has closed. Return to the tournament for its results.";
                buttons[0].disabled = false;
                return;
              }
              await server.startTournamentMatch(roomId, victimId);
              box.remove();
              resolve();
            } catch {
              error.textContent = "The start was not confirmed. Try Start again, or return to the tournament.";
              buttons.forEach((button) => { button.disabled = false; });
              busy = false;
            }
          })();
          return false;
        } },
      ], false, body);
    });
  }

  function finishWindow(result: TournamentBattleResult, save: boolean): void {
    const body = document.createElement("div");
    body.className = "tournament-match-result";
    const picture = new Image();
    picture.alt = "";
    const text = document.createElement("p");
    const score = document.createElement("p");
    score.className = "quest-earned";
    const status = document.createElement("p");
    status.setAttribute("role", "status");
    body.append(picture, text, score, status);
    let confirmed = !save;
    let saving = false;
    let reloadRequired = false;
    finalWindow(word(result.won ? 1188 : 1190, result.won ? "Victory!" : "Defeat"), [
      { label: "Retry saving", keep: true, run: () => {
        if (reloadRequired) location.reload();
        else void persist();
        return false;
      } },
      { label: "Back to tournament", gold: true, keep: true, run: () => {
        if (!confirmed) return false;
        back.disabled = true;
        void (async () => {
          commands.add("game_status", "LOAD_MAP", "NORM", "NORM");
          if (await commands.flush()) goHome();
          else {
            status.textContent = "The return could not be saved. Your match is recorded; reload to continue.";
            reloadRequired = true;
            retry.textContent = "Reload match";
            retry.hidden = false;
          }
        })();
        return false;
      } },
    ], false, body);
    const box = body.closest(".quest-window")!;
    const [retry, back] = [...box.querySelectorAll("button")];
    const show = (value: TournamentBattleResult) => {
      box.querySelector("h2")!.textContent = word(value.won ? 1188 : 1190, value.won ? "Victory!" : "Defeat");
      picture.src = `${settings.assetsUrl}/images_new/${value.won ? "ataque_ganado" : "ataque_perdido"}.jpg`;
      text.textContent = word(value.won ? 1189 : 1191, "Your army returns home without losses.");
      score.textContent = `Score ${value.points.toFixed(2)}`;
    };
    show(result);
    retry.hidden = true;
    back.disabled = !confirmed;
    if (save) void persist();
    else status.textContent = "Match recorded. No units lost.";

    async function persist(): Promise<void> {
      if (saving || confirmed) return;
      saving = true;
      retry.hidden = true;
      status.textContent = "Saving the match…";
      try {
        if (!await commands.flush()) {
          // A permanently failed command sender needs a reload. Do not cache
          // or submit a score while a spell's mana change remains unconfirmed.
          reloadRequired = true;
          retry.textContent = "Reload match";
          retry.hidden = false;
          status.textContent = "Spell and battle changes could not be saved. Reload to continue from the saved state. This result has not been submitted.";
          return;
        }
        rememberPending(pendingKey, result);
        await server.finishTournamentMatch(roomId, victimId, result.won, result.points);
        const latest = (await server.tournamentInfo()).tournament;
        if (!latest || latest.tournament_id !== roomId) {
          // A different tab can leave or clean the room while this match is
          // open. A successful fresh read proves this is not a retryable loss
          // of the reply, but cannot prove that this local score was saved.
          confirmed = true;
          clearPending(pendingKey);
          box.querySelector("h2")!.textContent = "Tournament closed";
          text.textContent = "This result could not be checked because the tournament is no longer active.";
          score.hidden = true;
          status.textContent = "The tournament was closed elsewhere. Return to tournaments for your current place.";
          back.disabled = false;
          back.focus();
          return;
        }
        const saved = latest?.tournament_id === roomId ? matchIn(latest, settings.userId, victimId) : null;
        if (!saved?.finished) throw new Error("The saved match was not returned.");
        const authoritative = recorded(saved);
        show(authoritative);
        confirmed = true;
        clearPending(pendingKey);
        back.disabled = false;
        status.textContent = authoritative.won === result.won && authoritative.points.toFixed(2) === result.points.toFixed(2)
          ? "Match recorded. No units lost." : "This match had already closed. Its recorded result is shown. No units lost.";
        back.focus();
      } catch {
        status.textContent = "The saved result could not be confirmed. Retry saving; your result is kept in this tab.";
        retry.hidden = false;
        retry.focus();
      } finally { saving = false; }
    }
  }
}

function matchIn(room: TournamentRoom, userId: string, victimId: string): TournamentMatch | null {
  return room.players.find((seat) => seat.user_id === userId)?.matches.find((match) => match.attacker_id === userId && match.victim_id === victimId) ?? null;
}
function recorded(match: TournamentMatch): TournamentBattleResult {
  return { won: match.attacker_won, points: Number(match.attacker_points), surrendered: false };
}
function readPending(key: string): TournamentBattleResult | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(key) ?? "null") as TournamentBattleResult | null;
    return value && typeof value.won === "boolean" && typeof value.surrendered === "boolean" && Number.isFinite(value.points)
      && value.points >= 0 && value.points <= 100 ? value : null;
  } catch { return null; }
}
function rememberPending(key: string, result: TournamentBattleResult): void {
  try { sessionStorage.setItem(key, JSON.stringify(result)); } catch { /* Retry on this screen remains available. */ }
}
function clearPending(key: string): void {
  try { sessionStorage.removeItem(key); } catch { /* The authoritative result still takes priority. */ }
}

/** A paused surrender question must block spells and special-move buttons,
 * including keyboard focus, while the opponent's clock is stopped. */
function blockBehind(dialog: HTMLElement): () => void {
  const cover = document.createElement("div");
  cover.className = "tournament-battle-cover";
  document.body.append(cover);
  const behind = [...document.body.children].filter((element): element is HTMLElement =>
    element instanceof HTMLElement && element !== dialog && element !== cover && !element.inert);
  behind.forEach((element) => { element.inert = true; });
  return () => {
    behind.forEach((element) => { element.inert = false; });
    cover.remove();
  };
}

class TournamentBar {
  private readonly time = document.createElement("span");
  private readonly counts: HTMLElement[] = [];
  private readonly fills: HTMLElement[] = [];
  private readonly buttons = document.createElement("div");

  constructor(playerName: string, enemyName: string, actions: {
    select: () => void; focus: (self: boolean) => void; speed: () => number; leave: () => void;
  }) {
    const bar = document.createElement("header");
    bar.className = "hud quest-hud tournament-battle-hud";
    const armies = document.createElement("div");
    armies.className = "tournament-battle-armies";
    for (const [i, name] of [playerName, enemyName].entries()) {
      const army = document.createElement("button");
      army.className = `tournament-battle-army ${i === 0 ? "player" : "enemy"}`;
      army.type = "button";
      army.title = `Look at ${name}'s army`;
      army.setAttribute("aria-label", `${i === 0 ? "Your" : "Opponent's"} army: ${name}`);
      const heading = document.createElement("strong");
      heading.textContent = name;
      const count = document.createElement("span");
      const track = document.createElement("span");
      track.className = "tournament-battle-life";
      const fill = document.createElement("span");
      track.append(fill);
      army.append(heading, count, track);
      army.addEventListener("click", () => actions.focus(i === 0));
      this.counts.push(count); this.fills.push(fill); armies.append(army);
    }
    this.buttons.className = "hud-buttons";
    const select = document.createElement("button");
    select.className = "button small plain"; select.type = "button"; select.textContent = "Select all";
    select.addEventListener("click", actions.select);
    const speed = document.createElement("button");
    speed.className = "button small plain"; speed.type = "button"; speed.textContent = "Speed 1×";
    speed.addEventListener("click", () => { speed.textContent = `Speed ${actions.speed()}×`; });
    const leave = document.createElement("button");
    leave.className = "hud-sound quest-home"; leave.type = "button"; leave.title = "Leave the match";
    leave.setAttribute("aria-label", "Leave the match"); leave.append(iconImage("my-town"));
    leave.addEventListener("click", actions.leave);
    this.time.className = "pill-dark tournament-battle-clock";
    this.buttons.append(this.time, select, speed, leave);
    bar.append(armies, this.buttons); document.body.append(bar);
  }

  add(button: HTMLElement): void { this.buttons.prepend(button); }
  update(match: TournamentBattle): void {
    this.time.textContent = clockText(match.seconds);
    this.time.setAttribute("aria-label", `Match time ${match.seconds} seconds`);
    this.counts[0].textContent = `${match.playerLeft} units left`;
    this.counts[1].textContent = `${match.enemyLeft} units left`;
    this.fills[0].style.width = `${match.playerHealth * 100}%`;
    this.fills[1].style.width = `${match.enemyHealth * 100}%`;
  }
}
