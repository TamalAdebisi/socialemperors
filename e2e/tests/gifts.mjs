// Gifts (CLIENT.md, "Neighbours"), the classic page's window in the new
// client. Two players are friends; one sends the other today's free gift.
// As the other's town opens, the Gifts window opens by itself with it;
// Take puts it in storage (the town loads again as the window closes). Then
// it goes back from storage to the friend, from Neighbours' Gifts; the
// friend's row there has their experience and the "ASSIST!" mark. What is
// given leaves the giver's storage, on the server and on screen; the friend
// takes it into their storage, not their gift box, so placing it gives no
// experience again (DECISIONS.md, 20 October 2026).

import assert from "node:assert/strict";
import { has, stored } from "../lib.mjs";

export default async function gifts({ newPlayer }) {
  const player = await newPlayer();
  const friend = await newPlayer();
  // No friend requests: every account can exchange gifts.
  const giftsOf = async (who) => (await who.page.request.get(`${who.base}/gifts/game?empire=${encodeURIComponent(who.settings.userId)}`)).json();
  const infoOf = async (who) => (await who.page.request.post(`${who.base}${who.settings.dynamicUrl}/get_player_info.php`,
    { form: { USERID: who.settings.userId, user_key: who.settings.userKey } })).json();

  // The friend sends today's free gift.
  const theirs = await giftsOf(friend);
  const me = theirs.friends.find((f) => f.username === player.name);
  assert.ok(me && theirs.free.length > 0, "the friend can send a free gift");
  const sent = await friend.page.request.post(`${friend.base}/gifts/game?empire=${encodeURIComponent(friend.settings.userId)}`,
    { form: { action: "free", friend: String(me.id), item: String(theirs.free[0].id), csrf: await friend.csrf() } });
  assert.ok((await sent.json()).ok, "sent");
  const giftName = theirs.free[0].name;
  const giftId = theirs.free[0].id;

  // The town opens: the window with the gift waiting.
  await player.open();
  const { page } = player;
  const window = page.locator(".panel.gifts-window:not([hidden])");
  await window.waitFor({ timeout: 15_000 });
  await window.getByRole("button", { name: `Take ${giftName}` }).waitFor();
  assert.match(await window.textContent(), new RegExp(`from ${friend.name}`));
  await player.shot("waiting");
  await window.getByRole("button", { name: `Take ${giftName}` }).click();
  await page.waitForFunction(() => /In your Gifts and Storage/.test(document.querySelector(".gifts-message")?.textContent ?? ""));
  // Closing loads the town again, with the gift in storage.
  await Promise.all([page.waitForEvent("load"), page.keyboard.press("Escape")]);
  await player.loaded();
  const held = () => page.evaluate((id) => {
    const town = window.seHome.parts.town;
    return (town.gifts.get(id) ?? 0) + (town.store.get(id) ?? 0);
  }, giftId);
  const before = await held();
  assert.ok(before >= 1, "the gift is in storage");

  // From Neighbours: Gifts, From storage, back to the friend.
  await player.menu("Neighbours");
  // The friend's row: their experience, and "ASSIST!" (never helped).
  const row = page.locator(".panel:not([hidden]) .row", { hasText: friend.name });
  assert.match(await row.textContent(), /Level \d+ · [\d,]+ XP/);
  assert.equal(await row.locator(".assist-mark").count(), 1, "can be helped today");
  await player.shot("neighbours");
  await page.locator(".panel:not([hidden])").getByRole("button", { name: "Gifts" }).click();
  await window.waitFor();
  await window.getByRole("tab", { name: "From storage" }).click();
  await window.locator("select").first().selectOption({ label: friend.name });
  const item = window.locator("select").nth(1);
  const options = await item.locator("option").allTextContents();
  const index = options.findIndex((text) => text.startsWith(giftName));
  assert.ok(index >= 0, `the gift is offered from storage: ${options.join(", ")}`);
  await item.selectOption({ index });
  await player.shot("give");
  await window.getByRole("button", { name: "Give" }).click();
  await page.waitForFunction(() => /is on its way to/.test(document.querySelector(".gifts-message")?.textContent ?? ""), null, { timeout: 10_000 });
  const back = await giftsOf(friend);
  assert.ok(back.waiting.some((g) => g.name === giftName), "the friend has it waiting");

  // It left the giver: on the server at once, on screen once the window
  // closes and the town loads again.
  const left = (await giftsOf(player)).storage.find((g) => g.id === giftId)?.count ?? 0;
  assert.equal(left, before - 1, "it left the giver's storage on the server");
  await Promise.all([page.waitForEvent("load"), page.keyboard.press("Escape")]);
  await player.loaded();
  assert.equal(await held(), before - 1, "and on screen");

  // The friend takes it into storage: placing it gives no experience again.
  const taken = await friend.page.request.post(`${friend.base}/gifts/game?empire=${encodeURIComponent(friend.settings.userId)}`,
    { form: { action: "take", gift: "all", csrf: await friend.csrf() } });
  assert.match((await taken.json()).ok ?? "", new RegExp(giftName), "taken");
  const info = await infoOf(friend);
  assert.equal(stored(info.map.store, giftId), 1, "in the friend's storage");
  assert.equal(stored(info.privateState.gifts, giftId), 0, "not in their gift box");
  await friend.send([{ cmd: "place_gift", args: [giftId, 40, 40, 0, 0] }]);  // as an edited request would ask
  const town = await friend.saved({ waitForBatch: false });
  assert.ok(has(town, giftId, [40, 40]), "placed");
  assert.equal(town.xp, info.map.xp, "no experience for it again");
}
