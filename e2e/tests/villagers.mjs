// Villagers by town hall (CLIENT.md, "Villagers at work"): with no town
// hall a villager lines up 3 trees, which glow pale yellow, and works them
// one after another; a fourth doesn't fit (the tree is selected instead).
// With Town Hall IV they're "Villager IV" and line up 10. The save hears the
// trees cut, and the fourth is left standing.

import assert from "node:assert/strict";
import { has } from "../lib.mjs";

const VILLAGER = 500, TREE = 19, TOWN_HALL = 26, TOWN_HALL_IV = 141;
const HALL_AT = [52, 52], WORKER = [50, 54];
// On screen where the camera starts, and apart from each other, so the villager doesn't go on to touching ones by itself.
const TREES = [[54, 46], [55, 50], [54, 55], [48, 57]];

export default async function villagers({ newPlayer }) {
  const player = await newPlayer();
  await player.send([
    { cmd: "sell", args: [...HALL_AT, TOWN_HALL, 0, 1, "TEST"] },
    { cmd: "buy", args: [VILLAGER, ...WORKER, 0, 0, 1, 1] },
    ...TREES.map(([x, y]) => ({ cmd: "buy", args: [TREE, x, y, 0, 0, 1, 1] })),
  ]);
  await player.reload();
  const spot = async (tile, name) => {
    const { point, text } = await player.select(tile, name);
    await player.press("Close");
    return { point, text };
  };
  const trees = [];
  for (const tile of TREES) {
    trees.push((await spot(tile, "Tree")).point);
  }
  const worker = await player.select(WORKER, "Villager I");
  assert.match(worker.text, /up to 3 trees or rocks/, "no town hall: 3 in line");

  // Three trees in line: they glow; the villager sets off for the first.
  const before = await paleYellowAround(player, trees[2]);
  for (const tree of trees.slice(0, 3)) {
    await player.click(tree);
  }
  const after = await paleYellowAround(player, trees[2]);
  await player.shot("lined-up");
  assert.ok(after > before + 30, `the third tree glows: ${before} -> ${after} pale yellow pixels`);

  // A fourth doesn't fit: the tree is selected instead.
  await player.click(trees[3]);
  await player.said(/Villager I has 3 lined up already/);
  assert.match(await player.bar(), /^Tree/);

  // All three are cut, one after another (up to a minute on a slow machine); the fourth stays.
  let saved;
  for (let tries = 0; tries < 14; tries++) {
    saved = await player.saved();
    if (TREES.slice(0, 3).every((tile) => !has(saved, TREE, tile))) break;
  }
  await player.shot("cut");
  for (const tile of TREES.slice(0, 3)) {
    assert.ok(!has(saved, TREE, tile), `the tree at ${tile} is cut`);
  }
  assert.ok(has(saved, TREE, TREES[3]), "the fourth is still there");

  // Town Hall IV: Villager IV, 10 in line.
  await player.send([{ cmd: "buy", args: [TOWN_HALL_IV, ...HALL_AT, 0, 0, 1, 1] }]);
  await player.reload();
  const villager = (await player.saved({ waitForBatch: false })).items.find((i) => i[0] === VILLAGER);
  const upgraded = await player.select([villager[1], villager[2]], "Villager IV");
  assert.match(upgraded.text, /up to 10 trees or rocks/);
}

/** How many of the screen's pixels are the line's pale yellow (0xffffb0), in a box round a point. */
async function paleYellowAround(player, point) {
  const shot = (await player.page.screenshot()).toString("base64");
  return player.page.evaluate(async ({ shot, point }) => {
    const image = new Image();
    image.src = `data:image/png;base64,${shot}`;
    await image.decode();
    const scale = image.width / window.innerWidth;
    const box = { x: (point.x - 60) * scale, y: (point.y - 90) * scale, w: 120 * scale, h: 130 * scale };
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext("2d");
    context.drawImage(image, 0, 0);
    const { data } = context.getImageData(box.x, box.y, box.w, box.h);
    let pale = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] > 235 && data[i + 1] > 235 && data[i + 2] > 150 && data[i + 2] < 200) pale++;
    }
    return pale;
  }, { shot, point });
}
