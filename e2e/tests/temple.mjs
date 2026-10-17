// Supreme Bahamut's temple: freely chosen offerings, live shared mana,
// sacrifice confirmation, saved waits, the Heart and free claim/reset.
// Between stages the fixture uses the original admin-only wait command;
// the ordinary window must not grow that hidden shortcut.
import assert from "node:assert/strict";

const TEMPLE = 1394, HEART = 1410, SUPREME = 2003, FURIOUS = 649, ACADEMY = 416;
const AT = [56, 52], ACADEMY_AT = [48, 58], DRAGON_AT = [57, 58];

export default async function temple({ newPlayer }) {
  const player = await newPlayer();
  const { page } = player;
  const info = async () => (await page.request.post(`${player.base}${player.settings.dynamicUrl}/get_player_info.php`,
    { form: { USERID: player.settings.userId, user_key: player.settings.userKey } })).json();
  await player.send([
    { cmd: "rt_level_up", args: [60] },
    { cmd: "buy", args: [TEMPLE, ...AT, 0, 0, 1, 1, "b"] },
    { cmd: "buy", args: [ACADEMY, ...ACADEMY_AT, 0, 0, 1, 1, "b"] },
    { cmd: "buy", args: [FURIOUS, ...DRAGON_AT, 0, 0, 1, 1, "u"] },
  ]);
  await player.reload();
  assert.equal((await info()).privateState.mana, 50);
  await player.select(ACADEMY_AT, "Wizardry Academy");
  await player.press("Spells");
  await page.getByRole("button", { name: "Buy 5 mana for 1 cash", exact: true }).click();
  assert.match(await page.locator(".spells .mana-pill").textContent(), /55/);
  await page.keyboard.press("Escape");

  const open = async (who = player) => {
    await who.select(AT, "Supreme Dragon Temple");
    await who.press("Open");
    const window = who.page.locator(".temple-window:not([hidden])");
    await window.waitFor();
    return window;
  };
  const savedAction = async () => {
    await page.waitForFunction(() => {
      const status = document.querySelector(".temple-notice");
      return status && status.textContent === "";
    }, null, { timeout: 30000 });
    return info();
  };
  let window = await open();
  assert.equal(await window.locator(".temple-offering").count(), 12);
  assert.match(await window.locator(".temple-progress").textContent(), /0\/12/);
  assert.ok(await window.locator(".temple-offer").isDisabled(), "cannot afford the first offering");
  await window.getByRole("button", { name: "Help", exact: true }).click();
  assert.match(await window.locator(".temple-help").textContent(), /order you wish/);
  await player.shot("laws");
  await window.getByRole("button", { name: "Back", exact: true }).click();

  // Choose the fifth offering first. The Academy's purchase is visible
  // without reloading either window; the gift and gold steps cannot run.
  await window.locator('[data-step="11"]').click();
  assert.ok(await window.locator(".temple-offer").isDisabled(), "no Heart in gifts");
  await window.locator('[data-step="4"]').click();
  assert.ok(await window.locator(".temple-offer").isEnabled());
  await page.waitForFunction(() => [...document.querySelectorAll(".temple-window img")].every((image) => image.complete && image.naturalWidth > 0),
    null, { timeout: 60000 });
  await player.shot("offerings-desktop");
  const before = await info();
  await window.locator(".temple-offer").click();
  await window.locator(".temple-countdown").waitFor();
  const manaOffered = await savedAction();
  assert.deepEqual(manaOffered.privateState.templeStep, [4]);
  assert.equal(manaOffered.privateState.mana, 5);
  assert.ok(manaOffered.privateState.timeStampTemple > 0);
  assert.equal(manaOffered.playerInfo.cash, before.playerInfo.cash);
  assert.equal(await window.locator(".temple-offer").count(), 0, "the wait hides the action, including after the last offering");
  assert.equal(await window.getByRole("button", { name: /Skip|Speed|Get now/i }).count(), 0, "the original's admin-only wait shortcut is not a public control");
  await player.shot("wait-desktop");
  await page.keyboard.press("Escape");
  await player.select(ACADEMY_AT, "Wizardry Academy");
  await player.press("Spells");
  assert.match(await page.locator(".spells .mana-pill").textContent(), /\b5\b/, "the Academy shares the temple's remaining mana without a reload");

  // A real phone reload reads the same progress and deadline from the save.
  await page.keyboard.press("Escape");
  await player.reload();
  const phone = await player.onPhone();
  const phoneWindow = await open(phone);
  assert.match(await phoneWindow.locator(".temple-progress").textContent(), /1\/12/);
  await phoneWindow.locator('[data-step="4"]').click();
  assert.equal(await phoneWindow.locator('[data-step="4"]').getAttribute("aria-pressed"), "true");
  assert.match(await phoneWindow.locator('[data-step="4"]').getAttribute("aria-label"), /offered/);
  await phoneWindow.locator(".temple-countdown").scrollIntoViewIfNeeded();
  const phoneBox = await phoneWindow.boundingBox();
  assert.ok(phoneBox.x >= 0 && phoneBox.x + phoneBox.width <= 391, "the phone sheet fits the viewport");
  assert.equal(await phoneWindow.evaluate((element) => element.scrollWidth <= element.clientWidth), true, "no horizontal overflow");
  assert.equal(await phoneWindow.locator(".temple-offer").count(), 0);
  await phone.shot("wait-phone");
  await phone.page.close();
  await page.bringToFront();

  // Clear only the test fixture's wait, then make a real sacrifice.
  await player.send([{ cmd: "buy_temple_step_cash", args: [5] }]);
  await player.reload();
  window = await open();
  await window.locator('[data-step="6"]').click();
  await window.locator(".temple-offer").click();
  assert.match(await window.locator(".temple-confirm").textContent(), /Furious Dragon/);
  await player.shot("sacrifice-confirmation");
  await window.getByRole("button", { name: "No", exact: true }).click();
  assert.ok((await info()).map.items.some((item) => item[0] === FURIOUS), "cancel keeps the dragon");

  // A real walking dragon is already on a different visual tile while
  // its save still names the starting tile. Sacrifice must sell there.
  await page.keyboard.press("Escape");
  await player.select(DRAGON_AT, "Furious Dragon");
  const oldCentre = await page.evaluate(() => window.seHome.parts.camera.toMap({ x: innerWidth / 2, y: innerHeight / 2 }));
  await page.evaluate(() => window.seHome.parts.camera.lookAt({ x: 0, y: 27 * (90 + 90) - 81 }));
  await page.mouse.click(640, 400);
  await page.evaluate((centre) => window.seHome.parts.camera.lookAt(centre), oldCentre);
  await page.waitForFunction(() => {
    const { town, view } = window.seHome.parts;
    const dragon = town.items.find((p) => p.item.id === 649);
    return dragon && view.isWalking(dragon) && (dragon.tx !== 57 || dragon.ty !== 58);
  }, null, { timeout: 30000 });
  const walkingSave = await info();
  const savedDragon = walkingSave.map.items.find((item) => item[0] === FURIOUS);
  assert.deepEqual(savedDragon.slice(1, 3), DRAGON_AT, "movement has not sent an arrival yet");
  window = await open();
  await window.locator('[data-step="6"]').click();
  await window.locator(".temple-offer").click();
  assert.ok(await page.evaluate(() => {
    const dragon = window.seHome.parts.town.items.find((p) => p.item.id === 649);
    return dragon && window.seHome.parts.view.isWalking(dragon);
  }), "the dragon is still walking at confirmation");
  await window.getByRole("button", { name: "Yes", exact: true }).click();
  await window.locator(".temple-countdown").waitFor();
  const sacrificed = await savedAction();
  assert.deepEqual(sacrificed.privateState.templeStep, [4, 6]);
  assert.ok(!sacrificed.map.items.some((item) => item[0] === FURIOUS));
  assert.equal(sacrificed.privateState.deadHeroes?.[FURIOUS] ?? 0, 0, "sacrifice does not bury the dragon");
  assert.equal(sacrificed.map.coins, manaOffered.map.coins, "no sale refund");

  // Earn the Heart through the actual collection commands. Its offering
  // checks gifts and keeps the Heart until the final dragon is claimed.
  await page.keyboard.press("Escape");
  await player.send([
    { cmd: "buy_temple_step_cash", args: [5] },
    ...[1, 2, 3, 4, 5].map((piece) => ({ cmd: "add_collectable", args: [23, piece] })),
    { cmd: "finish_collection", args: [23] },
    { cmd: "store_add_items", args: [JSON.stringify([HEART])] },
  ]);
  await player.reload();
  window = await open();
  await window.locator('[data-step="11"]').click();
  assert.ok(await window.locator(".temple-offer").isEnabled());
  await window.locator(".temple-offer").click();
  await window.locator(".temple-countdown").waitFor();
  const heartOffered = await savedAction();
  assert.deepEqual(heartOffered.privateState.templeStep, [4, 6, 11]);
  assert.equal(heartOffered.privateState.gifts[HEART], 1);
  assert.equal(heartOffered.map.store[HEART], 1, "the offering retains both stored Hearts");
  await player.shot("heart-offered");

  // Prepare the remaining historic progress with the original wire
  // commands. The final normal-window claim still waits for step twelve.
  await page.keyboard.press("Escape");
  const remaining = [0, 1, 2, 3, 5, 7, 8, 9, 10];
  const data = [{ g: 100000 }, { s: 100000 }, { w: 100000 }, { f: 100000 }, { m: 50 }, { c: 50 },
    { u: 649 }, { u: 684 }, { u: 695 }, { u: 853 }, { u: 875 }, { collection: 23 }];
  await player.send(remaining.map((step) => ({ cmd: "next_temple_step", args: [JSON.stringify(data[step]), step] })));
  await player.reload();
  window = await open();
  assert.match(await window.locator(".temple-progress").textContent(), /12\/12/);
  assert.equal(await window.locator(".temple-offer").count(), 0, "completion keeps the twelfth wait");
  await player.shot("completed-wait");
  await page.keyboard.press("Escape");
  await player.send([{ cmd: "buy_temple_step_cash", args: [5] }]);
  await player.reload();
  const beforeClaim = await info();
  window = await open();
  assert.equal(await window.locator(".temple-offer").textContent(), "Get Dragon");
  await player.shot("ready");
  await window.locator(".temple-offer").click();
  await window.waitFor({ state: "hidden" });
  const claimed = await info();
  assert.deepEqual(claimed.privateState.templeStep, []);
  assert.equal(claimed.privateState.timeStampTemple, 0);
  assert.equal(claimed.map.store[HEART] ?? 0, 0, "claim consumes the town's stored Heart first");
  assert.equal(claimed.privateState.gifts[HEART] ?? 0, 1, "the shared gift Heart remains");
  const dragon = claimed.map.items.find((item) => item[0] === SUPREME);
  assert.ok(dragon, "the free Supreme dragon is saved");
  assert.ok(Math.max(Math.abs(dragon[1] - AT[0]), Math.abs(dragon[2] - AT[1])) <= 4, "beside its temple");
  assert.equal(claimed.playerInfo.cash, beforeClaim.playerInfo.cash);
  assert.equal(claimed.map.coins, beforeClaim.map.coins);
  assert.equal(claimed.map.xp, beforeClaim.map.xp);
  await player.reload();
  window = await open();
  assert.match(await window.locator(".temple-progress").textContent(), /0\/12/);
  assert.equal(await window.locator(".temple-countdown").count(), 0);
  await player.shot("reset");
}
