// A real copied-army match, then a restarted attempt and surrender on a
// phone. Service failures exercise result retry/reload without double scores.
import assert from "node:assert/strict";
import { PHONE } from "../lib.mjs";
import { padded, prepare, open, join, service, playerInfo, tournamentPath, requestData } from "../tournament-lib.mjs";

const KNIGHT = 514, SWORD = 511;

export default async function tournamentBattle({ newPlayer }) {
  const player = await newPlayer();
  await prepare(player, padded(KNIGHT, KNIGHT, KNIGHT));
  await player.send([
    { cmd: "rt_level_up", args: [49] },
    { cmd: "store_add_items", args: [JSON.stringify([KNIGHT, KNIGHT, KNIGHT])] },
    ...[2, 7, 16].map((id) => ({ cmd: "buy_magic", args: [id, 0, 0] })),
    { cmd: "collect_treasure", args: [750, 0, 3, 0, 0, 0] },
  ]);
  await player.reload();
  const opponents = [];
  const room = await join(player, "1", "", padded(KNIGHT, KNIGHT, KNIGHT), 5);
  for (let i = 0; i < 3; i++) {
    const foe = await newPlayer();
    await prepare(foe, padded(SWORD));
    await foe.send([{ cmd: "rt_level_up", args: [49] }]);
    assert.equal((await join(foe, "1", "", padded(SWORD), 5)).tournament_id, room.tournament_id);
    opponents.push(foe);
  }
  const before = await playerInfo(player);
  const { page } = player;
  const sent = [];
  page.on("request", (request) => {
    if (request.url().endsWith("/command.php")) sent.push(...requestData(request).commands);
  });
  await open(player);
  await page.locator(`[data-victim="${opponents[0].settings.userId}"]`).getByRole("button", { name: /^Start match against/ }).click();
  await page.waitForURL(/tournament=.*victim=/);
  await page.waitForSelector(".quest-window", { timeout: 60_000 });
  assert.equal((await service(player, "get_tournament_info")).tournament.players[0].matches[0].date_started, null,
    "loading the map does not start a timed attempt");
  await player.shot("before-start-desktop");
  await player.press("Start the match");
  await page.waitForFunction(() => window.seTournament, null, { timeout: 30_000 });
  const army = await page.evaluate(() => {
    const { player, enemy, match } = window.seTournament;
    return { mine: player.map((f) => f.item.id), enemy: enemy.map((f) => f.item.id), state: match.state };
  });
  assert.deepEqual(army.mine, [KNIGHT, KNIGHT, KNIGHT]);
  assert.deepEqual(army.enemy, [SWORD]);
  await page.waitForFunction(() => {
    const { player, screenOf } = window.seTournament;
    return player.some((unit) => { const at = screenOf(unit); return at.x > 50 && at.x < innerWidth - 50 && at.y > 150 && at.y < innerHeight - 80; });
  });
  assert.match(await page.locator(".tournament-battle-hud").textContent(), /3 units left.*1 units left/s);
  assert.ok(sent.some((command) => command.cmd === "game_status" && JSON.stringify(command.args) === JSON.stringify(["LOAD_MAP", "NORM", "TOUR"])));

  // The two prohibited spells stay visible but cannot be cast. An ordinary
  // learned spell stays usable, even though this match is won with the army.
  await player.press("Spell book");
  assert.ok(await page.getByRole("button", { name: /Cast Hell Abyss/ }).isDisabled());
  assert.ok(await page.getByRole("button", { name: /Cast Black Hole/ }).isDisabled());
  assert.ok(await page.getByRole("button", { name: /Cast Fire Havoc/ }).isEnabled());
  await player.shot("spell-book-desktop");
  await player.press("Spell book");
  await player.press("Speed 1×");
  await player.press("Speed 2×");
  await page.waitForFunction(() => window.seTournament.match.state === "waiting", null, { timeout: 60_000 });
  await player.shot("formed-desktop");

  let savedFirst;
  await page.route(tournamentPath("finish_tournament_match"), async (route) => {
    const response = await route.fetch();
    savedFirst = requestData(route.request());
    assert.equal((await response.json()).data.result, "OK");
    await route.fulfill({ response, body: "" });
  }, { times: 1 });
  // Select and issue the attack through the real controls. The test hook only
  // locates the moving rendered unit; damage, targeting and victory are real.
  await page.evaluate(() => {
    const { enemy, lookAt } = window.seTournament;
    lookAt({ x: enemy[0].tx, y: enemy[0].ty });
  });
  await page.waitForFunction(() => {
    const { enemy, screenOf } = window.seTournament;
    const at = screenOf(enemy[0]);
    return at.x > 100 && at.x < innerWidth - 100 && at.y > 180 && at.y < innerHeight - 100;
  });
  await player.press("Select all");
  const target = await page.evaluate(() => window.seTournament.screenOf(window.seTournament.enemy[0]));
  await page.mouse.click(target.x, target.y);
  await page.waitForFunction(() => window.seTournament.player.some((unit) => unit.target?.side === 2));
  await page.waitForFunction(() => window.seTournament.match.result?.won === true, null, { timeout: 120_000 });
  await page.getByRole("button", { name: "Retry saving", exact: true }).waitFor({ state: "visible", timeout: 20_000 });
  assert.ok(await player.button("Back to tournament").isDisabled(), "an unconfirmed result is not presented as saved");
  const first = (await service(player, "get_tournament_info")).tournament.players[0].matches.find((m) => m.victim_id === opponents[0].settings.userId);
  assert.equal(first.finished, true);
  assert.equal(first.attacker_won, true);
  assert.ok(first.attacker_points > 20 && first.attacker_points <= 100);
  assert.match(savedFirst.attacker_points, /^\d+\.\d{2}$/);
  assert.equal(savedFirst.victim_points, 0);
  await player.press("Retry saving");
  await page.waitForFunction(() => document.querySelector('.tournament-match-result [role="status"]')?.textContent === "Match recorded. No units lost.");
  assert.deepEqual((await service(player, "get_tournament_info")).tournament.players[0].matches.find((m) => m.victim_id === opponents[0].settings.userId), first,
    "retry keeps the first recorded score and timestamps");
  await player.shot("victory-desktop");
  await player.press("Back to tournament");
  await page.waitForURL(/client\.html\?tournaments=1$/);
  await player.loaded();
  await page.waitForSelector(".tournament-results");
  assert.equal(await page.locator(".tournament-match button[aria-label^='Start match']").count(), 2);
  const home = await playerInfo(player);
  assert.deepEqual(home.map.store, before.map.store);
  assert.deepEqual(home.privateState.teams.tournament, before.privateState.teams.tournament);
  assert.equal(home.map.coins, before.map.coins);
  assert.deepEqual(home.privateState.attacksSent, before.privateState.attacksSent, "tournaments never create town-attack reports");
  assert.ok(!sent.some((command) => ["end_attack", "unit_lost", "end_quest"].includes(command.cmd)));

  // A phone reopens the same server room. Refreshing an unfinished attempt
  // shows Start again with fresh armies; the original has no health snapshot.
  const phone = await player.onPhone();
  await open(phone, true);
  const secondId = opponents[1].settings.userId;
  await phone.page.locator(`[data-victim="${secondId}"]`).getByRole("button", { name: /^Start match against/ }).click();
  await phone.page.waitForSelector(".quest-window", { timeout: 60_000 });
  await phone.press("Start the match");
  await phone.page.waitForFunction(() => window.seTournament?.match.seconds >= 1, null, { timeout: 30_000 });
  const start = (await service(phone, "get_tournament_info")).tournament.players[0].matches.find((m) => m.victim_id === secondId);
  assert.equal(start.finished, false);
  await phone.page.reload();
  await phone.page.waitForSelector(".quest-window", { timeout: 60_000 });
  assert.equal(await phone.page.evaluate(() => !!window.seTournament), false);
  await phone.press("Start the match");
  await phone.page.waitForFunction(() => window.seTournament);
  const restarted = (await service(phone, "get_tournament_info")).tournament.players[0].matches.find((m) => m.victim_id === secondId);
  assert.ok(restarted.date_started >= start.date_started);
  assert.equal(await phone.page.evaluate(() => window.seTournament.player.every((f) => f.life === f.maxLife)), true);
  const hud = await phone.page.locator(".tournament-battle-hud").boundingBox();
  assert.ok(hud.x >= 0 && hud.x + hud.width <= PHONE.width + 1);
  await phone.shot("battle-phone");
  await phone.press("Leave the match");
  assert.equal(await phone.page.locator(".tournament-battle-hud").evaluate((el) => el.inert), true,
    "the surrender question blocks background orders and spells");
  await phone.press("Keep fighting");
  assert.equal((await service(phone, "get_tournament_info")).tournament.players[0].matches.find((m) => m.victim_id === secondId).finished, false);
  // This failure happens before the service: the tab's pending result must
  // survive a page reload and then reach the actual server once.
  await phone.page.route(tournamentPath("finish_tournament_match"), (route) => route.fulfill({ json: { data: {} } }), { times: 1 });
  await phone.press("Leave the match");
  await phone.press("Leave match");
  await phone.page.getByRole("button", { name: "Retry saving", exact: true }).waitFor({ state: "visible", timeout: 20_000 });
  assert.equal((await service(phone, "get_tournament_info")).tournament.players[0].matches.find((m) => m.victim_id === secondId).finished, false);
  await phone.page.reload();
  await phone.page.waitForFunction(() => document.querySelector('.tournament-match-result [role="status"]')?.textContent === "Match recorded. No units lost.", null, { timeout: 30_000 });
  const surrendered = (await service(phone, "get_tournament_info")).tournament.players[0].matches.find((m) => m.victim_id === secondId);
  assert.equal(surrendered.finished, true);
  assert.equal(surrendered.attacker_won, false);
  assert.equal(surrendered.attacker_points, 0);
  await phone.shot("surrender-phone");
  await phone.press("Back to tournament");
  await phone.page.waitForURL(/client\.html\?tournaments=1$/);
  await phone.loaded();
  await phone.page.waitForSelector(".tournament-results");
  assert.equal(await phone.page.locator(".tournament-match button[aria-label^='Start match']").count(), 1);
  assert.deepEqual((await playerInfo(phone)).map.store, before.map.store);
  await phone.page.context().close();
  // Closing the enrollment elsewhere while this final match is open must
  // not trap the player behind a permanently retrying result dialog.
  await page.goto(`${player.base}/client.html?tournament=${room.tournament_id}&victim=${opponents[2].settings.userId}`);
  await page.waitForSelector(".quest-window", { timeout: 60_000 });
  await player.press("Start the match");
  await page.waitForFunction(() => window.seTournament);
  await service(player, "leave_tournament", { tournament_id: room.tournament_id });
  await player.press("Leave the match");
  await player.press("Leave match");
  await page.getByRole("heading", { name: "Tournament closed", exact: true }).waitFor({ timeout: 30_000 });
  assert.match(await page.locator('.tournament-match-result [role="status"]').textContent(), /closed elsewhere/);
  assert.ok(await player.button("Back to tournament").isEnabled());
  await player.press("Back to tournament");
  await page.waitForURL(/client\.html\?tournaments=1$/);
  await player.loaded();
  await page.waitForSelector(".tournament-cards");
  for (const entrant of [player, ...opponents]) await service(entrant, "leave_tournament", { tournament_id: room.tournament_id });
}
