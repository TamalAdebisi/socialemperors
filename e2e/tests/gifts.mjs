// Gifts (CLIENT.md, "Neighbours"), the classic page's window in the new
// client. Two players are friends; one sends the other today's free gift.
// As the other's town opens, the Gifts window opens by itself with it;
// Take puts it in storage (the town loads again as the window closes). Then
// it goes back from storage to the friend, from Neighbours' Gifts; the
// friend's row there has their experience and the "ASSIST!" mark.

import assert from "node:assert/strict";

export default async function gifts({ newPlayer }) {
  const player = await newPlayer();
  const friend = await newPlayer();
  for (const [one, other] of [[player, friend], [friend, player]]) {
    const asked = await one.page.request.post(`${one.base}/friends/ask`, { form: { username: other.name, csrf: await one.csrf() } });
    assert.ok(asked.ok(), `${one.name} asks ${other.name}`);
  }
  const giftsOf = async (who) => (await who.page.request.get(`${who.base}/gifts/game?empire=${encodeURIComponent(who.settings.userId)}`)).json();

  // The friend sends today's free gift.
  const theirs = await giftsOf(friend);
  const me = theirs.friends.find((f) => f.username === player.name);
  assert.ok(me && theirs.free.length > 0, "the friend can send a free gift");
  const sent = await friend.page.request.post(`${friend.base}/gifts/game?empire=${encodeURIComponent(friend.settings.userId)}`,
    { form: { action: "free", friend: String(me.id), item: String(theirs.free[0].id), csrf: await friend.csrf() } });
  assert.ok((await sent.json()).ok, "sent");
  const giftName = theirs.free[0].name;

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
  const stored = await page.evaluate(() => [...window.seHome.parts.town.gifts.values()].reduce((a, b) => a + b, 0));
  assert.ok(stored >= 1, "the gift is in storage");

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
}
