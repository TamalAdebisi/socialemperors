// The server's message as the town opens (CLIENT.md, "Missions and
// bonuses"): what neighbours did and gifts that came, a line each. The new
// client shows it once, before the carts, and OK tells the server it's read
// (clear_message), as the Flash client does. The message is put in the town
// on its way to the browser here; the server's side has tests of its own.

import assert from "node:assert/strict";

const MESSAGE = "Bob took an hour off your Farm Land.\nA Pumpkin from Ann is in your Gifts and Storage.";

export default async function messages({ newPlayer }) {
  const player = await newPlayer();
  const { page } = player;
  await page.route("**/get_player_info.php", async (route) => {
    const response = await route.fetch();
    const json = await response.json();
    if (json.privateState) json.privateState.message = MESSAGE;
    await route.fulfill({ response, json });
  });
  const sent = [];
  page.on("request", (request) => {
    if (request.url().endsWith("/command.php")) sent.push(request.postData() ?? "");
  });
  await player.reload();
  await page.unroute("**/get_player_info.php");

  const bar = await player.bar();
  assert.ok(bar.startsWith("Bob took an hour off your Farm Land.") && bar.includes("is in your Gifts and Storage."), `the message: "${bar}"`);
  await player.shot("message");
  await player.press("OK");
  assert.equal(await player.bar(), "", "read: it goes");
  await player.wait(4000);  // the next batch
  assert.ok(sent.some((data) => decodeURIComponent(data).includes("clear_message")), "the server hears it's read");
}
