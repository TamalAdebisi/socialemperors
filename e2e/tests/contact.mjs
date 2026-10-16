// Where players get in touch (SE_DISCORD_URL; the test server has one, run.mjs):
// a line under the card on the pages around the game, "No code? Ask for one
// on Discord" by the invite code (tests/test_contact.py, as this server asks
// for none), a Discord button on the classic game's bar, and Discord in the
// new client's Menu, before Log out. Each opens a new tab, so the game plays
// on; none is followed here.

import assert from "node:assert/strict";
import { DISCORD } from "../lib.mjs";

async function newTab(link) {
  assert.equal(await link.getAttribute("href"), DISCORD);
  assert.equal(await link.getAttribute("target"), "_blank", "a new tab: the game plays on");
  assert.equal(await link.getAttribute("rel"), "noopener");
}

async function fits(page) {
  return page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
}

export default async function contact({ newPlayer }) {
  const player = await newPlayer();
  const { page } = player;

  // Signed out: the front page, on a computer and on a narrow phone.
  const visitor = await page.context().browser().newContext();
  const front = await visitor.newPage();
  const problems = [];
  front.on("pageerror", (error) => problems.push(error.message));
  await front.goto(`${player.base}/`);
  const line = front.locator(".contact a");
  assert.ok(await line.isVisible(), "the front page says where to get in touch");
  assert.match(await line.textContent(), /Get in touch on Discord/);
  await newTab(line);
  await front.screenshot({ path: `${player.out}/front.png`, fullPage: true });
  for (const width of [390, 320]) {
    await front.setViewportSize({ width, height: 844 });
    assert.ok(await line.isVisible());
    assert.ok(await fits(front), `the front page fits ${width} pixels`);
  }
  await front.screenshot({ path: `${player.out}/front-phone.png`, fullPage: true });
  await visitor.close();
  assert.deepEqual(problems, []);

  // Signed in: the empires page and the Everybody page.
  for (const path of ["/", "/friends"]) {
    const other = await page.context().newPage();
    await other.goto(`${player.base}${path}`);
    await newTab(other.locator(".contact a"));
    assert.ok(await other.locator(".contact a").isVisible(), `${path} says where to get in touch`);
    await other.close();
  }

  // The classic game's bar: a button by Empires.
  const classic = await page.context().newPage();
  await classic.goto(`${player.base}/ruffle.html`, { waitUntil: "domcontentloaded" });
  const button = classic.locator("#gamebar #discord-button");
  assert.ok(await button.isVisible(), "the classic bar has Discord");
  await newTab(button);
  assert.equal(await button.getAttribute("aria-label"), "Discord");
  const order = await classic.locator("#gamebar nav > a").evaluateAll((links) => links.map((a) => a.textContent.trim()));
  assert.ok(order.indexOf("Discord") === order.indexOf("Empires") - 1, `Discord sits before Empires: ${order}`);
  await classic.locator("#gamebar").screenshot({ path: `${player.out}/classic-bar.png` });
  for (const width of [390, 360, 320]) {
    await classic.setViewportSize({ width, height: 844 });
    assert.ok(await button.isVisible(), `on a ${width}-pixel phone too, as an icon`);
    const logOut = await classic.locator("#gamebar nav form button").boundingBox();
    assert.ok(logOut.x + logOut.width <= width, `Log out still fits beside it at ${width} pixels`);
    assert.ok(await fits(classic), `the classic page fits ${width} pixels`);
    await classic.locator("#gamebar").screenshot({ path: `${player.out}/classic-bar-${width}.png` });
  }
  await classic.close();

  // The new client: Discord in the Menu, before Log out; picking it puts the Menu away.
  const menu = page.getByRole("button", { name: /^Menu/ });
  await menu.click();
  const list = page.locator(".site-menu");
  const discord = list.getByRole("menuitem", { name: "Discord" });
  assert.ok(await discord.isVisible(), "the Menu has Discord");
  await newTab(discord);
  const items = await list.getByRole("menuitem").evaluateAll((all) => all.map((item) => item.textContent.trim()));
  assert.deepEqual(items.slice(-2), ["Discord", "Log out"]);
  // Nothing on the town's screen covers the open Menu (the camp and raid countdown sits below it).
  for (const item of await list.getByRole("menuitem").all()) {
    const box = await item.boundingBox();
    const onTop = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest(".site-menu") !== null,
      { x: box.x + box.width / 2, y: box.y + box.height / 2 });
    assert.ok(onTop, `${await item.textContent()} can be seen and picked`);
  }
  await player.shot("menu");
  // Picking it opens a new tab and leaves the game where it was. The test
  // never goes to discord.gg: the tab's request is stopped on the way.
  await page.context().route("https://discord.gg/**", (route) => route.abort());
  const opened = page.context().waitForEvent("page");
  await discord.click();
  await (await opened).close();
  assert.ok(page.url().endsWith("/client.html"), "the game stays open");
  assert.ok(await list.isHidden(), "picking Discord puts the Menu away");

  const phone = await player.onPhone();
  await phone.page.getByRole("button", { name: /^Menu/ }).click();
  assert.ok(await phone.page.locator(".site-menu").getByRole("menuitem", { name: "Discord" }).isVisible());
  await phone.shot("menu-phone");
}
