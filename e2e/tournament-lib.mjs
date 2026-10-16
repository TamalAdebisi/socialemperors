// Shared local-server setup and observations for the tournament browser tests.
// These use the same command/service envelope as the original client.
import assert from "node:assert/strict";
import { PHONE } from "./lib.mjs";

export const SWORD = 511;
export const FULL_TEAM = Array(20).fill(SWORD);
export const padded = (...ids) => [...ids, ...Array(20 - ids.length).fill(0)];
export const tournamentPath = (name) => `**/tournaments/${name}.php`;

export function requestData(request) {
  const data = new URLSearchParams(request.postData() ?? "").get("data") ?? "";
  return JSON.parse(data.slice(data.indexOf(";") + 1));
}

export async function playerInfo(player) {
  const response = await player.page.request.post(`${player.base}${player.settings.dynamicUrl}/get_player_info.php`,
    { form: { USERID: player.settings.userId, user_key: player.settings.userKey } });
  assert.ok(response.ok());
  return response.json();
}

export async function service(player, name, params = {}) {
  const response = await player.page.request.post(`${player.base}${player.settings.dynamicUrl}/tournaments/${name}.php`,
    { form: { USERID: player.settings.userId, user_key: player.settings.userKey,
      data: "0".repeat(64) + ";" + JSON.stringify({ user_id: player.settings.userId, ...params }) } });
  assert.ok(response.ok(), `${name}: HTTP ${response.status()}`);
  return (await response.json()).data;
}

export async function prepare(player, team = FULL_TEAM) {
  await player.send([
    { cmd: "rt_level_up", args: [15] },
    // Tournament entrants use the current empire's name, not the login name.
    { cmd: "name_map", args: [0, player.name] },
    { cmd: "store_add_items", args: [JSON.stringify(FULL_TEAM)] },
    { cmd: "collect_treasure", args: [100000, 0, 3, 0, 0, 0] },
    { cmd: "set_attack_team", args: ["tournament", JSON.stringify(team)] },
    { cmd: "set_help_map", args: ["tournamentHelp"] },
  ]);
  await player.reload();
  // These scenarios prepare several separate players. Park each unused town
  // through its real Pause control, as a background game tab would pause,
  // rather than spend the software renderer on four idle towns at once.
  await player.press("Pause");
}

export async function open(player, phone = false) {
  if (await player.page.locator(".pause-curtain").count()) await player.press("Resume");
  await player.menu(phone ? "World" : "Battle");
  await player.page.locator(".panel:not([hidden]) .row", { hasText: "Tournament" }).locator("a").click();
  await player.page.waitForSelector(".tournament-cards, .tournament-room, .tournament-results");
}

export async function confirm(player, action, accept = true) {
  const dialog = player.page.waitForEvent("dialog");
  const clicked = action();
  const prompt = await dialog;
  assert.equal(prompt.type(), "confirm");
  const message = prompt.message();
  if (accept) await prompt.accept();
  else await prompt.dismiss();
  await clicked;
  return message;
}

export async function gold(player, expected) {
  await player.page.waitForFunction((amount) =>
    Number(document.querySelector('[data-n="gold"]')?.textContent?.replace(/,/g, "")) === amount,
  expected, { timeout: 15_000 });
  assert.equal((await playerInfo(player)).map.coins, expected, "the HUD and saved gold agree");
}

export async function fitsPhone(player) {
  const box = await player.page.locator(".tournament-window").boundingBox();
  assert.ok(box && box.x >= 0 && box.x + box.width <= PHONE.width + 1, "the tournament sheet fits the phone");
  assert.equal(await player.page.locator(".tournament-window .panel-body").evaluate((el) => el.scrollWidth <= el.clientWidth),
    true, "the tournament content has no horizontal overflow");
}

export async function gameConfig(player) {
  return (await player.page.request.post(`${player.base}${player.settings.dynamicUrl}/get_game_config.php`,
    { form: { USERID: player.settings.userId, user_key: player.settings.userKey } })).json();
}

export async function join(player, type = "1", room = "", team = FULL_TEAM, category = 1) {
  const reply = await service(player, "join_tournament", {
    tournament_type_id: type, category, tournament_id: room, team, flashSubResources: 1,
  });
  assert.equal(reply.result, "OK");
  return reply.tournament;
}

/** Real service results set up a saved results screen; battle mechanics have their own test. */
export async function finish(player, room, victim, points = "90.00", won = true) {
  assert.equal((await service(player, "start_tournament_match", { tournament_id: room, victim_id: victim })).result, "OK");
  assert.equal((await service(player, "finish_tournament_match", {
    tournament_id: room, victim_id: victim, attacker_won: won, attacker_points: points, victim_points: 0,
  })).result, "OK");
}
