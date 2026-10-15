// The new client and the classic game play the same empire (CLAUDE.md, rule
// 5), and Arthur's lessons (CLIENT.md, "Arthur's lessons"). A new player is
// asked about the lessons; plays a little in the new client first (a farm
// from the shop, a unit walked somewhere), is asked again on reloading,
// then opens the classic game: Ruffle opens the same empire and asks for
// the farm's picture, so it found the farm the new client built. No server
// errors on the way. Another player skips them: the save has the first half
// done, and the question doesn't come back. (The lessons themselves:
// lessons.mjs.)

import assert from "node:assert/strict";

const FARM_AT = [56, 56], KNIGHT_AT = [50, 44], TO = [55, 60];

export default async function classic({ newPlayer }) {
  const player = await newPlayer({ lessons: true });
  const { page } = player;
  assert.match(await player.bar(), /^Arthur teaches the first steps/);

  // In the new client.
  await page.keyboard.press("Escape");
  await player.menu("Build");
  await player.press("Resources");
  await player.card("Farm Land").click();
  await player.tapTile(FARM_AT);
  await player.press("Done");
  await player.select(KNIGHT_AT, "Light Knight");
  await player.tapTile(TO);
  await player.wait(6000);
  const saved = await player.saved();
  assert.ok(saved.items.some((i) => i[0] === 10 && i[1] === FARM_AT[0] && i[2] === FARM_AT[1]), "the farm is in the save");

  // Asked again; then the classic game, on the same empire.
  await player.reload();
  assert.match(await player.bar(), /^Arthur teaches the first steps/);
  const asked = [];
  const failed = [];
  page.on("request", (request) => asked.push(request.url()));
  page.on("response", (response) => {
    if (response.url().startsWith(player.base) && response.status() >= 500) failed.push(`${response.status()} ${response.url()}`);
  });
  const started = Date.now();
  await page.getByRole("link", { name: "Classic game" }).click();
  await page.waitForURL(/\/ruffle\.html$/);
  while (!asked.some((url) => url.includes("/granja3.")) && Date.now() - started < 240_000) {
    await player.wait(2000);
  }
  await player.wait(5000);
  await player.shot("classic");
  const fromServer = asked.filter((url) => url.startsWith(player.base)).map((url) => new URL(url).pathname.split("/").pop());
  assert.ok(fromServer.includes("get_game_config.php") && fromServer.includes("get_player_info.php"),
    `the classic game asked for the config and the town: ${fromServer}`);
  assert.ok(asked.some((url) => url.includes("/granja3.")), `the classic game drew the farm the new client built (${((Date.now() - started) / 1000).toFixed(0)} s)`);
  assert.deepEqual(failed, [], "no server errors");
  console.log(`  the classic game opened the empire in ${((Date.now() - started) / 1000).toFixed(0)} s`);

  // Skipping them: done in the save, as when the classic game's last lesson closes; not asked again.
  const skipper = await newPlayer();  // the test helper answers "Skip them"
  const info = await skipper.page.request.post(`${skipper.base}${skipper.settings.dynamicUrl}/get_player_info.php`,
    { form: { USERID: skipper.settings.userId, user_key: skipper.settings.userKey } });
  assert.equal(Number((await info.json()).playerInfo.completed_tutorial), 15);
  await skipper.reload();
  assert.equal(await skipper.bar(), "", "not asked again");
}
