// Collection pieces from fights (CLIENT.md, "Collection pieces";
// rules/collections.ts, battleLoot.ts), where the Flash client rolls for
// them: a troll raider killed at home, a soldier killed attacking a town,
// a troll killed and the Treasure Chest opened on the Mysterious Isle, and
// anything killed on a God Isle, whose pieces are the Bahamuts'. The test
// chooses the rolls, so each gives a known piece: the game names it, the
// server keeps it, and the collections window counts it.

import assert from "node:assert/strict";

const KNIGHT = 514, RODAS_COLOSSUS = 764;
const FOUND = /You found a collection piece: .+, of .+\./;

export default async function battlePieces({ newPlayer }) {
  const victim = await newPlayer();
  const player = await newPlayer();
  const { page } = player;
  const army = [];
  for (let i = 0; i < 8; i++) army.push({ cmd: "buy", args: [KNIGHT, 44 + i, 52, 0, 0, 0, 1] });
  army.push({ cmd: "buy", args: [RODAS_COLOSSUS, 48, 47, 0, 0, 0, 1] });
  await player.send([{ cmd: "rt_level_up", args: [12] }, ...army]);
  await player.reload();

  // At home: a band of raiders (the enemy race's: trolls), brought on at once.
  await page.waitForFunction(() => window.seHome, null, { timeout: 30_000 });
  await page.evaluate(() => { window.seHome.speed = 4; window.seHome.hurry(); });
  await page.waitForFunction(() => window.seHome.fighting?.battle.fighters.some((f) => f.side === 2 && f.isUnit && !f.dead),
    null, { timeout: 30_000 });
  await rolls(page, "home", [0.004, 0]);  // under 0.5 in 100: the rarest of a fallen troll's, the War Troll's first
  const raider = await page.evaluate(() => {
    const { battle } = window.seHome.fighting;
    const f = battle.fighters.find((f) => f.side === 2 && f.isUnit && !f.dead);
    battle.kill(f, null);
    return f.item.race;
  });
  assert.equal(raider, "t", "the raiders are trolls");
  assert.match(await player.said(FOUND), /Golden boots, of The Diabolic Appearance/);  // the War Troll's
  await player.shot("home-piece");
  // The rest of the band falls with nothing more (0.99: no piece), and the raid is over.
  await page.evaluate(() => {
    const { battle } = window.seHome.fighting;
    for (const f of battle.fighters.filter((f) => f.side === 2 && f.isUnit && !f.dead)) battle.kill(f, null);
  });
  await page.waitForFunction(() => !window.seHome.fighting, null, { timeout: 30_000 });
  // The collections window counts it at once: the War Troll is on the third page.
  await player.menu("Army");
  await player.press("Collections");
  const panel = page.getByRole("dialog", { name: "Collections", exact: true });
  await panel.waitFor({ state: "visible" });
  for (let i = 0; i < 2; i++) await panel.getByRole("button", { name: "Next", exact: true }).click();
  assert.equal(await panel.locator('[data-collection="9"] .collection-pieces').innerText(), "×1\n×0\n×0\n×0\n×0");
  await player.shot("home-window");
  await page.keyboard.press("Escape");
  assert.equal(count(await collections(player), 9, 1), 1, "the server keeps it");

  // Attacking a town: a soldier of theirs killed (it pays gold) gives a piece of the attacks'.
  await player.menu("Neighbours");
  await page.locator(".panel:not([hidden])").getByRole("link", { name: `Attack ${victim.name}` }).click();
  await page.waitForSelector(".attack-grid", { timeout: 60_000 });
  await player.press("Start the battle");
  await page.waitForFunction(() => window.seAttack, null, { timeout: 60_000 });
  await player.loaded();
  await rolls(page, "attack", [0.01, 0]);  // rare: the Penguin's first
  await page.evaluate(() => {
    const { battle } = window.seAttack;
    battle.kill(battle.fighters.find((f) => f.side === 2 && f.isUnit && f.item.attack > 0 && !f.dead), null);
  });
  assert.match(await player.said(FOUND), /Cold Water, of An Arctic Discovery/);  // the Penguin's
  await player.shot("attack-piece");
  assert.equal(count(await collections(player), 7, 1), 1);

  // The Mysterious Isle: a troll killed, then the Treasure Chest opened.
  await player.open();
  await player.menu("Quests");
  await page.locator(".islands .island-button").nth(0).locator(".island-enter").click();
  await page.waitForSelector(".quest-window", { timeout: 60_000 });
  await player.press("Start battle");
  await player.loaded();
  await rolls(page, "quest", [0.004, 0]);  // the first troll: the War Troll's first again
  await page.evaluate(() => {
    const { battle, quest } = window.seQuest;
    for (const f of battle.fighters.filter((f) => f.side === 2 && f.isUnit && !f.dead && f !== quest.chest)) battle.kill(f, null);
  });
  await page.waitForFunction(() => window.seQuest.quest.chest?.collectable, null, { timeout: 30_000 });
  // A chest always gives one: rolled out of 2.5, 2.475 is rare, the first the Soldier Statue's head.
  await rolls(page, "quest", [0.99, 0]);
  await centreOn(player, await page.evaluate(() => window.seQuest.screenOf(window.seQuest.quest.chest)));
  await player.click(await page.evaluate(() => window.seQuest.screenOf(window.seQuest.quest.chest)));
  assert.match(await player.said(/^The treasure is yours! You found a collection piece/), /Stone Head, of Hero Tribute/);
  await player.shot("chest-piece");
  await page.waitForSelector(".quest-window h2", { timeout: 30_000 });
  await player.wait(1500);
  let rows = await collections(player);
  assert.equal(count(rows, 9, 1), 2, "a troll on an island: the same pieces as at home");
  assert.equal(count(rows, 15, 4), 1, "the chest's");

  // God Isle 1, open from the start: anything killed there gives the Bahamuts' pieces only.
  await player.press("Back home");
  await page.waitForURL(/islands=1/);
  await player.loaded();
  const enter = page.locator(".islands .island-button", { hasText: "God Isle 1" }).locator(".island-enter");
  for (let i = 0; i < 7 && !(await enter.isVisible()); i++) {
    await page.getByRole("button", { name: "Next page" }).click();
    await player.wait(800);
  }
  await enter.click();
  await page.waitForSelector(".quest-team", { timeout: 60_000 });
  await page.getByRole("button", { name: "Add a Rodas Colossus" }).click();
  await page.getByRole("button", { name: "Add a Heavy Knight" }).click();
  for (let i = 0; i < 3 && await page.locator(".quest-team").count(); i++) {
    await player.press("Start battle");  // "Only 2 of 20": a second press sails anyway
  }
  await player.loaded();
  const kill = () => page.evaluate(() => {
    const { battle } = window.seQuest;
    battle.kill(battle.fighters.find((f) => f.side === 2 && f.isUnit && f.item.subcategory !== 84 && !f.dead), null);
  });
  // Rare (1 in 100), kept (under 0.5), the first: the Golden Bahamut's first.
  await rolls(page, "quest", [0.01, 0.4, 0]);
  await kill();
  assert.match(await player.said(FOUND), /Golden Gem, of Golden Bahamut Dragon/);
  await player.shot("god-isle-piece");
  // The rarest (under 0.5 in 100), kept: the Bahamut Heart's first. Then one the half chance takes away.
  await rolls(page, "quest", [0.004, 0.4, 0]);
  await kill();
  assert.match(await player.said(FOUND), /Black Gem, of Supreme Heart/);
  await rolls(page, "quest", [0.004, 0.6, 0]);
  await kill();
  await player.wait(4000);
  rows = await collections(player);
  assert.equal(count(rows, 21, 1), 1, "Golden Bahamut");
  assert.equal(count(rows, 23, 1), 1, "the Heart, once: the second roll gave none");
}

/** The next rolls of a fight's pieces (battleLoot.ts): these numbers, then 0.99 (none, but from a boss or chest). */
function rolls(page, fight, numbers) {
  return page.evaluate(([fight, numbers]) => {
    const loot = fight === "home" ? window.seHome.fighting.loot : fight === "quest" ? window.seQuest.loot : window.seAttack.loot;
    const queue = [...numbers];
    loot.random = () => (queue.length ? queue.shift() : 0.99);
  }, [fight, numbers]);
}

/** The pieces the server keeps, after the game's next batch (every 3 seconds). */
async function collections(player) {
  await player.wait(4000);
  const reply = await player.page.request.post(`${player.base}${player.settings.dynamicUrl}/get_player_info.php`,
    { form: { USERID: player.settings.userId, user_key: player.settings.userKey } });
  return (await reply.json()).privateState.collections ?? [];
}

const count = (rows, collection, piece) => Number(rows?.[collection]?.[piece] ?? 0);

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
    await player.wait(200);
    await player.page.mouse.up();
    await player.wait(300);
    dx -= sx;
    dy -= sy;
  }
}
