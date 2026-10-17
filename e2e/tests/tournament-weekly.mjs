// All three configured weekly armies load with their original art. The first
// exercises the automatic advance, then all three real matches are recorded.
import assert from "node:assert/strict";
import { PHONE } from "../lib.mjs";
import { prepare, open, gameConfig, service, playerInfo, fitsPhone } from "../tournament-lib.mjs";

export default async function tournamentWeekly({ newPlayer }) {
  const player = await newPlayer({ viewport: PHONE, phone: true });
  await prepare(player);
  const { page } = player;
  const config = await gameConfig(player);
  const before = await playerInfo(player);
  await open(player, true);
  await player.press("Weekly");
  const enter = () => page.locator('[data-tournament="8"]').getByRole("button", { name: "Enter tournament", exact: true }).click();
  // Entry refreshes the town asynchronously, so the clock can cross the
  // final-ten-minutes boundary after the card was displayed. Accept only
  // the original weekly warning while this entry is in progress.
  const weeklyWarning = config.localization_strings.find((word) => Number(word.id) === 1298)?.text.trim();
  assert.ok(weeklyWarning, "the original weekly warning is configured");
  const entryDialogs = [];
  const acceptWeeklyWarning = async (dialog) => {
    const prompt = { type: dialog.type(), message: dialog.message() };
    entryDialogs.push(prompt);
    if (prompt.type === "confirm" && prompt.message === weeklyWarning) await dialog.accept();
    else await dialog.dismiss();
  };
  page.on("dialog", acceptWeeklyWarning);
  try {
    await enter();
    await page.waitForSelector(".tournament-results");
  } finally {
    page.off("dialog", acceptWeeklyWarning);
    for (const prompt of entryDialogs) assert.deepEqual(prompt, { type: "confirm", message: weeklyWarning });
  }
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
    assert.ok(await page.locator(".tournament-battle-hud button").evaluateAll((buttons) =>
      buttons.every((button) => button.getBoundingClientRect().height >= 44)), "phone battle controls have full touch targets");
    await page.locator(".tournament-battle-army.enemy").click();
    await page.waitForFunction(() => {
      const { enemy, screenOf } = window.seTournament;
      return enemy.some((unit) => { const at = screenOf(unit); return at.x > 20 && at.x < innerWidth - 20 && at.y > 180 && at.y < innerHeight - 60; });
    });
    await player.shot(`weekly-army-${index + 1}-phone`);
    if (index === 0) {
      // Exactly 720px in landscape uses the shared HUD's phone breakpoint.
      // Pause the real match during layout checks, then restore the phone
      // before observing formation and the timed advance below.
      await player.press("Pause");
      await page.setViewportSize({ width: 720, height: 600 });
      await page.waitForFunction(() => innerWidth === 720 && innerHeight === 600 && matchMedia("(orientation: landscape)").matches);
      const layout = await page.locator(".tournament-battle-hud").evaluate((hud) => {
        const bounds = hud.getBoundingClientRect();
        return {
          direction: getComputedStyle(hud).flexDirection,
          controls: getComputedStyle(hud.querySelector(".hud-buttons")).display,
          x: bounds.x, right: bounds.right, height: bounds.height,
          fits: hud.scrollWidth <= hud.clientWidth,
          buttons: [...hud.querySelectorAll("button")].map((button) => {
            const box = button.getBoundingClientRect();
            return { name: button.getAttribute("aria-label") ?? button.textContent,
              x: box.x, right: box.right, width: box.width, height: box.height };
          }),
        };
      });
      assert.equal(layout.direction, "column", "720px landscape uses the compact battle HUD");
      assert.equal(layout.controls, "flex", "battle controls stay in their own row at the shared phone breakpoint");
      assert.ok(layout.x >= 0 && layout.right <= 721 && layout.fits, "the landscape HUD has no horizontal overflow");
      assert.ok(layout.height <= 160, "the landscape controls leave room for the battlefield");
      for (const button of layout.buttons) {
        assert.ok(button.x >= 0 && button.right <= 721, `${button.name} fits in the landscape viewport`);
        assert.ok(button.width >= 44 && button.height >= 44, `${button.name} keeps a full touch target in landscape`);
      }
      await player.press("Resume");
      await page.waitForSelector(".pause-curtain", { state: "detached" });
      await player.shot("weekly-battle-720-landscape");
      await page.setViewportSize(PHONE);
      await page.waitForFunction(({ width, height }) => innerWidth === width && innerHeight === height, PHONE);
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
