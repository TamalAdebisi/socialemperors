// Quests (CLIENT.md, "Quests"): a town at level 10 with an army opens the
// Quests window (the first island open, the next locked), sails to the
// Mysterious Isle, picks one star and starts. The army is sent at the
// trolls with taps until none is left, the chest is opened, and the results
// say Victory. The save has the star, the next island open, the island's
// rest started, the gold, and the fallen units that didn't come home gone;
// the town then shows the next island open and this one resting.

import assert from "node:assert/strict";

const KNIGHT = 514, ARCHER = 518, MYSTERIOUS = 100000006;

export default async function quest({ newPlayer }) {
  const player = await newPlayer();
  // As the Flash client would: level 10, and an army of 14 heavy knights and 6 archers.
  const army = [];
  for (let i = 0; i < 14; i++) army.push({ cmd: "buy", args: [KNIGHT, 44 + (i % 7), 44 + Math.floor(i / 7), 0, 0, 0, 1] });
  for (let i = 0; i < 6; i++) army.push({ cmd: "buy", args: [ARCHER, 44 + i, 47, 0, 0, 0, 1] });
  await player.send([{ cmd: "rt_level_up", args: [10] }, ...army]);
  await player.reload();
  const before = await player.saved({ waitForBatch: false });

  // The Quests window: the game's island map, the first island open, the second locked.
  await player.menu("Quests");
  await player.wait(1500);
  await player.shot("islands");
  const islands = player.page.locator(".islands .island-button");
  assert.equal(await islands.count(), 28);
  assert.match(await islands.nth(0).textContent(), /Mysterious Isle/);
  assert.match(await islands.nth(0).getAttribute("href"), /quest=100000006/, "the first island can be sailed to");
  assert.equal(await islands.nth(1).locator(".island-lock").count(), 1, "the next island is locked");
  await islands.nth(1).locator(".island-name").click();
  assert.match(await player.page.locator(".island-said").textContent(), /Win the island before it/);
  await islands.nth(0).locator(".island-enter").click();

  // The start window: the army, one star (the others locked), Start battle.
  await player.page.waitForSelector(".quest-window", { timeout: 60_000 });
  // The 20 bought, and the units a new town starts with.
  assert.match(await player.page.locator(".quest-window").textContent(), /Your army is ready: 2[0-9] units/);
  assert.equal(await player.page.locator(".quest-star:disabled").count(), 2, "2 and 3 stars come after winning");
  await player.shot("start");
  await player.press("Start battle");
  await player.loaded();
  await player.shot("landed");
  await wholeIsland(player, "island");
  assert.equal(await player.page.locator(".quest-hud").count(), 1);
  assert.match(await player.page.locator(".quest-hud").textContent(), /5 trolls left/);

  // Select all is not a sticky command mode: inspect a unit, then clear it.
  await player.press("Select all");
  await player.page.locator(".battle-selection-roster button").first().click();
  assert.equal(await player.page.evaluate(() => window.seQuest.view.selected.size), 1);
  assert.match(await player.page.locator(".battle-selection").textContent(), /health.*attack/);
  await player.press("Deselect");
  assert.equal(await player.page.evaluate(() => window.seQuest.view.selected.size), 0);

  // Faster, every unit selected, then at the nearest troll, again and again.
  await player.press("Speed 1×");
  await player.press("Speed 2×");
  let tries = 0;
  for (;;) {
    const state = await player.page.evaluate(() => {
      const { battle, quest } = window.seQuest;
      const mine = battle.fighters.filter((f) => f.side === 1 && f.isUnit && !f.dead);
      const trolls = battle.fighters.filter((f) => f.side === 2 && f.isUnit && !f.dead);
      const busy = mine.some((f) => f.target || f.next);
      return { left: quest.remaining, chest: Boolean(quest.chest?.collectable), mine: mine.length, busy, state: quest.state,
        troll: trolls.length ? window.seQuest.screenOf(trolls.sort((a, b) =>
          Math.hypot(a.tx - mine[0].tx, a.ty - mine[0].ty) - Math.hypot(b.tx - mine[0].tx, b.ty - mine[0].ty))[0]) : null };
    });
    if (state.chest || state.state !== "fighting") break;
    if (tries % 10 === 0) console.log(`  (order ${tries}: ${state.left} trolls left, ${state.mine} units)`);
    assert.ok(++tries < 120, `still fighting after ${tries} orders: ${JSON.stringify(state)}`);
    if (!state.busy && state.troll) {
      await player.press("Select all");
      await centreOn(player, state.troll);
      await player.click(await nearest(player, "unit"));
      // A troll behind walls can't be reached, and the order is dropped, as in the
      // Flash client: the player knocks down what's in the way first.
      if (!(await busy(player))) {
        await player.press("Select all");
        const wall = await nearest(player, "building");
        if (wall) {
          await centreOn(player, wall);
          await player.click(await nearest(player, "building"));
        }
      }
    }
    await player.wait(1500);
  }
  await player.shot("chest");

  // The chest, lit: opening it wins.
  const chest = await player.page.evaluate(() => window.seQuest.screenOf(window.seQuest.quest.chest));
  await centreOn(player, chest);
  const at = await player.page.evaluate(() => window.seQuest.screenOf(window.seQuest.quest.chest));
  await player.click(at);
  await player.page.waitForSelector(".quest-window h2", { timeout: 30_000 });
  assert.equal((await player.page.locator(".quest-window h2").textContent()).trim(), "Victory!");
  await player.shot("victory");

  // The server has it all, sent with the results.
  await player.wait(1500);
  const after = await player.saved({ waitForBatch: false });
  const info = await (await player.page.request.post(`${player.base}${player.settings.dynamicUrl}/get_player_info.php`,
    { form: { USERID: player.settings.userId, user_key: player.settings.userKey } })).json();
  assert.equal(info.privateState.questsRank[MYSTERIOUS], 1, "one star won");
  assert.ok(info.privateState.unlockedQuestIndex >= 1, "the next island is open");
  assert.ok(after.questTimes[MYSTERIOUS] > 0, "the island's rest started");
  assert.ok(after.coins >= before.coins + 1500, `the gold came home: ${before.coins} -> ${after.coins}`);
  const units = (map) => map.items.filter((item) => item[0] === KNIGHT || item[0] === ARCHER).length;
  const lost = Number(await player.page.evaluate(() => window.seQuest.quest.lost().reduce((n, [, c]) => n + c, 0)));
  assert.equal(units(after), units(before) - lost, `the ${lost} units lost for good are gone`);

  // Home: the island map again, the next island open, this one resting with its star.
  await player.press("Back home");
  await player.page.waitForURL(/islands=1/);
  await player.loaded();
  const home = player.page.locator(".islands .island-button");
  assert.match(await home.nth(0).getAttribute("aria-label"), /rests/);
  assert.match(await home.nth(0).locator(".island-stars").getAttribute("alt"), /^1 of 3 stars/);
  assert.match(await home.nth(1).getAttribute("href"), /quest=100000007/, "the next island can be sailed to");
  await player.shot("home");

  // On a phone: World, then Quests, opens the map as a sheet above the dock.
  const phone = await player.onPhone();
  await phone.menu("World");
  await phone.page.locator(".panel:not([hidden]) .row", { hasText: "Quests" }).locator("a").click();
  await phone.wait(1500);
  assert.equal(await phone.page.locator(".islands .island-button").count(), 28);
  await phone.shot("phone-islands");
}

