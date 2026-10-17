// Native rider windows and untouched original adventures. Real keyboard
// play verifies the first adventure's end-screen success callback; the
// eighth adventure's real loss callback preserves both inputs. A phone
// adapter victory checks the final transformation, not a full boss victory.
import assert from "node:assert/strict";
const ACADEMY = [56, 52], TAMING = [48, 58];

export default async function riderTraining({ newPlayer }) {
  const player = await newPlayer();
  const { page } = player;
  const commandBatches = [];
  page.on("request", (request) => {
    if (!request.url().endsWith("/command.php")) return;
    const data = new URLSearchParams(request.postData() ?? "").get("data") ?? "";
    commandBatches.push(JSON.parse(data.slice(data.indexOf(";") + 1)).commands);
  });
  // Ruffle's Rust logger prints AVM2 failures as formatted console.log.
  const runtimeErrors = (message) => { if (/%cERROR%c/.test(message.text())) player.problems.push(message.text()); };
  page.on("console", runtimeErrors);
  await player.send([
    { cmd: "rt_level_up", args: [35] },
    { cmd: "buy", args: [1345, ...ACADEMY, 0, 0, 1, 1, "b"] },
    { cmd: "buy", args: [1346, ...TAMING, 0, 0, 1, 1, "b"] },
  ]);
  await player.reload();
  let activePage = page;
  const info = async () => (await activePage.request.post(`${player.base}${player.settings.dynamicUrl}/get_player_info.php`,
    { form: { USERID: player.settings.userId, user_key: player.settings.userKey } })).json();
  const savedWhen = async (check) => {
    const end = Date.now() + 30_000;
    let saved;
    do {
      saved = await info();
      if (check(saved)) return saved;
      await activePage.waitForTimeout(100);
    } while (Date.now() < end);
    assert.ok(check(saved), "the server saved the expected state");
  };
  const inside = (save) => save.map.items.find((item) => item[0] === 1346)?.[6] ?? [];
  const initial = await info();
  const progress = () => activePage.evaluate(() => document.querySelector(".rider-adventure ruffle-player")?.ruffle().callExternalInterface("riderProgress"));
  let journey;
  const beginJourney = async (name) => { journey = { name, first: (await progress()).frames, at: Date.now() }; };
  const budget = (state) => {
    assert.ok(state.frames - journey.first <= 600, `${journey.name} reached its result within 600 movie frames: ${JSON.stringify(state)}`);
    return state;
  };
  const goalReached = (state, goal) => goal === "enemy" ? Math.abs(state.distanceToEnemy) <= 90 || state.state !== "playing"
    : goal === "won" ? state.state === "won" : state.state === "lost" && state.menuReady;
  const gameUntil = async (goal) => {
    for (;;) {
      const before = budget(await progress());
      console.log("Rider game", { phase: journey.name, wallMs: Date.now() - journey.at, ...before });
      if (goalReached(before, goal)) return before;
      // Software collision readback measures about 3 FPS here. Keep a hard
      // simulation cap and 30-second liveness for each 30-frame segment.
      await activePage.waitForFunction(({ frame, priorState, goal }) => {
        const state = document.querySelector(".rider-adventure ruffle-player").ruffle().callExternalInterface("riderProgress");
        const reached = goal === "enemy" ? Math.abs(state.distanceToEnemy) <= 90 || state.state !== "playing"
          : goal === "won" ? state.state === "won" : state.state === "lost" && state.menuReady;
        return reached || state.frames >= frame + 30 || state.state !== priorState;
      }, { frame: before.frames, priorState: before.state, goal }, { timeout: 30_000, polling: 250 });
      const after = budget(await progress());
      if (goalReached(after, goal)) return after;
      const moved = Math.abs(after.distance + after.x - before.distance - before.x) > .01 || Math.abs(after.y - before.y) > .01;
      const changed = after.health !== before.health || after.enemies !== before.enemies || after.distanceToEnemy !== before.distanceToEnemy
        || after.cooldown !== before.cooldown || after.menuFrame !== before.menuFrame || after.state !== before.state;
      assert.ok(moved || (goal === "lost" && changed), `the original simulation advanced, beyond the wrapper clock: ${JSON.stringify({ before, after })}`);
    }
  };
  const approach = async () => {
    const direction = (await progress()).distanceToEnemy >= 0 ? "ArrowRight" : "ArrowLeft";
    await activePage.keyboard.down(direction);
    await gameUntil("enemy");
    await activePage.keyboard.up(direction);
    const state = await progress();
    const facing = state.distanceToEnemy >= 0 ? "right" : "left";
    if (state.facing !== facing) {
      const turn = facing === "right" ? "ArrowRight" : "ArrowLeft";
      await activePage.keyboard.down(turn);
      await activePage.waitForFunction((facing) => document.querySelector(".rider-adventure ruffle-player").ruffle().callExternalInterface("riderProgress").facing === facing,
        facing, { timeout: 30_000, polling: 250 });
      await activePage.keyboard.up(turn);
    }
  };
  const endGame = async () => {
    const bounds = await activePage.locator(".rider-adventure-stage").boundingBox();
    assert.ok(bounds);
    // The original's End Game button, measured from its shipped artwork.
    await activePage.mouse.click(bounds.x + bounds.width * 325 / 650, bounds.y + bounds.height * 220 / 500);
  };
  await player.select(ACADEMY, "Rider Academy");
  await player.press("Open");
  const panel = page.locator(".rider-window");
  await panel.waitFor();
  assert.equal(await panel.locator(".rider-choice").count(), 3);
  assert.equal(await panel.locator(".rider-choose:disabled").count(), 2);
  await panel.locator(".rider-preview").first().click();
  assert.equal(await panel.locator(".rider-dragons img").count(), 6);
  await page.waitForFunction(() => [...document.querySelectorAll(".rider-choice img")].every((img) => img.naturalWidth > 0));
  await player.shot("rider-picker");
  await panel.getByRole("button", { name: "Train Dragon Rider I", exact: true }).click();
  assert.equal(await panel.locator(".rider-count").textContent(), "0/5");
  await panel.locator(".rider-action").click();
  const adventure = page.locator(".rider-adventure");
  await adventure.waitFor();
  await page.waitForFunction(() => document.querySelector(".rider-adventure")?.getAttribute("data-ready") === "true", null, { timeout: 60_000 });
  await player.shot("adventure-one");
  const oldSession = await adventure.getAttribute("data-session");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("1");
  await adventure.getByRole("button", { name: "Close adventure" }).click();
  let saved = await info();
  assert.equal(saved.privateState.riderStepNumber, 0, "closing an adventure does not advance training");
  await panel.locator(".rider-action").click();
  await page.waitForFunction(() => document.querySelector(".rider-adventure")?.getAttribute("data-ready") === "true", null, { timeout: 60_000 });
  await page.evaluate((session) => window.seRiderAdventure("won", 1, session), oldSession);
  assert.equal(await adventure.isVisible(), true, "a late callback from the previous instance cannot complete the reopened adventure");
  assert.equal(Number((await info()).privateState.riderStepNumber), 0);
  // Walk to the first opponent, fight with the game's ordinary attack keys,
  // then reach the end and press the actual in-movie End Game button.
  await beginJourney("first adventure victory");
  await approach();
  for (let turn = 0; turn < 30; turn++) {
    const state = budget(await progress());
    assert.notEqual(state.state, "lost", "the rider survived the first adventure");
    if (state.enemies === 0 || state.state === "won") break;
    if (Math.abs(state.distanceToEnemy) > 105) await approach();
    const attacking = budget(await progress());
    await page.keyboard.press("1");
    await page.waitForFunction((before) => {
      const state = document.querySelector(".rider-adventure ruffle-player").ruffle().callExternalInterface("riderProgress");
      return state.frames >= before + 28 || state.state !== "playing";
    }, attacking.frames, { timeout: 30_000, polling: 250 });
  }
  assert.equal((await progress()).enemies, 0, "the first opponent was defeated through normal input");
  await page.keyboard.down("ArrowRight");
  await gameUntil("won");
  await page.keyboard.up("ArrowRight");
  await player.shot("adventure-one-won");
  await endGame();
  await panel.locator(".rider-recovery").waitFor();
  saved = await savedWhen((save) => save.privateState.riderStepNumber === 1);
  assert.equal(saved.privateState.riderStepNumber, 1);
  assert.ok(Number(saved.privateState.riderTimeStamp) > 0);
  await player.shot("rider-recovery");

  // Recovery costs cash; the original's page-session shortcut appears only
  // after that payment and still starts each following recovery.
  for (let step = 1; step <= 5; step++) {
    await panel.locator(".rider-recover").click();
    await savedWhen((save) => Number(save.privateState.riderTimeStamp) === -1);
    if (step < 5) {
      await panel.locator(".rider-fast").click();
      await savedWhen((save) => Number(save.privateState.riderStepNumber) === step + 1);
    }
  }
  assert.equal(await panel.locator(".rider-action").textContent(), "Get rider");
  await player.shot("rider-ready");
  await panel.locator(".rider-action").click();
  await panel.waitFor({ state: "hidden" });
  saved = await savedWhen((save) => Number(save.privateState.riderNumber) === 0 && save.map.items.some((item) => item[0] === 822));
  assert.equal(saved.privateState.riderStepNumber, 0);
  assert.equal(Number(saved.playerInfo.cash), Number(initial.playerInfo.cash) - 75);
  const rider = saved.map.items.find((item) => item[0] === 822);
  assert.equal(Number(saved.map.coins), Number(initial.map.coins), "the rider is placed free");
  const claimBatch = commandBatches.find((batch) => batch.some((command) => command.cmd === "buy" && Number(command.args[0]) === 822));
  assert.ok(claimBatch, "claim was sent through the real CommandSender");
  const rewardIndex = claimBatch.findIndex((command) => command.cmd === "buy" && Number(command.args[0]) === 822);
  assert.equal(claimBatch[rewardIndex + 1]?.cmd, "rider_select", "reward and reset share one ordered retryable batch");
  assert.equal(Number(claimBatch[rewardIndex + 1].args[0]), 0);
  await player.select(ACADEMY, "Rider Academy");
  await player.press("Open");
  await panel.locator(".rider-choices").waitFor();
  await page.keyboard.press("Escape");
  assert.equal((await info()).map.items.filter((item) => item[0] === 822).length, 1, "reopening the academy cannot claim again");

  // Send the trained rider and a compatible dragon through the ordinary
  // map interaction. This checks entry, the screen and the saved pair.
  await player.send([{ cmd: "buy", args: [684, 51, 60, 0, 0, 1, 1, "u"] }]);
  await player.reload();
  const { point: tamingPoint } = await player.select(TAMING, "Dragon Riding");
  await player.press("Close");
  await player.select([rider[1], rider[2]], "Dragon Rider I");
  await player.click(tamingPoint);
  await savedWhen((save) => inside(save).includes(822));
  await player.select([51, 60], "Stormy Dragon");
  await player.click(tamingPoint);
  await savedWhen((save) => inside(save).length === 2);
  await player.select(TAMING, "Dragon Riding");
  await player.press("Open");
  await panel.locator(".rider-taming-result").waitFor();
  assert.match(await panel.locator(".rider-taming-result").textContent(), /Stormy Dragon Rider/);
  await player.shot("taming-pair");
  await panel.locator(".rider-tame").click();
  await page.waitForFunction(() => document.querySelector(".rider-adventure")?.getAttribute("data-ready") === "true", null, { timeout: 60_000 });
  assert.equal(await adventure.getAttribute("data-level"), "8");
  await player.shot("taming-adventure");
  await beginJourney("taming adventure loss");
  await approach();
  await gameUntil("lost");
  await player.shot("taming-adventure-lost");
  await endGame();
  await adventure.waitFor({ state: "hidden" });
  assert.equal(inside(await info()).length, 2, "a lost adventure keeps both units");

  // The same saved pair on a phone, including touch keys and the actual
  // original eighth adventure. Success consumes both and adds its result.
  await page.keyboard.press("Escape");
  const phone = await player.onPhone();
  phone.page.on("console", runtimeErrors);
  activePage = phone.page;
  await page.close();
  await phone.select(TAMING, "Dragon Riding");
  await phone.press("Open");
  const sheet = phone.page.locator(".rider-window");
  await sheet.locator(".rider-taming-result").waitFor();
  const slots = await sheet.locator(".rider-taming-slots").boundingBox();
  assert.ok(slots && slots.x >= 0 && slots.x + slots.width <= 390, "the taming pair fits the phone");
  await phone.shot("phone-taming");
  await sheet.locator(".rider-tame").click();
  await phone.page.waitForFunction(() => document.querySelector(".rider-adventure")?.getAttribute("data-ready") === "true", null, { timeout: 60_000 });
  const key = phone.page.getByRole("button", { name: "Adventure key →", exact: true });
  await key.tap();
  await phone.shot("phone-adventure");
  await phone.page.evaluate(() => window.seRiderAdventure("won", 8, document.querySelector(".rider-adventure").dataset.session));
  saved = await savedWhen((save) => inside(save).length === 0 && save.map.items.some((item) => item[0] === 833));
  assert.ok(!saved.map.items.some((item) => item[0] === 822 || item[0] === 684), "both inputs were consumed");
  assert.equal(Number(saved.playerInfo.cash), Number(initial.playerInfo.cash) - 75, "taming costs no cash");
  await phone.select(ACADEMY, "Rider Academy");
  await phone.press("Open");
  await sheet.locator(".rider-choices").waitFor();
  const choices = await sheet.locator(".rider-choices").boundingBox();
  assert.ok(choices && choices.x >= 0 && choices.x + choices.width <= 390, "all rider choices fit the phone");
  await phone.shot("phone-rider-picker");
}
