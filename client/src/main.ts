// The new game client (CLIENT.md, steps 2 and 3): load the game config and
// the player's town from our server, as the Flash client does, draw it with
// PixiJS, and let the player run it (so far: build, place from storage, move, turn,
// store, sell, collect).

import "./ui/style.css";

import { Application, Container } from "pixi.js";

import { TownEditor } from "./editor.ts";
import { CommandSender } from "./net/commands.ts";
import { GameServer, readPageSettings } from "./net/server.ts";
import { itemsById } from "./rules/config.ts";
import { mapArea, skinColour, type Point } from "./rules/geometry.ts";
import { readLevels } from "./rules/levels.ts";
import { obstacle, readShop, shopItems } from "./rules/shop.ts";
import { readTown } from "./rules/town.ts";
import { ActionBar } from "./ui/actions.ts";
import { showHud, showStatus } from "./ui/hud.ts";
import { ShopWindow } from "./ui/shop.ts";
import { ArtLibrary } from "./view/art.ts";
import { Camera } from "./view/camera.ts";
import { drawThumbnail } from "./view/thumbnail.ts";
import { TownView } from "./view/townView.ts";

async function start(): Promise<void> {
  const settings = readPageSettings();
  const server = new GameServer(settings);

  // ?visit=<player id> shows another player's town, as visiting a neighbour does.
  const visit = new URLSearchParams(location.search).get("visit") ?? undefined;
  showStatus(visit ? "Loading their town…" : "Loading your town…");
  const [config, info] = await Promise.all([server.gameConfig(), server.playerInfo({ user: visit })]);
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
  app.stage.addChild(world);
  const camera = new Camera(world, mapArea(), FLASH_START);
  camera.resize(app.screen.width, app.screen.height);
  camera.attach(app.canvas);
  app.renderer.on("resize", (width: number, height: number) => camera.resize(width, height));
  app.ticker.add((ticker) => camera.update(ticker.deltaMS));

  const hud = showHud(town, { classicUrl: settings.classicUrl, visiting: visit !== undefined });

  const art = new ArtLibrary(settings.artUrl);
  const view = new TownView(art, items, town);
  world.addChild(view.root);
  app.ticker.add((ticker) => view.tick(ticker.deltaMS, camera.scale));

  // The player's own town can be changed; a visited one only looked at.
  if (visit === undefined) {
    const commands = new CommandSender(settings, { clock, onFailure: (reason) => showStatus(reason) });
    commands.start();
    const levels = readLevels(config.levels);
    const shop = new ShopWindow({
      categories: readShop(config.categories),
      items: (category, tab) => shopItems(items.values(), town, category, tab),
      obstacle: (item) => obstacle(town, item),
      thumbnail: (item) => `${settings.assetsUrl}/buildingthumbs/${item.art}.jpg`,
      picture: (item, canvas) => drawThumbnail(art, item, canvas),
      choose: (item) => editor.startBuilding(item),
      storage: () => editor.storageCards(),
    });
    const editor = new TownEditor({ town, view, bar: new ActionBar(), commands, hud, camera, clock, levels, shop, items });
    hud.offerShop(() => editor.openShop(), () => editor.openStorage());
  }
  const { missing } = await view.build((done, total) => showStatus(`Drawing your town… ${Math.round((100 * done) / total)}%`));
  if (missing.length) {
    console.warn("No art yet for:", missing);
    showStatus(`Some pictures aren't available yet (${missing.length}); they show as outlines.`);
    setTimeout(() => showStatus(""), 6000);
  } else {
    showStatus("");
  }
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
