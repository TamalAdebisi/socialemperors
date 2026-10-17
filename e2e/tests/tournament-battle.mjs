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
  // As in playthrough-controls: withhold animation frames while hidden,
  // so the independent GameLoop timer must advance the actual battle.
  await player.page.addInitScript(() => {
    window.testHidden = false;
    Object.defineProperty(document, "hidden", { get: () => window.testHidden });
    const request = window.requestAnimationFrame.bind(window);
    const pending = [];
    window.requestAnimationFrame = (run) => request((time) => {
      if (window.testHidden) pending.push(run);
      else run(time);
    });
    window.changeTestVisibility = (hidden) => {
      window.testHidden = hidden;
      document.dispatchEvent(new Event("visibilitychange"));
      if (!hidden) for (const run of pending.splice(0)) request(run);
    };
  });
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
  assert.equal(await page.locator(".battle-selection").count(), 0, "the start dialog has no active battle inspector");
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

  const beforeHidden = await page.evaluate(() => {
    window.dispatchEvent(new Event("blur"));
    window.changeTestVisibility(true);
    return window.seTournament.battle.frame;
  });
  await page.waitForFunction((before) => window.seTournament.battle.frame >= before + 60, beforeHidden,
    { timeout: 20_000, polling: 100 });
  assert.equal(await page.locator(".pause-curtain").count(), 0, "switching tabs does not pause a tournament");
  const hiddenClock = await page.evaluate(() => ({
    label: document.querySelector(".tournament-battle-clock").getAttribute("aria-label"),
    seconds: window.seTournament.match.seconds,
  }));
  assert.equal(hiddenClock.label, `Match time ${hiddenClock.seconds} seconds`, "the hidden match updates its displayed clock");
  const returned = await page.evaluate(async () => {
    window.changeTestVisibility(false);
    const frame = window.seTournament.battle.frame;
    const at = performance.now();
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return { frames: window.seTournament.battle.frame - frame, elapsed: performance.now() - at };
  });
  assert.ok(returned.frames <= Math.ceil(returned.elapsed * 30 / 1000) + 2,
    `returning must not replay hidden time (${returned.frames} frames in ${returned.elapsed}ms)`);
  await player.press("Pause");
  const paused = await page.evaluate(() => window.seTournament.battle.frame);
  await page.evaluate(() => window.changeTestVisibility(true));
  // An independent timer checks the absence of progress during explicit Pause.
  await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 1000)));
  assert.equal(await page.evaluate(() => window.seTournament.battle.frame), paused);
  await page.evaluate(() => window.changeTestVisibility(false));
  assert.ok(await page.locator(".pause-curtain").isVisible(), "visibility changes preserve explicit Pause");
  await player.press("Resume");
  await page.waitForFunction((before) => window.seTournament.battle.frame > before, paused);

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

  // The shared inspector works with the tournament's copied army. Portraits
  // inspect one unit; Escape clears it without issuing an order.
  await player.press("Select all");
  await assertGroup(page);
  await page.locator(".battle-selection-roster button").first().click();
  await assertInspection(page, "player", 0);
  await player.shot("inspect-desktop");
  await page.keyboard.press("Escape");
  assert.equal(await page.evaluate(() => window.seTournament.view.selected.size), 0);
  assert.ok(await page.locator(".battle-selection").isHidden());

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
  const inspected = await page.evaluate(() => window.seTournament.screenOf(window.seTournament.enemy[0]));
  await clickUnit(page, inspected);
  await assertInspection(page, "enemy", 0);
  assert.equal(await page.evaluate(() => window.seTournament.player.some((unit) => unit.target?.side === 2)), false,
    "inspecting an opponent with no troops selected does not order an attack");
  await player.press("Select all");
  const target = await page.evaluate(() => window.seTournament.screenOf(window.seTournament.enemy[0]));
  await clickUnit(page, target);
  await page.waitForFunction(() => window.seTournament.player.some((unit) => unit.target?.side === 2));
  await player.press("Spell book");
  await player.press("Open book");
  await page.waitForSelector(".panel.spells:not([hidden])");
  await page.locator(".spell-mana").click();
  await page.getByRole("heading", { name: "Wizard's Resources Bank", exact: true }).waitFor();
  await page.waitForFunction(() => window.seTournament.match.result?.won === true, null, { timeout: 120_000 });
  await page.getByRole("button", { name: "Retry saving", exact: true }).waitFor({ state: "visible", timeout: 20_000 });
  assert.equal(await page.locator(".panel.spells:not([hidden])").count(), 0, "a finished battle closes its spell academy");
  assert.equal(await page.getByRole("heading", { name: "Wizard's Resources Bank", exact: true }).count(), 0,
    "a finished battle closes its mana bank before saving the result");
  assert.equal(await page.locator(".battle-selection").count(), 0, "a finished battle removes its inspector before saving");
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
  await phone.button("Select all").tap();
  await assertGroup(phone.page);
  await assertPhoneInspectionFits(phone.page);
  await phone.shot("selection-phone");
  await phone.page.locator(".battle-selection-roster button").first().tap();
  await assertInspection(phone.page, "player", 0);
  await assertPhoneInspectionFits(phone.page);
  await phone.shot("inspect-phone");
  await phone.button("Deselect").tap();
  assert.equal(await phone.page.evaluate(() => window.seTournament.view.selected.size), 0);
  assert.ok(await phone.page.locator(".battle-selection").isHidden());
  await phone.button("Select all").tap();
  const selectedBeforeQuestion = await phone.page.evaluate(() => [...window.seTournament.view.selected].map((unit) => unit.key));
  const deselect = await phone.button("Deselect").boundingBox();
  await phone.press("Leave the match");
  assert.equal(await phone.page.locator(".tournament-battle-hud").evaluate((el) => el.inert), true,
    "the surrender question blocks background orders and spells");
  assert.equal(await phone.page.locator(".battle-selection").evaluate((el) => el.inert), true,
    "the surrender question also blocks the battle inspector");
  await phone.page.touchscreen.tap(deselect.x + deselect.width / 2, deselect.y + deselect.height / 2);
  await phone.page.keyboard.press("Escape");
  assert.deepEqual(await phone.page.evaluate(() => [...window.seTournament.view.selected].map((unit) => unit.key)), selectedBeforeQuestion,
    "background touch and dialog Escape leave the paused army selection unchanged");
  assert.ok(await phone.button("Keep fighting").isVisible());
  await phone.press("Keep fighting");
  assert.equal(await phone.page.locator(".battle-selection").evaluate((el) => el.inert), false);
  await phone.button("Deselect").tap();
  assert.equal(await phone.page.evaluate(() => window.seTournament.view.selected.size), 0,
    "Keep fighting restores the inspector's touch controls");
  assert.equal((await service(phone, "get_tournament_info")).tournament.players[0].matches.find((m) => m.victim_id === secondId).finished, false);
  // This failure happens before the service: the tab's pending result must
  // survive a page reload and then reach the actual server once.
  await phone.page.route(tournamentPath("finish_tournament_match"), (route) => route.fulfill({ json: { data: {} } }), { times: 1 });
  await phone.button("Select all").tap();
  await phone.press("Leave the match");
  await phone.press("Leave match");
  await phone.page.getByRole("button", { name: "Retry saving", exact: true }).waitFor({ state: "visible", timeout: 20_000 });
  assert.equal(await phone.page.locator(".battle-selection").count(), 0, "surrender also removes the inspector before retrying a result");
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

