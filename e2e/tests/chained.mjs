// Chained buildings (CLIENT.md, "Chained buildings"; DECISIONS.md, 20
// October 2026). A level 20 town buys the Chained Fire God + Colossus in New,
// Limited Edition, for gold. Built, its Free button shows the god and the
// colossus and how long the chains hold; Speed up pays a cash an hour left;
// Free puts both beside it and the building goes. The save follows. Then the
// shop won't sell it again: each Chained building once per empire.

import assert from "node:assert/strict";
import { has } from "../lib.mjs";

const CHAIN = 3094, FIRE_GOD = 2075, FIRE_COLOSSUS = 2077, HOUSE = 1, AT = [56, 56];

export default async function chained({ newPlayer, offlineVillage }) {
  let player = await newPlayer();
  await player.send([{ cmd: "rt_level_up", args: [20] }]);
  // Gold and cash, and room for the god and the colossus (5 people each): three more houses.
  player = await offlineVillage(player, (save) => {
    save.maps[0].coins = 8_000_000;
    save.playerInfo.cash = 200;
    for (const x of [40, 42, 44]) save.maps[0].items.push([HOUSE, x, 62, 0, 1, 0]);
  });
  const { page } = player;
  await player.closeLevelUps();
  const price = await page.evaluate((id) => window.seHome.parts.items.get(id).cost, CHAIN);
  assert.equal(price, 7_290_000, "priced by the god's and the colossus's strength");
  const hours = await page.evaluate((id) => window.seHome.parts.items.get(id).chainHours, CHAIN);

  await player.press("Build");
  await player.press("New");
  await player.press("Limited Edition");
  // By its text: player.card() reads the name as a pattern, and "+" means something there.
  const card = page.locator(".shop-card", { has: page.locator(".shop-name", { hasText: "Chained Fire God + Colossus" }) });
  await card.scrollIntoViewIfNeeded();
  await page.waitForFunction(() => [...document.querySelectorAll(".shop-card")]
    .find((c) => c.querySelector(".shop-name")?.textContent === "Chained Fire God + Colossus")?.querySelector(".shop-picture img")?.naturalWidth > 0,
    null, { timeout: 15_000 });
  await player.shot("shop");
  await card.click();
  await player.wait(300);
  await player.tapTile(AT);
  await player.wait(500);
  await player.closeLevelUps();
  await page.waitForFunction(([x, y]) => {
    const placed = window.seHome.parts.town.items.find((p) => p.item.id === 3094 && p.tx === x && p.ty === y);
    return placed && !(placed.builtAt !== undefined && placed.builtAt > Date.now());
  }, AT, { timeout: 30_000 });
  let saved = await player.saved();
  assert.ok(has(saved, CHAIN, AT), "bought and placed");
  // Its gold price, give or take what the houses earned meanwhile.
  assert.ok(saved.coins >= 8_000_000 - price && saved.coins <= 8_000_000 - price + 100, `its gold price (${saved.coins})`);

  // Its window: both units, the chains' wait, Speed up.
  await player.select(AT, "Chained Fire God + Colossus");
  await player.press("Free");
  const window = page.locator(".chained-window");
  await window.waitFor();
  assert.deepEqual(await window.locator(".chained-units span").allTextContents(), ["Elemental Fire God", "Elemental Fire Colossus"]);
  assert.match(await window.locator(".chained-time").textContent(), /^\d+:\d\d:\d\d$/);
  const speed = window.locator(".chained-speed-up");
  assert.match(await speed.textContent(), new RegExp(`Speed up for (${hours}|${hours - 1})`));
  await page.waitForFunction(() => [...document.querySelectorAll(".chained-units img")].every((i) => i.naturalWidth > 0), null, { timeout: 15_000 });
  await player.shot("waiting");
  const cost = Number((await speed.textContent()).match(/(\d+)/)[1]);
  await speed.click();

  // Free: both beside it, the building gone.
  await window.getByRole("button", { name: "Free Elemental Fire God and Elemental Fire Colossus" }).click();
  await window.waitFor({ state: "hidden" });
  assert.match(await player.said(/yours/), /Elemental Fire God and Elemental Fire Colossus are yours!/);
  await player.wait(1500);
  const state = await (await page.request.post(`${player.base}${player.settings.dynamicUrl}/get_player_info.php`,
    { form: { USERID: player.settings.userId, user_key: player.settings.userKey } })).json();
  assert.equal(Number(state.playerInfo.cash), 200 - cost, "a cash an hour left");
  assert.ok(!state.map.items.some((row) => row[0] === CHAIN), "the building is gone");
  assert.equal(state.map.items.filter((row) => row[0] === FIRE_GOD).length, 1, "the god");
  assert.equal(state.map.items.filter((row) => row[0] === FIRE_COLOSSUS).length, 1, "the colossus");
  assert.match(await page.locator(".hud-people [data-people]").textContent(), /^16\/20$/, "room for them");
  await player.shot("freed");

  // After a reload they're still there.
  await player.reload();
  saved = await player.saved({ waitForBatch: false });
  assert.ok(saved.items.some((row) => row[0] === FIRE_GOD) && saved.items.some((row) => row[0] === FIRE_COLOSSUS));

  // Once per empire: the shop says so, and the server keeps the list.
  await player.closeLevelUps();
  await player.press("Build");
  await player.press("New");
  await player.press("Limited Edition");
  const again = page.locator(".shop-card", { has: page.locator(".shop-name", { hasText: "Chained Fire God + Colossus" }) });
  await again.scrollIntoViewIfNeeded();
  assert.match(await again.textContent(), /Bought already/);
  await player.shot("bought-already");
  const after = await (await page.request.post(`${player.base}${player.settings.dynamicUrl}/get_player_info.php`,
    { form: { USERID: player.settings.userId, user_key: player.settings.userKey } })).json();
  assert.deepEqual(after.privateState.chainedBought, [CHAIN]);
}
