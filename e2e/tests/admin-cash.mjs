// The admin's cash box (admin.py, change_cash): on an empire's admin page,
// the admin gives a player cash and takes some back. The page says what
// changed and shows the new amount, and the game gets it from the server.
// Taking more than the empire has is refused, and a player who isn't an
// admin can't open the page. Site pages only: the game isn't opened.

import assert from "node:assert/strict";
import { ADMIN } from "../lib.mjs";

export default async function adminCash({ newPlayer }) {
  const player = await newPlayer({ game: false });
  const pid = player.settings.userId;
  /** The cash the game gets when it loads the town. */
  const cash = async () => {
    const reply = await player.page.request.post(`${player.base}${player.settings.dynamicUrl}/get_player_info.php`,
      { form: { USERID: pid, user_key: player.settings.userKey } });
    return (await reply.json()).playerInfo.cash;
  };
  const before = await cash();

  // For a player, the page doesn't exist.
  assert.equal((await player.page.goto(`${player.base}/admin/empire/${pid}`)).status(), 404);

  const admin = await newPlayer({ name: ADMIN, game: false });
  const page = admin.page;
  await page.goto(`${admin.base}/admin/empire/${pid}`);
  const box = page.locator("form.cash");
  const change = async (amount, way) => {
    await box.locator('input[name="amount"]').fill(String(amount));
    await box.getByRole("button", { name: way, exact: true }).click();
    await page.waitForLoadState();
  };
  /** The Cash column of the empire's table. */
  const shown = async () => {
    const headings = await page.locator("table th").allTextContents();
    return Number((await page.locator("table td").nth(headings.indexOf("Cash")).textContent()).replace(/,/g, ""));
  };

  await change(50, "Give");
  assert.equal((await page.locator(".done").textContent()).trim(), `Gave 50 cash: ${before} → ${before + 50}.`);
  assert.equal(await shown(), before + 50);
  await admin.shot("given");
  assert.equal(await cash(), before + 50, "the game gets it");

  // More than the empire has: refused, and nothing changes. The server answers
  // 400, which the browser notes as an error: expected here, and only this one.
  const [refusal] = await Promise.all([page.waitForResponse((reply) => reply.request().method() === "POST"),
    change(before + 51, "Take")]);
  assert.equal(refusal.status(), 400);
  const noted = admin.problems.findIndex((problem) => problem.includes("status of 400"));
  assert.ok(noted >= 0, "the browser noted the refusal");
  admin.problems.splice(noted, 1);
  assert.match(await page.locator(".error").textContent(), new RegExp(`has only ${before + 50} cash`));
  assert.equal(await cash(), before + 50);
  await admin.shot("refused");

  await change(30, "Take");
  assert.equal((await page.locator(".done").textContent()).trim(), `Took 30 cash: ${before + 50} → ${before + 20}.`);
  assert.equal(await shown(), before + 20);
  assert.equal(await cash(), before + 20);

  // Reloading the page after a change shows it again, without changing the cash twice.
  await page.reload();
  assert.equal(await cash(), before + 20);
}
