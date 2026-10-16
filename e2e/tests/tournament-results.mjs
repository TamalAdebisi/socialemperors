// Saved public/weekly matches, rankings, automatic rewards and acknowledgement.
// Normal services create every room and result here; combat itself is covered
// by tournament-battle. Nothing writes the server's storage files directly.
import assert from "node:assert/strict";
import { stored } from "../lib.mjs";
import { FULL_TEAM, SWORD, padded, tournamentPath, playerInfo, service, prepare, confirm,
  open, gold, fitsPhone, gameConfig, join, finish } from "../tournament-lib.mjs";

export default async function tournamentResults({ newPlayer }) {
  const players = [];
  for (let index = 0; index < 4; index++) {
    const player = await newPlayer();
    await prepare(player, index ? padded(...Array(index).fill(SWORD)) : FULL_TEAM);
    players.push(player);
  }
  const [winner, loser, third, fourth] = players;
  const { page } = winner;
  const config = await gameConfig(winner);
  const before = await playerInfo(winner);
  const losingBefore = await playerInfo(loser);
  const room = await join(winner);
  for (let index = 1; index < players.length; index++) {
    assert.equal((await join(players[index], "1", "", padded(...Array(index).fill(SWORD)))).tournament_id, room.tournament_id);
  }
  await open(winner);
  await page.waitForSelector(".tournament-results");
  assert.equal(await page.locator(".tournament-match").count(), 3);
  assert.equal(await page.locator(".tournament-match button[aria-label^='Start match against']").count(), 3);
  assert.match(await page.locator(".tournament-deadline").textContent(), /\d\d:\d\d:\d\d/);
  assert.equal(await page.locator(".tournament-team > li").count(), 20);
  assert.equal(await page.locator(".tournament-team img").count(), 20);
  await page.locator(".tournament-player-tabs").getByRole("button", { name: loser.name, exact: true }).click();
  assert.equal(await page.locator(`.tournament-match[data-attacker="${loser.settings.userId}"]`).count(), 3);
  assert.equal(await page.locator(".tournament-match button[aria-label^='Start match']").count(), 0, "another player's matches cannot be started");
  assert.match(await page.locator(".tournament-match-list").textContent(), /Pending/);
  assert.equal(await page.locator(".tournament-team img").count(), 1, "the selected player's enrolled army is shown");
  assert.equal(await page.locator(".tournament-team button").count(), 0);
  await page.locator(".tournament-player-tabs").getByRole("button", { name: "Your matches", exact: true }).click();
  await winner.shot("matches-desktop");

  // Record the winner's three matches, then check partial results before the
  // remaining human players finish. A loss still contributes its earned points.
  for (const opponent of players.slice(1)) await finish(winner, room.tournament_id, opponent.settings.userId, "90.25");
  await finish(loser, room.tournament_id, winner.settings.userId, "12.34", false);
  await winner.button("Refresh").click();
  await page.waitForFunction(() => document.querySelectorAll(".tournament-match-result").length === 3);
  assert.ok((await page.locator(".tournament-match-result").allTextContents()).every((text) => text.includes("90.25")));
  assert.equal(await page.locator(".tournament-outcome").count(), 0, "playing your own three matches does not prematurely finish a four-human room");
  await winner.button("Results").click();
  assert.equal(await page.locator(".tournament-score-row").count(), 4);
  assert.equal(await page.locator(".tournament-score-row").first().getAttribute("data-player"), winner.settings.userId);
  assert.match(await page.locator(`.tournament-score-row[data-player="${winner.settings.userId}"]`).textContent(), /270\.75/);
  assert.match(await page.locator(`.tournament-score-row[data-player="${loser.settings.userId}"]`).textContent(), /12\.34/);
  assert.equal((await playerInfo(winner)).map.coins, before.map.coins - 500, "there is no early prize");
  for (let index = 1; index < players.length; index++) {
    for (const opponent of players) {
      if (opponent === players[index] || (index === 1 && opponent === winner)) continue;
      await finish(players[index], room.tournament_id, opponent.settings.userId, `${index * 10}.00`, false);
    }
  }
  const finishedRoom = (await service(winner, "get_tournament_info")).tournament;
  assert.ok(finishedRoom.date_finished);
  assert.equal(finishedRoom.winner_id, winner.settings.userId);
  const prize = config.tournament_type["1"].prize[finishedRoom.reward_id];
  const awarded = await playerInfo(winner);
  const expectedGold = before.map.coins - 500 + Number(prize.g ?? 0);
  assert.equal(awarded.map.coins, expectedGold);
  assert.equal(awarded.playerInfo.cash, before.playerInfo.cash + Number(prize.c ?? 0));
  for (const [id, count] of Object.entries(prize.u ?? {})) {
    assert.equal(stored(awarded.privateState.gifts, Number(id)), stored(before.privateState.gifts, Number(id)) + Number(count));
  }
  assert.deepEqual(awarded.map.store, before.map.store, "enrolled units remain in home storage");
  assert.equal((await playerInfo(loser)).map.coins, losingBefore.map.coins - 500, "a losing player receives no prize");

  await winner.button("Refresh").click();
  await page.waitForSelector('.tournament-outcome[data-won="true"]');
  await gold(winner, expectedGold);
  assert.match(await page.locator(".tournament-outcome").textContent(), /prize has been awarded.*Storage/s);
  assert.equal(await winner.button("Done").count(), 1, "Done acknowledges an already paid prize");
  await winner.shot("winner-desktop");
  // Reading, reopening and retrying the already completed last match cannot
  // duplicate currency or unit rewards, or replace its first recorded score.
  await service(winner, "finish_tournament_match", { tournament_id: room.tournament_id,
    victim_id: fourth.settings.userId, attacker_won: true, attacker_points: "100.00", victim_points: 0 });
  await page.keyboard.press("Escape");
  await open(winner);
  await page.waitForSelector('.tournament-outcome[data-won="true"]');
  assert.equal((await service(winner, "get_tournament_info")).tournament.players[0].matches.at(-1).attacker_points, 90.25);
  const repeated = await playerInfo(winner);
  assert.equal(repeated.map.coins, awarded.map.coins);
  assert.deepEqual(repeated.privateState.gifts, awarded.privateState.gifts);

  const phone = await winner.onPhone();
  await open(phone, true);
  await fitsPhone(phone);
  assert.equal(await phone.page.locator('.tournament-outcome[data-won="true"]').count(), 1);
  await phone.shot("winner-phone");
  await phone.button("Matches").click();
  assert.equal(await phone.page.locator(".tournament-match-result").count(), 3);
  assert.equal(await phone.page.locator(".tournament-match button[aria-label^='Start match']").count(), 0);
  await fitsPhone(phone);
  await phone.shot("finished-matches-phone");
  await phone.button("Done").click();
  await phone.page.waitForSelector(".tournament-cards");
  assert.equal((await service(winner, "get_tournament_info")).tournament, null);
  await gold(phone, expectedGold);
  await service(winner, "clean_tournament");
  assert.deepEqual((await playerInfo(winner)).privateState.gifts, awarded.privateState.gifts);
  // The desktop still has the old result view. A different room entered on
  // the phone must replace it when refreshed, rather than reuse its old type,
  // finished state or actions with a new server room.
  await phone.page.locator('[data-tournament="1"]').getByRole("button", { name: "Enter tournament", exact: true }).click();
  await phone.page.waitForSelector(".tournament-room");
  const replacement = (await service(winner, "get_tournament_info")).tournament;
  assert.notEqual(replacement.tournament_id, room.tournament_id);
  await winner.button("Refresh").click();
  await page.waitForSelector(".tournament-room");
  assert.equal(await page.locator(".tournament-results").count(), 0);
  assert.ok(await winner.button("Start tournament").isDisabled());
  await gold(winner, expectedGold - 500);
  await confirm(phone, () => phone.button("Leave tournament").click());
  await phone.page.waitForSelector(".tournament-cards");
  await gold(phone, expectedGold);
  await phone.page.context().close();
  await winner.button("Refresh").click();
  await page.waitForSelector(".tournament-cards");

  // Rewards are usable in Storage immediately after a refresh, without a
  // browser reload or a second claim button.
  await winner.menu("Storage");
  for (const id of Object.keys(prize.u ?? {})) {
    const name = config.items.find((item) => Number(item.id) === Number(id)).name;
    await page.getByText(name, { exact: true }).last().waitFor();
    assert.equal(await winner.card(name).count(), 1);
  }
  await winner.shot("reward-storage");
  await page.keyboard.press("Escape");

  // A losing account sees the same finished table without a winner's reward.
  // If acknowledgement succeeds but its reply is lost, Refresh reconciles it.
  await open(loser);
  await loser.page.waitForSelector('.tournament-outcome[data-won="false"]');
  assert.equal(await loser.page.locator(".tournament-score-row").first().getAttribute("data-player"), winner.settings.userId);
  assert.equal(await loser.page.locator(".tournament-outcome .tournament-prize").count(), 0);
  await loser.shot("loser-desktop");
  await loser.page.route(tournamentPath("clean_tournament"), async (route) => {
    const response = await route.fetch();
    assert.equal((await response.json()).data.result, "OK");
    await route.fulfill({ response, body: "" });
  }, { times: 1 });
  await loser.button("Done").click();
  await loser.page.waitForSelector(".tournament-error");
  assert.equal((await service(loser, "get_tournament_info")).tournament, null);
  await loser.button("Refresh").click();
  await loser.page.waitForSelector(".tournament-cards");
  assert.equal((await playerInfo(loser)).map.coins, losingBefore.map.coins - 500);
  for (const player of [third, fourth]) await service(player, "clean_tournament");

  // Weekly opponents and prize information come from the server's fixed
  // teams/config. Only the current player's three matches can be selected.
  await open(winner);
  await winner.button("Weekly").click();
  await winner.button("Prizes").click();
  assert.equal(await page.locator(".tournament-prize-list > li").count(), 10);
  await winner.shot("weekly-prizes-desktop");
  await winner.button("Close prizes").click();
  const weeklyBefore = await playerInfo(winner);
  await page.locator('[data-tournament="8"]').getByRole("button", { name: "Enter tournament", exact: true }).click();
  await page.waitForSelector(".tournament-results");
  let weekly = (await service(winner, "get_tournament_info")).tournament;
  assert.equal(weekly.tournament_type_id, "8");
  assert.ok(weekly.date_ready);
  assert.equal(await page.locator(".tournament-player-tabs").count(), 0);
  assert.equal(await page.locator(".tournament-match").count(), 3);
  for (const opponent of weekly.players.slice(1)) {
    assert.deepEqual(opponent.team, config.tournament_type["8"].weekly_opponent[opponent.user_id].team);
    await finish(winner, weekly.tournament_id, opponent.user_id, "70.25");
  }
  await winner.button("Refresh").click();
  await page.waitForSelector(".tournament-outcome");
  weekly = (await service(winner, "get_tournament_info")).tournament;
  const awardedRank = weekly.ranking.user.rank;
  assert.ok(awardedRank >= 1 && awardedRank <= 10);
  const weeklyPrize = config.tournament_type["8"].prize[awardedRank - 1];
  const weeklyAwarded = await playerInfo(winner);
  await gold(winner, weeklyBefore.map.coins - 500 + Number(weeklyPrize.g ?? 0));
  for (const [id, count] of Object.entries(weeklyPrize.u ?? {})) {
    assert.equal(stored(weeklyAwarded.privateState.gifts, Number(id)), stored(weeklyBefore.privateState.gifts, Number(id)) + Number(count));
  }
  assert.match(await page.locator(".tournament-your-rank").textContent(), /210\.75/);
  assert.equal(await page.locator(".tournament-scoreboard .tournament-score-row").count(), Object.keys(weekly.ranking.top).length);
  await winner.shot("weekly-results-desktop");

  // A later entrant overtakes this player. Live ordering changes but the
  // already awarded rank, currency and unit reward stay fixed.
  const rivalWeekly = await join(loser, "8", "", padded(SWORD));
  for (const opponent of rivalWeekly.players.slice(1)) await finish(loser, rivalWeekly.tournament_id, opponent.user_id, "100.00");
  await winner.button("Refresh").click();
  await page.locator(`.tournament-score-row[data-player="${loser.settings.userId}"]`).waitFor();
  const updated = (await service(winner, "get_tournament_info")).tournament;
  assert.equal(updated.ranking.user.rank, awardedRank, "weekly prize rank is frozen at completion");
  const ranking = Object.entries(updated.ranking.top).sort(([a], [b]) => Number(a) - Number(b));
  assert.ok(ranking.findIndex(([, row]) => row.user_id === loser.settings.userId) < ranking.findIndex(([, row]) => row.user_id === winner.settings.userId));
  assert.deepEqual(await page.locator(".tournament-score-row").evaluateAll((rows) => rows.map((row) => row.dataset.player)), ranking.map(([, row]) => row.user_id));
  assert.equal((await playerInfo(winner)).map.coins, weeklyAwarded.map.coins);
  assert.deepEqual((await playerInfo(winner)).privateState.gifts, weeklyAwarded.privateState.gifts);

  const weeklyPhone = await winner.onPhone();
  await open(weeklyPhone, true);
  await fitsPhone(weeklyPhone);
  await weeklyPhone.shot("weekly-results-phone");
  assert.match(await weeklyPhone.page.locator(".tournament-outcome").textContent(), /rank when you finished/);
  await weeklyPhone.button("Done").click();
  await weeklyPhone.page.waitForSelector(".tournament-cards");
  await weeklyPhone.button("Weekly").click();
  assert.equal(await weeklyPhone.page.locator(".tournament-card").count(), 0, "finishing and acknowledging does not allow a second weekly entry");
  assert.equal((await service(winner, "get_tournament_info")).tournament_weekly["8"].full, "1");
  assert.equal((await service(winner, "join_tournament", { tournament_type_id: "8", category: 1,
    tournament_id: "", team: FULL_TEAM, flashSubResources: 1 })).result, "NOK");
  await gold(weeklyPhone, weeklyAwarded.map.coins);
  assert.deepEqual((await playerInfo(winner)).privateState.gifts, weeklyAwarded.privateState.gifts);
  await service(loser, "clean_tournament");
}
