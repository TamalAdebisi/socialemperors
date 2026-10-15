// The nests (CLIENT.md, "The nests"). A level 20 town with a dragon nest
// whose first egg is 9 steps along and a monster nest that is closed. The
// dragon nest's Open shows 9/10 and Take care: a step starts the six-hour
// wait, Speed up buys it off for 3 cash, Get Dragon! puts the Draggy
// beside the nest and the next one starts (Feed). Hire friends lists the
// friends to ask (none here). The monster nest opens for 50 cash. The
// server's save follows each step. On a phone the window fits the screen.

import assert from "node:assert/strict";

const DRAGON_NEST = 1233, MONSTER_NEST = 1255, DRAGGY = 638;
const NEST_AT = [56, 52], MONSTERS_AT = [48, 58];

export default async function nests({ newPlayer }) {
  const player = await newPlayer();
  const { page } = player;
  await player.send([
    { cmd: "rt_level_up", args: [20] },
    // Free (the sixth argument), so the town keeps its gold.
    { cmd: "buy", args: [DRAGON_NEST, ...NEST_AT, 0, 0, 1, 1, "b"] },
    { cmd: "buy", args: [MONSTER_NEST, ...MONSTERS_AT, 0, 0, 1, 1, "b"] },
    // The lessons' gift steps (the text "0": no wait), and two more.
    ...Array.from({ length: 9 }, () => ({ cmd: "next_step", args: ["0"] })),
  ]);
  await player.reload();
  const info = async () => {
    const response = await page.request.post(`${player.base}${player.settings.dynamicUrl}/get_player_info.php`,
      { form: { USERID: player.settings.userId, user_key: player.settings.userKey } });
    return response.json();
  };
  const before = await info();
  assert.equal(before.privateState.stepNumber, 9);
  const cash = Number(before.playerInfo.cash);
  assert.ok(cash >= 53, `cash for the speed up and the monster nest (${cash})`);

  // The dragon nest: 9 of 10, Take care.
  await player.select(NEST_AT, "Dragon Breeding Nest");
  await player.press("Open");
  const window = page.locator(".nest-window");
  await window.waitFor();
  assert.equal(await window.locator(".nest-count").textContent(), "9/10");
  assert.equal(await window.locator(".nest-button").textContent(), "Take care");
  assert.equal(await window.locator(".nest-one").count(), 6);
  assert.equal(await window.locator(".nest-one.locked").count(), 5, "only the first one open");
  await page.waitForFunction(() => [...document.querySelectorAll(".nest-picture")].length === 1);
  await player.shot("egg");

  // A step: 10 of 10, and the wait.
  await window.locator(".nest-button").click();
  await window.locator(".nest-timer").waitFor();
  assert.equal(await window.locator(".nest-count").textContent(), "10/10");
  assert.ok(await window.locator(".nest-button").isDisabled(), "no step while it waits");
  assert.match(await window.locator(".nest-time").textContent(), /^[56]:\d\d:\d\d$/);
  let saved = await info();
  assert.equal(saved.privateState.stepNumber, 10);
  assert.ok(Number(saved.privateState.timeStampTakeCare) > 0, "the server's wait");
  await page.waitForFunction(() => [...document.querySelectorAll(".nest-one > img:first-child")].every((i) => i.naturalWidth > 0), null, { timeout: 15_000 });
  await player.shot("waiting");

  // Speed up for 3 cash: Get Dragon!
  await window.locator(".nest-speed-up").click();
  await page.waitForFunction(() => document.querySelector(".nest-button")?.textContent === "Get Dragon!");
  assert.equal(await window.locator(".nest-timer").count(), 0);
  await window.locator(".nest-button").click();
  await window.waitFor({ state: "hidden" });
  assert.match(await player.said(/is yours/), /Draggy is yours!/);
  await player.wait(1500);
  saved = await info();
  assert.equal(Number(saved.playerInfo.cash), cash - 3, "3 cash for the speed up");
  assert.equal(saved.privateState.dragonNumber, 1, "the next dragon");
  assert.equal(saved.privateState.stepNumber, 0);
  assert.ok(saved.map.items.some((i) => i[0] === DRAGGY), "the Draggy, beside the nest");

  // The next one is fed; Hire friends lists the friends to ask.
  await player.select(NEST_AT, "Dragon Breeding Nest");
  await player.press("Open");
  await window.waitFor();
  assert.equal(await window.locator(".nest-button").textContent(), "Feed");
  assert.equal(await window.locator(".nest-count").textContent(), "0/10");
  assert.equal(await window.locator(".nest-one.locked").count(), 4);
  await window.locator(".nest-hire").click();
  await page.waitForFunction(() => /Add friends/.test(document.querySelector(".ask-friends")?.textContent ?? ""));
  await window.getByRole("button", { name: "Back" }).click();
  await window.locator(".nest-button").waitFor();
  await page.keyboard.press("Escape");

  // The monster nest is closed: 50 cash opens it.
  await player.select(MONSTERS_AT, "Monsters Nest");
  await player.press("Open");
  await window.waitFor();
  assert.equal(await window.locator(".panel-head h2").textContent(), "Monster Breeding Nest");
  await window.getByRole("button", { name: "Start again for 50 cash" }).click();
  await window.locator(".nest-button").waitFor();
  assert.equal(await window.locator(".nest-one").count(), 4);
  assert.equal(await window.locator(".nest-help").count(), 0, "no help or friends here, as in the original");
  await page.waitForFunction(() => [...document.querySelectorAll(".nest-one > img:first-child")].every((i) => i.naturalWidth > 0), null, { timeout: 15_000 });
  await player.shot("monsters");
  await player.wait(1500);
  saved = await info();
  assert.equal(saved.privateState.monsterNestActive, 1);
  assert.equal(Number(saved.playerInfo.cash), cash - 53);

  // On a phone: the window is a sheet, and the row of dragons fits across it.
  const phone = await player.onPhone();
  await phone.select(NEST_AT, "Dragon Breeding Nest");
  await phone.press("Open");
  const sheet = phone.page.locator(".nest-window");
  await sheet.waitFor();
  const last = await sheet.locator(".nest-one").last().boundingBox();
  assert.ok(last && last.x + last.width <= 390, `the sixth dragon fits on the screen: ${JSON.stringify(last)}`);
  await phone.shot("phone");
}
