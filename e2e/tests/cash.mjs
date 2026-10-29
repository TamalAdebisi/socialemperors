// Land and cash (CLIENT.md, "Land and cash"): a town at level 20 (the
// level-up prizes give it cash) buys the block below the middle for cash,
// finds House IV can't be opened early (as in the Flash client, whose tag
// for it did nothing), hurries a gold mine for 1,000 food (the original's
// 2 cash, in food since 29 October 2026) and trades at the bank. The save
// has each.

import assert from "node:assert/strict";
import { itemAt } from "../lib.mjs";

const MINE = 13, VILLAGER = 500, MINE_AT = [56, 56], WORKER = [57, 54];
const FOR_SALE = [50, 61];  // block 18, below the middle (13)

export default async function cash({ newPlayer, offlineVillage }) {
  let player = await newPlayer();
  // As the Flash client would: level 20 (its prizes), and a gold mine with a villager set to work 8 hours.
  await player.send([
    { cmd: "rt_level_up", args: [20] },
    { cmd: "buy", args: [MINE, ...MINE_AT, 0, 0, 0, 1] },
    { cmd: "buy", args: [VILLAGER, ...WORKER, 0, 0, 0, 1] },
    { cmd: "push_unit", args: [...WORKER, VILLAGER, ...MINE_AT, 0] },
    { cmd: "activate", args: [...MINE_AT, 0, MINE, 4] },
  ]);
  // Food to hurry the mine.
  player = await offlineVillage(player, (save) => { save.maps[0].food = 5000; });
  // After the first batch: a goal done as the town opens (two villagers, with the one
  // lib.mjs gives every test town) pays its gold then.
  const before = await player.saved();
  const cashBefore = Number(await player.page.locator('[data-n="cash"]').textContent());
  assert.ok(cashBefore >= 40, `the prizes gave cash: ${cashBefore}`);

  // Land for sale: tapping it offers it; gold needs more than there is, cash will do.
  await player.tapTile(FOR_SALE);
  assert.match(await player.bar(), /^Land for sale: 4,000 gold \(with 1 neighbour\) or 20 cash/);
  await player.shot("land-for-sale");
  await player.press("Buy for 4,000 gold");
  await player.said(/Not enough gold/);
  await player.press("Buy for 20 cash");
  await player.wait(1500);
  await player.shot("land-bought");

  // House IV opens at level 31: grey till then, with no way to open it early.
  await player.menu("Build");
  await player.press("Houses");
  const house = player.page.locator(".shop-card.locked", { has: player.page.locator(".shop-name", { hasText: /^House IV$/ }) });
  assert.equal(await house.count(), 1, "House IV is locked");
  assert.equal(await house.getByRole("button").count(), 0, "and offers nothing to open it early");
  await player.page.keyboard.press("Escape");

  // The gold mine works for 8 hours: 1,000 food finish it, and its gold comes now.
  const mine = await player.select(MINE_AT, (text) => text.startsWith("Gold Mine I"));
  assert.match(mine.text, /Ready in 8 h|Ready in 7 h/);
  await player.press("Hurry up");  // the game's hurry window, then its Buy for 1,000
  await player.press("Finish now for 1,000 food");
  await player.wait(300);

  const saved = await player.saved();
  assert.ok(saved.expansions.includes(18), "block 18 is open");
  assert.equal(saved.coins, before.coins + 600, "the mine's 8 hours: 200 gold three times");
  const after = await player.page.request.post(`${player.base}${player.settings.dynamicUrl}/get_player_info.php`,
    { form: { USERID: player.settings.userId, user_key: player.settings.userKey } });
  const info = await after.json();
  assert.equal(info.playerInfo.cash, cashBefore - 20, "20 for the land, none to hurry");
  assert.equal(saved.food, before.food - 1000, "1,000 food to hurry");
  assert.ok(itemAt(saved, MINE, MINE_AT)[4] > before.items.find((i) => i[0] === MINE)[4], "the mine starts over");

  // The bank, from the + on the cash pill: cash for gold, the game's own trade.
  await player.press("Bank: get cash");
  await player.wait(1500);
  await player.shot("bank");
  const goldBefore = Number((await player.page.locator('[data-n="gold"]').textContent()).replace(/,/g, ""));
  await player.page.getByRole("button", { name: /^Trade 5 cash for 2,500 gold$/ }).click();
  await player.wait(300);
  assert.equal(Number((await player.page.locator('[data-n="gold"]').textContent()).replace(/,/g, "")), goldBefore + 2500);
  const banked = await player.saved();
  assert.equal(banked.coins, saved.coins + 2500, "the save has the gold");
}
