// The defence plan (CLIENT.md, "Attacking players"): the Army window's
// second tab shows the four plans with the game's pictures and words, the
// town's own ticked (a new town starts on "Defensive", as the game's own
// new save has it). A
// plan picked is ticked, and saved with set_strategy as the window closes;
// opened again, it shows the plan saved. Closing without a change sends
// nothing.

import assert from "node:assert/strict";

export default async function defence({ newPlayer }) {
  const player = await newPlayer();
  const { page } = player;
  const plans = () => page.locator(".army-plan");
  const picked = () => page.locator(".army-plan[aria-pressed=true]").getAttribute("aria-label");

  await player.menu("Army");
  await player.press("My Defensive Strategy");
  assert.equal(await plans().count(), 4);
  assert.deepEqual(await page.locator(".army-plan strong").allTextContents(), ["Defensive", "Mid Defensive", "Mid Aggressive", "Aggressive"]);
  assert.equal(await picked(), "Defensive", "a new town starts with all staying");
  assert.match(await page.locator(".army-plan-header").textContent(), /Defensive Strategy/);
  assert.equal(await page.locator(".army-plan-tick").count(), 1);
  // Every picture is the game's and loaded.
  for (const image of await page.locator(".army-plan-picture img:first-child").all()) {
    assert.ok(await image.evaluate((img) => img.complete && img.naturalWidth > 0), "a plan's picture");
  }

  await player.press("Aggressive");
  assert.equal(await picked(), "Aggressive");
  await player.shot("plans");
  const sent = page.waitForRequest((r) => r.url().endsWith("/command.php") && r.postData().includes("set_strategy"), { timeout: 15_000 });
  await page.keyboard.press("Escape");
  await sent;
  await player.wait(1000);
  const info = await (await page.request.post(`${player.base}${player.settings.dynamicUrl}/get_player_info.php`,
    { form: { USERID: player.settings.userId, user_key: player.settings.userKey } })).json();
  assert.equal(Number(info.privateState.strategy), 10, "saved: all go for the siege engines");

  // Opened again (and after a reload): the plan saved.
  await player.menu("Army");
  await player.press("My Defensive Strategy");
  assert.equal(await picked(), "Aggressive");
  await page.keyboard.press("Escape");
  await player.reload();
  await player.menu("Army");
  await player.press("My Defensive Strategy");
  assert.equal(await picked(), "Aggressive");
  // Back to the army tab: the units, as before.
  await player.press("My Army");
  assert.equal(await page.locator(".army-plans").count(), 0);
  assert.match(await page.locator(".army-people").textContent(), /^People:/);
}
