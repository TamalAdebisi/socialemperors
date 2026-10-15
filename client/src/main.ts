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
import { readLevels, unlockedAt } from "./rules/levels.ts";
import { LevelUpWindows } from "./ui/levelUp.ts";
import { obstacle, readShop, shopItems } from "./rules/shop.ts";
import { readLandPrices } from "./rules/land.ts";
import { arthur, carts } from "./rules/neighbours.ts";
import { lessonsNotStarted, lessonsUnderWay, reported, resumeAt } from "./rules/lessons.ts";
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
import { Graveyards } from "./ui/graveyard.ts";
import { Pause } from "./ui/pause.ts";
import { bury, readDead } from "./rules/graveyard.ts";
import { freeHelpers } from "./rules/social.ts";
import { freeSpotNear, GOALS_END_LEVEL, givenOnOpening, HARBOUR, levelThirtyFive, ZEPPELIN_TOWER } from "./rules/dock.ts";
import { NESTS } from "./rules/nest.ts";
import { NestWindow } from "./ui/nest.ts";
import { AskFriends } from "./ui/askFriends.ts";
import { WorldWindows } from "./ui/world.ts";
import { ArtLibrary } from "./view/art.ts";
import { Camera } from "./view/camera.ts";
import { drawThumbnail } from "./view/thumbnail.ts";
import { TownView } from "./view/townView.ts";

