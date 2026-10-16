// The site's links in the new client (CLIENT.md, "The menus: rail and
// dock"): a Menu by Full screen, as the classic page's bar. A friend's
// request waits on the Friends page, so the Menu and its Friends carry a
// red 1; Friends opens the site's page in a new tab, Empires the front page;
// on a phone the Menu sits by Classic game; Log out signs the player out.

import assert from "node:assert/strict";

export default async function siteMenu({ newPlayer }) {
  const player = await newPlayer();
  const friend = await newPlayer();
  await friend.page.goto(`${friend.base}/friends`);
  await friend.page.getByRole("textbox", { name: "Username of the player to add" }).fill(player.name);
  await Promise.all([
    friend.page.waitForURL("**/friends/ask"),
    friend.page.getByRole("button", { name: "Add friend" }).click(),
  ]);
  assert.match(await friend.page.locator(".card").textContent(), new RegExp(`Asked ${player.name}`));
  for (const width of [1280, 390]) {
    await friend.page.setViewportSize({ width, height: 844 });
    const styled = await friend.page.evaluate(() => ({
      card: getComputedStyle(document.querySelector(".card")).backgroundColor,
      scene: getComputedStyle(document.querySelector(".scene")).position,
      images: [...document.querySelectorAll("img")].every((img) => img.complete && img.naturalWidth > 0),
      fits: document.documentElement.scrollWidth <= innerWidth,
      sheets: [...document.styleSheets].map((sheet) => sheet.href),
    }));
    assert.equal(styled.scene, "fixed", "the nested form result loads the site's CSS");
    assert.notEqual(styled.card, "rgba(0, 0, 0, 0)");
    assert.ok(styled.images, "the logo and Friends icons load after submitting");
    assert.ok(styled.fits, "Friends fits the screen");
    assert.ok(styled.sheets.some((href) => href?.endsWith("/css/site.css")));
    await friend.shot(`friends-${width}`);
  }
  await player.reload();
  const { page } = player;

  const menu = page.getByRole("button", { name: /^Menu/ });
  assert.equal(await menu.getAttribute("aria-label"), "Menu, 1 waiting on the Friends page");
  await menu.click();
  const list = page.locator(".site-menu");
  assert.ok(await list.isVisible(), "the Menu opens");
  const friends = list.getByRole("menuitem", { name: "Friends, 1 waiting" });
  assert.equal(await friends.getAttribute("href"), "/friends");
  assert.equal(await friends.getAttribute("target"), "_blank", "a new tab: the game plays on");
  assert.equal(await list.getByRole("menuitem", { name: "Empires" }).getAttribute("href"), "/");
  await player.shot("menu");
  await page.keyboard.press("Escape");
  assert.ok(await list.isHidden(), "Escape puts it away");

  const phone = await player.onPhone();
  await phone.page.getByRole("button", { name: /^Menu/ }).click();
  assert.ok(await phone.page.locator(".site-menu").isVisible());
  await phone.shot("phone");

  // Log out: the site's front page, and the game is the signed-in player's no more.
  await menu.click();
  await Promise.all([page.waitForURL((url) => !url.pathname.endsWith("client.html")), list.getByRole("menuitem", { name: "Log out" }).click()]);
  const again = await page.request.get(`${player.base}/client.html`, { maxRedirects: 0 });
  assert.equal(again.status(), 302, "signed out: the game page sends you to the front page");
}
