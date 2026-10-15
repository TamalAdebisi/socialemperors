// The harbour, the zeppelin tower and pausing (CLIENT.md, "The harbour and
// the zeppelin", "Pausing"). A new town is given a harbour as it opens,
// near tile (59, 59), and the line at the top says so; the server has it,
// and a reload gives no second one. Its Open shows the island map. At
// level 30 the zeppelin tower comes too. The pause button stops the game
// under a curtain; a key let go starts it again. A brand-new town, whose
// first camp holds the Prisoner Princess, gets no harbour yet.

import assert from "node:assert/strict";

const HARBOUR = 224, ZEPPELIN_TOWER = 299, KNIGHT = 514;

export default async function dock({ newPlayer }) {
  const player = await newPlayer({ dock: true });
  const { page } = player;
  await player.said(/Dock operative/);
  const harbour = await page.evaluate(() => {
    const placed = window.seHome.parts.town.items.find((p) => p.item.id === 224);
    return placed && [placed.tx, placed.ty];
  });
  assert.ok(harbour, "a harbour in the town");
  assert.ok(Math.max(Math.abs(harbour[0] - 59), Math.abs(harbour[1] - 59)) <= 6, `near (59, 59): ${harbour}`);
  // Drawn open, still: its second picture is the scaffolding of one waiting for its crew.
  assert.equal(await page.evaluate(() => {
    const placed = window.seHome.parts.town.items.find((p) => p.item.id === 224);
    const slot = window.seHome.parts.view.slots.get(placed);
    return slot.children.some((c) => c.playing === true);
  }), false, "the harbour isn't flickering between its two pictures");
  let saved = await player.saved();
  assert.equal(saved.items.filter((i) => i[0] === HARBOUR).length, 1, "the server has it");

  // Its Open: the island map (with an army).
  await player.send([{ cmd: "buy", args: [KNIGHT, 50, 44, 0, 0, 0, 1] }]);
  await player.reload();
  assert.equal(await page.evaluate(() => window.seHome.parts.town.items.filter((p) => p.item.id === 224).length), 1, "no second one");
  await player.select(harbour, "Harbor");
  await player.press("Let's sail");
  await page.waitForSelector(".panel.islands:not([hidden])", { timeout: 5000 });
  await page.keyboard.press("Escape");

  // Pausing: nothing moves under the curtain; a key let go, and it goes on.
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.waitForSelector(".pause-curtain");
  await player.shot("paused");
  const frames = () => page.evaluate(() => window.seHome.clock);
  const before = await frames();
  await player.wait(1000);
  assert.equal(await frames(), before, "the game stands still");
  await page.keyboard.press("Space");
  assert.equal(await page.locator(".pause-curtain").count(), 0);
  await player.wait(500);
  assert.ok((await frames()) > before, "and goes on");
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.getByRole("button", { name: "Resume" }).click();
  assert.equal(await page.locator(".pause-curtain").count(), 0);

  // Level 30: the zeppelin tower.
  await player.send([{ cmd: "rt_level_up", args: [30] }]);
  await player.reload();
  await player.said(/Zeppelin operative/);
  saved = await player.saved();
  assert.equal(saved.items.filter((i) => i[0] === ZEPPELIN_TOWER).length, 1);
  assert.equal(saved.items.filter((i) => i[0] === HARBOUR).length, 1);

  // A brand-new town: its first camp holds the Prisoner Princess, and no harbour comes while she waits.
  const fresh = await newPlayer({ camp: true, dock: true });
  await fresh.page.waitForFunction(() => window.seHome, null, { timeout: 30_000 });
  await fresh.wait(1500);
  assert.deepEqual(await fresh.page.evaluate(() => window.seHome.parts.town.items.filter((p) => p.item.id === 83 || p.item.id === 224)
    .map((p) => p.item.id)), [83], "the princess, and no harbour yet");
}
