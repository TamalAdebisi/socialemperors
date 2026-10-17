// Selecting several units, as in the Flash client (CLIENT.md, "Selecting
// several units"): a drag that starts on a unit draws a box and selects the
// player's units in it; tapping the ground sends them to a square of tiles
// grown from it; a double click on a unit selects its kind near it; a group
// sent to a tree spreads out round it; and the square tool (Space) draws a
// box from anywhere, once. The save hears each unit's move.

import assert from "node:assert/strict";
import { has } from "../lib.mjs";

const VILLAGER = 500, SPEARMAN = 509;
const ROW = [[51, 59], [52, 59], [53, 59], [54, 59]];
const SOLDIER = [55, 55];
// Where the group is sent: it stands on this tile and the three after it in the square.
const GROUND = [57, 55];
const SQUARE = [[57, 55], [58, 55], [58, 56], [57, 56]];
const TREE = [43, 54];

export default async function group({ newPlayer }) {
  const player = await newPlayer();
  const { page } = player;
  await player.send([
    ...ROW.map(([x, y]) => ({ cmd: "buy", args: [VILLAGER, x, y, 0, 0, 0, 1] })),
    { cmd: "buy", args: [SPEARMAN, ...SOLDIER, 0, 0, 0, 1] },
  ]);
  await player.reload();
  const tree = await player.select(TREE, "Tree");
  await page.keyboard.press("Escape");
  const portraits = () => page.locator(".actions .portrait");
  const names = async () => page.locator(".actions .portrait").evaluateAll((all) => all.map((p) => p.getAttribute("aria-label")));
  const drag = async (from, to) => {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    for (let i = 1; i <= 10; i++) {
      await page.mouse.move(from.x + ((to.x - from.x) * i) / 10, from.y + ((to.y - from.y) * i) / 10);
      await player.wait(30);
    }
  };

  // A drag from the first villager to past the last: a box, and the four in it selected.
  const first = player.screenOf(...ROW[0], 45);
  const last = player.screenOf(...ROW[3], 27);
  await drag(first, { x: last.x + 30, y: last.y + 15 });
  await player.shot("box");
  await page.mouse.up();
  await player.wait(300);
  assert.equal(await portraits().count(), 4, "the four villagers in the box are selected");
  assert.deepEqual(await names(), ["Villager I", "Villager I", "Villager I", "Villager I"]);
  await player.shot("selected");

  // The ground tapped: they walk to a square grown from that tile, one each.
  await player.click(player.screenOf(...GROUND, 27));
  assert.equal(await portraits().count(), 4, "still selected, as in the Flash client");
  await player.wait(6000);
  await player.shot("sent");
  const saved = await player.saved();
  for (const tile of SQUARE) {
    assert.ok(has(saved, VILLAGER, tile), `a villager stands on ${tile}`);
  }

  // A double click on one: the villagers near it, not the spearman.
  await page.keyboard.press("Escape");
  // The original-height info panel covers the feet after the first click.
  // Double-click the visible head, with the browser sending both clicks.
  const one = player.screenOf(...SQUARE[0], 60);
  assert.equal(await page.evaluate((point) => window.seHome.parts.view.itemAt(point)?.item.id, one), VILLAGER,
    "the double click targets a villager's picture");
  // Send both clicks together: waiting for each protocol acknowledgment
  // can stretch them seconds apart while software rendering is busy.
  await page.mouse.dblclick(one.x, one.y);
  await player.wait(300);
  const kin = await names();
  assert.ok(kin.length >= 4 && kin.every((name) => name === "Villager I"), `the villagers near it: ${kin}`);

  // To a tree: each to a tile of its own beside it (some round the far side of the clump, so it takes a while).
  await player.click(tree.point);
  let near = [];
  for (let tries = 0; tries < 8 && near.length < 4; tries++) {
    const working = await player.saved();
    near = working.items.filter(([id, x, y]) => id === VILLAGER && Math.max(Math.abs(x - TREE[0]), Math.abs(y - TREE[1])) <= 4);
  }
  await player.shot("tree");
  assert.ok(near.length >= 4, `the villagers went to the tree: ${JSON.stringify(near)}`);
  assert.equal(new Set(near.map(([, x, y]) => `${x},${y}`)).size, near.length, "each on a tile of its own");

  // The square tool: Space, then a box from bare ground round the spearman alone; then it's off.
  await page.keyboard.press("Escape");
  await page.keyboard.press("Space");
  assert.ok(await page.locator(".square-tool.lit").isVisible(), "the square tool is on");
  const soldier = player.screenOf(...SOLDIER, 27);
  await drag({ x: soldier.x - 50, y: soldier.y - 90 }, { x: soldier.x + 50, y: soldier.y + 20 });
  await page.mouse.up();
  await player.wait(300);
  assert.ok((await player.bar()).startsWith("Spearman"), `the spearman alone is selected: "${await player.bar()}"`);
  assert.equal(await page.locator(".square-tool.lit").count(), 0, "the square tool works once");

  // On a phone: the square tool's button above the dock, then a box round the villagers at the trees.
  const phone = await player.onPhone();
  await phone.page.locator(".square-tool").click();
  // Where the phone has them now: they may have moved on from the tiles the save had a moment ago.
  const here = await phone.page.evaluate(([id, tx, ty]) => window.seHome.parts.town.items
    .filter((p) => p.item.id === id && Math.max(Math.abs(p.tx - tx), Math.abs(p.ty - ty)) <= 4)
    .map((p) => [p.tx, p.ty]), [VILLAGER, ...TREE]);
  const spots = (here.length >= 2 ? here : near.map(([, x, y]) => [x, y])).map(([x, y]) => phone.screenOf(x, y, 27));
  const xs = spots.map((p) => p.x), ys = spots.map((p) => p.y);
  const onScreen = (x) => Math.min(Math.max(x, 5), 385);  // a press off the edge misses the map
  await phone.page.mouse.move(onScreen(Math.min(...xs) - 30), Math.min(...ys) - 60);
  await phone.page.mouse.down();
  await phone.page.mouse.move(onScreen(Math.max(...xs) + 30), Math.max(...ys) + 30, { steps: 10 });
  await phone.page.mouse.up();
  await phone.wait(300);
  await phone.shot("phone");
  assert.ok(await phone.page.locator(".actions .portrait").count() >= 2, "the villagers are selected on a phone too");
}
