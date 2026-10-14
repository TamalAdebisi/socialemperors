// Villagers at work (CLIENT.md, "Villagers at work"): in a new town, one
// villager is sent to the trees by the houses, cuts one and goes on to the
// next; another mines a stone rock, which leaves one growing back; a third
// goes into a gold mine and is let out again. The save hears all of it as
// the Flash client tells it.

import assert from "node:assert/strict";
import { has, itemAt } from "../lib.mjs";

const VILLAGER = 500, TREE = 19, STONE = 69, REGROWING_STONE = 81, MINE = 13;
const CUTTER = [42, 52], MINER = [45, 57], WORKER = [48, 56];
const FIRST_TREE = [43, 54], ROCK = [47, 58], MINE_AT = [53, 57];

export default async function work({ newPlayer }) {
  const player = await newPlayer();
  await player.send([
    ...[CUTTER, MINER, WORKER].map(([x, y]) => ({ cmd: "buy", args: [VILLAGER, x, y, 0, 0, 0, 1] })),
    { cmd: "buy", args: [STONE, ...ROCK, 0, 0, 0, 1] },
    { cmd: "buy", args: [MINE, ...MINE_AT, 0, 0, 0, 1] },
  ]);
  await player.reload();
  const before = await player.saved({ waitForBatch: false });
  const { page } = player;
  // Where each thing is on the screen: found by selecting it (pictures stand higher or lower than a guess).
  const spot = async (tile, name) => {
    const { point, text } = await player.select(tile, name);
    await player.press("Close");
    return { point, text };
  };
  const villager = async (tile) => (await spot(tile, "Villager I")).point;
  const tree = await spot(FIRST_TREE, "Tree");
  assert.match(tree.text, /Select a villager, then tap it/, "a tree says how it's cut");
  const rock = (await spot(ROCK, "Stone")).point;
  const mine = (await spot(MINE_AT, "Gold Mine I")).point;
  const [cutter, miner, worker] = [await villager(CUTTER), await villager(MINER), await villager(WORKER)];

  // The cutter to the first tree: it walks beside it and chops.
  await player.click(cutter);
  await player.click(tree.point);
  await player.wait(2500);
  await player.shot("chopping");

  // The miner to the rock, the worker into the mine.
  await player.click(miner);
  await player.click(rock);
  await player.click(worker);
  await player.click(mine);
  await player.wait(9000);
  await player.shot("after");

  const saved = await player.saved();
  assert.ok(!has(saved, TREE, FIRST_TREE), "the first tree is cut");
  assert.ok(saved.wood >= before.wood + 20, `its wood: ${before.wood} -> ${saved.wood}`);
  assert.ok(!has(saved, STONE, ROCK), "the rock is mined");
  assert.ok(has(saved, REGROWING_STONE, ROCK), "and one grows back there");
  assert.equal(saved.stone, before.stone + 10);
  assert.ok(saved.xp >= before.xp + 2, "a point of experience each");
  assert.deepEqual(itemAt(saved, MINE, MINE_AT)?.[6], [VILLAGER], "the worker is in the mine");
  assert.ok(!has(saved, VILLAGER, WORKER), "and no longer on the map");
  const trees = saved.items.filter((i) => i[0] === TREE).length;
  const treesBefore = before.items.filter((i) => i[0] === TREE).length;
  assert.ok(trees < treesBefore, `the cutter went on to the next tree: ${treesBefore} -> ${trees}`);

  // Let the worker out again: it stands beside the mine.
  // Its worker waits for a working time, so tapping it asks how long, with a way out too.
  await player.click(mine);
  assert.match(await player.bar(), /^How long should Gold Mine I work\?/);
  await player.press("Let out");
  const out = await player.saved();
  assert.deepEqual(itemAt(out, MINE, MINE_AT)?.[6], [], "the mine is empty");
  const freed = out.items.filter((i) => i[0] === VILLAGER && Math.max(Math.abs(i[1] - MINE_AT[0]), Math.abs(i[2] - MINE_AT[1])) === 1);
  assert.equal(freed.length, 1, "the villager stands beside it");
  await page.keyboard.press("Escape");
}
