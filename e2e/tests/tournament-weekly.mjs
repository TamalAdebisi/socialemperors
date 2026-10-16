// All three configured weekly armies load with their original art. The first
// exercises the automatic advance, then all three real matches are recorded.
import assert from "node:assert/strict";
import { PHONE } from "../lib.mjs";
import { prepare, open, confirm, gameConfig, service, playerInfo, fitsPhone } from "../tournament-lib.mjs";

export default async function tournamentWeekly({ newPlayer }) {
  const player = await newPlayer({ viewport: PHONE, phone: true });
  await prepare(player);
  const { page } = player;
  const config = await gameConfig(player);
  const before = await playerInfo(player);
  await open(player, true);
  await player.press("Weekly");
  const enter = () => page.locator('[data-tournament="8"]').getByRole("button", { name: "Enter tournament", exact: true }).click();
  // The suite may run in the original final-ten-minutes warning interval.
  const available = (await service(player, "get_tournament_info")).tournament_weekly["8"];
  if (Number(available.timeLeft) <= 600) await confirm(player, enter);
  else await enter();
  await page.waitForSelector(".tournament-results");
  const room = (await service(player, "get_tournament_info")).tournament;
  assert.equal(room.players.length, 4);
  for (const [index, opponent] of room.players.slice(1).entries()) {
    await page.locator(`[data-victim="${opponent.user_id}"]`).getByRole("button", { name: /^Start match against/ }).click();
    await page.waitForSelector(".quest-window", { timeout: 60_000 });
    assert.equal(await player.button("Start the match").count(), 1, "the configured army's pictures loaded");
    await player.press("Start the match");
    await page.waitForFunction(() => window.seTournament, null, { timeout: 30_000 });
    const ids = await page.evaluate(() => window.seTournament.enemy.map((unit) => unit.item.id));
    assert.deepEqual(ids, config.tournament_type["8"].weekly_opponent[opponent.user_id].team.filter(Boolean));
    assert.equal(await page.locator(".tournament-battle-army.enemy").textContent(), `${opponent.user_name}20 units left`);
    assert.equal(await page.locator(".tournament-battle-hud").evaluate((el) => el.scrollWidth <= el.clientWidth), true);
    assert.ok((await page.locator(".tournament-battle-hud").boundingBox()).height <= 160, "the phone controls leave room to play");
    await page.locator(".tournament-battle-army.enemy").click();
    await page.waitForFunction(() => {
      const { enemy, screenOf } = window.seTournament;
      return enemy.some((unit) => { const at = screenOf(unit); return at.x > 20 && at.x < innerWidth - 20 && at.y > 180 && at.y < innerHeight - 60; });
    });
    await player.shot(`weekly-army-${index + 1}-phone`);
    if (index === 0) {
      await player.press("Speed 1×");
      await player.press("Speed 2×");
      await page.waitForFunction(() => window.seTournament.match.state === "waiting", null, { timeout: 60_000 });
      const formed = await page.evaluate(() => ({ frame: window.seTournament.battle.frame,
        target: window.seTournament.enemy.some((unit) => unit.target?.side === 1) }));
      assert.equal(formed.target, false, "weekly defenders form before their timed advance");
      await page.waitForFunction(() => window.seTournament.match.state === "fighting", null, { timeout: 30_000 });
      const charge = await page.evaluate(() => ({ frame: window.seTournament.battle.frame,
        target: window.seTournament.enemy.some((unit) => unit.target?.side === 1) }));
      assert.ok(charge.frame > formed.frame);
      assert.equal(charge.target, true, "weekly opponents advance without a player's attack order");
      await player.shot("weekly-advance-phone");
    }
    await player.press("Leave the match");
    await player.press("Leave match");
    await page.waitForFunction(() => document.querySelector('.tournament-match-result [role="status"]')?.textContent === "Match recorded. No units lost.", null, { timeout: 30_000 });
    const saved = (await service(player, "get_tournament_info")).tournament.players[0].matches.find((match) => match.victim_id === opponent.user_id);
    assert.equal(saved.finished, true);
    assert.equal(saved.attacker_won, false);
    assert.equal(saved.attacker_points, 0);
    await player.press("Back to tournament");
    await page.waitForURL(/client\.html\?tournaments=1$/);
    await player.loaded();
    await page.waitForSelector(".tournament-results");
    assert.equal(await page.locator(".tournament-match button[aria-label^='Start match']").count(), index === 2 ? 0 : 2 - index);
  }
  const finished = (await service(player, "get_tournament_info")).tournament;
  assert.ok(finished.date_finished);
  assert.equal(finished.players[0].matches.filter((match) => match.finished).length, 3);
  await page.waitForSelector(".tournament-outcome");
  await fitsPhone(player);
  await player.shot("weekly-complete-phone");
  const after = await playerInfo(player);
  assert.deepEqual(after.map.store, before.map.store, "even three defeats do not consume the copied army");
  assert.deepEqual(after.privateState.teams.tournament, before.privateState.teams.tournament);
  await player.press("Done");
  await page.waitForSelector(".tournament-cards");
  assert.equal((await service(player, "get_tournament_info")).tournament, null);
  await player.press("Weekly");
  assert.equal(await page.locator(".tournament-card").count(), 0);
}
