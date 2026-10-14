// Speed (CLIENT.md, "Sound and speed"): the game's config and the client's
// script come gzip-compressed, a tenth of their size, and Arthur's grown
// town (402 things, 69 pictures) opens; the test says how long it took.
// The limit is generous: a first run downloads the pictures.

import assert from "node:assert/strict";

export default async function speed({ newPlayer }) {
  const player = await newPlayer();
  const { page } = player;
  const packed = new Map();
  page.on("response", async (response) => {
    const url = response.url();
    if (url.endsWith("/get_game_config.php") || url.endsWith("/client/client.js")) {
      const headers = await response.allHeaders();
      packed.set(url.endsWith(".js") ? "script" : "config", headers["content-encoding"]);
    }
  });
  const started = Date.now();
  await page.goto(`${player.base}/client.html?visit=100000032`);
  await player.loaded();
  const took = Date.now() - started - 800;  // loaded() waits 800 ms for the signs
  console.log(`  Arthur's grown town opened in ${(took / 1000).toFixed(1)} s`);
  assert.equal(packed.get("config"), "gzip", "the config comes compressed");
  assert.equal(packed.get("script"), "gzip", "and the script");
  assert.ok(took < 30_000, `opened in ${took} ms`);
  assert.match(await page.locator(".hud-visiting").textContent(), /Visiting Arthur/);
  await player.shot("arthur-grown");
}
