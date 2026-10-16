// Entry, waiting rooms and friends' tournaments use real throwaway accounts,
// fees and refunds. Only a lost response and the NOFRIENDS refusal are mocked;
// no successful room or balance change is fabricated in the browser.
import assert from "node:assert/strict";
import { FULL_TEAM, SWORD, padded, tournamentPath, requestData, playerInfo, service,
  prepare, open, confirm, gold, fitsPhone, join } from "../tournament-lib.mjs";

export default async function tournamentRooms({ newPlayer }) {
  const host = await newPlayer();
  await prepare(host, padded(SWORD));
  const { page } = host;
  const before = await playerInfo(host);
  const entries = [], commands = [], feeCommandsAtEntry = [];
  page.on("request", (request) => {
    if (request.url().endsWith("/command.php")) commands.push(...requestData(request).commands);
    if (request.url().endsWith("/tournaments/join_tournament.php")) {
      entries.push(requestData(request));
      feeCommandsAtEntry.push(commands.filter((command) => command.cmd === "tournament_substract_resources").length);
    }
  });
  const enter = () => page.locator('[data-tournament="1"]').getByRole("button", { name: "Enter tournament", exact: true }).click();

  await open(host);
  await confirm(host, enter, false);
  assert.equal((await service(host, "get_tournament_info")).tournament, null, "dismissing the short-team warning does not enter");
  assert.equal(entries.length, 0);
  await gold(host, before.map.coins);
  await confirm(host, enter);
  await page.waitForSelector(".tournament-room");
  const firstRoom = (await service(host, "get_tournament_info")).tournament;
  assert.equal(firstRoom.date_ready, null);
  assert.deepEqual(firstRoom.players[0].team, padded(SWORD));
  assert.equal(await page.locator(".tournament-seat").count(), 4);
  assert.equal(await page.locator(".tournament-empty-seat").count(), 3);
  assert.equal(await page.locator(".tournament-room .tournament-team > li").count(), 20);
  assert.equal(await page.locator(".tournament-room .tournament-team img").count(), 1);
  assert.equal(await page.locator(".tournament-room .tournament-team button").count(), 0, "the enrolled army is read-only");
  assert.ok(await host.button("Start tournament").isDisabled());
  assert.match(await page.locator(".tournament-room-refresh").textContent(), /Refresh in \d+s/);
  assert.match(await page.locator(".tournament-room").textContent(), /30 minutes/);
  await gold(host, before.map.coins - 500);
  assert.equal(entries.length, 1);
  assert.equal(feeCommandsAtEntry[0], 1, "the original bookkeeping batch precedes the entry service");
  assert.deepEqual(entries[0], { user_id: host.settings.userId, tournament_type_id: "1", category: 1,
    team: padded(SWORD), tournament_id: "", flashSubResources: 1 });
  assert.deepEqual(commands.find((command) => command.cmd === "tournament_substract_resources")?.args, ["g", 500, "1", 0]);
  await host.shot("waiting-desktop");
  await page.locator(".tournament-seat").getByRole("button", { name: host.name, exact: true }).click();
  await page.waitForSelector(".tournament-profile");
  assert.match(await page.locator(".tournament-profile").textContent(), /Level 15.*Honour:/s);
  await host.button("Close profile").click();
  assert.equal((await service(host, "get_tournament_info")).tournament.tournament_id, firstRoom.tournament_id);

  // A later saved preference cannot rewrite an already enrolled army, even
  // after the client is reloaded. Closing the window never leaves the room.
  await page.keyboard.press("Escape");
  await host.send([{ cmd: "set_attack_team", args: ["tournament", JSON.stringify(FULL_TEAM)] }]);
  await host.reload();
  await open(host);
  assert.equal((await service(host, "get_tournament_info")).tournament.tournament_id, firstRoom.tournament_id);
  assert.equal(await page.locator(".tournament-room .tournament-team img").count(), 1);
  assert.deepEqual((await playerInfo(host)).privateState.teams.tournament, FULL_TEAM);

  // Failed polling keeps the saved room and a retry, rather than silently
  // returning to the list or losing the paid seat.
  await page.route(tournamentPath("get_tournament_info"), (route) => route.fulfill({ json: { data: {} } }), { times: 1 });
  await host.button("Refresh").click();
  await page.waitForSelector(".tournament-error");
  assert.equal(await page.locator(".tournament-room").count(), 1);
  assert.match(await page.locator(".tournament-error").textContent(), /last saved room is still shown/);
  await host.button("Refresh").click();
  await page.waitForSelector(".tournament-error", { state: "detached" });
  assert.equal((await service(host, "get_tournament_info")).tournament.tournament_id, firstRoom.tournament_id);

  const phone = await host.onPhone();
  await open(phone, true);
  await fitsPhone(phone);
  assert.equal(await phone.page.locator(".tournament-room .tournament-team img").count(), 1);
  await phone.shot("waiting-phone");
  await phone.page.locator(".tournament-window .panel-body").evaluate((element) => { element.scrollTop = element.scrollHeight; });
  await phone.shot("waiting-team-phone");
  await confirm(phone, () => phone.button("Leave tournament").click(), false);
  assert.equal((await service(host, "get_tournament_info")).tournament.tournament_id, firstRoom.tournament_id);
  await confirm(phone, () => phone.button("Leave tournament").click());
  await phone.page.waitForSelector(".tournament-cards");
  await gold(phone, before.map.coins);
  await phone.page.context().close();
  await host.button("Refresh").click();
  await page.waitForSelector(".tournament-cards");
  await gold(host, before.map.coins);

  // The service really accepts entry, but its response body is lost. The
  // client must read the saved room, not send another entry or fee.
  let accepted;
  await page.route(tournamentPath("join_tournament"), async (route) => {
    const response = await route.fetch();
    accepted = (await response.json()).data;
    assert.equal(accepted.result, "OK");
    await route.fulfill({ response, body: "" });
  }, { times: 1 });
  const requestsBefore = entries.length;
  await enter();
  await page.waitForSelector(".tournament-room");
  assert.equal(entries.length, requestsBefore + 1, "a lost answer does not replay the entry mutation");
  assert.equal((await service(host, "get_tournament_info")).tournament.tournament_id, accepted.tournament.tournament_id);
  await gold(host, before.map.coins - 500);
  await confirm(host, () => host.button("Leave tournament").click());
  await page.waitForSelector(".tournament-cards");
  await gold(host, before.map.coins);

  // An old load completing after close/reopen must not replace a newer room.
  let release, fetched;
  const held = new Promise((resolve) => { release = resolve; });
  const reading = new Promise((resolve) => { fetched = resolve; });
  let heldRequest;
  await page.keyboard.press("Escape");
  await page.route(tournamentPath("get_tournament_info"), async (route) => {
    heldRequest = route.request();
    const response = await route.fetch();
    fetched();
    await held;
    await route.fulfill({ response });
  }, { times: 1 });
  await host.menu("Battle");
  await page.locator(".panel:not([hidden]) .row", { hasText: "Tournament" }).locator("a").click();
  await reading;
  await page.keyboard.press("Escape");
  const newer = await join(host);
  await open(host);
  const oldResponse = page.waitForResponse((response) => response.request() === heldRequest);
  release();
  await (await oldResponse).finished();
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
  assert.equal(await page.locator(".tournament-room").count(), 1);
  assert.equal((await service(host, "get_tournament_info")).tournament.tournament_id, newer.tournament_id);
  await confirm(host, () => host.button("Leave tournament").click());
  await page.waitForSelector(".tournament-cards");
  await gold(host, before.map.coins);

  // Three real neighbours make creation possible. The refusal fixture is
  // necessary because the full runner keeps earlier test accounts, which
  // also count as neighbours. The real three-neighbour rule has server tests.
  const friends = [];
  for (let index = 0; index < 3; index++) {
    const friend = await newPlayer();
    await prepare(friend);
    friends.push(friend);
  }
  const [guest, second, third] = friends;
  const guestBefore = await playerInfo(guest);
  await host.reload();
  await open(host);
  await host.button("Your own").click();
  await host.button("Create tournament").click();
  await page.getByRole("button", { name: "Choose type", exact: true }).first().waitFor();
  assert.equal(await page.locator(".tournament-card[data-tournament]").count(), 7, "only everyday types can be created");
  assert.ok(await host.button("Create tournament").isDisabled());
  await page.locator('[data-tournament="1"]').getByRole("button", { name: "Choose type", exact: true }).click();
  await page.route(tournamentPath("create_tournament"), (route) => route.fulfill({ json: {
    data: { result: "NOFRIENDS", resources: { refund: 1, tournament_type_id: "1" } },
  } }), { times: 1 });
  await host.button("Create tournament").click();
  await page.waitForSelector(".tournament-invite");
  assert.match(await page.locator(".tournament-error").textContent(), /3 friends/);
  assert.equal(await page.locator(".tournament-invite a").getAttribute("href"), "/friends");
  assert.equal((await service(host, "get_tournament_info")).tournament, null);
  await gold(host, before.map.coins);
  await page.locator(".tournament-invite").getByRole("button", { name: "OK", exact: true }).click();

  await host.button("Create tournament").click();
  await page.locator('[data-tournament="1"]').getByRole("button", { name: "Choose type", exact: true }).click();
  const creation = page.waitForRequest(tournamentPath("create_tournament"));
  await host.button("Create tournament").click();
  const createdPayload = requestData(await creation);
  assert.equal(createdPayload.tournament_type_id, "1");
  assert.deepEqual(createdPayload.team, FULL_TEAM);
  assert.equal(createdPayload.flashSubResources, 1);
  assert.ok(createdPayload.usersFriends.includes(guest.settings.userId));
  await page.waitForSelector(".tournament-room");
  const privateRoom = (await service(host, "get_tournament_info")).tournament;
  assert.equal(privateRoom.private, "1");
  assert.equal(privateRoom.owner_id, host.settings.userId);
  assert.deepEqual(commands.filter((command) => command.cmd === "tournament_substract_resources").at(-1).args, ["g", 500, "1", 1]);
  assert.equal(await host.button("Leave tournament").count(), 0);
  assert.ok(await host.button("Cancel tournament").isEnabled());
  await gold(host, before.map.coins - 500);
  await host.button("Invite friends").click();
  assert.match(await page.locator(".tournament-invite").textContent(), /Your own.*after a day/s);
  const friendsLink = page.locator(".tournament-invite a");
  assert.equal(await friendsLink.getAttribute("href"), "/friends");
  assert.equal(await friendsLink.getAttribute("target"), "_blank");
  assert.ok((await page.request.get(host.base + "/friends")).ok(), "the invitation has a working local Friends page");
  await host.shot("invite-desktop");
  await page.locator(".tournament-invite").getByRole("button", { name: "OK", exact: true }).click();

  // Delayed leave/cancel commands for an old room cannot abandon this new one.
  await service(host, "leave_tournament", { tournament_id: firstRoom.tournament_id });
  await service(host, "cancel_tournament", { tournament_id: firstRoom.tournament_id });
  assert.equal((await service(host, "get_tournament_info")).tournament.tournament_id, privateRoom.tournament_id);
  await gold(host, before.map.coins - 500);
  await open(guest);
  await guest.button("Your own").click();
  const friendCard = guest.page.locator(`[data-tournament="${privateRoom.tournament_id}"]`);
  assert.match(await friendCard.textContent(), new RegExp(host.name));
  const guestEntry = guest.page.waitForRequest(tournamentPath("join_tournament"));
  await friendCard.getByRole("button", { name: "Enter tournament", exact: true }).click();
  assert.equal(requestData(await guestEntry).tournament_id, privateRoom.tournament_id);
  await guest.page.waitForSelector(".tournament-room");
  assert.equal(await guest.button("Cancel tournament").count(), 0);
  assert.equal(await guest.button("Invite friends").count(), 0);
  assert.ok(await guest.button("Leave tournament").isEnabled());
  await gold(guest, guestBefore.map.coins - 500);
  await host.button("Refresh").click();
  await page.waitForFunction(() => document.querySelectorAll(".tournament-empty-seat").length === 2);
  await host.shot("friends-room-desktop");

  await confirm(host, () => host.button("Cancel tournament").click(), false);
  assert.equal((await service(guest, "get_tournament_info")).tournament.players.length, 2);
  await confirm(host, () => host.button("Cancel tournament").click());
  await page.waitForSelector(".tournament-cards");
  await gold(host, before.map.coins);
  await guest.button("Refresh").click();
  await guest.page.waitForSelector(".tournament-cards");
  await gold(guest, guestBefore.map.coins);
  assert.equal((await service(guest, "get_tournament_info")).tournament, null);
  assert.equal(await guest.page.locator(`[data-tournament="${privateRoom.tournament_id}"]`).count(), 0);
  await service(host, "cancel_tournament", { tournament_id: privateRoom.tournament_id });
  assert.equal((await playerInfo(guest)).map.coins, guestBefore.map.coins, "repeated cancellation never refunds twice");

  // The fourth actual entrant starts a public room. Refresh preserves its
  // explicit Start button; reopening on a phone goes straight to Matches.
  await host.button("Everyday").click();
  await enter();
  await page.waitForSelector(".tournament-room");
  const readyRoom = (await service(host, "get_tournament_info")).tournament;
  for (const friend of friends) assert.equal((await join(friend)).tournament_id, readyRoom.tournament_id);
  await host.button("Refresh").click();
  await page.waitForFunction(() => [...document.querySelectorAll(".tournament-room button")].some((button) => button.textContent === "Start tournament" && !button.disabled));
  assert.equal(await page.locator(".tournament-empty-seat").count(), 0);
  assert.equal((await service(host, "get_tournament_info")).tournament.players.length, 4);
  await host.shot("ready-desktop");
  await host.button("Start tournament").click();
  await page.waitForSelector(".tournament-results");
  assert.equal(await page.locator(".tournament-match").count(), 3);
  const readyPhone = await host.onPhone();
  await open(readyPhone, true);
  assert.equal(await readyPhone.page.locator(".tournament-room").count(), 0);
  assert.equal(await readyPhone.page.locator(".tournament-match").count(), 3);
  await fitsPhone(readyPhone);
  await readyPhone.shot("ready-phone");
  await readyPhone.page.context().close();
  // Leaving a started tournament consumes the entry fee and marks outgoing
  // matches lost. Opponents keep the departed player's enrolled army.
  await confirm(host, () => page.getByRole("button", { name: /^Leave tournament$/i }).click());
  await page.waitForSelector(".tournament-cards");
  await gold(host, before.map.coins - 500);
  const fromGuest = (await service(guest, "get_tournament_info")).tournament;
  const departed = fromGuest.players.find((player) => player.user_id === host.settings.userId);
  assert.equal(departed.abandonned, 1);
  assert.ok(departed.matches.every((match) => match.finished && !match.attacker_won && match.attacker_points === 0));
  assert.deepEqual(departed.team, FULL_TEAM);
  assert.deepEqual((await playerInfo(host)).map.store, before.map.store, "entering and leaving never consume home units");
  for (const friend of [guest, second, third]) await service(friend, "leave_tournament", { tournament_id: readyRoom.tournament_id });
}
