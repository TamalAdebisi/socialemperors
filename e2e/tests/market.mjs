// The market (CLIENT.md, "The market"), as the Flash client's. A level 5
// town with a Market, whose goals before 65 are done, so the three market
// goals are open. "Visit Market" on its card opens six of the game's trade
// cards at the original's prices for lots of 100; each trade changes the
// town's numbers and every price at once. Selling what isn't there and
// trading after 20 trades each give the game's warning and change nothing.
// The save has the same numbers, and goals 65, 66 and 72 are done.

import assert from "node:assert/strict";

const MARKET = 23, MARKET_AT = [58, 52];
const MARKET_GOALS = [65, 66, 72];

export default async function market({ newPlayer }) {
  const player = await newPlayer();
  const { page } = player;
  const before = [];
  for (let id = 1; id < 65; id++) {
    before.push({ cmd: "complete_mission", args: [id, 0] }, { cmd: "reward_mission", args: [0, id] });
  }
  await player.send([
    { cmd: "rt_level_up", args: [5] },
    { cmd: "buy", args: [MARKET, ...MARKET_AT, 0, 0, 1, 1, "b"] },  // free (the sixth argument)
    ...before,
  ]);
  await player.reload();
  const numbers = () => page.evaluate(() => {
    const { gold, wood, stone, food } = window.seHome.parts.town;
    return { gold, wood, stone, food };
  });

  await player.select(MARKET_AT, "Market");
  await player.press("Visit Market");
  const window = page.locator(".panel.market-window:not([hidden])");
  await window.waitFor();
  assert.equal((await window.locator("h2").textContent()).trim(), "Market");
  assert.equal(await window.locator(".market-trade").count(), 6);
  const left = async () => (await window.locator(".market-left").textContent()).replace(/\s+/g, " ").trim();
  assert.equal(await left(), "Trades left today: 20");
  // The original's prices for 100: wood and food 100 gold, stone 150; selling, three quarters.
  for (const label of ["Buy 100 wood for 100 gold", "Buy 100 stone for 150 gold", "Buy 100 food for 100 gold",
    "Sell 100 wood for 75 gold", "Sell 100 stone for 113 gold", "Sell 100 food for 75 gold"]) {
    assert.ok(await player.button(label).isVisible(), label);
  }
  await player.wait(1000);  // the cards' pictures come in
  await player.shot("market");

  // 200 stone in two trades (goal 65): the second dearer.
  const start = await numbers();
  await player.press("Buy 100 stone for 150 gold");
  await player.press("Buy 100 stone for 153 gold");
  // 100 wood sold (goal 72), then 100 bought (goal 66), cheaper for the sale.
  await player.press("Sell 100 wood for 75 gold");
  await player.press("Buy 100 wood for 98 gold");
  const after = await numbers();
  // (The gold also gets the goals' rewards as they're paid, so the prices are checked by the buttons' names.)
  assert.deepEqual({ stone: after.stone - start.stone, wood: after.wood - start.wood }, { stone: 200, wood: 0 }, "the trades' goods");
  assert.equal(await left(), "Trades left today: 16");
  assert.match(await page.locator(".hud").textContent(), new RegExp(after.stone.toLocaleString("en-US")), "the top bar has them");

  // Sell all the food, then once more: the game's warning (naming food), nothing changes.
  let sold = 0;
  while ((await numbers()).food >= 100) {
    await window.locator(".market-trade.sells .market-do").nth(2).click();
    sold++;
  }
  const empty = await numbers();
  await window.locator(".market-trade.sells .market-do").nth(2).click();
  await player.said(/You don't have enough food to sell!/);
  assert.deepEqual(await numbers(), empty, "nothing sold");
  assert.equal(await left(), `Trades left today: ${16 - sold}`);

  // Buy food until the trades run out, then once more: the game's warning.
  for (let i = 0; i < 16 - sold; i++) {
    await window.locator(".market-trade.buys .market-do").nth(2).click();
  }
  assert.equal(await left(), "Trades left today: 0");
  const spent = await numbers();
  await window.locator(".market-trade.buys .market-do").nth(2).click();
  await player.said(/Market resources have been exhausted/);
  assert.deepEqual(await numbers(), spent, "no 21st trade");

  // The server has the same: the goods, the counts, the trades. And the three goals are done.
  const saved = await player.saved();
  const mine = await numbers();
  assert.deepEqual({ wood: saved.wood, stone: saved.stone, food: saved.food }, { wood: mine.wood, stone: mine.stone, food: mine.food });
  assert.deepEqual(saved.resourcesTraded, { s: 2, w: 0, f: (16 - sold) - sold });
  assert.equal(saved.numTradesDone, 20);
  const until = Date.now() + 15_000;
  let done = [];
  while (Date.now() < until) {
    const response = await page.request.post(`${player.base}${player.settings.dynamicUrl}/get_player_info.php`,
      { form: { USERID: player.settings.userId, user_key: player.settings.userKey } });
    done = (await response.json()).privateState.completedMissions ?? [];
    if (MARKET_GOALS.every((id) => done.includes(id))) break;
    await player.wait(1000);
  }
  assert.ok(MARKET_GOALS.every((id) => done.includes(id)), `goals 65, 66 and 72 done (${done.filter((id) => id > 64)})`);

  // After a reload, the window remembers: the prices and the trades left.
  await player.reload();
  await player.select(MARKET_AT, "Market");
  await player.press("Visit Market");
  await page.locator(".panel.market-window:not([hidden])").waitFor();
  assert.equal(await left(), "Trades left today: 0");
  assert.ok(await player.button("Buy 100 stone for 156 gold").isVisible(), "stone dearer after two purchases");

  // On a phone: the six cards fit across the sheet.
  const phone = await player.onPhone();
  await phone.select(MARKET_AT, "Market");
  await phone.press("Visit Market");
  await phone.wait(800);
  await phone.shot("phone");
  const boxes = await phone.page.locator(".market-trade").evaluateAll((cards) => cards.map((card) => card.getBoundingClientRect().right));
  assert.ok(boxes.every((right) => right <= 390), "within the phone's width");
}