/** Where the enemy unit (or building) nearest the army is on screen, or null. */
function nearest(player, kind) {
  return player.page.evaluate((kind) => {
    const { battle, screenOf } = window.seQuest;
    const mine = battle.fighters.filter((f) => f.side === 1 && f.isUnit && !f.dead);
    const near = (f) => Math.hypot(f.tx - mine[0].tx, f.ty - mine[0].ty);
    const found = battle.fighters.filter((f) => f.side === 2 && !f.dead && (kind === "unit" ? f.isUnit : !f.isUnit))
      .sort((a, b) => near(a) - near(b))[0];
    return found ? screenOf(found) : null;
  }, kind);
}

/** Whether any of the army is walking or fighting. */
function busy(player) {
  return player.page.evaluate(() => window.seQuest.battle.fighters.some((f) => f.side === 1 && f.isUnit && !f.dead && (f.target || f.next)));
}

/** Drags the map (from the middle of the screen, a screen at a time) so a point comes to the middle. */
async function centreOn(player, point) {
  const { width, height } = player.viewport;
  let dx = width / 2 - point.x;
  let dy = height / 2 - point.y;
  while (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
    const sx = Math.max(-width / 3, Math.min(width / 3, dx));
    const sy = Math.max(-height / 3, Math.min(height / 3, dy));
    await player.page.mouse.move(width / 2, height / 2);
    await player.page.mouse.down();
    for (let i = 1; i <= 8; i++) {
      await player.page.mouse.move(width / 2 + (sx * i) / 8, height / 2 + (sy * i) / 8);
    }
    // Held still a moment before letting go, so the map doesn't glide on.
    await player.wait(200);
    await player.page.mouse.up();
    await player.wait(300);
    dx -= sx;
    dy -= sy;
  }
}

/** The whole island, zoomed out, for a picture; then back as it was. */
async function wholeIsland(player, name) {
  const { width, height } = player.viewport;
  await player.page.mouse.move(width / 2, height / 2);
  for (let i = 0; i < 3; i++) await player.page.mouse.wheel(0, 400);
  await player.wait(800);
  await player.shot(name);
  for (let i = 0; i < 3; i++) await player.page.mouse.wheel(0, -400);
  await player.wait(800);
}
