// The Monster Nest, played as a new player meets it (CLIENT.md, "The
// nests"). A level 30 town buys it in the shop and places it; its Open
// shows the first monster's egg at 0/10, not the "Start again" window of a
// finished nest. Take care starts the six-hour wait, Speed up buys it off
// for 3,500 food (the original's 7 cash, in food since 29 October 2026), and
// so on to ten; Get Monster! puts King Kong beside the
// nest and the T-Rex comes next. Stored and placed again, and after a
// reload, the nest carries on where it was. The server's save follows.

import assert from "node:assert/strict";
import { stored } from "../lib.mjs";

const MONSTER_NEST = 1255, KING_KONG = 717;
// Placed again where it stood: the land beside the town hall is free once it is stored.
const NEST_AT = [56, 52], AGAIN_AT = NEST_AT;

export default async function monsterNest({ newPlayer, offlineVillage }) {
  let player = await newPlayer();
  // Level 30, the nest's level, and gold for it (5 cash for 2,500 gold, three times).
  await player.send([{ cmd: "rt_level_up", args: [30] }, ...Array.from({ length: 3 }, () => ({ cmd: "exchange_cash_new", args: [0] }))]);
  // Food for ten speed ups.
  player = await offlineVillage(player, (save) => { save.maps[0].food = 40_000; });
  const { page } = player;
  const info = async () => {
    const response = await page.request.post(`${player.base}${player.settings.dynamicUrl}/get_player_info.php`,
      { form: { USERID: player.settings.userId, user_key: player.settings.userKey } });
    return response.json();
  };
  const start = await info();
  assert.equal(start.privateState.monsterNestActive, 1, "a new empire's monster nest is ready to raise its first monster");
  const cash = Number(start.playerInfo.cash);
  const food = Number(start.map.food);
  assert.ok(food >= 35_000, `food for ten speed ups (${food})`);

  // The shop: Monsters Nest, placed.
  await player.press("Build");
  await player.press("Miscellaneous");
  await player.wait(800);
  await player.card("Monsters Nest").click();
  await player.wait(300);
  await player.tapTile(NEST_AT);
  await player.wait(500);
  await player.closeLevelUps();
  await built(page, NEST_AT);
  let saved = await info();
  assert.ok(saved.map.items.some((i) => i[0] === MONSTER_NEST), "the nest is in the town");
  assert.ok(Number(saved.map.coins) < Number(start.map.coins), "bought with gold");

  // Open: the first monster's egg, 0 of 10, Take care.
  await player.select(NEST_AT, "Monsters Nest");
  await player.press("Open");
  const window = page.locator(".nest-window");
  await window.waitFor();
  assert.equal(await window.locator(".panel-head h2").textContent(), "Monster Breeding Nest");
  assert.equal(await window.locator(".nest-pay").count(), 0, "no Start again on a new nest");
  assert.equal(await window.locator(".nest-count").textContent(), "0/10");
  assert.equal(await window.locator(".nest-button").textContent(), "Take care");
  assert.equal(await window.locator(".nest-one").count(), 4);
  assert.equal(await window.locator(".nest-one.locked").count(), 3, "King Kong open, the rest locked");
  await page.waitForFunction(() => [...document.querySelectorAll(".nest-one > img:first-child")].every((i) => i.naturalWidth > 0), null, { timeout: 15_000 });
  await player.shot("new");

  // A step and its wait; Speed up for 3,500 food. Nine times, then the tenth step is stored and reloaded.
  for (let step = 1; step <= 9; step++) {
    await window.locator(".nest-button").click();
    await window.locator(".nest-timer").waitFor();
    assert.equal(await window.locator(".nest-count").textContent(), `${step}/10`);
    assert.ok(await window.locator(".nest-button").isDisabled(), "no step while it waits");
    if (step === 1) {
      assert.match(await window.locator(".nest-speed-up").textContent(), /\b3,500$/);
      await player.shot("waiting");
    }
    await window.locator(".nest-speed-up").click();
    await window.locator(".nest-timer").waitFor({ state: "detached" });
  }
  await window.locator(".nest-button").click();
  await window.locator(".nest-timer").waitFor();
  assert.equal(await window.locator(".nest-count").textContent(), "10/10");
  await player.wait(1500);
  saved = await info();
  assert.equal(saved.privateState.stepMonsterNumber, 10);
  assert.ok(Number(saved.privateState.timeStampTakeCareMonster) > 0, "the server's wait");
  assert.equal(Number(saved.map.food), food - 9 * 3500, "3,500 food for each speed up");
  assert.equal(Number(saved.playerInfo.cash), cash, "and no cash");
  await page.keyboard.press("Escape");

  // Stored, and placed again: the nest is where it was.
  await player.select(NEST_AT, "Monsters Nest");
  await player.press("Store");
  await player.press("Storage");
  await player.card("Monsters Nest").getByRole("button", { name: "Place" }).click();
  await player.wait(300);
  await player.tapTile(AGAIN_AT);
  await built(page, AGAIN_AT);
  saved = await info();
  assert.equal(stored(saved.map.store, MONSTER_NEST), 0, "out of storage");
  assert.ok(saved.map.items.some((i) => i[0] === MONSTER_NEST && i[1] === AGAIN_AT[0] && i[2] === AGAIN_AT[1]), "placed again");
  assert.equal(saved.privateState.stepMonsterNumber, 10);

  // After a reload: 10/10 and the wait; speed up, Get Monster!
  await player.reload();
  await player.select(AGAIN_AT, "Monsters Nest");
  await player.press("Open");
  await window.waitFor();
  assert.equal(await window.locator(".nest-count").textContent(), "10/10");
  await window.locator(".nest-speed-up").click();
  await page.waitForFunction(() => document.querySelector(".nest-button")?.textContent === "Get Monster!");
  await player.shot("grown");
  await window.locator(".nest-button").click();
  await window.waitFor({ state: "hidden" });
  assert.match(await player.said(/is yours/), /King Kong is yours!/);
  await player.wait(1500);
  saved = await info();
  assert.deepEqual([Number(saved.playerInfo.cash), Number(saved.map.food)], [cash, food - 10 * 3500]);
  assert.equal(saved.privateState.monsterNumber, 1, "the next monster");
  assert.equal(saved.privateState.stepMonsterNumber, 0);
  assert.equal(saved.privateState.monsterNestActive, 1);
  assert.ok(saved.map.items.some((i) => i[0] === KING_KONG), "King Kong, beside the nest");

  // The next one: the T-Rex, fed.
  await player.reload();
  await player.select(AGAIN_AT, "Monsters Nest");
  await player.press("Open");
  await window.waitFor();
  assert.equal(await window.locator(".nest-count").textContent(), "0/10");
  assert.equal(await window.locator(".nest-button").textContent(), "Feed");
  assert.equal(await window.locator(".nest-one.locked").count(), 2);
  await player.shot("next");
}

/** Waits for the nest's ten seconds of scaffolding (CLIENT.md, "Construction"). */
async function built(page, [x, y]) {
  await page.waitForFunction(([x, y]) => {
    const placed = window.seHome.parts.town.items.find((p) => p.item.id === 1255 && p.tx === x && p.ty === y);
    return placed && !(placed.builtAt !== undefined && placed.builtAt > Date.now());
  }, [x, y], { timeout: 30_000 });
  await page.waitForTimeout(500);
}
