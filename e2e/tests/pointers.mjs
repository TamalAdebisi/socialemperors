// Pointers (CLIENT.md, "Villagers at work"): with a villager selected, the
// mouse pointer is the Flash client's own for what the villager would do: an
// axe over a tree, a pickaxe over a rock, a red arrow over a mine it can go
// into, and the usual arrow again once nothing is selected. On a phone, with
// no pointer, the picture pops up over what the villager is sent to: here
// the arrow over the mine (the trees are off a phone's narrower screen).

import assert from "node:assert/strict";

const VILLAGER = 500, STONE = 69, MINE = 13;
const CUTTER = [42, 52], TREE = [43, 54], ROCK = [47, 58], MINE_AT = [53, 57], WORKER = [55, 55];

export default async function pointers({ newPlayer }) {
  const player = await newPlayer();
  await player.send([
    { cmd: "buy", args: [VILLAGER, ...CUTTER, 0, 0, 0, 1] },
    { cmd: "buy", args: [VILLAGER, ...WORKER, 0, 0, 0, 1] },
    { cmd: "buy", args: [STONE, ...ROCK, 0, 0, 0, 1] },
    { cmd: "buy", args: [MINE, ...MINE_AT, 0, 0, 0, 1] },
  ]);
  await player.reload();
  const { page } = player;
  const spot = async (tile, name) => {
    const { point } = await player.select(tile, name);
    await player.press("Close");
    return point;
  };
  const tree = await spot(TREE, "Tree"), rock = await spot(ROCK, "Stone"), mine = await spot(MINE_AT, "Gold Mine I");
  const cutter = (await player.select(CUTTER, "Villager I")).point;
  const pointer = async (point) => {
    await page.mouse.move(point.x, point.y);
    await player.wait(250);
    return page.locator("canvas").evaluate((canvas) => canvas.style.cursor);
  };

  // A computer: the pointer says what the villager would do.
  // (The build puts these small pictures in the page itself, so they're told apart by their pictures.)
  const [axe, pick, inside] = [await pointer(tree), await pointer(rock), await pointer(mine)];
  for (const [name, cursor] of [["an axe over a tree", axe], ["a pickaxe over a rock", pick], ["the arrow over a mine", inside]]) {
    assert.match(cursor, /^url\(".+"\) \d+ \d+, pointer$/, name);
  }
  assert.equal(new Set([axe, pick, inside]).size, 3, "three different pointers");
  await page.keyboard.press("Escape");
  await page.mouse.move(cutter.x, cutter.y + 5);
  await player.wait(250);
  assert.equal(await pointer(tree), "", "nothing selected: the usual arrow");

  // A phone: the arrow pops up over the mine the villager is sent into.
  const phone = await player.onPhone();
  const phoneMine = (await phone.select(MINE_AT, "Gold Mine I")).point;
  await phone.press("Close");
  await phone.select(WORKER, "Villager I");
  const before = await redAbove(phone, phoneMine);
  await phone.page.touchscreen.tap(phoneMine.x, phoneMine.y);
  await phone.page.waitForTimeout(150);  // it shows for a second, fading in its second half
  const after = await redAbove(phone, phoneMine);
  await phone.shot("arrow-on-tap");
  assert.ok(after > before + 200, `the red arrow pops up over the mine: ${before} -> ${after} red pixels`);
  await phone.wait(3000);
  assert.match(await phone.bar(), /^Gold Mine I/, "and the villager went in (the mine is selected then)");
}

/** How many of the screen's pixels are the arrow's bright red, in a box just above a point. */
async function redAbove(player, point) {
  const shot = (await player.page.screenshot()).toString("base64");
  return player.page.evaluate(async ({ shot, point }) => {
    const image = new Image();
    image.src = `data:image/png;base64,${shot}`;
    await image.decode();
    const scale = image.width / window.innerWidth;
    const box = { x: (point.x - 70) * scale, y: (point.y - 140) * scale, w: 140 * scale, h: 140 * scale };
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext("2d");
    context.drawImage(image, 0, 0);
    const { data } = context.getImageData(box.x, box.y, box.w, box.h);
    let red = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] > 190 && data[i + 1] < 70 && data[i + 2] < 70) red++;
    }
    return red;
  }, { shot, point });
}
