// The units book counts a player's own version of a book unit (DECISIONS.md,
// 20 October): the book's Trolls II page lists the wild War Troll (529),
// and the War Troll a player owns has another id (552) with the same name
// and picture. Placed in town, it shows as obtained on that page.

import assert from "node:assert/strict";

const WAR_TROLL_OWN = 552, WAR_TROLL_BOOK = 529, TROLLS_II = 16;

export default async function unitsBookLookalikes({ newPlayer }) {
  const player = await newPlayer();
  const { page } = player;
  await player.send([{ cmd: "buy", args: [WAR_TROLL_OWN, 54, 54, 0, 0, 1, 1, "u"] }]);
  await player.reload();
  await player.menu("Army");
  await player.press("Units book");
  const panel = page.getByRole("dialog", { name: "Units book", exact: true });
  await panel.waitFor({ state: "visible" });
  // Three categories a page: Next until Trolls II shows.
  const trolls = panel.locator(`[data-category="${TROLLS_II}"]`);
  for (let pages = 0; pages < 40 && !(await trolls.count()); pages++) {
    await panel.getByRole("button", { name: "Next", exact: true }).click();
  }
  await trolls.scrollIntoViewIfNeeded();
  const cell = trolls.locator(`[data-unit="${WAR_TROLL_BOOK}"]`);
  assert.match(await cell.innerText(), /Obtained/);
  assert.match(await trolls.innerText(), /1 \/ 5/);
  await player.wait(800);
  await player.shot("trolls");
}
