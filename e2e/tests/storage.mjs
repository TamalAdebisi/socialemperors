// Storage, and the original's rules for trees and rocks: store a tower and a
// house, place the tower back elsewhere, sell the house from storage, and
// remove a stone rock on bought land.

import assert from "node:assert/strict";
import { has, stored } from "../lib.mjs";

const TOWER = 29, HOUSE = 1;
const ROCK = [69, 47, 53], TREE = [50, 58], TOWER_AT = [59, 49], HOUSE_AT = [44, 52], NEW_TOWER_AT = [47, 51];

export default async function storage({ newPlayer }) {
  const player = await newPlayer();
  // A stone rock, placed as the Flash client places one that grew back.
  await player.send([{ cmd: "buy", args: [...ROCK, 1, 0, 1, 1, "b"] }]);
  await player.reload();

  await player.select(TREE, "Tree");
  assert.deepEqual((await player.barButtons()).filter((label) => /Sell|Remove/.test(label)), [], "trees can't be sold");
  await player.press("Close");

  // A rock on your own land: removed for nothing, after asking.
  await player.select(ROCK.slice(1), "Stone");
  await player.press("Remove");
  assert.match(await player.bar(), /Remove/, "removing asks to confirm");
  await player.press("Remove");

  await player.select(TOWER_AT, "Tower I");
  await player.press("Store");
  await player.select(HOUSE_AT, "House I");
  await player.press("Store");

  await player.press("Storage");
  await player.wait(800);
  await player.shot("window");
  assert.deepEqual((await player.page.locator(".shop-card.stored .shop-name").allTextContents()).sort(), ["House I", "Tower I"]);

  await player.card("Tower I").getByRole("button", { name: "Place" }).click();
  await player.wait(300);
  await player.tapTile(NEW_TOWER_AT);

  await player.press("Storage");
  await player.card("House I").getByRole("button", { name: "Sell" }).click();
  await player.card("House I").locator(".shop-actions button").last().click();  // sure?
  await player.wait(300);
  assert.equal(await player.page.locator(".shop-card.stored").count(), 0, "storage is empty");
  await player.shot("empty");

  // The shop's pictures are the Flash client's own.
  await player.page.locator(".shop-categories button").first().click();
  await player.wait(1500);
  const pictures = await player.page.evaluate(() => [...document.querySelectorAll(".shop-picture img")].slice(0, 6).map((img) => img.naturalWidth));
  assert.ok(pictures.length > 0 && pictures.every((width) => width > 0), `the shop's pictures load: ${pictures}`);
  await player.page.keyboard.press("Escape");

  const map = await player.saved();
  assert.ok(!has(map, ROCK[0], ROCK.slice(1)), "the rock is gone");
  assert.ok(has(map, TOWER, NEW_TOWER_AT) && !has(map, TOWER, TOWER_AT), "the tower moved through storage");
  assert.ok(!has(map, HOUSE, HOUSE_AT), "the house left the town");
  assert.equal(stored(map.store, TOWER) + stored(map.store, HOUSE), 0, "nothing left in storage");
}
