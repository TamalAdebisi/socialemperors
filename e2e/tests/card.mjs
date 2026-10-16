// The building card as the Flash client's info panel (CLIENT.md, "The
// building card"): on its parchment, a farm's picture and life, what it
// earns with its time bar, who's inside and its Upgrade, which waits for
// level 28; a house's numbers, upgraded to House II on the same tile (the
// save hears a sale for "UPGR" and the purchase: 60 wood paid, 1 back, 6
// experience); the town hall's Train with its price and the bubble over the
// villager; a mill's Hurry up opening the game's window; and the farm's card
// on a phone.

import assert from "node:assert/strict";
import { has } from "../lib.mjs";

const FARM = [10, 55, 56], HOUSE = [1, 46, 47], MILL = [5, 56, 52], VILLAGER = 500, HALL = [52, 52];
const HOUSE_2 = 2;

export default async function card({ newPlayer }) {
  const player = await newPlayer();
  const { page } = player;
  await player.send([
    { cmd: "rt_level_up", args: [7] },
    { cmd: "buy", args: [...FARM, 0, 0, 1, 1] },
    { cmd: "buy", args: [VILLAGER, 58, 57, 0, 0, 1, 1] },
    { cmd: "push_unit", args: [58, 57, VILLAGER, FARM[1], FARM[2], 0] },
    { cmd: "buy", args: [...HOUSE, 0, 0, 1, 1] },
    { cmd: "buy", args: [...MILL, 0, 0, 1, 1, "b"] },
    { cmd: "buy", args: [VILLAGER, 56, 55, 0, 0, 1, 1, "u"] },
    { cmd: "push_unit", args: [56, 55, VILLAGER, MILL[1], MILL[2], 0] },
    { cmd: "activate", args: [MILL[1], MILL[2], 0, MILL[0], 4] },
  ]);
  await player.reload();
  const card = page.locator(".actions.card");

  // The farm: its life, what it earns, its bar, who's inside.
  const farm = await player.select(FARM.slice(1), "Farm Land");
  assert.match(farm.text, /^Farm Land.*Earns:\s+15.*\d+%.*Ready in.*CAPACITY 1\/1/s);
  assert.equal(await card.locator(".card-life").getAttribute("aria-label"), "Life 100 of 100");
  assert.equal(await card.locator(".card-unit").getAttribute("aria-label"), "Let out Villager I");
  // Upgrade: over it, the next field and the level it waits for; pressed, the game's words why not.
  await card.locator(".card-upgrade-button").hover();
  assert.match(await card.locator(".card-upgrade-bubble").textContent(), /^Carrot Field/);
  assert.equal(await card.locator(".card-unlock").getAttribute("aria-label"), "From level 28");
  await player.shot("farm");
  await card.locator(".card-upgrade-button").click();
  await player.said(/You need to be level 28 to upgrade this building/);
  await player.press("Close");

  // A house: attack, the time between hits, room for people; Upgrade costs House II's 60 wood.
  await player.select(HOUSE.slice(1), "House I");
  assert.deepEqual(await card.locator(".card-stat").evaluateAll((all) => all.map((s) => s.getAttribute("aria-label"))),
    ["Attack Damage: 0", "Attack Delay: 0", "Population Capacity: 3"]);
  assert.equal(await card.getByRole("button", { name: /^(Sell|Remove)$/ }).count(), 0, "no Sell: that's the bulldozer's");
  await card.locator(".card-upgrade-button").hover();
  assert.match(await card.locator(".card-upgrade-bubble").textContent(), /^House II.*Cost\s+60/s);
  await player.shot("house");
  const before = await player.saved();
  await card.locator(".card-upgrade-button").click();
  assert.equal(await player.bar(), "", "the card closes, as the game's");
  await player.wait(500);
  await player.shot("upgrading");
  const after = await player.saved();
  assert.ok(has(after, HOUSE_2, HOUSE.slice(1)) && !has(after, HOUSE[0], HOUSE.slice(1)), "House II stands where House I was");
  assert.equal(after.wood, before.wood + 1 - 60, "60 wood paid, a twentieth of House I's 30 back");
  assert.equal(after.xp, before.xp + 6, "House II's experience");

  // The town hall: Train, its price under the box, the bubble over the villager; Town Hall II from level 12.
  await player.select(HALL, "Town Hall");
  assert.match(await card.locator(".card-train-cost").textContent(), /^COST: 50/);
  await card.locator(".card-train-button").hover();
  assert.match(await card.locator(".card-train-bubble").textContent(), /Allows you to train:.*Villager I.*in a row/s);
  await player.shot("town-hall");
  await card.locator(".card-upgrade-button").hover();
  assert.match(await card.locator(".card-upgrade-bubble").textContent(), /^Town Hall II/);
  assert.equal(await card.locator(".card-unlock").getAttribute("aria-label"), "From level 12");
  await player.press("Close");

  // The mill at work: Hurry up opens the game's window, the mill and its time, and paying to finish now.
  await player.select(MILL.slice(1), "Mill I");
  await player.press("Hurry up");
  const box = card.locator(".card-hurry-box");
  assert.match(await box.textContent(), /WORK IN PROGRESS.*Mill I.*Ready in.*Pay to finish the work instantly/s);
  assert.equal(await box.getByRole("button", { name: "Finish now for 2 cash" }).count(), 1);
  await player.shot("hurry");
  await box.getByRole("button", { name: "Close" }).click();
  assert.equal(await box.count(), 0, "closed, nothing paid");
  await player.press("Close");

  // On a phone: the same card, stacked above the dock.
  const phone = await player.onPhone();
  await phone.select(FARM.slice(1), "Farm Land");
  const box2 = await phone.page.locator(".actions.card").boundingBox();
  assert.ok(box2.x >= 0 && box2.x + box2.width <= 390, `the card fits the phone: ${JSON.stringify(box2)}`);
  await phone.shot("phone");
}
