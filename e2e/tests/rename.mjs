// Naming the empire (CLIENT.md, "The menus: rail and dock"), as from the
// Flash client's top bar: the level, which carries the town's name, opens
// the game's window. A name shorter than 3 letters isn't taken; Save or
// Enter sends `name_map` and the top bar has the new name at once; Cancel
// changes nothing. Letters typed there aren't the game's shortcuts.

import assert from "node:assert/strict";

export default async function rename({ newPlayer }) {
  const player = await newPlayer();
  const { page } = player;
  const names = async () => {
    const response = await page.request.post(`${player.base}${player.settings.dynamicUrl}/get_player_info.php`,
      { form: { USERID: player.settings.userId, user_key: player.settings.userKey } });
    return (await response.json()).playerInfo.map_names;
  };
  const tip = () => page.locator(".hud-level").getAttribute("data-tip");
  const window = page.locator(".name-window");
  const input = window.locator(".name-input");

  await page.locator(".hud-level").click();
  await window.waitFor();
  assert.equal(await window.locator(".name-band").textContent(), "NAME YOUR EMPIRE");
  const old = await input.inputValue();
  await player.shot("window");

  // Too short: not taken.
  await input.fill("Ab");
  await window.getByRole("button", { name: "Save" }).click();
  assert.ok(await window.isVisible(), "two letters aren't a name");

  // Bob's Hill (a B, which would open the shop as a shortcut), with Enter.
  await input.fill("");
  await input.type("Bob's Hill");
  assert.ok(await page.locator(".shop").isHidden(), "typing B doesn't open the shop");
  await page.keyboard.press("Enter");
  assert.equal(await window.count(), 0, "saved, closed");
  assert.match(await tip(), /Bob's Hill/, "the top bar has the new name");
  await player.saved();  // the commands sent
  assert.equal((await names())[0], "Bob's Hill", "the server has it");

  // Cancel: nothing changes.
  await page.locator(".hud-level").click();
  assert.equal(await input.inputValue(), "Bob's Hill", "the window shows the name it has now");
  await input.fill("Something Else");
  await window.getByRole("button", { name: "Cancel" }).click();
  assert.equal(await window.count(), 0);
  assert.match(await tip(), /Bob's Hill/);
  assert.notEqual(old, "Bob's Hill");

  // On a phone: the window fits.
  const phone = await player.onPhone();
  await phone.page.locator(".hud-level").click();
  await phone.wait(300);
  await phone.shot("phone");
  const box = await phone.page.locator(".name-window").boundingBox();
  assert.ok(box && box.x >= 0 && box.x + box.width <= 390, "within the phone's width");
}
