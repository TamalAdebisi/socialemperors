// The archived config has none of the later Soul Mixer's content tables.
// Its original-art window explains that limitation and cannot spend cash
// or move units. Check both the visible screen and the ordinary server save.
import assert from "node:assert/strict";

const BUILDING = 1529, AT = [56, 54];
export default async function soulMixer({ newPlayer }) {
  const player = await newPlayer();
  await player.send([
    { cmd: "buy", args: [BUILDING, ...AT, 0, 0, 1, 1, "b"] },
    { cmd: "buy", args: [514, 51, 51, 0, 0, 1, 1, "u"] },
  ]);
  await player.reload();
  const { page } = player;
  const read = async () => {
    const response = await page.request.post(`${player.base}${player.settings.dynamicUrl}/get_player_info.php`,
      { form: { USERID: player.settings.userId, user_key: player.settings.userKey } });
    const state = await response.json();
    return { cash: state.playerInfo.cash, mixer: state.map.items.filter((row) => row[0] === BUILDING),
      knights: state.map.items.filter((row) => row[0] === 514).map((row) => row.slice(0, 3)), queues: state.privateState.barracksQueues ?? {} };
  };
  const before = await read();
  await player.select(AT, "Soul Mixer");
  await player.press("Soul Mixer");
  const panel = page.locator(".panel.soul-mixer:not([hidden])");
  await panel.waitFor();
  assert.match(await panel.textContent(), /original Soul Mixer rules are unavailable/);
  assert.ok(await panel.getByRole("button", { name: "Select unit", exact: true }).isDisabled());
  assert.ok(await panel.getByRole("button", { name: "Start mixing", exact: true }).isDisabled());
  await panel.locator(".soul-mixer-scene").evaluate((image) => image.decode());
  await player.shot("unavailable");
  await panel.getByRole("button", { name: "Help", exact: true }).click();
  await panel.locator(".soul-mixer-help img").evaluateAll((images) => Promise.all(images.map((image) => image.decode())));
  assert.equal(await panel.locator(".soul-mixer-help img").count(), 4);
  await player.shot("help");
  await panel.getByRole("button", { name: "Back", exact: true }).click();
  assert.deepEqual(await read(), before, "opening, help and disabled actions preserve cash, parents and queues");
  await player.reload();
  const phone = await player.onPhone();
  await phone.select(AT, "Soul Mixer");
  await phone.press("Soul Mixer");
  const sheet = phone.page.locator(".panel.soul-mixer:not([hidden])");
  await sheet.waitFor();
  await sheet.locator(".soul-mixer-scene").evaluate((image) => image.decode());
  assert.match(await sheet.textContent(), /units and cash are safe/);
  const width = await sheet.evaluate((element) => ({ right: element.getBoundingClientRect().right, scroll: element.scrollWidth, width: element.clientWidth }));
  assert.ok(width.right <= 390 && width.scroll <= width.width, "the original window fits the phone sheet");
  await phone.shot("phone-unavailable");
  assert.deepEqual(await read(), before, "the save remains unchanged after reload and phone opening");
}
