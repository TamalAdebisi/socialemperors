// The six original terrain looks, paid unlock-and-apply, remembered owned
// looks and free grass; desktop and phone both check the server's save.
import assert from "node:assert/strict";
const MACHINE = 373, AT = [52, 54];
export default async function weatherMachine({ newPlayer }) {
  const player = await newPlayer();
  await player.send([{ cmd: "rt_level_up", args: [20] }, { cmd: "buy", args: [MACHINE, ...AT, 0, 0, 1, 1, "b"] }]);
  await player.reload();
  const before = await info(player);
  await open(player);
  const panel = player.page.locator(".weather-machine:not([hidden])");
  assert.deepEqual(await panel.locator(".machine-look").evaluateAll((rows) => rows.map((row) => Number(row.dataset.skin))), [0, 1, 2, 4, 5, 6]);
  assert.ok(await player.button("Grassy Meadows: selected").isDisabled());
  await player.page.waitForFunction(() => [...document.querySelectorAll('.weather-machine .machine-theme')].every((image) => image.complete && image.naturalWidth > 0), null, { timeout: 30_000 });
  await player.shot("looks");
  await Promise.all([player.page.waitForEvent("domcontentloaded"), player.press("Unlock Snowy Plains for 20 cash")]);
  await player.loaded();
  const snow = await info(player);
  assert.equal(snow.map.skin, 2);
  assert.equal(snow.privateState.unlockedSkins["2"], "true");
  assert.equal(snow.playerInfo.cash, before.playerInfo.cash - 20);
  await open(player);
  assert.ok(await player.button("Snowy Plains: selected").isDisabled());
  await player.shot("snow");
  const phone = await player.onPhone();
  await open(phone);
  const rows = await phone.page.locator(".weather-machine .machine-look").evaluateAll((rows) => rows.map((row) => ({ right: row.getBoundingClientRect().right, scroll: row.scrollWidth, width: row.clientWidth })));
  assert.ok(rows.every((row) => row.right <= 390 && row.scroll <= row.width + 1), "looks fit the phone");
  await phone.shot("phone-snow");
  await Promise.all([phone.page.waitForEvent("domcontentloaded"), phone.press("Select Grassy Meadows")]);
  await phone.loaded();
  const grass = await info(phone);
  assert.equal(grass.map.skin, 0);
  assert.equal(grass.playerInfo.cash, snow.playerInfo.cash);
  await open(phone);
  assert.ok(await phone.button("Select Snowy Plains").isVisible(), "owned look stays free after changing away");
  await phone.shot("phone-grass");
  await Promise.all([phone.page.waitForEvent("domcontentloaded"), phone.press("Select Snowy Plains")]);
  await phone.loaded();
  const again = await info(phone);
  assert.equal(again.map.skin, 2);
  assert.equal(again.playerInfo.cash, snow.playerInfo.cash, "no repeat unlock charge");
}
async function open(player) { await player.select(AT, "Weather Machine"); await player.press("Set weather"); }
async function info(player) {
  const response = await player.page.request.post(`${player.base}${player.settings.dynamicUrl}/get_player_info.php`, { form: { USERID: player.settings.userId, user_key: player.settings.userKey } });
  return response.json();
}
