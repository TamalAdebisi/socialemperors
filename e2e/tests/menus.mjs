// The menus as a rail and dock (CLIENT.md, "The menus: rail and dock"): on a
// computer the rail on the left with its windows as a panel on the right;
// on a phone the dock, short numbers and windows as sheets. Each menu opens
// its window and lights its button; pressed again, or Escape, puts it away.
// The shop greys what's above the player's level, the neighbours list has
// another player, and Visit opens their town to look at.

import assert from "node:assert/strict";

export default async function menus({ newPlayer }) {
  const neighbour = await newPlayer();
  const player = await newPlayer();
  const { page } = player;
  const lit = async () => page.locator(".menu[aria-pressed=true]").evaluateAll((buttons) => buttons.map((b) => b.getAttribute("aria-label")));
  const panel = () => page.locator(".panel:not([hidden])");

  // The rail: Quests and Battle there, World only in the phone's dock.
  for (const name of ["Build", "Storage", "Army", "Quests", "Battle", "Neighbours"]) {
    assert.ok(await player.button(name).isVisible(), `the rail has ${name}`);
  }
  assert.ok(await player.button("World").isHidden(), "World is the dock's");
  const rail = await page.locator(".menus").boundingBox();
  assert.ok(rail.x < 30 && rail.height > 400, "the rail stands down the left");

  // Build opens the shop as a panel on the right, its button lit; the town stays in view.
  await player.menu("Build");
  assert.deepEqual(await lit(), ["Build"]);
  const box = await panel().boundingBox();
  assert.ok(box.x > 700 && box.height > 600, `the shop is a panel on the right: ${JSON.stringify(box)}`);
  await player.press("Resources");
  const locked = page.locator(".shop-card.locked").first();
  assert.match(await locked.locator(".shop-note.level").textContent(), /^Level \d+$/, "what's above the level shows its level in red");
  await player.shot("shop");

  // Storage inside the same window lights Storage instead.
  await page.locator(".shop-categories .shop-storage").click();
  assert.deepEqual(await lit(), ["Storage"]);
  await player.menu("Storage");
  assert.equal(await panel().count(), 0, "pressing the lit button again puts the window away");

  // Neighbours: the other player (the most recently active come first), each with Visit.
  await player.menu("Neighbours");
  assert.deepEqual(await lit(), ["Neighbours"]);
  const names = await page.locator(".panel:not([hidden]) .row strong").allTextContents();
  assert.ok(names.includes(neighbour.name), `the other player is a neighbour: ${names}`);
  await player.shot("neighbours");

  // Battle: the three ways to fight, and the attacks' results.
  await player.menu("Battle");
  assert.deepEqual(await lit(), ["Battle"], "one window at a time");
  assert.deepEqual(await page.locator(".panel:not([hidden]) .row strong").allTextContents(), ["Attack a player", "Survival", "Tournament", "Battle Results"]);
  // Tournament now opens its list here; matches keep their classic link inside.
  assert.equal(await page.locator(".panel:not([hidden]) .row a").nth(2).getAttribute("href"), "#");
  await page.keyboard.press("Escape");
  assert.equal(await panel().count(), 0, "Escape closes the window");
  assert.deepEqual(await lit(), []);

  // Army, from its shortcut: the town's units (a new town has none).
  await page.keyboard.press("a");
  assert.deepEqual(await lit(), ["Army"]);
  await page.keyboard.press("Escape");

  // A selected building's card sits at the bottom middle, between the rail and the right edge.
  await player.select([51, 47], "Tower I");
  const card = await page.locator(".actions").boundingBox();
  assert.ok(card.y + card.height > 700, "the card is at the bottom");
  await player.shot("selected");
  await player.press("Close");

  // Visiting them: their town, to look at, with a way home and no menus.
  await player.menu("Neighbours");
  await page.getByRole("link", { name: `Visit ${neighbour.name}` }).click();
  await player.loaded();
  assert.match(await page.locator(".hud-visiting").textContent(), new RegExp(`^Visiting ${neighbour.name}`));
  assert.ok(await page.getByRole("link", { name: "Back home" }).isVisible(), "a way home");
  assert.equal(await page.locator(".menus").count(), 0, "no menus in someone else's town");
  await player.shot("visiting");
  await page.getByRole("link", { name: "Back home" }).click();
  await player.loaded();

  // On a phone: the dock with World, the numbers short, windows as sheets above the dock.
  const phone = await player.onPhone();
  for (const name of ["Build", "Storage", "Army", "World", "Neighbours"]) {
    assert.ok(await phone.button(name).isVisible(), `the dock has ${name}`);
  }
  assert.ok(await phone.button("Quests").isHidden(), "Quests is in World's sheet");
  const dock = await phone.page.locator(".menus").boundingBox();
  assert.ok(dock.y > 700 && dock.width > 380, "the dock lies across the bottom");
  assert.ok(await phone.page.locator(".n-short").first().isVisible(), "short numbers on a phone");
  await phone.menu("World");
  const sheet = await phone.page.locator(".panel:not([hidden])").boundingBox();
  assert.ok(sheet.y > 200 && sheet.y + sheet.height <= dock.y + 4, `the sheet sits above the dock: ${JSON.stringify(sheet)}`);
  assert.deepEqual(await phone.page.locator(".panel:not([hidden]) .row strong").allTextContents(),
    ["Quests", "Attack a player", "Survival", "Tournament", "Battle Results"]);
  await phone.shot("phone-world");
  // Dragging the sheet's handle down puts it away.
  const handle = await phone.page.locator(".panel:not([hidden]) .panel-handle").boundingBox();
  await phone.page.mouse.move(handle.x + handle.width / 2, handle.y + 4);
  await phone.page.mouse.down();
  await phone.page.mouse.move(handle.x + handle.width / 2, handle.y + 200, { steps: 8 });
  await phone.page.mouse.up();
  await phone.wait(300);
  assert.equal(await phone.page.locator(".panel:not([hidden])").count(), 0, "dragged down, the sheet closes");
  await phone.menu("Build");
  await phone.wait(1000);
  await phone.shot("phone-shop");
}
