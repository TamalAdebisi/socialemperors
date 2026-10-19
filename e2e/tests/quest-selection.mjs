// Picking units on an island (CLIENT.md, "Selecting units in a battle"),
// as the owner asked: a double click takes every unit of that very kind;
// Shift and a double click adds another kind; the bar shows one portrait per
// kind, with how many, and a click keeps that kind while Shift-click or a
// right click drops it; Shift and a number keep a group, the number picks it
// again and, pressed twice, takes the camera to it; a Shift-drag box adds
// the units in it without moving the map. An order then goes to the units
// picked, and no others. Nothing is sent to the server while fighting.

import assert from "node:assert/strict";

const KNIGHT = 514, ARCHER = 518;

export default async function questSelection({ newPlayer }) {
  const player = await newPlayer();
  const { page } = player;
  // As quest.mjs: level 10, 14 heavy knights and 6 heavy archers.
  const army = [];
  for (let i = 0; i < 14; i++) army.push({ cmd: "buy", args: [KNIGHT, 44 + (i % 7), 44 + Math.floor(i / 7), 0, 0, 0, 1] });
  for (let i = 0; i < 6; i++) army.push({ cmd: "buy", args: [ARCHER, 44 + i, 47, 0, 0, 0, 1] });
  await player.send([{ cmd: "rt_level_up", args: [10] }, ...army]);
  await player.reload();
  await player.menu("Quests");
  await page.locator(".islands .island-button").nth(0).locator(".island-enter").click();
  await page.waitForSelector(".quest-window", { timeout: 60_000 });
  await player.press("Start battle");
  await player.loaded();

  const selected = () => page.evaluate(() => [...window.seQuest.view.selected].map((f) => f.item.id));
  const mine = (id) => page.evaluate((id) => window.seQuest.battle.fighters
    .filter((f) => f.side === 1 && f.isUnit && !f.dead && f.item.id === id).length, id);
  const knights = await mine(KNIGHT), archers = await mine(ARCHER);
  assert.equal(knights, 14);
  assert.equal(archers, 6);

  // A double click on a knight: every knight, and nothing else.
  const knight = await unitOnScreen(page, KNIGHT);
  await page.mouse.dblclick(knight.x, knight.y);
  await player.wait(300);
  let ids = await selected();
  assert.equal(ids.length, knights, `every knight: ${ids}`);
  assert.ok(ids.every((id) => id === KNIGHT), "only knights");
  assert.match(await page.locator(".battle-selection").textContent(), /14 × Heavy Knight/);

  // Shift and a double click on an archer: the archers join them, one portrait per kind with how many.
  const archer = await unitOnScreen(page, ARCHER);
  await page.keyboard.down("Shift");
  await page.mouse.dblclick(archer.x, archer.y);
  await page.keyboard.up("Shift");
  await player.wait(300);
  ids = await selected();
  assert.equal(ids.length, knights + archers);
  assert.deepEqual(await page.locator(".battle-selection-roster .count").allTextContents(), ["14", "6"]);
  await player.shot("two-kinds");

  // The bar: a click keeps the archers; Select all, then a right click and a Shift-click drop kinds.
  await page.getByRole("button", { name: "Only Heavy Archer (6)", exact: true }).click();
  ids = await selected();
  assert.deepEqual([ids.length, new Set(ids).size, ids[0]], [archers, 1, ARCHER], "only the archers");
  await player.press("Select all");
  const all = (await selected()).length;
  await page.getByRole("button", { name: "Only Heavy Knight (14)", exact: true }).click({ button: "right" });
  ids = await selected();
  assert.ok(!ids.includes(KNIGHT) && ids.length === all - knights, "a right click drops the knights");
  await page.keyboard.down("Shift");
  await page.getByRole("button", { name: "Only Heavy Archer (6)", exact: true }).click();
  await page.keyboard.up("Shift");
  ids = await selected();
  assert.ok(!ids.includes(ARCHER) && ids.length === all - knights - archers, "Shift-click drops the archers");

  // Shift and a number keep a group; the number picks it again; twice, the camera goes to it.
  await page.keyboard.press("Escape");
  await page.mouse.dblclick(archer.x, archer.y);
  await player.wait(300);
  assert.equal((await selected()).length, archers);
  await page.keyboard.press("Shift+Digit2");
  await player.said(/Group 2: 6 units kept/);
  await page.keyboard.press("Escape");
  assert.equal((await selected()).length, 0);
  const offMiddle = () => page.evaluate(() => {
    const { battle, screenOf } = window.seQuest;
    const archers = battle.fighters.filter((f) => f.side === 1 && f.isUnit && !f.dead && f.item.id === 518).map(screenOf);
    const middle = { x: archers.reduce((n, p) => n + p.x, 0) / archers.length, y: archers.reduce((n, p) => n + p.y, 0) / archers.length };
    return Math.hypot(middle.x - innerWidth / 2, middle.y - innerHeight / 2);
  });
  await page.evaluate(() => window.seQuest.lookAt({ x: 10, y: 10 }));
  await player.wait(1500);
  const far = await offMiddle();
  await page.keyboard.press("2");
  ids = await selected();
  assert.deepEqual([ids.length, new Set(ids).size, ids[0]], [archers, 1, ARCHER], "group 2 again");
  await player.wait(700);
  await page.keyboard.press("2");
  await page.keyboard.press("2");
  await player.wait(1500);
  const near = await offMiddle();
  assert.ok(far > 300 && near < 150, `twice: the camera went to the group (${Math.round(far)}, then ${Math.round(near)} pixels off the middle)`);
  await page.keyboard.press("Digit7");
  await player.said(/Group 7 is empty/);

  // A Shift-drag box round the archers adds them to one knight, and the map stays put.
  await page.keyboard.press("Escape");
  await player.click(await unitOnScreen(page, KNIGHT));
  assert.equal((await selected()).length, 1);
  await page.evaluate(() => {
    const { battle, lookAt } = window.seQuest;
    const archers = battle.fighters.filter((f) => f.side === 1 && f.isUnit && !f.dead && f.item.id === 518);
    lookAt({ x: Math.round(archers.reduce((n, f) => n + f.tx, 0) / archers.length), y: Math.round(archers.reduce((n, f) => n + f.ty, 0) / archers.length) });
  });
  await player.wait(1500);
  const box = await page.evaluate(() => {
    const { battle, screenOf } = window.seQuest;
    const points = battle.fighters.filter((f) => f.side === 1 && f.isUnit && !f.dead && f.item.id === 518).map(screenOf);
    const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
    const box = { left: Math.min(...xs) - 40, right: Math.max(...xs) + 40, top: Math.min(...ys) - 40, bottom: Math.max(...ys) + 40 };
    return { ...box, starts: document.elementFromPoint(box.left, box.top)?.tagName,
      inside: box.left > 0 && box.top > 0 && box.right < innerWidth && box.bottom < innerHeight };
  });
  assert.ok(box.inside && box.starts === "CANVAS", `the archers fit a box on the map: ${JSON.stringify(box)}`);
  const camera = () => page.evaluate(() => window.seQuest.tileScreen({ x: 50, y: 50 }));
  const before = await camera();
  await page.keyboard.down("Shift");
  await page.mouse.move(box.left, box.top);
  await page.mouse.down();
  await page.mouse.move((box.left + box.right) / 2, (box.top + box.bottom) / 2, { steps: 5 });
  await page.mouse.move(box.right, box.bottom, { steps: 5 });
  await player.shot("box");
  await page.mouse.up();
  await page.keyboard.up("Shift");
  await player.wait(300);
  const after = await camera();
  assert.ok(Math.hypot(after.x - before.x, after.y - before.y) < 2, "the box didn't move the map");
  ids = await selected();
  assert.ok(ids.filter((id) => id === ARCHER).length === archers, `the box took every archer: ${ids}`);
  assert.ok(ids.includes(KNIGHT), "and kept the knight picked before");
  assert.ok(await page.evaluate(() => [...window.seQuest.view.selected].every((f) => f.side === 1 && f.isUnit)), "only the player's units");

  // An order goes to the units picked only: the archers at the nearest troll, the knights stay.
  const anArcher = await unitOnScreen(page, ARCHER);
  await page.mouse.dblclick(anArcher.x, anArcher.y);
  await player.wait(300);
  assert.equal((await selected()).length, archers);
  await page.evaluate(() => {
    const { battle, lookAt } = window.seQuest;
    const mine = battle.fighters.filter((f) => f.side === 1 && f.isUnit && !f.dead && f.item.id === 518);
    const near = (f) => Math.hypot(f.tx - mine[0].tx, f.ty - mine[0].ty);
    window.seQuestTroll = battle.fighters.filter((f) => f.side === 2 && !f.dead && f.isUnit).sort((a, b) => near(a) - near(b))[0];
    lookAt({ x: window.seQuestTroll.tx, y: window.seQuestTroll.ty });
  });
  await player.wait(1500);
  await player.click(await page.evaluate(() => window.seQuest.screenOf(window.seQuestTroll)));
  const orders = await page.evaluate(() => {
    const fighters = window.seQuest.battle.fighters.filter((f) => f.side === 1 && f.isUnit && !f.dead);
    const busy = (f) => Boolean(f.target || f.next);
    return {
      archers: fighters.filter((f) => f.item.id === 518 && busy(f)).length,
      knights: fighters.filter((f) => f.item.id === 514 && busy(f)).length,
    };
  });
  assert.equal(orders.archers, archers, "the archers set off");
  assert.equal(orders.knights, 0, "the knights stay where they are");
  await player.shot("archers-sent");
}

/** A point on screen on one of the player's units of a kind, in the middle of the screen, nothing in front of it. */
async function unitOnScreen(page, id) {
  await page.evaluate((id) => {
    const { battle, lookAt } = window.seQuest;
    const unit = battle.fighters.find((f) => f.side === 1 && f.isUnit && !f.dead && f.item.id === id);
    lookAt({ x: unit.tx, y: unit.ty });
  }, id);
  await page.waitForFunction((id) => {
    const { battle, view } = window.seQuest;
    for (const unit of battle.fighters.filter((f) => f.side === 1 && f.isUnit && !f.dead && f.item.id === id)) {
      const box = view.drawn.get(unit)?.slot.children[0]?.getBounds();
      if (!box || box.width <= 0 || box.height <= 0) continue;
      const at = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      if (view.fighterAt(at) === unit && at.y > 170 && at.y < innerHeight - 230
          && document.elementFromPoint(at.x, at.y)?.tagName === "CANVAS") {
        window.seQuestPoint = at;
        return true;
      }
    }
    return false;
  }, id, { timeout: 30_000 });
  return page.evaluate(() => window.seQuestPoint);
}
