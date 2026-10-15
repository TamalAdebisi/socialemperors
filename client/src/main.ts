// The new game client (CLIENT.md, steps 2 and 3): load the game config and
// the player's town from our server, as the Flash client does, draw it with
// PixiJS, and let the player run it (so far: build, place from storage, move, turn,
// store, sell, collect), with the menus as a rail and dock.

import "./ui/style.css";

import { Application, Container } from "pixi.js";

import { TownEditor } from "./editor.ts";
import islandData from "./rules/islands.json" with { type: "json" };
import { armyOf, type Island } from "./rules/quest.ts";
import { IslandsWindow } from "./ui/islandMap.ts";
import { CommandSender } from "./net/commands.ts";
import { GameServer, readPageSettings } from "./net/server.ts";
import { itemsById, type ItemInfo } from "./rules/config.ts";
import { mapArea, skinColour, type Point } from "./rules/geometry.ts";
import { readLevels } from "./rules/levels.ts";
import { obstacle, readShop, shopItems, unlockPrice } from "./rules/shop.ts";
import { readLandPrices } from "./rules/land.ts";
import { arthur, carts } from "./rules/neighbours.ts";
import { lessonsNotStarted } from "./rules/lessons.ts";
import { markWild } from "./rules/animals.ts";
import { cleanUp, oneVillager } from "./rules/cleanup.ts";
import { growBack } from "./rules/nature.ts";
import { Doings, goalsRun, readGoals, type Need } from "./rules/goals.ts";
import { readBonusConfig } from "./rules/bonuses.ts";
import goalNeeds from "./rules/goals.json" with { type: "json" };
import { GoalKeeper } from "./goals.ts";
import { BonusDesk } from "./bonuses.ts";
import { readTown, type Town } from "./rules/town.ts";
import { population } from "./rules/training.ts";
import { ActionBar } from "./ui/actions.ts";
import { ArmyWindow } from "./ui/army.ts";
import { BankWindow } from "./ui/bank.ts";
import { showHud, showMessage, showStatus } from "./ui/hud.ts";
import { Sound } from "./sound.ts";
import { Visit, visitsSoFar } from "./visit.ts";
import { ICONS } from "./ui/icons.ts";
import { Menus } from "./ui/menus.ts";
import { NeighboursWindow } from "./ui/neighbours.ts";
import { ShopWindow } from "./ui/shop.ts";
import { SpellsWindow, magicParts } from "./ui/spells.ts";
import { WorldWindows } from "./ui/world.ts";
import { ArtLibrary } from "./view/art.ts";
import { Camera } from "./view/camera.ts";
import { drawThumbnail } from "./view/thumbnail.ts";
import { TownView } from "./view/townView.ts";

/** The building where spells are learnt. */
const WIZARDRY_ACADEMY = 416;

/** Arthur's portrait in the Neighbours window: the game's own king. */
const ARTHUR_PICTURE = new URL("./ui/art/arthur.jpg", import.meta.url).href;