/** The building where spells are learnt. */
const WIZARDRY_ACADEMY = 416;
/** The harbours and zeppelin towers (human and troll), and the island map's page each opens. */
const DOCKS = new Map([[HARBOUR, 1], [343, 1], [ZEPPELIN_TOWER, 3], [344, 3]]);

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
    population: (t) => population(t, items, increase), sound, pause: new Pause(app.ticker) });

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
    // As the Flash client opens a town: the tidy-up, and a free helper at a social building that waits for some.
    const opening = [...cleanUp(town).commands, ...freeHelpers(town)];
    // Arthur's lessons (lessons.ts): carried on after a reload, from what the save and this browser say.
    const lessonsKey = `se-lessons-${settings.userId}`;
    const lessonsHere = rememberedLessons(lessonsKey);
    if (!lessonsNotStarted(info.playerInfo.completed_tutorial, town.id) && !lessonsUnderWay(info.playerInfo.completed_tutorial, town.id, lessonsHere)) {
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
    // Trees, rocks and wild animals grow back (rules/nature.ts) once the camp of the moment is
    // up, as in the Flash client: a camp that clears the wild ring doesn't take what just grew.
    const grow = () => {
      const { commands: grown, added } = growBack(town, items, clock(), { animals });
      for (const command of grown) {
        commands.add(command.cmd, ...command.args);
      }
      added.forEach((placed) => void view.redraw(placed));
    };
    const shop = new ShopWindow({
      categories: readShop(config.categories),
      items: (category, tab) => shopItems(items.values(), town, category, tab),
      obstacle: (item) => obstacle(town, item),
      thumbnail: (item) => `${settings.assetsUrl}/buildingthumbs/${item.art}.jpg`,
      picture: (item, canvas) => drawThumbnail(art, item, canvas),
      choose: (item) => editor.startBuilding(item),
      storage: () => editor.storageCards(),
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
      // For the goals: the map seen at all ("Check the map"), and from the menus ("Sail in another way").
      opened: (how) => {
        doings.openedIslands(how === "menu");
      },
    });
    const world = new WorldWindows(settings.classicUrl, islands);
    openIslands = () => islands.open(undefined, "back");
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
    // The graveyards and the Altar of Heroes (ui/graveyard.ts): the fallen as the save keeps them, and the potions.
    const saved = (info.privateState ?? {}) as Record<string, unknown>;
    const dead = readDead(saved.deadHeroes);
    const potionPack = (config.globals?.GRAVEYARD_POTIONS ?? {}) as { price?: { c?: number }; amount?: number };
    const graves = new Graveyards({
      town, items, dead,
      potions: { count: Number(saved.potion) || 0 },
      pack: { amount: Number(potionPack.amount) || 1, cash: Number(potionPack.price?.c) || 100 },
      thumbnail: (item) => `${settings.assetsUrl}/buildingthumbs/${item.art}.jpg`,
      heroPicture: (item) => `${settings.assetsUrl}/buildingthumbs/${item.art}_altar.png`,
      send: (cmd, ...args) => {
        commands.add(cmd, ...args);
        void commands.flush();  // as the Flash client: at once
      },
      arrived: (placed, lines) => editor.arrived(placed, lines),
      changed: () => hud.update(town),
    });
    let learning = lessonsUnderWay(info.playerInfo.completed_tutorial, town.id, lessonsHere);
    const lines = new Map(((config.localization_strings ?? []) as { id: number; text: string }[]).map((l) => [Number(l.id), l.text]));
    const doings = new Doings();
    doings.questStars = ((info.privateState as Record<string, unknown> | undefined)?.questsRank ?? {}) as Record<string, number>;
    // What visits to neighbours did in this tab counts for the goals here.
    const visits = visitsSoFar();
    doings.lastVisited = visits.last;
    doings.helpedBuildings = visits.helped;
    // The bonuses (made once the town's goals are, below) hear of a level up.
    let bonuses: BonusDesk | undefined;
    // The goals, while they run (from level 35 they stop, as in the Flash client).
    let goalKeeper: GoalKeeper | undefined;
    // The level-up window, the game's words in it; from level 36 each level gives mana too.
    const line = (id: number, fallback: string) => lines.get(id) ?? fallback;
    const manaFrom = Number(config.globals?.START_LEVEL_MANA_REWARD) || 36;
    const manaPerLevel = Number(config.globals?.MANA_REWARD_PER_LEVEL) || 2;
    const levelWindows = new LevelUpWindows(
      { title: line(467, "LEVEL #0#!"), rank: line(468, "You've reached #0# rank"), canBuy: line(469, "You can now buy:"), reward: line(470, "Level reward:") },
      (item) => `${settings.assetsUrl}/buildingthumbs/${item.art}.jpg`,
      () => sound.play("level-up"));
    (window as unknown as Record<string, unknown>).seLevels = levelWindows;
    const editor = new TownEditor({ town, view, bar: new ActionBar(), commands, hud, camera, clock, levels, shop, items, doings,
      sound: (effect) => sound.play(effect),
      showLevels: (reached) => levelWindows.show(reached.map((r) => ({
        ...r, unlocked: unlockedAt(items.values(), r.level, town.race), mana: r.level >= manaFrom ? manaPerLevel : 0,
      }))),
      thumbnail: (item) => `${settings.assetsUrl}/buildingthumbs/${item.art}.jpg`,
      land: { prices: readLandPrices(config.expansion_prices as never), neighbours: (info.neighbors ?? []).filter((n) => n.name !== "Best Empire").length },
      waiting: (gifts) => menus.count("storage", gifts),
      windowOf: (placed) => {
        if (placed.item.id === WIZARDRY_ACADEMY) {
          return { label: "Spells", run: () => spells.open() };
        }
        // The harbour opens the island map at its first page, the zeppelin tower at its third, as in the original.
        const page = DOCKS.get(placed.item.id);
        if (page) {
          return { label: page === 1 ? "Let's sail" : "Let's fly", icon: page === 1 ? "open-harbour" : "open-zeppelin", run: () => {
            if (armyOf(town).length === 0) {
              editor.tell(page === 1 ? "You don't have any troop to set sail!" : "You don't have any troop to fly!");
            } else {
              islands.open(page);
            }
          } };
        }
        // The dragon nest and the monster nest (ui/nest.ts): the original's Open button.
        const kind = NESTS.find((n) => n.building === placed.item.id);
        if (kind) {
          return { label: "Open", icon: "open-nest", run: () => nests.open(kind, placed) };
        }
        return graves.windowOf(placed);
      },
      levelled: (level) => {
        bonuses?.levelled();
        if (level === GOALS_END_LEVEL) {
          // Level 35, as the Flash client marks it: the goals stop, and a Wizardry Academy is given.
          goalKeeper?.stop();
          const academy = levelThirtyFive(town, items);
          if (academy) {
            academy.commands.forEach((command) => commands.add(command.cmd, ...command.args));
            void view.redraw(academy.placed);
            editor.tell("Your goals are done! A Wizardry Academy is yours: learn spells there for your battles.");
          }
        }
      } });
    hud.offerCollectAll(() => editor.collectAll());
    hud.offerSquareTool(() => editor.takeSquareTool());
    hud.offerTools((tool) => editor.chooseTool(tool));
    // Help from neighbours: their donkey carts, one after another.
    const names = new Map(neighbourList.map((n) => [String(n.pid), n.name?.trim() || "A neighbour"]));
    // Once the town is drawn: a cart added before would be drawn twice.
    // Raids on the town and the troll camps (homeDefence.ts, homeCamps.ts): rolled each time it opens.
    const defend = () => {
      void import("./homeDefence.ts").then(({ HomeDefence }) => {
        const defence = new HomeDefence({
          town, items, config, privateState: info.privateState as Record<string, unknown> | undefined, settings, commands, sound,
          art, view, world: mapLayer, camera, editor, clock, buried: (id) => bury(dead, id), quiet: () => learning,
          camp: { id: Number(info.map.idCurrentTreasure) || 0, last: Number(info.map.timestampLastTreasure) || 0,
            vars: (info.map as unknown as { currentQuestVars?: Record<string, unknown> }).currentQuestVars ?? {} },
        });
        app.ticker.add((ticker) => defence.tick(ticker.deltaMS));
        grow();
        // Then the harbour (and from level 30 the zeppelin tower), given and opened as the Flash
        // client does (rules/dock.ts): after the camp, as a new town's prisoner holds the harbour back.
        for (const { placed, commands: sent } of givenOnOpening(town, items)) {
          for (const command of sent) {
            commands.add(command.cmd, ...command.args);
          }
          void view.redraw(placed);
          editor.tell(placed.item.id === HARBOUR ? "Dock operative! Click in the Harbour to sail through the Great Sea!"
            : "Zeppelin operative! Click in the Zeppelin Tower to fly through the Ancient Sea!");
        }
      });
    };
    afterDrawing = () => {
      defend();
      // Arthur's lessons first (a new player has no carts yet); otherwise the carts.
      const welcome = () => editor.welcomeCarts(carts(info.map.receivedAssists), (pid) => names.get(pid) ?? "A neighbour");
      const startLessons = (from: number) => {
        learning = true;
        void import("./lessons.ts").then(({ Lessons }) => {
          const lessons = new Lessons({
            town, items, editor, view, commands,
            line: (id) => lines.get(id) ?? "",
            screenOf: (point) => mapLayer.toGlobal(point),
            lookAt: (point) => camera.lookAt(point),
            thumbnail: (item) => `${settings.assetsUrl}/buildingthumbs/${item.art}.jpg`,
            privateState: saved,
            remember: (step) => rememberLessons(lessonsKey, step),
            finished: () => {
              learning = false;
              welcome();
            },
          }, from);
          (window as unknown as Record<string, unknown>).seLessons = lessons;
        });
      };
      const then = () => {
        const completed = info.playerInfo.completed_tutorial;
        if (lessonsUnderWay(completed, town.id, lessonsHere)) {
          startLessons(resumeAt(Math.max(reported(completed), lessonsHere ?? 0)));
        } else if (lessonsNotStarted(completed, town.id)) {
          editor.offerLessons(() => startLessons(0));
        } else {
          welcome();
        }
      };
      // Before them, the server's message, if it has one (neighbours' help, gifts).
      const message = String((info.privateState as Record<string, unknown> | undefined)?.message ?? "").trim();
      if (message) {
        editor.showServerMessage(message, then);
      } else {
        then();
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
    // The nests' window. The grown one is the player's, free, on the nearest free tile to the nest, as in the original.
    const nests = new NestWindow({
      town, items, privateState: saved, globals: (config.globals ?? {}) as Record<string, unknown>,
      line: (id) => lines.get(id) ?? "",
      thumbnail: (item) => `${settings.assetsUrl}/buildingthumbs/${item.art}.jpg`,
      picture: (name) => `${settings.assetsUrl}/images_new/${name}`,
      clock,
      send: (list) => {
        for (const command of list) {
          commands.add(command.cmd, ...command.args);
        }
        void commands.flush();  // as the Flash client: at once
      },
      place: (item, nest) => {
        const spot = freeSpotNear(town, item, { x: nest.tx, y: nest.ty });
        if (spot) {
          const placed = { item, tx: spot.x, ty: spot.y, orientation: 0, unitsInside: 0, units: [], startedAt: null, workTime: 0 };
          town.items.push(placed);
          commands.add("buy", item.id, spot.x, spot.y, 0, town.id, 1, 1, "u");
          editor.arrived(placed, []);
          editor.tell(`${item.name} is yours!`);
        }
      },
      changed: () => hud.update(town),
      bank: (why) => {
        editor.tell(why);
        void bank.open();
      },
      askFriends: settings.csrf ? new AskFriends({ empire: settings.userId, csrf: settings.csrf }) : null,
    });

    const thumbnail = (item: ItemInfo) => `${settings.assetsUrl}/buildingthumbs/${item.art}.jpg`;
    const privateState = info.privateState ?? {};
    // Goals only in a human town below level 35, as in the Flash client.
    if (goalsRun(town)) {
      goalKeeper = new GoalKeeper({
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
    bonuses = new BonusDesk({
      town, items, thumbnail,
      state: privateState,
      config: readBonusConfig(config.globals),
      days: settings.days ?? 1000,
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
        doings.dailyBonus(day);
      },
    });
  } else {
    document.body.classList.add("visiting");
    const commands = new CommandSender(settings, { clock, onFailure: (reason) => showStatus(reason) });
    let quiet: ReturnType<typeof setTimeout> | undefined;
    const show = (text: string) => {
      showMessage(text);
      clearTimeout(quiet);
      quiet = setTimeout(() => showMessage(""), 3000);
    };
    // What's said before the town is drawn waits for it: a big town takes
    // more than the message's 3 seconds to draw, and the hint went unseen.
    let held: string | undefined;
    let drawn = false;
    const visitor = new Visit({
      neighbour: visit, view, hud, commands, clock,
      assists: mine?.privateState?.neighborAssists,
      say: (text) => {
        if (drawn) {
          show(text);
        } else {
          held = text;
        }
      },
    });
    afterDrawing = () => {
      drawn = true;
      if (held !== undefined) {
        show(held);
      }
    };
    commands.start();  // after the visit's own leaving, so the help goes with the last send
    camera.onTap = (at) => visitor.tap(at);
  }
  const { missing } = await view.build((done, total) => showStatus(`Drawing your town… ${Math.round((100 * done) / total)}%`));
  if (visit === undefined) {
    void view.showLandForSale();  // the player's own land for sale, as in the Flash client
  }
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

/** The lesson this browser was at, for carrying on after a reload (null: none going on). */
function rememberedLessons(key: string): number | null {
  try {
    const step = localStorage.getItem(key);
    return step === null ? null : Number(step);
  } catch {
    return null;
  }
}

function rememberLessons(key: string, step: number | null): void {
  try {
    if (step === null) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, String(step));
    }
  } catch {
    // nothing kept: after a reload, the save's step alone says where they were
  }
}
