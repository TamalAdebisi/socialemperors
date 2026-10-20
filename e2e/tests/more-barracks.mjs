// Barracks the game's shop never sold (DECISIONS.md, 20 October 2026):
// the shop now sells them in New, Limited Edition. A level 20 town buys the
// Gryphon Barracks there for its cash price; once built, its card offers
// to train the Gryphon Knight. The save has the barracks and the cash paid.

import assert from "node:assert/strict";
import { has } from "../lib.mjs";

const GRYPHON_BARRACKS = 1223, AT = [56, 56];

export default async function moreBarracks({ newPlayer }) {
  const player = await newPlayer();
  const { page } = player;
  await player.send([{ cmd: "rt_level_up", args: [20] }]);
  await player.reload();
  await player.closeLevelUps();
  const cash = await page.evaluate(() => window.seHome.parts.town.cash);
  const price = await page.evaluate((id) => window.seHome.parts.items.get(id).cost, GRYPHON_BARRACKS);
  assert.ok(cash >= price, `cash for the barracks (${cash} of ${price})`);

  await player.press("Build");
  await player.press("New");
  await player.press("Limited Edition");
  await player.wait(1000);
  const card = player.card("Gryphon Barracks");
  await card.scrollIntoViewIfNeeded();
  await page.waitForFunction(() => [...document.querySelectorAll(".shop-card")]
    .find((c) => c.querySelector(".shop-name")?.textContent === "Gryphon Barracks")?.querySelector(".shop-picture img")?.naturalWidth > 0,
    null, { timeout: 15_000 });
  await player.shot("shop");
  await card.click();
  await player.wait(300);
  await player.tapTile(AT);
  await player.wait(500);
  await player.closeLevelUps();

  // Ten seconds of scaffolding, then its card trains the Gryphon Knight.
  await page.waitForFunction(([x, y]) => {
    const placed = window.seHome.parts.town.items.find((p) => p.item.id === 1223 && p.tx === x && p.ty === y);
    return placed && !(placed.builtAt !== undefined && placed.builtAt > Date.now());
  }, AT, { timeout: 30_000 });
  await player.select(AT, "Gryphon Barracks");
  assert.ok(await player.button("Train Gryphon Knight").isVisible(), "it trains the Gryphon Knight");
  await player.shot("card");

  const after = await player.saved();
  assert.ok(has(after, GRYPHON_BARRACKS, AT), "the barracks in the save");
  const saved = await (await page.request.post(`${player.base}${player.settings.dynamicUrl}/get_player_info.php`,
    { form: { USERID: player.settings.userId, user_key: player.settings.userKey } })).json();
  assert.equal(Number(saved.playerInfo.cash), cash - price, "its cash price paid");
}
