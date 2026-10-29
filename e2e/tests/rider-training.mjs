// Native rider windows and untouched original adventures. Real keyboard
// play verifies the first adventure's end-screen success callback; the
// eighth adventure's real loss callback preserves both inputs. A phone
// adapter victory checks the final transformation, not a full boss victory.
import assert from "node:assert/strict";
const ACADEMY = [56, 52], TAMING = [48, 58], DRAGON = [51, 56];

export default async function riderTraining({ newPlayer, offlineVillage }) {
  let player = await newPlayer();
  await player.send([
    { cmd: "rt_level_up", args: [35] },
    { cmd: "buy", args: [1345, ...ACADEMY, 0, 0, 1, 1, "b"] },
    { cmd: "buy", args: [1346, ...TAMING, 0, 0, 1, 1, "b"] },
  ]);
  // Food for five recoveries, 7,500 each (the original's 15 cash, in food since 29 October 2026).
  player = await offlineVillage(player, (save) => { save.maps[0].food = 40_000; });
  const { page } = player;
  const commandBatches = [];
  page.on("request", (request) => {
    if (!request.url().endsWith("/command.php")) return;
    const data = new URLSearchParams(request.postData() ?? "").get("data") ?? "";
    commandBatches.push(JSON.parse(data.slice(data.indexOf(";") + 1)).commands);
  });
  // Ruffle's Rust logger prints AVM2 failures as formatted console.log.
  const runtimeErrors = (message) => {
    if (/%cERROR%c/.test(message.text())) { player.problems.push(message.text()); console.error("Rider runtime error", message.text()); }
  };
  page.on("console", runtimeErrors);
  let activePage = page;
  let activePlayer = player, rendererNotices = 0;
  const rendererNotice = async () => {
    const bounds = await activePage.locator(".rider-adventure-stage").boundingBox();
    assert.ok(bounds);
    // The pinned runtime shows its standard CPU-renderer advice on the
    // first mouseover of each new player, intercepting the next click.
    await activePage.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    const notice = activePage.locator("ruffle-player #hardware-acceleration-modal");
    if (await notice.isVisible()) {
      assert.match(await notice.textContent(), /hardware acceleration/i);
      await activePlayer.shot(`renderer-notice-${++rendererNotices}`);
      await notice.locator(".close-modal").click();
      await notice.waitFor({ state: "hidden" });
    }
  };
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
  const goalReached = (state, goal, stopAt = 90) => goal === "enemy" ? Math.abs(state.distanceToEnemy) <= stopAt || state.state !== "playing"
    : goal === "won" ? state.state === "won" : state.state === "lost" && state.menuReady;
  const gameUntil = async (goal, stopAt = 90) => {
    for (;;) {
      const before = budget(await progress());
      console.log("Rider game", { phase: journey.name, wallMs: Date.now() - journey.at, ...before });
      if (goalReached(before, goal, stopAt)) return before;
      // Software collision readback measures about 3 FPS here. Keep a hard
      // simulation cap and 30-second liveness for each 30-frame segment.
      await activePage.waitForFunction(({ frame, priorState, goal, stopAt }) => {
        const state = document.querySelector(".rider-adventure ruffle-player").ruffle().callExternalInterface("riderProgress");
        const reached = goal === "enemy" ? Math.abs(state.distanceToEnemy) <= stopAt || state.state !== "playing"
          : goal === "won" ? state.state === "won" : state.state === "lost" && state.menuReady;
        return reached || state.frames >= frame + 30 || state.state !== priorState;
      }, { frame: before.frames, priorState: before.state, goal, stopAt }, { timeout: 30_000, polling: 250 });
      const after = budget(await progress());
      if (goalReached(after, goal, stopAt)) return after;
      const moved = Math.abs(after.distance + after.x - before.distance - before.x) > .01 || Math.abs(after.y - before.y) > .01;
      const changed = after.health !== before.health || after.enemies !== before.enemies || after.distanceToEnemy !== before.distanceToEnemy
        || after.cooldown !== before.cooldown || after.menuFrame !== before.menuFrame || after.state !== before.state;
      assert.ok(moved || (goal === "lost" && changed), `the original simulation advanced, beyond the wrapper clock: ${JSON.stringify({ before, after })}`);
    }
  };
  const faceEnemy = async () => {
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
  const approach = async (stopAt = 90) => {
    const direction = (await progress()).distanceToEnemy >= 0 ? "ArrowRight" : "ArrowLeft";
    await activePage.keyboard.down(direction);
    await gameUntil("enemy", stopAt);
    await activePage.keyboard.up(direction);
    await faceEnemy();
  };
  const endGame = async (expected) => {
    const bounds = await activePage.locator(".rider-adventure-stage").boundingBox();
    assert.ok(bounds);
    await activePage.evaluate(() => {
      const callback = window.seRiderAdventure;
      window.riderEndEvents = [];
      window.seRiderAdventure = (...args) => { window.riderEndEvents.push(args); callback(...args); };
    });
    const nextFrame = async () => {
      const before = await progress();
      await activePage.waitForFunction((frame) => document.querySelector(".rider-adventure ruffle-player").ruffle().callExternalInterface("riderProgress").frames > frame,
        before.frames, { timeout: 30_000, polling: 250 });
    };
    // The original's End Game button, measured from its shipped artwork.
    // Let hover and press each reach the slow software-rendered movie.
    await activePage.mouse.move(bounds.x + bounds.width * 325 / 650, bounds.y + bounds.height * 220 / 500);
    await nextFrame();
    await activePage.mouse.down();
    await nextFrame();
    await activePage.mouse.up();
    await activePage.waitForFunction((expected) => window.riderEndEvents.some(([event]) => event === expected), expected, { timeout: 30_000, polling: 250 });
    const events = await activePage.evaluate(() => window.riderEndEvents);
    console.log("Rider original end-screen callback", events);
    assert.equal(events[0][0], expected);
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
  await rendererNotice();
  await player.shot("adventure-one");
  const oldSession = await adventure.getAttribute("data-session");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("1");
  await adventure.getByRole("button", { name: "Close adventure" }).click();
  let saved = await info();
  assert.equal(saved.privateState.riderStepNumber, 0, "closing an adventure does not advance training");
  await panel.locator(".rider-action").click();
  await page.waitForFunction(() => document.querySelector(".rider-adventure")?.getAttribute("data-ready") === "true", null, { timeout: 60_000 });
  await rendererNotice();
  await page.evaluate((session) => window.seRiderAdventure("won", 1, session), oldSession);
  assert.equal(await adventure.isVisible(), true, "a late callback from the previous instance cannot complete the reopened adventure");
  assert.equal(Number((await info()).privateState.riderStepNumber), 0);
  // Walk to the first opponent, fight with the game's ordinary attack keys,
  // then reach the end and press the actual in-movie End Game button.
  await beginJourney("first adventure victory");
  await approach();
  let lastBolt = -Infinity;
  for (let turn = 0; turn < 30; turn++) {
    const state = budget(await progress());
    assert.notEqual(state.state, "lost", "the rider survived the first adventure");
    if (state.enemies === 0 || state.state === "won") break;
    if (Math.abs(state.distanceToEnemy) > 105) await approach();
    await faceEnemy();
    const attacking = budget(await progress());
    const attack = attacking.frames - lastBolt > 150 ? "3" : "1";
    console.log("Rider normal attack", { key: attack, frames: attacking.frames, distanceToEnemy: attacking.distanceToEnemy, facing: attacking.facing });
    await page.keyboard.press(attack);
    if (attack === "3") lastBolt = (await progress()).frames;
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
  await endGame("won");
  await panel.locator(".rider-recovery").waitFor();
  saved = await savedWhen((save) => save.privateState.riderStepNumber === 1);
  assert.equal(saved.privateState.riderStepNumber, 1);
  assert.ok(Number(saved.privateState.riderTimeStamp) > 0);
  await player.shot("rider-recovery");

  // Recovery costs food; the original's page-session shortcut appears only
  // after that payment and still starts each following recovery.
  assert.match(await panel.locator(".rider-recover").textContent(), /7,500/);
  assert.equal(await panel.locator(".rider-recover img").getAttribute("alt"), "food");
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
  assert.equal(Number(saved.playerInfo.cash), Number(initial.playerInfo.cash), "recovery costs no cash");
  assert.equal(Number(saved.map.food), Number(initial.map.food) - 5 * 7500, "but 7,500 food each");
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
  await player.send([{ cmd: "buy", args: [684, ...DRAGON, 0, 0, 1, 1, "u"] }]);
  await player.reload();
  // A searching click sequence can hit the dragon's wide footprint first
  // and then legitimately send it inside. Check one visible building-body
  // pixel before issuing the single ordinary selection click.
  const tamingPoint = player.screenOf(...TAMING, 100);
  await page.waitForFunction((point) => window.seHome.parts.view.itemAt(point)?.item.id === 1346,
    tamingPoint, { timeout: 30_000, polling: 250 });
  await player.click(tamingPoint);
  assert.match(await player.bar(), /^Dragon Riding/);
  await player.press("Close");
  assert.deepEqual(inside(await info()), [], "finding the building did not admit the nearby dragon");
  await player.select([rider[1], rider[2]], "Dragon Rider I");
  await player.click(tamingPoint);
  saved = await savedWhen((save) => inside(save).includes(822));
  assert.deepEqual(inside(saved), [822], "the rider entered first");
  await player.select(DRAGON, "Stormy Dragon");
  await player.click(tamingPoint);
  await savedWhen((save) => inside(save).length === 2);
  await player.select(TAMING, "Dragon Riding");
  await player.press("Open");
  await panel.locator(".rider-taming-result").waitFor();
  assert.match(await panel.locator(".rider-taming-result").textContent(), /Stormy Dragon Rider/);
  await player.shot("taming-pair");
  await panel.locator(".rider-tame").click();
  await page.waitForFunction(() => document.querySelector(".rider-adventure")?.getAttribute("data-ready") === "true", null, { timeout: 60_000 });
  await rendererNotice();
  assert.equal(await adventure.getAttribute("data-level"), "8");
  await player.shot("taming-adventure");
  await beginJourney("taming adventure loss");
  // Release before coasting through the boss and turn away. The original
  // left-facing body then overlaps its attacks, producing an ordinary loss.
  await approach(220);
  await page.keyboard.down("ArrowLeft");
  await page.waitForFunction(() => document.querySelector(".rider-adventure ruffle-player").ruffle().callExternalInterface("riderProgress").facing === "left",
    null, { timeout: 30_000, polling: 250 });
  await page.keyboard.up("ArrowLeft");
  await gameUntil("lost");
  await player.shot("taming-adventure-lost");
  await endGame("lost");
  await adventure.waitFor({ state: "hidden" });
  assert.equal(inside(await info()).length, 2, "a lost adventure keeps both units");

  // The same saved pair on a phone, including touch keys and the actual
  // original eighth adventure. Success consumes both and adds its result.
  await page.keyboard.press("Escape");
  const phone = await player.onPhone();
  phone.page.on("console", runtimeErrors);
  activePage = phone.page;
  activePlayer = phone;
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
  await rendererNotice();
  const key = phone.page.getByRole("button", { name: "Adventure key →", exact: true });
  await key.tap();
  await phone.page.waitForFunction(() => document.querySelector(".rider-adventure ruffle-player").ruffle().callExternalInterface("riderProgress").cooldown >= 30,
    null, { timeout: 30_000, polling: 250 });
  const beforeTouch = await progress();
  await phone.page.getByRole("button", { name: "Adventure key 1", exact: true }).tap();
  await phone.page.waitForFunction((before) => document.querySelector(".rider-adventure ruffle-player").ruffle().callExternalInterface("riderProgress").cooldown < before,
    beforeTouch.cooldown, { timeout: 30_000, polling: 250 });
  assert.equal(await phone.page.locator(".rider-adventure-controls button:focus").count(), 0, "touch controls preserve the adventure's focus");
  await phone.shot("phone-adventure");
  await phone.page.evaluate(() => window.seRiderAdventure("won", 8, document.querySelector(".rider-adventure").dataset.session));
  saved = await savedWhen((save) => inside(save).length === 0 && save.map.items.some((item) => item[0] === 833));
  assert.ok(!saved.map.items.some((item) => item[0] === 822 || item[0] === 684), "both inputs were consumed");
  assert.equal(Number(saved.playerInfo.cash), Number(initial.playerInfo.cash), "taming costs no cash");
  await phone.select(ACADEMY, "Rider Academy");
  await phone.press("Open");
  await sheet.locator(".rider-choices").waitFor();
  const choices = await sheet.locator(".rider-choices").boundingBox();
  assert.ok(choices && choices.x >= 0 && choices.x + choices.width <= 390, "all rider choices fit the phone");
  await phone.shot("phone-rider-picker");
}
