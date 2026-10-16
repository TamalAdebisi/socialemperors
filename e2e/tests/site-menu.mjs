// The site's links in the new client (CLIENT.md, "The menus: rail and
// dock"): a Menu by Full screen, as the classic page's bar. A friend's
// request waits on the Everybody page, so the Menu and its Everybody carry a
// red 1; Everybody opens the site's page in a new tab, Empires the front page;
// on a phone the Menu sits by Full screen; Log out signs the player out.

import assert from "node:assert/strict";

async function assertMenuTargets(list, screen) {
  const targets = await list.getByRole("menuitem").evaluateAll((items) => items.map((item) => {
    const box = item.getBoundingClientRect();
    const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
    return {
      name: item.textContent.trim(),
      reachable: item.contains(hit),
      hit: hit?.className || hit?.tagName || "nothing",
    };
  }));
  assert.equal(targets.length, 3, `${screen} Menu has all three destinations`);
  for (const target of targets) {
    assert.ok(target.reachable, `${screen} Menu item ${target.name} receives clicks; hit ${target.hit}`);
  }
}

export default async function siteMenu({ newPlayer }) {
  const player = await newPlayer();
  const friend = await newPlayer();
  const csrf = await friend.csrf();
  await friend.page.goto(`${friend.base}/friends`);
  assert.equal(await friend.page.getByRole("button", { name: "Add friend", exact: true }).count(), 0);
  // The old endpoint remains compatible. A fixture form exercises its nested
  // response and assets without restoring friend requests to Everybody's UI.
  await Promise.all([
    friend.page.waitForURL("**/friends/ask"),
    friend.page.evaluate(({ username, csrf }) => {
      const form = document.createElement("form");
      form.method = "post";
      form.action = "/friends/ask";
      for (const [name, value] of Object.entries({ username, csrf })) {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = name;
        input.value = value;
        form.append(input);
      }
      document.body.append(form);
      form.submit();
    }, { username: player.name, csrf }),
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
  assert.equal(await menu.getAttribute("aria-label"), "Menu, 1 waiting on the Everybody page");
  const countdown = page.locator(".home-threats");
  await countdown.waitFor({ state: "visible" });
  assert.match(await countdown.textContent(), /^Next camp .*Next raid /, "the active countdown exercises the overlapping area");
  await menu.click();
  const list = page.locator(".site-menu");
  assert.ok(await list.isVisible(), "the Menu opens");
  const friends = list.getByRole("menuitem", { name: "Everybody, 1 waiting" });
  assert.equal(await friends.getAttribute("href"), "/friends");
  assert.equal(await friends.getAttribute("target"), "_blank", "a new tab: the game plays on");
  assert.equal(await list.getByRole("menuitem", { name: "Empires" }).getAttribute("href"), "/");
  await player.shot("menu");
  await assertMenuTargets(list, "Desktop");
  await page.keyboard.press("Escape");
  assert.ok(await list.isHidden(), "Escape puts it away");
  assert.ok(await countdown.isVisible(), "the countdown remains available after closing Menu");

  const phone = await player.onPhone();
  const phoneCountdown = phone.page.locator(".home-threats");
  await phoneCountdown.waitFor({ state: "visible" });
  assert.match(await phoneCountdown.textContent(), /^Next camp .*Next raid /);
  await phone.page.getByRole("button", { name: /^Menu/ }).click();
  const phoneList = phone.page.locator(".site-menu");
  assert.ok(await phoneList.isVisible());
  await phone.shot("phone");
  await assertMenuTargets(phoneList, "Phone");
  await phone.page.keyboard.press("Escape");
  assert.ok(await phoneList.isHidden(), "Escape also closes the phone Menu");
  assert.ok(await phoneCountdown.isVisible(), "the phone countdown remains available after closing Menu");

  // Log out: the site's front page, and the game is the signed-in player's no more.
  await menu.click();
  await Promise.all([page.waitForURL((url) => !url.pathname.endsWith("client.html")), list.getByRole("menuitem", { name: "Log out" }).click()]);
  const again = await page.request.get(`${player.base}/client.html`, { maxRedirects: 0 });
  assert.equal(again.status(), 302, "signed out: the game page sends you to the front page");
}
