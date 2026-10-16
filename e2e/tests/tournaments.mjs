// Tournament browsing and team selection on desktop and phone. Real local
// saves/services for teams, help, active rooms and weekly reuse; closed-week
// and friends-list replies exercise states the local clock cannot schedule.
import assert from "node:assert/strict";
import { PHONE } from "../lib.mjs";

const KNIGHT = 514, SWORD = 511, BANNED = 762, LIMITED = 602;
const padded = (...ids) => [...ids, ...Array(20 - ids.length).fill(0)];

export default async function tournaments({ newPlayer }) {
  // Other feature tests use the completed mandatory-tutorial fixture.
  const player = await newPlayer();
  const { page } = player;
  const servicePath = "**/tournaments/get_tournament_info.php";
  const getInfo = async (p = player) => (await (await p.page.request.post(`${p.base}${p.settings.dynamicUrl}/get_player_info.php`,
    { form: { USERID: p.settings.userId, user_key: p.settings.userKey } })).json());
  const service = async (name, params = {}) => (await (await page.request.post(`${player.base}${player.settings.dynamicUrl}/tournaments/${name}.php`,
    { form: { USERID: player.settings.userId, user_key: player.settings.userKey,
      data: "0".repeat(64) + ";" + JSON.stringify({ user_id: player.settings.userId, ...params }) } })).json()).data;
  const open = async (p = player, phone = false) => {
    await p.menu(phone ? "World" : "Battle");
    await p.page.locator(".panel:not([hidden]) .row", { hasText: "Tournament" }).locator("a").click();
  };
  const saved = (p = player) => p.page.waitForResponse((r) => r.url().endsWith("/command.php") &&
    decodeURIComponent(r.request().postData() ?? "").includes('"set_attack_team"') && r.status() === 200, { timeout: 15_000 });

  // The original menu gate: the list service must not be called below 15.
  let reads = 0;
  page.on("request", (r) => { if (r.url().endsWith("/tournaments/get_tournament_info.php")) reads++; });
  await open();
  await player.said(/Tournaments open at level 15/);
  assert.equal(reads, 0);

  const config = await (await page.request.post(`${player.base}${player.settings.dynamicUrl}/get_game_config.php`,
    { form: { USERID: player.settings.userId, user_key: player.settings.userKey } })).json();
  const item = (id) => config.items.find((i) => Number(i.id) === id);
  const dragons = config.items.filter((i) => i.groups === "dragon" && !config.globals.TOURNAMENT_UNITS_NOT_ALLOWED.includes(Number(i.id)))
    .slice(0, 11).map((i) => Number(i.id));
  await player.send([
    { cmd: "rt_level_up", args: [15] },
    { cmd: "buy", args: [KNIGHT, 44, 48, 0, 0, 0, 1] },
    { cmd: "buy", args: [KNIGHT, 45, 48, 0, 0, 0, 1] },
    { cmd: "add_unit_warehouse", args: [45, 48, 0, KNIGHT] },
    { cmd: "buy", args: [SWORD, 46, 48, 0, 0, 0, 1] },
    { cmd: "push_unit", args: [46, 48, SWORD, 59, 49, 0] },
    { cmd: "store_add_items", args: [JSON.stringify([KNIGHT, ...Array(21).fill(SWORD), BANNED, ...Array(6).fill(LIMITED), ...dragons])] },
    { cmd: "collect_treasure", args: [750, 0, 3, 0, 0, 0] },
    { cmd: "set_attack_team", args: ["quest", JSON.stringify(padded(SWORD))] },
    { cmd: "set_attack_team", args: ["tournament", JSON.stringify([0, BANNED, KNIGHT, KNIGHT, KNIGHT, KNIGHT, 999999, SWORD])] },
  ]);
  await player.reload();
  const before = await getInfo();
  const normalized = saved();
  await open();
  await normalized;
  await page.waitForSelector(".tournament-help");
  assert.match(await page.locator(".tournament-help").textContent(), /TOURNAMENT HELP.*WON'T lose any units/s);
  assert.ok((await page.locator(".tournament-help").textContent()).includes(item(BANNED).name));
  await player.shot("help-desktop");
  await page.locator(".tournament-help").getByRole("button", { name: "OK", exact: true }).click();
  assert.equal(await page.locator(".tournament-card").count(), 7);
  const list = await service("get_tournament_info");
  const prize = config.tournament_type["1"].prize[Number(list.tournament_reward_id["1"])];
  assert.match(await page.locator('[data-tournament="1"] .tournament-fee').textContent(), /500/);
  assert.ok((await page.locator('[data-tournament="1"] .tournament-prize').textContent()).includes(item(Number(Object.keys(prize.u)[0])).name));
  await page.waitForFunction(() => [...document.querySelectorAll(".tournament-picture")].every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 30_000 })
    .catch(async (error) => { throw new Error(`${error.message}: ${JSON.stringify(await page.locator(".tournament-picture").evaluateAll((images) => images.map((i) => ({ src: i.src, complete: i.complete, width: i.naturalWidth }))))}`); });
  await player.shot("list-desktop");

  await player.press("Edit team");
  assert.match(await page.locator(".tournament-selected").textContent(), /4 \/ 20/);
  assert.equal(await page.getByRole("button", { name: `Add ${item(BANNED).name}`, exact: true }).count(), 0);
  assert.match(await page.getByRole("button", { name: `Add ${item(LIMITED).name}`, exact: true }).textContent(), /×4$/);
  assert.match(await page.getByRole("button", { name: "Add Long Swordsman", exact: true }).textContent(), /×21$/,
    "the contained swordsman and storage both count");
  assert.ok(await page.getByRole("button", { name: "Add Heavy Knight", exact: true }).isDisabled(), "all three ownership sources restored, no fourth copy");
  await page.getByRole("button", { name: "Remove Heavy Knight", exact: true }).first().click();
  assert.ok(await page.getByRole("button", { name: "Add Heavy Knight", exact: true }).isEnabled());
  await player.press("Reset");
  assert.ok(await player.button("Save team").isDisabled());
  for (const id of dragons) await page.locator(`.tournament-choice[data-unit="${id}"]`).click();
  await player.press("Save team");
  assert.match(await page.locator(".tournament-error").textContent(), /more than 10 dragons, gods and colossus/);
  await player.press("Reset");
  for (let i = 0; i < 20; i++) await page.getByRole("button", { name: "Add Long Swordsman", exact: true }).click();
  assert.match(await page.locator(".tournament-selected").textContent(), /20 \/ 20/);
  assert.ok(await page.getByRole("button", { name: "Add Heavy Knight", exact: true }).isDisabled());
  assert.ok(await page.getByRole("button", { name: "Add Long Swordsman", exact: true }).isDisabled(), "20 places even with copies left");
  await player.press("Reset");
  await page.getByRole("button", { name: "Add Heavy Knight", exact: true }).click();
  await page.getByRole("button", { name: "Add Long Swordsman", exact: true }).click();
  // Removing leaves a hole; adding fills the first free place, just as Flash.
  await page.getByRole("button", { name: "Remove Heavy Knight", exact: true }).click();
  await page.getByRole("button", { name: `Add ${item(LIMITED).name}`, exact: true }).click();
  await player.shot("team-desktop");
  await page.locator(".tournament-window .panel-body").evaluate((el) => { el.scrollTop = 0; });
  await player.shot("selected-desktop");
  const save = saved();
  await player.press("Save team");
  await save;
  await page.waitForSelector(".tournament-team-box");
  const after = await getInfo();
  assert.deepEqual(after.privateState.teams.tournament, padded(LIMITED, SWORD));
  assert.deepEqual(after.privateState.teams.quest, padded(SWORD), "quest team stays separate");
  assert.ok(after.privateState.helpMap.includes("tournamentHelp"));
  assert.equal(after.playerInfo.cash, before.playerInfo.cash);
  assert.equal(after.map.coins, before.map.coins, "browsing and saving charge no fee");
  assert.deepEqual(after.map.store, before.map.store, "team selection copies units");
  assert.deepEqual(after.map.warehousedUnits, before.map.warehousedUnits);
  assert.equal((await service("get_tournament_info")).tournament, null);

  await player.press("Weekly");
  assert.equal(await page.locator(".tournament-card").count(), 1);
  assert.match(await page.locator(".tournament-countdown").textContent(), /Ends in \d+d \d\d:\d\d:\d\d/);
  await player.press("Your own");
  assert.match(await page.locator(".tournament-cards").textContent(), /No friends' tournaments/);
  assert.ok(await page.getByRole("button", { name: "Create tournament", exact: true }).isEnabled());
  assert.equal(await page.locator(".tournament-window a[href*=ruffle]").count(), 0);
  assert.equal(await page.locator(".tournament-unavailable").count(), 0, "friends creation is implemented");

  // Read-only fixtures for closed schedules and a friend's card, with text treated as text.
  await page.route(servicePath, async (route) => {
    const response = await route.fetch();
    const reply = await response.json();
    reply.data.tournament_weekly["8"] = { open: "0", full: "0", timeLeft: 90 };
    reply.data.tournament_friends = [{ tournament_id: "friend-room", tournament_type_id: "1", reward_id: 2, owner: "<Friend>" }];
    await route.fulfill({ response, json: reply });
  });
  await player.press("Refresh");
  await page.waitForSelector('[data-tournament="friend-room"]');
  assert.ok((await page.locator('[data-tournament="friend-room"]').textContent()).includes("<Friend>'s tournament"));
  await player.shot("own-desktop");
  await player.press("Weekly");
  assert.match(await page.locator(".tournament-countdown").textContent(), /Available on 0d 00:01:/);
  assert.ok(await page.getByRole("button", { name: "Enter tournament", exact: true }).isDisabled(), "a closed weekly schedule cannot be entered");
  assert.equal(await page.locator(".tournament-window a[href*=ruffle]").count(), 0);
  assert.equal(await page.locator(".tournament-unavailable").count(), 0, "closed schedules use the implemented entry control");
  await page.unroute(servicePath);

  // A malformed response gives retry; retry really reads again.
  await page.route(servicePath, (route) => route.fulfill({ json: { data: {} } }), { times: 1 });
  await player.press("Refresh");
  await page.waitForSelector(".tournament-error");
  assert.equal(await page.locator(".tournament-window a[href*=ruffle]").count(), 0);
  await player.press("Try again");
  await page.waitForSelector(".tournament-team-box");
  assert.equal(await page.locator(".tournament-help").count(), 0);
  await page.keyboard.press("Escape");

  // Same real save on a phone; neither a first-time help repeat nor horizontal overflow.
  const phone = await player.onPhone();
  await open(phone, true);
  await phone.page.waitForSelector(".tournament-team-box");
  assert.equal(await phone.page.locator(".tournament-help").count(), 0);
  await phone.press("Edit team");
  assert.match(await phone.page.locator(".tournament-selected").textContent(), /2 \/ 20/);
  await phone.page.getByRole("button", { name: "Add Heavy Knight", exact: true }).click();
  await phone.page.locator(".tournament-window .panel-body").evaluate((el) => { el.scrollTop = 0; });
  await phone.shot("team-phone");
  const box = await phone.page.locator(".tournament-window").boundingBox();
  assert.ok(box.x >= 0 && box.x + box.width <= PHONE.width + 1);
  assert.equal(await phone.page.locator(".tournament-window .panel-body").evaluate((el) => el.scrollWidth <= el.clientWidth), true);
  const phoneSave = saved(phone);
  await phone.press("Save team");
  await phoneSave;
  await phone.page.waitForSelector(".tournament-team-box");
  assert.deepEqual((await getInfo(phone)).privateState.teams.tournament, padded(LIMITED, SWORD, KNIGHT));
  await phone.press("Weekly");
  await phone.shot("weekly-phone");
  await phone.page.keyboard.press("Escape");

  // An actual server room reopens at its ready matches, never replaced or cleaned.
  const joined = await service("join_tournament", { tournament_type_id: "8", category: 1, tournament_id: "", team: padded(LIMITED, SWORD, KNIGHT), flashSubResources: 1 });
  assert.equal(joined.result, "OK");
  await open();
  await page.waitForSelector(".tournament-results");
  assert.equal(await page.locator(".tournament-match").count(), 3, "three real server opponents are ready");
  assert.equal(await page.getByRole("button", { name: "Edit team", exact: true }).count(), 0, "the enrolled team cannot be edited");
  assert.equal(await page.locator(".tournament-window a[href*=ruffle]").count(), 0);
  assert.equal(await page.locator(".tournament-unavailable").count(), 0, "ready rooms use the implemented matches view");
  assert.equal((await service("get_tournament_info")).tournament.tournament_id, joined.tournament.tournament_id);
  await player.shot("existing-room");
  await service("leave_tournament", { tournament_id: joined.tournament.tournament_id });
  await page.keyboard.press("Escape");
  await open();
  await page.waitForSelector(".tournament-team-box");
  assert.deepEqual((await getInfo()).privateState.teams.tournament, padded(LIMITED, SWORD, KNIGHT),
    "reopening on desktop preserves the team saved from the phone");
  await player.press("Weekly");
  assert.equal(await page.locator(".tournament-card").count(), 0, "an entered weekly tournament stays hidden after leaving");

  // The phone acquires another copy after the desktop loaded. Its saved team
  // must be checked against fresh ownership, not pruned by the old town view.
  await phone.send([
    { cmd: "store_add_items", args: [JSON.stringify([KNIGHT])] },
    { cmd: "set_attack_team", args: ["tournament", JSON.stringify(padded(KNIGHT, KNIGHT, KNIGHT, KNIGHT))] },
  ]);
  await page.keyboard.press("Escape");
  await open();
  await page.waitForSelector(".tournament-team-box");
  assert.deepEqual((await getInfo()).privateState.teams.tournament, padded(KNIGHT, KNIGHT, KNIGHT, KNIGHT),
    "new ownership and the saved team from another tab are refreshed together");
  assert.equal(await page.locator(".tournament-team-box .tournament-team img").count(), 4);
  await phone.send([{ cmd: "sell_stored_item", args: [KNIGHT, 0] }]);
  const goldAfterSale = (await getInfo()).map.coins;
  await player.press("Everyday");
  await page.locator('[data-tournament="1"]').getByRole("button", { name: "Enter tournament", exact: true }).click();
  await page.waitForSelector(".tournament-error");
  assert.match(await page.locator(".tournament-error").textContent(), /available units have changed/);
  assert.equal((await service("get_tournament_info")).tournament, null, "entry rechecks ownership changed while the list stayed open");
  assert.equal((await getInfo()).map.coins, goldAfterSale, "rejected ownership takes no entry fee");
  await player.press("Edit team");
  await page.waitForSelector(".tournament-selected");
  assert.match(await page.locator(".tournament-selected").textContent(), /3 \/ 20/);
  await phone.send([{ cmd: "sell_stored_item", args: [KNIGHT, 0] }]);
  await player.press("Save team");
  await page.waitForSelector(".tournament-error");
  assert.match(await page.locator(".tournament-error").textContent(), /available units have changed/);
  assert.deepEqual((await getInfo()).privateState.teams.tournament, padded(KNIGHT, KNIGHT, KNIGHT, KNIGHT),
    "the editor does not save a team invalidated while it was open");
  await player.press("Cancel");

  // The classic routes still share this save, but launch choices stay hidden.
  // Their direct routes are covered separately by classic.mjs.
  await player.press("Your own");
  assert.equal(await page.getByRole("link", { name: /classic/i }).count(), 0);

  // A saved battle-return URL must not open tournaments over mandatory
  // lessons. Start from the saved final choice, then complete it normally.
  for (const finished of [player, phone]) {
    if (!await finished.page.locator(".pause-curtain").count()) await finished.press("Pause");
  }
  const learner = await newPlayer({ lessons: true });
  await learner.page.waitForFunction(() => window.seLessons?.at === 0);
  assert.equal(await learner.page.evaluate(() => window.seHome.parts.commands.flush()), true);
  await learner.send([
    { cmd: "rt_level_up", args: [15] },
    { cmd: "store_add_items", args: [JSON.stringify([SWORD])] },
    { cmd: "set_attack_team", args: ["tournament", JSON.stringify(padded(SWORD))] },
    { cmd: "complete_tutorial", args: [32, { trees: 3 }] },
  ]);
  let lessonTournamentRequests = 0;
  learner.page.on("request", (request) => {
    if (new URL(request.url()).pathname.includes("/tournaments/")) lessonTournamentRequests++;
  });
  await learner.page.goto(`${learner.base}/client.html?tournaments=1`);
  await learner.loaded();
  await learner.page.waitForSelector(".draggy-window.choose");
  assert.ok(await learner.page.locator('.menus button[aria-label="Battle"]').isDisabled());
  assert.equal(lessonTournamentRequests, 0, "the return URL makes no tournament service request during lessons");
  assert.equal(await learner.page.locator(".tournament-window:not([hidden])").count(), 0);
  assert.deepEqual((await getInfo(learner)).privateState.teams.tournament, padded(SWORD));
  await learner.page.getByRole("button", { name: "Select Green Draggy", exact: true }).click();
  await learner.page.waitForSelector(".draggy-window.reminder", { timeout: 30_000 });
  assert.equal(lessonTournamentRequests, 0, "the final reminder still belongs to the tutorial");
  assert.equal(await learner.page.locator(".tournament-window:not([hidden])").count(), 0);
  await learner.page.locator(".draggy-ok").click();
  await learner.closeLevelUps();
  await learner.page.waitForSelector(".tournament-team-box", { timeout: 30_000 });
  assert.equal(lessonTournamentRequests, 1, "the preserved return intent opens the tournament once after completion");
  assert.ok(await learner.page.locator('.menus button[aria-label="Battle"]').isEnabled());
  const learned = await getInfo(learner);
  assert.equal(Number(learned.playerInfo.completed_tutorial), 33);
  assert.deepEqual(learned.privateState.teams.tournament, padded(SWORD));
  await learner.shot("after-mandatory-lessons");

  // Ordinary returns also wait for a slow welcome read and the real social
  // gift it finds; closing Gifts then restores the saved room exactly once.
  await learner.press("Pause");
  for (const [one, other] of [[player, learner], [learner, player]]) {
    const asked = await one.page.request.post(`${one.base}/friends/ask`,
      { form: { username: other.name, csrf: await one.csrf() } });
    assert.ok(asked.ok());
  }
  const giftState = await (await learner.page.request.get(`${learner.base}/gifts/game?empire=${encodeURIComponent(learner.settings.userId)}`)).json();
  const recipient = giftState.friends.find((friend) => friend.username === player.name);
  assert.ok(recipient && giftState.free.length > 0);
  const gift = await learner.page.request.post(`${learner.base}/gifts/game?empire=${encodeURIComponent(learner.settings.userId)}`,
    { form: { action: "free", friend: String(recipient.id), item: String(giftState.free[0].id), csrf: await learner.csrf() } });
  assert.ok((await gift.json()).ok);
  // The earlier weekly entry spent its fee. Fund this separate room through
  // a real command; one treasure is capped at 750 gold by the server.
  const returnFee = Number(config.tournament_type["1"].cost);
  const beforeReturnFunding = (await getInfo()).map.coins;
  await player.send([{ cmd: "collect_treasure", args: [returnFee, 0, 3, 0, 0, 0] }]);
  const beforeReturnEntry = (await getInfo()).map.coins;
  assert.equal(beforeReturnEntry, beforeReturnFunding + returnFee, "the welcome-return fixture funds its entry fee");
  const returnRoom = await service("join_tournament", { tournament_type_id: "1", category: 1, tournament_id: "", team: padded(SWORD), flashSubResources: 1 });
  assert.equal(returnRoom.result, "OK");
  const returnBalance = (await getInfo()).map.coins;
  assert.equal(returnBalance, beforeReturnEntry - returnFee, "creating the return room charges its fee exactly once");
  let releaseWelcome, welcomeRead;
  const welcomeHeld = new Promise((resolve) => { releaseWelcome = resolve; });
  const welcomeReading = new Promise((resolve) => { welcomeRead = resolve; });
  await page.route("**/gifts/game?**", async (route) => {
    const response = await route.fetch();
    welcomeRead();
    await welcomeHeld;
    await route.fulfill({ response });
  }, { times: 1 });
  const readsBeforeReturn = reads;
  await page.goto(`${player.base}/client.html?tournaments=1`);
  await player.loaded();
  await welcomeReading;
  try {
    assert.equal(reads, readsBeforeReturn, "ordinary return waits for the welcome read before requesting tournaments");
    assert.equal(await page.locator(".tournament-window:not([hidden])").count(), 0);
  } finally { releaseWelcome(); }
  const giftWindow = page.locator(".panel.gifts-window:not([hidden])");
  await giftWindow.getByRole("button", { name: `Take ${giftState.free[0].name}`, exact: true }).waitFor();
  assert.equal(reads, readsBeforeReturn, "the gift window is not replaced by the returning tournament");
  await giftWindow.getByRole("button", { name: "Close window", exact: true }).click();
  await page.waitForSelector(".tournament-room", { timeout: 30_000 });
  assert.equal(reads, readsBeforeReturn + 1);
  assert.equal((await service("get_tournament_info")).tournament.tournament_id, returnRoom.tournament.tournament_id);
  assert.equal((await getInfo()).map.coins, returnBalance, "returning neither repeats the fee nor leaves the saved room");
  await player.shot("after-welcome-gift");
}
