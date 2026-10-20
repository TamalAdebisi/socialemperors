// The Soul Mixer (CLIENT.md, "The Soul Mixer"), with its tables rebuilt from
// the community wiki (config/soulmixer_wiki.json; DECISIONS.md). Two
// Valkyries go in, the result shows as a silhouette, one power-up costs 1
// cash, the mix starts and the server keeps its queue; speeding it up costs
// a cash an hour left, Get unit puts the result beside the mixer and both
// Valkyries come back out. The help and the phone sheet are checked too.
import assert from "node:assert/strict";

const BUILDING = 1529, AT = [56, 54], VALKYRIE = 554, SOLDIERS = [512, 516];

async function readState(player) {
  const response = await player.page.request.post(`${player.base}${player.settings.dynamicUrl}/get_player_info.php`,
    { form: { USERID: player.settings.userId, user_key: player.settings.userKey } });
  return response.json();
}

async function mixing(context) {
  let player = await context.newPlayer();
  await player.send([
    { cmd: "rt_level_up", args: [25] },
    { cmd: "buy", args: [BUILDING, ...AT, 0, 0, 1, 1, "b"] },
    { cmd: "buy", args: [VALKYRIE, 58, 58, 0, 0, 1, 1, "u"] },
    { cmd: "buy", args: [VALKYRIE, 59, 58, 0, 0, 1, 1, "u"] },
  ]);
  // Cash to speed the mix up, and room for its result: the new town's soldiers go.
  player = await context.offlineVillage(player, (save) => {
    save.playerInfo.cash = 500;
    save.maps[0].items = save.maps[0].items.filter((row) => !SOLDIERS.includes(row[0]));
  });
  const { page } = player;
  await player.closeLevelUps();
  const panel = await openMixer(player);
  assert.equal(await panel.locator(".soul-mixer-unavailable").count(), 0, "the mixer works");
  for (const slot of [1, 2]) {
    await panel.getByRole("button", { name: `Select unit ${slot}`, exact: true }).click();
    await panel.getByRole("button", { name: "Valkyrie", exact: true }).first().click();
  }
  await panel.locator(".soul-mixer-result.silhouette").waitFor();
  await decodedMixerArt(panel);
  await player.shot("chosen");
  const cash = () => page.evaluate(() => window.seHome.parts.town.cash);
  await panel.getByRole("button", { name: "Power up · 1 cash", exact: true }).click();
  assert.equal(await cash(), 499, "the first power-up: 1 cash");
  await panel.getByRole("button", { name: "Start mixing", exact: true }).click();
  const speed = panel.locator(".soul-mixer-speed");
  await speed.waitFor();
  assert.match(await panel.locator(".soul-mixer-time").textContent(), /Remaining time/);
  await player.shot("mixing");
  assert.equal(await page.evaluate(() => window.seHome.parts.commands.flush()), true);
  let saved = await readState(player);
  const mixer = saved.map.items.find((row) => row[0] === BUILDING);
  assert.deepEqual(mixer[6], [VALKYRIE, VALKYRIE], "both Valkyries inside");
  const queue = saved.privateState.barracksQueues[mixer[7].bq];
  assert.equal(queue.amount, 1);
  assert.equal(saved.playerInfo.cash, 499);
  const result = queue.unit;
  const hours = Number((await speed.textContent()).match(/(\d+) cash/)[1]);
  assert.ok(hours >= 3 && hours <= 130, `a wait of 3 hours to 5 days 10 hours (${hours})`);

  await speed.click();
  await panel.getByRole("button", { name: "Get unit", exact: true }).click();
  await panel.waitFor({ state: "hidden" });
  assert.equal(await page.evaluate(() => window.seHome.parts.commands.flush()), true);
  saved = await readState(player);
  assert.equal(saved.playerInfo.cash, 499 - hours, "a cash an hour left");
  assert.equal(saved.map.items.filter((row) => row[0] === result).length, 1, "the result beside the mixer");
  assert.equal(saved.map.items.filter((row) => row[0] === VALKYRIE).length, 2, "both Valkyries back out");
  assert.equal(saved.privateState.barracksQueues[mixer[7].bq].amount, 0);
  await player.shot("collected");

  // The original help, and the phone sheet.
  const again = await openMixer(player);
  await again.getByRole("button", { name: "Help", exact: true }).click();
  await again.locator(".soul-mixer-help img").evaluateAll((images) => Promise.all(images.map((image) => image.decode())));
  assert.equal(await again.locator(".soul-mixer-help img").count(), 4);
  await player.shot("help");
  await again.getByRole("button", { name: "Back", exact: true }).click();
  const phone = await player.onPhone();
  const sheet = await openMixer(phone);
  const width = await sheet.evaluate((element) => ({ right: element.getBoundingClientRect().right, scroll: element.scrollWidth, width: element.clientWidth }));
  assert.ok(width.right <= 390 && width.scroll <= width.width, "the original window fits the phone sheet");
  await phone.shot("phone");
  await phone.page.context().close();
}

// A finished mix from an old save is restored offline in the runner's
// isolated save, and collected through the ordinary window and commands;
// a malformed one is refused.
export default async function soulMixer(context) {
  assert.equal(typeof context.offlineVillage, "function", "the checks need the runner-owned offline restart callback");
  await mixing(context);
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

async function assertWikiTables(player) {
  const response = await player.page.request.post(`${player.base}${player.settings.dynamicUrl}/get_game_config.php`,
    { form: { USERID: player.settings.userId, user_key: player.settings.userKey } });
  assert.equal(response.status(), 200);
  const config = await response.json();
  for (const key of ["SOUL_MIXER_MIN_LEVEL", "SOUL_MIXER_POWERUPS_LEVELS"]) {
    assert.equal(Object.hasOwn(config.globals ?? {}, key), true, `${key} from the wiki's tables`);
  }
  for (const key of ["breeding_order", "sm_training_time"]) {
    assert.equal(config.items.some((item) => Object.hasOwn(item, key)), true, `${key} on the mixable units`);
  }
  assert.equal(config.items.find((item) => Number(item.id) === 533)?.type, "u");
  assert.equal(config.items.find((item) => Number(item.id) === 1345)?.type, "b");
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
  await assertWikiTables(player);
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
  await assertWikiTables(player);
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
  assert.equal(await idle.getByRole("button", { name: "Start mixing", exact: true }).count(), 0, "no mix chosen yet");
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