async function assertGroup(page) {
  assert.deepEqual(await page.evaluate(() => [...window.seTournament.view.selected].map((unit) => unit.key)),
    await page.evaluate(() => window.seTournament.player.map((unit) => unit.key)));
  assert.match(await page.locator(".battle-selection").textContent(), /3 units selected/);
  assert.equal(await page.locator(".battle-selection-roster button").count(), 3);
  await page.waitForFunction(() => {
    const images = [...document.querySelectorAll(".battle-selection-roster img")];
    return images.length === 3 && images.every((image) => image.complete && image.naturalWidth > 0);
  });
}

async function clickUnit(page, point) {
  // Match the shared selection check: let the initial hover render before
  // pressing, so slow software drawing does not turn a click into a hold.
  await page.mouse.move(point.x, point.y);
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.mouse.click(point.x, point.y);
}

async function assertInspection(page, side, index) {
  const expected = await page.evaluate(({ side, index }) => {
    const unit = window.seTournament[side][index];
    return { key: unit.key, text: `${unit.item.name} · ${Math.ceil(unit.life)}/${unit.maxLife} health · ${unit.attack} attack` };
  }, { side, index });
  assert.deepEqual(await page.evaluate(() => [...window.seTournament.view.selected].map((unit) => unit.key)), [expected.key]);
  assert.equal(await page.locator(".battle-selection > span").textContent(), expected.text);
  assert.equal(await page.locator(".battle-selection-roster button").count(), 0);
}

async function assertPhoneInspectionFits(page) {
  const layout = await page.evaluate(() => {
    const selection = document.querySelector(".battle-selection").getBoundingClientRect();
    const hud = document.querySelector(".tournament-battle-hud").getBoundingClientRect();
    const book = document.querySelector(".spell-book").getBoundingClientRect();
    return { left: selection.left, right: selection.right, top: selection.top, bottom: selection.bottom,
      hudBottom: hud.bottom, bookTop: book.top, width: innerWidth };
  });
  assert.ok(layout.left >= 0 && layout.right <= layout.width, "the inspector fits across the phone");
  assert.ok(layout.top >= layout.hudBottom, "the inspector leaves the battle HUD uncovered");
  assert.ok(layout.bottom <= layout.bookTop, "the inspector leaves the closed spell controls uncovered");
}
