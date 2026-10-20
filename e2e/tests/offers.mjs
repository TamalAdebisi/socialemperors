// The shop's Offers (CLIENT.md, "Offers"; DECISIONS.md, 20 October 2026): the
// original's offer packs and mystery boxes, for cash earned in the game. A
// level 30 town buys the first pack (a Castle I, a Wizard and Willy
// Wallace, with resources), the mystery box and a one-prize super box; each
// lands in Storage and the server's save agrees on the cash and the items.

import assert from "node:assert/strict";
import { stored } from "../lib.mjs";

const PACK = 1, MYSTERY = 11, SUPER = 65;

export default async function offers({ newPlayer }) {
  const player = await newPlayer();
  const { page } = player;
  await player.send([{ cmd: "rt_level_up", args: [30] }]);
  await player.reload();
  await player.closeLevelUps();
  const read = async () => (await (await page.request.post(`${player.base}${player.settings.dynamicUrl}/get_player_info.php`,
    { form: { USERID: player.settings.userId, user_key: player.settings.userKey } })).json());
  const before = await read();
  const cash = Number(before.playerInfo.cash);

  await player.press("Build");
  await player.press("Offers");
  const card = (id) => page.locator(`.shop-card.offer-card[data-offer="${id}"]`);
  await card(PACK).waitFor();
  assert.equal(await page.locator(".shop-card.offer-card").count(), 65, "every pack and box the game has");
  await page.waitForFunction(() => document.querySelector('[data-offer="1"] .offer-picture img')?.naturalWidth > 0, null, { timeout: 15_000 });
  await player.shot("offers");

  // The pack: its price, and everything in Storage.
  const packButton = card(PACK).getByRole("button", { name: /^Buy · \d+ cash$/ });
  const packCash = Number((await packButton.textContent()).match(/· (\d+)/)[1]);
  await packButton.click();
  assert.match(await player.said(/in your Storage/), /Castle I, Wizard, Willy Wallace are in your Storage/);

  // The mystery box: one of its four prizes.
  const boxButton = card(MYSTERY).getByRole("button", { name: /^Buy · \d+ cash$/ });
  const boxCash = Number((await boxButton.textContent()).match(/· (\d+)/)[1]);
  await boxButton.scrollIntoViewIfNeeded();
  await boxButton.click();
  await player.said(/is in your Storage/);

  // A super box: its first choice, one prize; its picture.
  const superButton = card(SUPER).getByRole("button", { name: /^1 prize · \d+ cash$/ });
  const superCash = Number((await superButton.textContent()).match(/· (\d+)/)[1]);
  await superButton.scrollIntoViewIfNeeded();
  await superButton.click();
  await player.said(/is in your Storage/);
  await player.shot("bought");
  // A box the game has no picture of shows its prizes' pictures.
  const unpictured = page.locator(".shop-card.offer-card .offer-prizes").first();
  await unpictured.scrollIntoViewIfNeeded();
  assert.ok(await unpictured.locator("img").count() > 0);
  await player.shot("prizes");

  await player.wait(1500);
  const after = await read();
  assert.equal(Number(after.playerInfo.cash), cash - packCash - boxCash - superCash, `each price paid (${cash}, ${packCash}, ${boxCash}, ${superCash})`);
  assert.ok(packCash <= 25 && boxCash <= 60 && superCash <= 60, "the game's prices, shrunk");
  const store = after.map.store;
  for (const id of [27, 550, 555]) assert.equal(stored(store, id), 1, `pack item ${id}`);
  const mysteryPrizes = [60, 662, 660, 651].filter((id) => stored(store, id) > 0);
  assert.equal(mysteryPrizes.length, 1, "one mystery prize");
  assert.equal(Number(after.map.coins), Number(before.map.coins) + 5000, "the pack's gold");
}
