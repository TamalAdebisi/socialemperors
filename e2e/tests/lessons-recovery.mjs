// Interrupted saves and a lost soldier must not strand a mandatory tutorial.
import assert from "node:assert/strict";

export default async function recovery({ newPlayer }) {
  const player = await newPlayer({ lessons: true, wild: true, camp: true, dock: true });
  const { page } = player;
  await page.evaluate(() => window.seHome.parts.commands.flush());
  const soldiers = await page.evaluate(() => window.seHome.parts.town.items.filter((p) =>
    p.item.isUnit && p.item.race === "h" && p.item.subcategory !== 71).map((p) => [p.tx, p.ty, p.item.id]));
  await player.send([
    ...soldiers.map(([x, y, id]) => ({ cmd: "sell", args: [x, y, id, 0, true, "KILL"] })),
    { cmd: "buy", args: [500, 51, 55, 0, 0, 1, 1, "u"] },
    { cmd: "complete_tutorial", args: [11, { trees: 0 }] },
  ]);
  await player.reload();
  await page.waitForFunction(() => window.seLessons?.at === 11);
  await page.getByRole("button", { name: "Get a training knight" }).waitFor();
  assert.equal(await page.evaluate(() => window.seLessons.pointing), null, "a villager is never the soldier target");
  await player.shot("missing-knight");
  await player.press("Get a training knight");
  await page.waitForFunction(() => window.seHome.parts.town.items.some((p) => p.item.id === 512));
  await page.waitForFunction(() => document.querySelector(".lesson")?.dataset.moving === "false");
  await player.click(await page.evaluate(() => window.seLessons.pointing));
  await page.waitForFunction(() => window.seLessons.at === 12);
  let save = await player.saved();
  assert.equal(save.items.filter((i) => i[0] === 512).length, 1, "one saved replacement knight");

  // A saved partial final task resumes from its count, on a browser with no local storage.
  await player.send([{ cmd: "complete_tutorial", args: [31, { trees: 2 }] }]);
  await page.evaluate(() => localStorage.clear());
  await player.reload();
  await page.waitForFunction(() => window.seLessons?.at === 31);
  assert.equal(await page.locator(".lesson-count").textContent(), "Trees chopped 2/3");
  await page.waitForFunction(() => document.querySelector(".lesson")?.dataset.moving === "false");
  await player.click(await page.evaluate(() => window.seLessons.pointing));
  await page.waitForSelector(".draggy-window.choose", { timeout: 180_000 });

  // The server saves the choice but its first answer is lost. The retry must
  // finish the UI and must not duplicate either part of the gift.
  let lost = false;
  await page.route("**/command.php", async (route) => {
    if (!lost && route.request().postData()?.includes("claim_tutorial_reward")) {
      lost = true;
      await route.fetch();
      await route.abort("failed");
    } else await route.continue();
  });
  await page.getByRole("button", { name: "Select Green Draggy" }).click();
  await page.waitForSelector(".draggy-window.reminder", { timeout: 30_000 });
  assert.ok(lost, "the reward save was retried after losing its answer");
  await page.locator(".draggy-ok").click();
  await player.closeLevelUps();
  save = await player.saved();
  for (const id of [1233, 698]) assert.equal(save.items.filter((i) => i[0] === id).length, 1);
  await player.reload();
  assert.equal(await page.locator(".lesson, .draggy-window.choose").count(), 0);
  await player.shot("recovered");
  // The deliberately aborted request is expected; all other browser errors remain failures.
  player.problems = player.problems.filter((message) => !message.includes("net::ERR_FAILED"));
}
