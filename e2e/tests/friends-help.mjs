// Friends' help at a building at work (CLIENT.md, "Neighbours"), as the
// Flash client's: two players become friends; one's mill at work has Ask
// friends on its card, which asks the other on the site; the other answers
// on their Friends page. When the town opens again the friend waits over the
// mill in the game's bubble, and a tap there takes an hour off its work and
// tells the server (accept_collect_help), which keeps the same.

import assert from "node:assert/strict";

const MILL = 5, MILL_AT = [56, 52], VILLAGER = 500, SPOT = [56, 55];
const LONGEST = 4;  // 8 hours' work
const HOUR = 3600;

export default async function friendsHelp({ newPlayer }) {
  const asker = await newPlayer();
  const friend = await newPlayer();
  // Friends: each asks the other (the second ask is a yes).
  for (const [one, other] of [[asker, friend], [friend, asker]]) {
    const asked = await one.page.request.post(`${one.base}/friends/ask`, { form: { username: other.name, csrf: await one.csrf() } });
    assert.ok(asked.ok(), `${one.name} asks ${other.name}`);
  }
  await asker.send([
    { cmd: "buy", args: [MILL, ...MILL_AT, 0, 0, 1, 1, "b"] },
    { cmd: "buy", args: [VILLAGER, ...SPOT, 0, 0, 1, 1, "u"] },
    { cmd: "push_unit", args: [...SPOT, VILLAGER, ...MILL_AT, 0] },
    { cmd: "activate", args: [...MILL_AT, 0, MILL, LONGEST] },
  ]);
  await asker.open();
  const { page } = asker;
  const mill = () => page.evaluate(([x, y]) => {
    const placed = window.seHome.parts.town.items.find((p) => p.item.id === 5 && p.tx === x && p.ty === y);
    return { helpers: placed.helpers ?? [], startedAt: placed.startedAt };
  }, MILL_AT);
  const savedMill = async () => (await asker.saved({ waitForBatch: false })).items.find((i) => i[0] === MILL && i[1] === MILL_AT[0] && i[2] === MILL_AT[1]);

  // The card of the mill at work: Hurry up opens the game's window, Ask for help beside finishing now for cash.
  // It lists the friend; Ask asks.
  await asker.select(MILL_AT, "Mill I");
  await asker.press("Hurry up");
  await asker.press("Ask for help");
  const window = page.locator(".panel.list-window:not([hidden])", { has: page.locator(".ask-friends") });
  await window.locator(".ask-friends label", { hasText: friend.name }).waitFor();
  await asker.shot("ask");
  await window.getByRole("button", { name: "Ask", exact: true }).click();
  await page.waitForFunction(() => /Asked|asked/.test(document.querySelector(".ask-status")?.textContent ?? ""), null, { timeout: 10_000 });

  // The friend answers on their Friends page.
  const answered = await friend.page.request.post(`${friend.base}/help/answer`, { form: { help: "all", csrf: await friend.csrf() } });
  assert.ok(answered.ok(), "the friend helps");
  const before = await savedMill();
  assert.ok(before[7]?.hc && Object.keys(before[7].hc).length === 1, "the save has the friend's hour waiting");

  // The town again: the friend waits over the mill.
  await asker.reload();
  const waiting = await mill();
  assert.equal(waiting.helpers.length, 1, "one friend waits over the mill");
  // The mouse on the mill: the bubble says Accept (looked at in the screenshot).
  await asker.hover(MILL_AT);
  await asker.wait(500);
  await asker.shot("waiting");

  // A tap on the mill takes the hour.
  for (let up = 10; up <= 220 && (await mill()).helpers.length > 0; up += 15) {
    await asker.click(asker.screenOf(...MILL_AT, up));
    await asker.wait(200);
  }
  const used = await mill();
  assert.equal(used.helpers.length, 0, "the friend's help is used");
  assert.equal(used.startedAt, waiting.startedAt - HOUR, "an hour off its work");
  await asker.wait(400);
  await asker.shot("used");
  await asker.saved();
  const after = await savedMill();
  assert.ok(!after[7]?.hc, "the server used it too");
  assert.equal(after[4], before[4] - HOUR, "the server's clock for the mill an hour back");
}
