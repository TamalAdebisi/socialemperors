// The archived config has none of the later Soul Mixer's content tables.
// New mixing stays unavailable. Check its help and saved-state invariance,
// then collect explicit-ready historical work through the real window.
import assert from "node:assert/strict";

const BUILDING = 1529, AT = [56, 54];
async function unavailableSoulMixer({ newPlayer }) {
  const player = await newPlayer();
  await player.send([
    { cmd: "buy", args: [BUILDING, ...AT, 0, 0, 1, 1, "b"] },
    { cmd: "buy", args: [514, 58, 56, 0, 0, 1, 1, "u"] },
  ]);
  await player.reload();
  const { page } = player;
  assert.equal(await page.evaluate(() => window.seHome.parts.commands.flush()), true, "fixture setup is saved before comparing the unavailable window");
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

// Completed legacy work is restored offline in the runner's isolated save.
// No content tables are supplied: explicit-ready historical work is collected
// through the ordinary window and commands while new mixing stays unavailable.
export default async function soulMixer(context) {
  assert.equal(typeof context.offlineVillage, "function", "legacy coverage requires the reviewed, runner-owned offline restart callback");
  await unavailableSoulMixer(context); // all original unavailable/help/phone checks and captures
  await legacyReady(context);
  await malformedLegacyOutput(context);
}

const PARENTS = [{ id: 509, at: [58, 58] }, { id: 514, at: [59, 58] }];

async function stateOf(player) {
  const response = await player.page.request.post(`${player.base}${player.settings.dynamicUrl}/get_player_info.php`,
    { form: { USERID: player.settings.userId, user_key: player.settings.userKey } });
  assert.equal(response.status(), 200);
  return response.json();
}

async function assertOriginalDataAbsent(player) {
  const response = await player.page.request.post(`${player.base}${player.settings.dynamicUrl}/get_game_config.php`,
    { form: { USERID: player.settings.userId, user_key: player.settings.userKey } });
  assert.equal(response.status(), 200);
  const config = await response.json();
  for (const key of ["SOUL_MIXER_MIN_LEVEL", "SOUL_MIXER_POWERUPS_LEVELS"]) {
    assert.equal(Object.hasOwn(config.globals ?? {}, key), false, `${key} stays absent`);
  }
  for (const key of ["breeding_order", "sm_training_time"]) {
    assert.equal(config.items.some((item) => Object.hasOwn(item, key)), false, `${key} stays absent from every original item`);
  }
  assert.equal(config.items.find((item) => Number(item.id) === 533)?.type, "u");
  assert.equal(config.items.find((item) => Number(item.id) === 1345)?.type, "b");
  assert.equal(await player.page.evaluate(() => window.seHome.parts.town.soulMixerReady), false);
}

function mixerOf(state) {
  return state.map.items.find((row) => row[0] === BUILDING && row[1] === AT[0] && row[2] === AT[1]);
}

function projection(state) {
  return { cash: state.playerInfo.cash, xp: state.map.xp,
    mixer: mixerOf(state), queues: state.privateState.barracksQueues ?? {},
    units: state.map.items.filter((row) => [509, 514, 533, 1345].includes(row[0])).map((row) => row.slice(0, 3)).sort() };
}

function countOnMap(state, id) {
  return state.map.items.filter((row) => row[0] === id).length;
}

async function prepared(context, output, queueId) {
  let player = await context.newPlayer();
  await player.send([
    { cmd: "buy", args: [BUILDING, ...AT, 0, 0, 1, 1, "b"] },
    ...PARENTS.map(({ id, at }) => ({ cmd: "buy", args: [id, ...at, 0, 0, 1, 1, "u"] })),
  ]);
  await player.reload();
  await assertOriginalDataAbsent(player);
  // Only after all pages have flushed/closed and the owned child exits does the
  // harness read/edit this player's SQLite JSON. It then restarts normally.
  player = await context.offlineVillage(player, (save) => {
    const map = save.maps[0];
    const mixer = map.items.find((row) => row[0] === BUILDING && row[1] === AT[0] && row[2] === AT[1]);
    assert.ok(mixer, "the original buy handler created the fixture building");
    assert.equal(mixer[6]?.length ?? 0, 0);
    assert.equal(mixer[7]?.bq, undefined);
    for (const { id, at } of PARENTS) {
      const index = map.items.findIndex((row) => row[0] === id && row[1] === at[0] && row[2] === at[1]);
      assert.ok(index >= 0, "the original buy handler created each existing parent unit");
      map.items.splice(index, 1);
    }
    mixer[6] = PARENTS.map(({ id }) => id);
    mixer[7] = { ...(mixer[7] ?? {}), bq: queueId };
    save.privateState.barracksQueues ??= {};
    assert.equal(Object.hasOwn(save.privateState.barracksQueues, queueId), false);
    save.privateState.barracksQueues[queueId] = { ts: 0, amount: 1, unit: output };
  });
  await assertOriginalDataAbsent(player);
  const saved = await stateOf(player);
  assert.deepEqual(mixerOf(saved)[6], PARENTS.map(({ id }) => id));
  assert.equal(mixerOf(saved)[7].bq, queueId);
  assert.deepEqual(saved.privateState.barracksQueues[queueId], { ts: 0, amount: 1, unit: output });
  return player;
}

async function openMixer(player) {
  await player.select(AT, "Soul Mixer");
  await player.press("Soul Mixer");
  const panel = player.page.locator(".panel.soul-mixer:not([hidden])");
  await panel.waitFor();
  await panel.locator(".soul-mixer-scene").evaluate((image) => image.decode());
  return panel;
}

async function decodedMixerArt(panel) {
  await panel.locator(".soul-mixer-scene, .soul-mixer-parents img, .soul-mixer-result")
    .evaluateAll((images) => Promise.all(images.map((image) => image.decode())));
}

async function legacyReady(context) {
  const player = await prepared(context, 533, "1");
  const baseline = await stateOf(player);
  const panel = await openMixer(player);
  await decodedMixerArt(panel);
  assert.equal(await panel.getByRole("button", { name: /^Get unit$/i }).isEnabled(), true);
  assert.equal(await panel.getByRole("button", { name: /^Speed up/i }).count(), 0);
  await player.shot("legacy-ready");
  // One active page makes command attribution exact and avoids a stale desktop
  // copy acting after the phone claims. Existing authenticated context stays.
  assert.equal(await player.page.evaluate(() => window.seHome.parts.commands.flush()), true);
  await player.page.goto("about:blank");
  const phone = await player.onPhone();
  const sheet = await openMixer(phone);
  const get = sheet.getByRole("button", { name: /^Get unit$/i });
  await get.scrollIntoViewIfNeeded();
  assert.equal(await get.evaluate((button) => {
    const box = button.getBoundingClientRect();
    return box.left >= 0 && box.right <= innerWidth && box.top >= 0 && box.bottom <= innerHeight;
  }), true, "the full legacy claim control fits the phone viewport after normal scrolling");
  await decodedMixerArt(sheet);
  await phone.shot("phone-legacy-ready");
  const commands = [];
  const observe = (request) => {
    if (!request.url().endsWith("/command.php") || request.method() !== "POST") return;
    const payload = new URLSearchParams(request.postData()).get("data");
    commands.push(...JSON.parse(payload.slice(payload.indexOf(";") + 1)).commands);
  };
  phone.page.on("request", observe);
  await get.click();
  await sheet.waitFor({ state: "hidden" });
  assert.equal(await phone.page.evaluate(() => window.seHome.parts.commands.flush()), true);
  phone.page.off("request", observe);
  assert.equal(commands.filter((command) => command.cmd === "pop_queue_unit").length, 1);
  assert.deepEqual(commands.filter((command) => command.cmd === "pop_unit").map((command) => command.args[3]).sort(), [509, 514]);
  assert.equal(commands.some((command) => ["buy_powerups", "push_queue_unit", "speed_up_queue"].includes(command.cmd)), false);
  const claimed = await stateOf(phone);
  assert.equal(claimed.playerInfo.cash, baseline.playerInfo.cash, "completed legacy work spends zero cash");
  assert.equal(claimed.map.xp, baseline.map.xp, "completed legacy work grants zero XP");
  for (const { id } of PARENTS) assert.equal(countOnMap(claimed, id), countOnMap(baseline, id) + 1, "each parent returns exactly once");
  assert.equal(countOnMap(claimed, 533), countOnMap(baseline, 533) + 1, "one actual known unit is granted");
  assert.deepEqual(mixerOf(claimed)[6], []);
  assert.equal(mixerOf(claimed)[7].bq, "1");
  assert.deepEqual(claimed.privateState.barracksQueues["1"], { ts: 0, amount: 0, unit: 533 });
  const once = projection(claimed);
  await phone.reload();
  const idle = await openMixer(phone);
  assert.equal(await idle.getByRole("button", { name: /^Get unit$/i }).count(), 0);
  assert.equal(await idle.getByRole("button", { name: "Select unit", exact: true }).isDisabled(), true);
  assert.equal(await idle.getByRole("button", { name: "Start mixing", exact: true }).isDisabled(), true);
  assert.deepEqual(projection(await stateOf(phone)), once, "reload preserves the claimed marker and returned units");
  // A repeated original command is refused by the real server too.
  await phone.send([{ cmd: "pop_queue_unit", args: [1, 60, 55, BUILDING] }]);
  assert.deepEqual(projection(await stateOf(phone)), once, "a retry cannot grant or return anything twice");
  await player.open();
  await decodedMixerArt(await openMixer(player));
  await player.shot("legacy-collected");
}

async function malformedLegacyOutput(context) {
  const player = await prepared(context, 1345, "2");
  const before = projection(await stateOf(player));
  const panel = await openMixer(player);
  await panel.getByRole("button", { name: /^Get unit$/i }).click();
  await player.said(/Your unit is not ready yet/i);
  assert.equal(await panel.isVisible(), true);
  assert.equal(await player.page.evaluate(() => window.seHome.parts.commands.flush()), true);
  assert.deepEqual(projection(await stateOf(player)), before, "building metadata grants nothing, spends nothing and keeps both parents");
  await decodedMixerArt(panel);
  await player.shot("legacy-malformed-refused");
  await player.send([{ cmd: "pop_queue_unit", args: [2, 60, 55, BUILDING] }]);
  assert.deepEqual(projection(await stateOf(player)), before, "the real server also refuses malformed legacy output");
}
