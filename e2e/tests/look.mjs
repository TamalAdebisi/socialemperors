// The look: the game's own icons on a desktop and a phone, a selected
// building's buttons, the shop, and signs over a farm and a mill that are
// working. Mostly screenshots for a person to look at; it checks that every
// icon loaded.

import assert from "node:assert/strict";

export default async function look({ newPlayer }) {
  const player = await newPlayer();
  // A farm and a mill, each with a villager, as the Flash client would set them up.
  await player.send([
    { cmd: "buy", args: [10, 47, 51, 0, 0, 0, 1] }, { cmd: "buy", args: [5, 47, 53, 0, 0, 0, 1] },
    { cmd: "buy", args: [500, 43, 53, 0, 0, 0, 1] }, { cmd: "buy", args: [500, 44, 53, 0, 0, 0, 1] },
    { cmd: "push_unit", args: [43, 53, 500, 47, 51, 0] }, { cmd: "push_unit", args: [44, 53, 500, 47, 53, 0] },
  ]);
  const setUpAt = Date.now();
  await player.reload();

  await player.select([51, 47], "Tower I");
  await player.shot("desktop");
  await iconsLoaded(player);
  await player.press("Close");

  await player.press("Build");
  await player.wait(1500);
  await player.shot("shop");
  await iconsLoaded(player);
  await player.page.keyboard.press("Escape");

  // The farm is ready 32.4 s after its villager walked in: its sign changes.
  await player.wait(Math.max(0, setUpAt + 35_000 - Date.now()));
  await player.shot("signs");

  const phone = await player.onPhone();
  await phone.wait(700);
  await phone.shot("phone");
  await iconsLoaded(phone);
}

async function iconsLoaded(player) {
  const broken = await player.page.evaluate(() => [...document.querySelectorAll("img.icon")]
    .filter((img) => img.complete && img.naturalWidth === 0).map((img) => img.getAttribute("src")));
  assert.deepEqual(broken, [], "every icon loads");
}
