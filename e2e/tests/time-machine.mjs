// Time packets: first-use help, saved purchases, a real working building's
// timer moved back and the reloaded town; the same actions on a phone.
import assert from "node:assert/strict";
import { itemAt } from "../lib.mjs";
const MACHINE = 1463, AT = [54, 52], MINE = 13, MINE_AT = [56, 56], WORKER = [57, 54];

export default async function timeMachine({ newPlayer }) {
  const player = await newPlayer();
  await player.send([
    { cmd: "rt_level_up", args: [20] },
    { cmd: "buy", args: [MACHINE, ...AT, 0, 0, 1, 1, "b"] },
    { cmd: "buy", args: [373, 52, 54, 0, 0, 1, 1, "b"] },
    { cmd: "buy", args: [MINE, ...MINE_AT, 0, 0, 1, 1, "b"] },
    { cmd: "buy", args: [500, ...WORKER, 0, 0, 1, 1, "u"] },
    { cmd: "push_unit", args: [...WORKER, 500, ...MINE_AT, 0] },
    { cmd: "activate", args: [...MINE_AT, 0, MINE, 4] },
  ]);
  await player.reload();
  const before = await info(player);
  await open(player);
  const panel = player.page.locator(".time-machine:not([hidden])");
  assert.equal(await panel.locator(".machine-packet").count(), 6);
  assert.equal(await panel.locator(".machine-help").isVisible(), true, "first open shows the help");
  assert.match(await panel.textContent(), /Time Machine Help/);
  await player.shot("first-help");
  await player.press("OK");
  await player.press("Use 30 mins");
  assert.match(await panel.locator(".machine-status").textContent(), /buy this item before you can use it/);
  await player.press("Buy 1 day for 75 cash");
  assert.match(await panel.locator(".machine-status").textContent(), /Not enough cash/);
  assert.equal((await info(player)).playerInfo.cash, before.playerInfo.cash, "cash refusal sends no purchase");

  // Saving a purchase in one panel must unlock the other panel if the
  // player switches buildings before the delayed acknowledgement arrives.
  let release, entered;
  const gate = new Promise((resolve) => { release = resolve; });
  const caught = new Promise((resolve) => { entered = resolve; });
  const delay = async (route) => {
    const data = new URLSearchParams(route.request().postData()).get("data");
    const commands = JSON.parse(data.slice(data.indexOf(";") + 1)).commands;
    if (commands.some((command) => command.cmd === "buy_time_packet" && command.args[0] === 0)) { entered(); await gate; }
    await route.continue();
  };
  await player.page.route("**/command.php", delay);
  await player.press("Buy 30 mins for 2 cash");
  await caught;
  await panel.getByRole("button", { name: "Close window", exact: true }).click();
  await player.select([52, 54], "Weather Machine");
  await player.press("Set weather");
  assert.ok(await player.button("Unlock Snowy Plains for 20 cash").isDisabled(), "other machine waits for the purchase");
  release();
  await player.page.waitForFunction(() => !document.querySelector('.weather-machine [data-skin="2"] .button').disabled);
  assert.ok(await player.button("Unlock Snowy Plains for 20 cash").isEnabled(), "other machine is usable after acknowledgement");
  await player.page.unroute("**/command.php", delay);
  await player.page.locator(".weather-machine").getByRole("button", { name: "Close window", exact: true }).click();
  await open(player);
  assert.match(await panel.locator('[data-packet="0"] .machine-owned').textContent(), /Available: 1/);
  await player.press("Buy 1 hour for 4 cash");
  await panel.locator('[data-packet="1"] .button').first().waitFor({ state: "visible" });
  await player.page.waitForFunction(() => !document.querySelector('.time-machine [data-packet="1"] .button').disabled);
  assert.match(await panel.locator('[data-packet="1"] .machine-owned').textContent(), /Available: 1/);
  const bought = await info(player);
  assert.equal(bought.playerInfo.cash, before.playerInfo.cash - 6);
  assert.deepEqual(bought.privateState.countTimePacket, [1, 1, 0, 0, 0, 0]);
  assert.ok(bought.privateState.helpMap.includes("timeMachineHelp"));
  await player.shot("packets");
  await Promise.all([player.page.waitForEvent("domcontentloaded"), player.press("Use 1 hour")]);
  await player.loaded();
  const used = await info(player);
  assert.deepEqual(used.privateState.countTimePacket, [1, 0, 0, 0, 0, 0]);
  assert.equal(itemAt(used.map, MINE, MINE_AT)[4], itemAt(before.map, MINE, MINE_AT)[4] - 3600);
  // Advancing an hour also makes the normal ten-minute camp due. Its
  // chapter notice is real game behavior and must be acknowledged before
  // tapping the machine behind it, as a player would.
  await player.page.locator(".notice").waitFor();
  assert.match(await player.page.locator(".notice h2").textContent(), /CHAPTER 4/);
  await player.shot("travel-camp");
  await open(player);
  assert.equal(await panel.locator(".machine-help").isVisible(), false, "the help is remembered after travel");
  await player.press("Time Machine Help");
  assert.equal(await panel.locator(".machine-help").isVisible(), true, "help remains available");
  await player.press("OK");
  await player.shot("returned");

  const phone = await player.onPhone();
  await open(phone);
  const sheet = phone.page.locator(".time-machine:not([hidden])");
  await phone.press("Buy 30 mins for 2 cash");
  await phone.page.waitForFunction(() => !document.querySelector('.time-machine [data-packet="0"] .button').disabled);
  const boxes = await sheet.locator(".machine-packet").evaluateAll((rows) => rows.map((row) => ({ left: row.getBoundingClientRect().left, right: row.getBoundingClientRect().right, scroll: row.scrollWidth, width: row.clientWidth })));
  assert.ok(boxes.every((b) => b.left >= 0 && b.right <= 390 && b.scroll <= b.width + 1), "packets fit the phone");
  await phone.shot("phone");
  await Promise.all([phone.page.waitForEvent("domcontentloaded"), phone.press("Use 30 mins")]);
  await phone.loaded();
  const afterPhone = await info(phone);
  assert.equal(afterPhone.playerInfo.cash, bought.playerInfo.cash - 2);
  assert.deepEqual(afterPhone.privateState.countTimePacket, [1, 0, 0, 0, 0, 0]);
  assert.equal(itemAt(afterPhone.map, MINE, MINE_AT)[4], itemAt(before.map, MINE, MINE_AT)[4] - 5400);

  // A successful HTTP response without command acknowledgement is refused
  // by the normal sender. Its three retries must neither auto-reload nor
  // spend again; Reload restores the actual saved balance and stock.
  await open(phone);
  const refuse = async (route) => {
    const data = new URLSearchParams(route.request().postData()).get("data");
    const commands = JSON.parse(data.slice(data.indexOf(";") + 1)).commands;
    if (commands.some((command) => command.cmd === "buy_time_packet")) await route.fulfill({ status: 204 });
    else await route.continue();
  };
  await phone.page.route("**/command.php", refuse);
  await phone.press("Buy 30 mins for 2 cash");
  await phone.button("Reload saved town").waitFor({ timeout: 30_000 });
  assert.match(await sheet.locator(".machine-status").textContent(), /couldn't be saved/);
  assert.equal(await sheet.isVisible(), true, "failed save stays on the page");
  assert.ok(await phone.button("Buy 30 mins for 2 cash").isDisabled(), "uncertain balance cannot be spent twice");
  const unsent = await info(phone);
  assert.equal(unsent.playerInfo.cash, afterPhone.playerInfo.cash);
  assert.deepEqual(unsent.privateState.countTimePacket, afterPhone.privateState.countTimePacket);
  await phone.shot("phone-save-recovery");
  await phone.page.unroute("**/command.php", refuse);
  await Promise.all([phone.page.waitForEvent("domcontentloaded"), phone.press("Reload saved town")]);
  await phone.loaded();
  await open(phone);
  assert.match(await sheet.locator('[data-packet="0"] .machine-owned').textContent(), /Available: 1/);

}
async function open(player) {
  const notice = player.page.locator(".notice");
  if (await notice.isVisible()) {
    assert.match(await notice.locator("h2").textContent(), /CHAPTER 4/, "the camp made due by time travel");
    await notice.getByRole("button", { name: "OK", exact: true }).click();
  }
  await player.select(AT, "Time Machine");
  await player.press("Open");
}
async function info(player) {
  const response = await player.page.request.post(`${player.base}${player.settings.dynamicUrl}/get_player_info.php`, { form: { USERID: player.settings.userId, user_key: player.settings.userKey } });
  return response.json();
}
