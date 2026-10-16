// The world map (CLIENT.md, "Attacking players"): Attack a player opens the
// continent with the town's island and its rivals on the game's own picture;
// an island's menu has Profile and Attack. The attack from the map carries
// the island, so winning it counts the island beaten: back on the map it
// shows the flag, the progress says 1/7 and the menu says wait 4 hours.
// Next shows another continent and My World comes back; Options opens the
// defence plans; Relocate (confirmed) loses the islands beaten. A new
// continent's prize window gives its prize on OK.

import assert from "node:assert/strict";

const KNIGHT = 514, TOWN_HALL = 135;
// Rivals are picked nearest the town's level: both at one no other test uses, so the
// rival is always on the map however many test players the server has.
const LEVEL = 17;

export default async function world({ newPlayer }) {
  const rival = await newPlayer();
  await rival.send([{ cmd: "rt_level_up", args: [LEVEL] }]);
  const player = await newPlayer();
  const { page } = player;
  const army = [];
  for (let i = 0; i < 20; i++) army.push({ cmd: "buy", args: [KNIGHT, 44 + (i % 10), 44 + Math.floor(i / 10), 0, 0, 0, 1] });
  await player.send([{ cmd: "rt_level_up", args: [LEVEL] }, ...army]);
  await player.reload();

  // Battle, Attack a player: the map of the town's continent.
  await player.menu("Battle");
  await page.locator(".panel:not([hidden]) .row", { hasText: "Attack a player" }).locator("a").click();
  await page.waitForSelector(".world-map:not(.loading) .world-island", { timeout: 30_000 });
  await player.wait(800);
  assert.match(await page.locator(".world-window .panel-title, .world-window h2").first().textContent(), /Continent 1/);
  const islands = page.locator(".world-island");
  assert.ok(await islands.count() >= 2, "the town and at least one rival");
  assert.equal(await page.locator(".world-island.mine").count(), 1, "the town's own island");
  assert.match(await page.locator(".world-progress").textContent(), /0\/7/);
  assert.match(await page.locator(".world-attacks").textContent(), /3/);
  assert.equal(await page.locator(".world-tint").count(), 1, "the town's own land coloured");
  await player.shot("map");

  // The rival's island: Profile, then Attack.
  const theirs = page.locator(".world-island", { has: page.locator(".world-name", { hasText: rival.name }) });
  await theirs.click();
  await page.getByRole("button", { name: `Profile of ${rival.name}` }).click();
  await page.waitForSelector(".world-profile");
  assert.match(await page.locator(".world-profile").textContent(), /Level \d+.*Honour: 0/s);
  await page.locator(".world-profile").getByRole("button").click();
  await theirs.click();
  const attack = page.getByRole("link", { name: `Attack ${rival.name}` });
  const href = await attack.getAttribute("href");
  const island = Number(new URLSearchParams(href.split("?")[1]).get("island"));
  assert.match(href, new RegExp(`attack=${rival.settings.userId}.*island=\\d.*continent=1`));
  await player.shot("menu");
  await attack.click();

  // The battle, as from Neighbours: the town hall falls.
  await page.waitForSelector(".attack-grid", { timeout: 60_000 });
  await player.press("Start the battle");
  await page.waitForFunction(() => window.seAttack, null, { timeout: 60_000 });
  await player.loaded();
  await player.press("Speed 1×");
  await player.press("Speed 2×");
  let tries = 0;
  while (await page.locator(".quest-window h2").count() === 0) {
    assert.ok(++tries < 80, "the town hall still stands");
    const idle = await page.evaluate(() =>
      !window.seAttack.battle.fighters.some((f) => f.side === 1 && f.isUnit && !f.dead && (f.target || f.next)));
    if (idle) {
      const hall = await page.evaluate((sub) => {
        const found = window.seAttack.battle.fighters.find((f) => f.side === 2 && !f.dead && f.item.subcategory === sub);
        return found ? { x: found.tx, y: found.ty } : null;
      }, TOWN_HALL);
      if (hall) {
        await page.evaluate((tile) => window.seAttack.lookAt(tile), hall);
        await player.wait(300);
        await player.press("Select all");
        await player.click(await page.evaluate((sub) => {
          const { battle, screenOf } = window.seAttack;
          return screenOf(battle.fighters.find((f) => f.side === 2 && !f.dead && f.item.subcategory === sub));
        }, TOWN_HALL));
      }
    }
    await player.wait(1500);
  }
  assert.match(await page.locator(".quest-window h2").textContent(), /You won the attack/);
  await player.wait(1500);
  const saved = await player.saved({ waitForBatch: false });
  assert.deepEqual(saved.universAttackWin, [island], "the island counts as beaten");
  await player.press("Back home");
  await page.waitForURL(/client\.html$/);
  await player.loaded();

  // Back on the map: the flag on their island, 1 of 7, and no attacking them again yet.
  await player.menu("Battle");
  await page.locator(".panel:not([hidden]) .row", { hasText: "Attack a player" }).locator("a").click();
  await page.waitForSelector(".world-map:not(.loading) .world-island", { timeout: 30_000 });
  await player.wait(800);
  assert.match(await page.locator(".world-progress").textContent(), /1\/7/);
  assert.match(await theirs.getAttribute("aria-label"), /beaten/);
  assert.match(await theirs.locator("img").getAttribute("src"), /island-10/);
  assert.equal(await page.locator(".world-tint").count(), 2, "their land coloured too");
  await theirs.click();
  assert.equal(await page.locator(".world-why", { hasText: "wait 4 hours" }).count(), 1);
  assert.equal(await page.locator(".world-why", { hasText: "Build Eagles to spy" }).count(), 1, "no Eagles here");
  assert.match(await page.locator(".world-attacks").textContent(), /2/, "one attack used");
  await player.shot("beaten");

  // Another continent, and back.
  await page.getByRole("button", { name: "Next continent" }).click();
  await page.waitForFunction(() => /Continent 2/.test(document.querySelector(".world-window").textContent));
  assert.equal(await page.locator(".world-progress").count(), 0, "progress only at home");
  await player.shot("continent-2");
  await page.getByRole("button", { name: "My World: back to your continent" }).click();
  await page.waitForSelector(".world-progress");

  // Options: the defence plans.
  await page.getByRole("button", { name: "Options: your army and defence" }).click();
  assert.equal(await page.locator(".army-plans .army-plan").count(), 4);

  // Relocate, confirmed: the islands beaten are lost.
  await player.menu("Battle");
  await page.locator(".panel:not([hidden]) .row", { hasText: "Attack a player" }).locator("a").click();
  await page.waitForSelector(".world-progress");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "RELOCATE" }).click();
  await page.waitForFunction(() => /0\/7/.test(document.querySelector(".world-progress")?.textContent ?? ""));
  await player.wait(4500);
  assert.deepEqual((await player.saved({ waitForBatch: false })).universAttackWin, [], "lost on the server too");

  // A new continent's prize (the save says one is owed): its window, and the prize on OK.
  await page.route("**/get_player_info.php", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.privateState.worldChange = 1;
    await route.fulfill({ response, json: body });
  });
  await player.reload();
  await page.unroute("**/get_player_info.php");
  await player.menu("Battle");
  await page.locator(".panel:not([hidden]) .row", { hasText: "Attack a player" }).locator("a").click();
  await page.waitForSelector(".world-prize", { timeout: 30_000 });
  assert.match(await page.locator(".world-prize").textContent(), /KING OF THE/);
  await player.shot("prize");
  const claimed = page.waitForRequest((r) => r.url().endsWith("/command.php") && r.postData().includes("apply_rewards_ranking"), { timeout: 15_000 });
  await page.locator(".world-prize").getByRole("button").click();
  await claimed;
  assert.equal(await page.locator(".world-prize").count(), 0);
}