async function start(): Promise<void> {
  const settings = readPageSettings();
  const server = new GameServer(settings);

  // ?quest=<id>: a quest island, played here (questPlay.ts).
  const quest = new URLSearchParams(location.search).get("quest");
  if (quest) {
    // The battle's code is loaded only for an island.
    const { playQuest } = await import("./questPlay.ts");
    await playQuest(settings, server, quest);
    return;
  }

  // ?visit=<player id> shows another player's town, as visiting a neighbour does.
  const visit = new URLSearchParams(location.search).get("visit") ?? undefined;
  showStatus(visit ? "Loading their town…" : "Loading your town…");
  // Visiting, the player's own save too: who they helped lately (helping is once a day per neighbour).
  const [config, info, mine] = await Promise.all([server.gameConfig(), server.playerInfo({ user: visit }),
    visit === undefined ? null : server.playerInfo()]);
  // The game's clock: the server's time when the town arrived, plus the time since.
  const arrived = performance.now();
  const clock = () => info.timestamp + (performance.now() - arrived) / 1000;
  const items = itemsById(config);
  const town = readTown(info, items);
  if (town.unknown.length) {
    console.warn("Items the game config doesn't know:", town.unknown);
  }

  const app = new Application();
  await app.init({
    resizeTo: window,
    background: skinColour(town.skin),
    // Sharp on high-resolution screens; above 2x costs a lot for little gain.
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    autoDensity: true,
    antialias: false,
    preference: "webgl",
    // One clock for everything: the camera, the drawing and the animations
    // (animated sprites follow the shared one).
    sharedTicker: true,
  });
  document.getElementById("stage")!.appendChild(app.canvas);
  document.body.style.background = `#${skinColour(town.skin).toString(16).padStart(6, "0")}`;

  const world = new Container();
  /** The map's layer, by another name: the menus' world windows take the name below. */
  const mapLayer = world;
  app.stage.addChild(world);
  const camera = new Camera(world, mapArea(), FLASH_START);
  camera.resize(app.screen.width, app.screen.height);
  camera.attach(app.canvas);
  app.renderer.on("resize", (width: number, height: number) => camera.resize(width, height));
  app.ticker.add((ticker) => camera.update(ticker.deltaMS));

  const levels = readLevels(config.levels);
  const increase = Number(config.globals?.POPULATION_INCREASE) || 10;
  // The music of the town shown (the trolls' for a troll town), and the game's sound effects.
  const sound = new Sound(settings.assetsUrl, town.race);
  // Visiting, the top bar shows the neighbour's numbers, as the Flash client did.
  const hud = showHud(town, { classicUrl: settings.classicUrl, visiting: visit === undefined ? undefined : town.name, levels,
    population: (t) => population(t, items, increase), sound });

  const art = new ArtLibrary(settings.artUrl);
  const view = new TownView(art, items, town);
  world.addChild(view.root);
  app.ticker.add((ticker) => view.tick(ticker.deltaMS, camera.scale));

  // The player's own town can be changed; a visited one only looked at.
  let afterDrawing = () => {};
  let openIslands = () => {};
  if (visit === undefined) {
    const commands = new CommandSender(settings, { clock, onFailure: (reason) => showStatus(reason) });
    commands.start();
    // As the town opens, as in the Flash client: things on top of each other sorted out, and
    // a villager for a town with none (rules/cleanup.ts; not before Arthur's lessons are
    // taken or skipped); animals off the player's land are wild (rules/animals.ts); then
    // trees, rocks and a few animals grow back (rules/nature.ts).
    const opening = [...cleanUp(town).commands];
    if (!lessonsNotStarted(info.playerInfo.completed_tutorial, town.id)) {
      opening.push(...(oneVillager(town, items, clock())?.commands ?? []));
    }
    for (const command of opening) {
      commands.add(command.cmd, ...command.args);
    }
    markWild(town);
    const animals = {
      today: ((info.privateState as Record<string, unknown> | undefined)?.arrayAnimals ?? {}) as Record<string, number>,
      perDay: Number(config.globals?.ANIMALS_PER_DAY) || 20,
    };
    for (const command of growBack(town, items, clock(), { animals }).commands) {
      commands.add(command.cmd, ...command.args);
    }
    const shop = new ShopWindow({
      categories: readShop(config.categories),
      items: (category, tab) => shopItems(items.values(), town, category, tab),
      obstacle: (item) => obstacle(town, item),
      thumbnail: (item) => `${settings.assetsUrl}/buildingthumbs/${item.art}.jpg`,
      picture: (item, canvas) => drawThumbnail(art, item, canvas),
      choose: (item) => editor.startBuilding(item),
      storage: () => editor.storageCards(),
      unlock: { price: unlockPrice, run: (item) => editor.unlock(item) },
    });
    // Arthur last, as the Flash client adds him: his town is the one for the player's stage.
    const neighbourList = [...(info.neighbors ?? []), { ...arthur(town.level, levels.length), picture: ARTHUR_PICTURE }];
    const neighbours = new NeighboursWindow(neighbourList, (pid) => `/client.html?visit=${encodeURIComponent(pid)}`);
    const islands = new IslandsWindow({
      islands: islandData.islands as unknown as Island[], items,
      unlockedIndex: () => Number((info.privateState as Record<string, unknown> | undefined)?.unlockedQuestIndex ?? 0),
      stars: () => ((info.privateState as Record<string, unknown> | undefined)?.questsRank ?? {}) as Record<string, number>,
      lastAttacked: () => {
        const times = (info.map as unknown as { questTimes?: unknown }).questTimes;
        return (times && !Array.isArray(times) ? times : {}) as Record<string, number>;
      },
      level: () => town.level,
      armySize: () => armyOf(town).reduce((sum, [, n]) => sum + n, 0),
      clock,
      pageUrl: (page) => `${settings.assetsUrl}/images_new/quests_manager_img_${page}.jpg`,
      questUrl: (quest) => `/client.html?quest=${quest}`,
      classicUrl: settings.classicUrl,
    });
    const world = new WorldWindows(settings.classicUrl, islands);
    openIslands = () => islands.open();
    const army = new ArmyWindow({
      units: () => unitsInTown(town),
      people: () => population(town, items, increase),
      thumbnail: (item) => `${settings.assetsUrl}/buildingthumbs/${item.art}.jpg`,
    });
    const menus = new Menus([
      { key: "build", label: "Build", icon: ICONS.build, run: () => editor.openShop(), shortcut: "b" },
      { key: "storage", label: "Storage", icon: ICONS.storage, run: () => editor.openStorage(), shortcut: "s" },
      { key: "army", label: "Army", icon: ICONS.units, run: () => army.toggle(), shortcut: "a" },
      { key: "quests", label: "Quests", icon: ICONS.quests, only: "rail", run: () => world.toggleQuests(), shortcut: "q" },
      { key: "battle", label: "Battle", icon: ICONS.pvp, only: "rail", run: () => world.toggleBattles() },
      { key: "world", label: "World", icon: ICONS.world, only: "dock", run: () => world.toggleWorld(), shortcut: "w" },
      { key: "neighbours", label: "Neighbours", icon: ICONS.neighbours, run: () => neighbours.toggle(), shortcut: "n" },
    ]);
    // The Wizardry Academy's spells (ui/spells.ts): learnt and mana bought at home, cast in battle.
    const spells = new SpellsWindow(magicParts(config, info.privateState as Record<string, unknown> | undefined, town,
      settings.assetsUrl, (cmd, ...args) => {
        commands.add(cmd, ...args);
        void commands.flush();  // as the Flash client: at once
      }, () => hud.update(town)));
    const doings = new Doings();
    // What visits to neighbours did in this tab counts for the goals here.
    const visits = visitsSoFar();
    doings.lastVisited = visits.last;
    doings.helpedBuildings = visits.helped;
    const editor = new TownEditor({ town, view, bar: new ActionBar(), commands, hud, camera, clock, levels, shop, items, doings,
      sound: (effect) => sound.play(effect),
      thumbnail: (item) => `${settings.assetsUrl}/buildingthumbs/${item.art}.jpg`,
      land: { prices: readLandPrices(config.expansion_prices as never), neighbours: (info.neighbors ?? []).filter((n) => n.name !== "Best Empire").length },
      waiting: (gifts) => menus.count("storage", gifts),
      windowOf: (placed) => (placed.item.id === WIZARDRY_ACADEMY ? { label: "Spells", run: () => spells.open() } : null) });
    hud.offerCollectAll(() => editor.collectAll());
    // Help from neighbours: their donkey carts, one after another.
    const names = new Map(neighbourList.map((n) => [String(n.pid), n.name?.trim() || "A neighbour"]));
    // Once the town is drawn: a cart added before would be drawn twice.
    // Raids on the town and the troll camps (homeDefence.ts, homeCamps.ts): rolled each time it opens.
    const defend = () => {
      void import("./homeDefence.ts").then(({ HomeDefence }) => {
        const defence = new HomeDefence({
          town, items, config, privateState: info.privateState as Record<string, unknown> | undefined, settings, commands, sound,
          art, view, world: mapLayer, camera, editor, clock,
          camp: { id: Number(info.map.idCurrentTreasure) || 0, last: Number(info.map.timestampLastTreasure) || 0,
            vars: (info.map as unknown as { currentQuestVars?: Record<string, unknown> }).currentQuestVars ?? {} },
        });
        app.ticker.add((ticker) => defence.tick(ticker.deltaMS));
      });
    };
    afterDrawing = () => {
      defend();
      // Arthur's lessons first (a new player has no carts yet); otherwise the carts.
      if (lessonsNotStarted(info.playerInfo.completed_tutorial, town.id)) {
        editor.offerLessons(settings.classicUrl);
      } else {
        editor.welcomeCarts(carts(info.map.receivedAssists), (pid) => names.get(pid) ?? "A neighbour");
      }
    };
    const [cashForGold, goldForCash] = [Number(config.globals?.EXCHANGE_CASH) || 5, Number(config.globals?.EXCHANGE_GOLD) || 2500];
    const bank = new BankWindow({
      empire: settings.userId,
      csrf: settings.csrf ?? "",
      flush: () => commands.flush(),
      changed: (cash, resources) => {
        town.cash = cash;
        town.gold = resources.g ?? town.gold;
        town.wood = resources.w ?? town.wood;
        town.food = resources.f ?? town.food;
        town.stone = resources.s ?? town.stone;
        hud.update(town);
      },
      cashForGold: () => {
        if (town.cash < cashForGold) {
          return false;
        }
        town.cash -= cashForGold;
        town.gold += goldForCash;
        commands.add("exchange_cash_new", town.id);
        hud.update(town);
        return true;
      },
    });
    hud.offerBank(() => void bank.open());

    const thumbnail = (item: ItemInfo) => `${settings.assetsUrl}/buildingthumbs/${item.art}.jpg`;
    const privateState = info.privateState ?? {};
    // Goals only in a human town below level 35, as in the Flash client.
    if (goalsRun(town)) {
      new GoalKeeper({
        town, doings, items,
        goals: readGoals((config.missions ?? []) as never, goalNeeds.goals as unknown as Record<string, Need>),
        done: privateState.completedMissions ?? [],
        paid: privateState.rewardedMissions ?? [],
        send: (cmd, ...args) => commands.add(cmd, ...args),
        people: () => population(town, items, increase).current,
        zoom: () => camera.scale,
        say: (text) => editor.tell(text),
        changed: () => hud.update(town),
      });
    }
    new BonusDesk({
      town, items, thumbnail,
      state: privateState,
      config: readBonusConfig(config.globals),
      clock,
      send: (cmd, ...args) => {
        commands.add(cmd, ...args);
        void commands.flush();  // as the Flash client does: a bonus is sent at once
      },
      say: (text) => editor.tell(text),
      changed: () => {
        hud.update(town);
        editor.refresh();
      },
      dailyCollected: (day) => {
        doings.dailyBonusDay = day;
      },
    });
  } else {
    document.body.classList.add("visiting");
    const commands = new CommandSender(settings, { clock, onFailure: (reason) => showStatus(reason) });
    let quiet: ReturnType<typeof setTimeout> | undefined;
    const visitor = new Visit({
      neighbour: visit, view, hud, commands, clock,
      assists: mine?.privateState?.neighborAssists,
      say: (text) => {
        showMessage(text);
        clearTimeout(quiet);
        quiet = setTimeout(() => showMessage(""), 3000);
      },
    });
    commands.start();  // after the visit's own leaving, so the help goes with the last send
    camera.onTap = (at) => visitor.tap(at);
  }
  const { missing } = await view.build((done, total) => showStatus(`Drawing your town… ${Math.round((100 * done) / total)}%`));
  if (missing.length) {
    console.warn("No art yet for:", missing);
    showStatus(`Some pictures aren't available yet (${missing.length}); they show as outlines.`);
    setTimeout(() => showStatus(""), 6000);
  } else {
    showStatus("");
  }
  afterDrawing();
  // Back from an island: the island window again, as the Flash client opens it.
  if (new URLSearchParams(location.search).has("islands")) {
    openIslands();
  }
}

/** The town's units by kind, the most first, as the Army window lists them. */
function unitsInTown(town: Town): { item: ItemInfo; count: number }[] {
  const counts = new Map<ItemInfo, number>();
  for (const placed of town.items) {
    if (placed.item.isUnit) {
      counts.set(placed.item, (counts.get(placed.item) ?? 0) + 1);
    }
  }
  return [...counts].map(([item, count]) => ({ item, count })).sort((a, b) => b.count - a.count || a.item.name.localeCompare(b.item.name));
}

/**
 * Where the camera starts: where the Flash client starts, so the town opens
 * on the view players know (the first block a little up and right of the
 * middle of the screen).
 */
const FLASH_START: Point = { x: -84, y: 2679 };

start().catch((error: unknown) => {
  console.error(error);
  showStatus(`The town couldn't load: ${error instanceof Error ? error.message : String(error)}`);
});
