// The mouse over the town, as in the Flash client (CLIENT.md, "Hovering"):
// a farm at work is lit (a white outline, its life bar) with the game's
// popup over it, its name, how far along its round is and the time left; a
// tower is lit without a popup; the ground lights nothing. With the
// bulldozer only what it would take lights up, its ground too. Tapped when
// ready, the farm runs the game's short "Collecting..." bar, then its
// harvest reaches the save.

import assert from "node:assert/strict";

const FARM = [10, 55, 56], TOWER = [29, 49, 57], HOUSE = [1, 47, 53], VILLAGER = 500, SPOT = [56, 57], HALL = [52, 52];

export default async function hover({ newPlayer }) {
  const player = await newPlayer();
  const { page } = player;
  await player.send([
    { cmd: "buy", args: [...FARM, 0, 0, 1, 1] },
    { cmd: "buy", args: [...TOWER, 0, 0, 1, 1] },
    { cmd: "buy", args: [...HOUSE, 0, 0, 1, 1] },
    { cmd: "buy", args: [VILLAGER, ...SPOT, 0, 0, 1, 1] },
    { cmd: "push_unit", args: [...SPOT, VILLAGER, FARM[1], FARM[2], 0] },
  ]);
  const setUpAt = Date.now();
  await player.reload();
  // Where each is on the screen: found by selecting it (pictures stand higher or lower than a guess).
  const spot = async (at, name) => {
    const { point } = await player.select(at.slice(1), name);
    await page.keyboard.press("Escape");
    return point;
  };
  const farm = await spot(FARM, "Farm Land");
  const tower = await spot(TOWER, "Tower I");
  const house = await spot(HOUSE, "House I");
  // What the map shows lit: the thing's name, its popup's words, its life bar, and its ground outlined.
  const lit = () => page.evaluate(() => {
    const view = window.seHome.parts.view;
    const words = [];
    const read = (node) => {
      if (typeof node.text === "string" && node.text) words.push(node.text);
      (node.children ?? []).forEach(read);
    };
    if (view.popup) read(view.popup.popup);
    const slot = view.hovered && view.slots.get(view.hovered);
    return {
      name: view.hovered?.item.name ?? null,
      popup: view.popup && view.popup.popup.visible ? words : null,
      life: Boolean(slot?.getChildByLabel("hover-life")),
      ground: view.marks.children.length > 0,
    };
  });

  // The farm at work: lit, with its popup.
  await page.mouse.move(farm.x, farm.y);
  await player.wait(400);
  await player.shot("farm");
  const working = await lit();
  assert.equal(working.name, "Farm Land");
  assert.ok(working.life, "its life bar");
  assert.equal(working.popup?.[0], "Farm Land", "the popup: its name");
  assert.match(working.popup?.[1] ?? "", /^\d+%$/, "how far along");
  assert.match(working.popup?.[2] ?? "", /\d+ s$/, "the time left");
  assert.ok(!working.ground, "the pointer doesn't outline its ground");

  // A tower: lit, no popup. The ground: nothing.
  await page.mouse.move(tower.x, tower.y);
  await player.wait(400);
  const towerLit = await lit();
  assert.equal(towerLit.name, "Tower I");
  assert.equal(towerLit.popup, null, "a defence has no popup");
  const ground = player.screenOf(58, 61);
  await page.mouse.move(ground.x, ground.y);
  await player.wait(300);
  assert.equal((await lit()).name, null, "nothing on the ground");

  // The bulldozer: the house lights up with its ground; the town hall doesn't.
  await page.locator(".pointer-tool").click();
  await page.locator('.tool-menu [data-tool="remove"]').click();
  await page.mouse.move(house.x, house.y);
  await player.wait(400);
  await player.shot("bulldozer");
  const sellable = await lit();
  assert.equal(sellable.name, "House I");
  assert.ok(sellable.ground, "its ground outlined");
  const hall = player.screenOf(...HALL, 60);
  await page.mouse.move(hall.x, hall.y);
  await player.wait(300);
  assert.equal((await lit()).name, null, "the town hall can't be taken: nothing lit");
  await page.locator(".pointer-tool").click();

  // Ready (32.4 seconds after the villager went in): tapped, the "Collecting..." bar, then the food.
  await player.wait(Math.max(0, setUpAt + 35_000 - Date.now()));
  const before = await player.saved({ waitForBatch: false });
  const food = () => page.evaluate(() => window.seHome.parts.town.food);
  const foodBefore = await food();
  await page.mouse.click(farm.x, farm.y);
  const bar = await page.evaluate(() => {
    const shown = [...window.seHome.parts.view.bars.entries()].find(([p]) => p.item.id === 10);
    return shown ? shown[1].bar.text.text : null;
  });
  assert.equal(bar, "Collecting...", "the game's collecting bar");
  assert.equal(await food(), foodBefore, "not collected while the bar fills");
  await player.shot("collecting");
  await player.wait(1000);
  assert.equal(await food(), foodBefore + 15, "collected once it's full");
  const after = await player.saved();
  assert.equal(after.food, before.food + 15, "collected once the bar is full");
}
