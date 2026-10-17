// Real Bull Gladiator art must not catch the empty canvas around it. The
// shared battle pointer describes an attack and clears with the selection.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { has } from "../lib.mjs";

const BULL = 2126, HOME = [49, 55];

export default async function combatControls({ newPlayer }) {
  const player = await newPlayer();
  await player.send([
    { cmd: "buy", args: [BULL, ...HOME, 0, 0, 1, 1, "u"] },
    { cmd: "buy", args: [514, 53, 55, 0, 0, 1, 1, "u"] },
  ]);
  await player.reload();
  const { page } = player;
  await page.evaluate(() => {
    window.combatVisibleBox = (picture) => {
      const b = picture.visualBounds;
      const points = [{ x: b.minX, y: b.minY }, { x: b.maxX, y: b.maxY }].map((p) => picture.toGlobal(p));
      return { x: Math.min(points[0].x, points[1].x), y: Math.min(points[0].y, points[1].y),
        width: Math.abs(points[1].x - points[0].x), height: Math.abs(points[1].y - points[0].y) };
    };
    const { camera } = window.seHome.parts;
    camera.lookAt({ x: 54 * (49 - 55), y: 27 * (49 + 55) - 241 });
  });
  await page.waitForFunction(() => {
    const { town, view } = window.seHome.parts;
    const bull = town.items.find((p) => p.item.id === 2126);
    return view.slots.get(bull)?.children[0]?.texture?.orig.width > 500;
  });
  const ground = await page.evaluate(() => {
    const { town, view, world } = window.seHome.parts;
    const bull = town.items.find((p) => p.item.id === 2126);
    const picture = view.slots.get(bull).children[0];
    const whole = picture.getBounds(), body = window.combatVisibleBox(picture);
    for (let x = 46; x <= 55; x++) for (let y = 54; y <= 59; y++) {
      const at = world.toGlobal({ x: 54 * (x - y), y: 27 * (x + y) - 81 });
      const padded = at.x >= whole.x && at.x <= whole.x + whole.width
        && at.y >= whole.y && at.y <= whole.y + whole.height;
      const outside = at.x < body.x - 24 || at.x > body.x + body.width + 24
        || at.y < body.y - 24 || at.y > body.y + body.height + 24;
      if (padded && outside && document.elementFromPoint(at.x, at.y)?.tagName === "CANVAS" && !view.itemAt(at)) {
        return { x: at.x, y: at.y, tile: [x, y], width: whole.width, visibleWidth: body.width };
      }
    }
    return null;
  });
  assert.ok(ground, "empty ground within Bull's oversized export canvas stays available");
  assert.ok(ground.width > ground.visibleWidth * 2, "the test uses the original padded Bull sheet");
  const body = await bodyPoint(page, false, BULL);
  await click(page, body);
  assert.equal(await page.evaluate(() => window.seHome.parts.editor.lessonSelected?.item.id), BULL);
  await player.shot("bull-selected");
  await click(page, ground);
  await page.waitForFunction(([x, y]) => window.seHome.parts.town.items.some((p) =>
    p.item.id === 2126 && p.tx === x && p.ty === y), ground.tile, { timeout: 30000 });
  assert.ok(has(await player.saved(), BULL, ground.tile), "clicking the former dead area moves and saves Bull");

  await page.evaluate(() => window.seHome.hurry());
  await page.waitForFunction(() => window.seHome.fighting);
  await page.evaluate(async () => {
    // Hold the fixture's battle clock while checking exact click locations;
    // rendering, pointer handlers and orders still run normally.
    window.seHome.speed = 0;
    await window.seHome.fighting.view.load(() => {});
  });
  const bull = await bodyPoint(page, true, BULL);
  await click(page, bull);
  assert.deepEqual(await page.evaluate(() => window.seHome.fighting.controls.selected.map((f) => f.item.id)), [BULL]);
  const paddingHit = await page.evaluate(() => {
    const { view, battle } = window.seHome.fighting;
    const bull = battle.fighters.find((f) => f.item.id === 2126);
    const picture = view.drawn.get(bull).slot.children[0];
    const body = window.combatVisibleBox(picture), whole = picture.getBounds();
    const at = { x: body.x - 35, y: body.y + body.height / 2 };
    return { inside: at.x >= whole.x && at.x < whole.x + whole.width, bull: view.fighterAt(at) === bull };
  });
  assert.ok(paddingHit.inside, "battle test point is within the original canvas");
  assert.equal(paddingHit.bull, false, "Bull's transparent padding does not catch battle clicks either");

  const enemy = await bodyPoint(page, true, null, 2);
  await page.mouse.move(enemy.x, enemy.y);
  const sword = readFileSync(new URL("../../client/src/ui/art/cursor-attack.png", import.meta.url)).toString("base64").slice(0, 200);
  const isSword = (value) => value.includes(sword) || value.includes("cursor-attack");
  assert.ok(isSword(await cursor(page)), "a selected army shows the original sword over an enemy");
  await click(page, enemy);
  assert.equal(await page.evaluate(() => window.seHome.fighting.controls.selected[0].target?.key), enemy.key,
    "the sword's target receives the actual attack order");
  await page.keyboard.press("Escape");
  assert.equal(await cursor(page), "", "deselect clears the sword without moving the mouse");
  await page.keyboard.press("a");
  assert.ok(isSword(await cursor(page)), "keyboard selection restores the action under a stationary mouse");
  await page.evaluate(() => {
    const { camera } = window.seHome.parts;
    const bull = window.seHome.fighting.battle.fighters.find((f) => f.item.id === 2126);
    camera.lookAt({ x: bull.at.x, y: bull.at.y - 160 });
  });
  await page.waitForFunction(() => document.querySelector("canvas").style.cursor === "");
  assert.notEqual(await page.evaluate((at) => window.seHome.fighting.view.fighterAt(at)?.side, enemy), 2,
    "camera movement removes the attack target under the stationary mouse");
  await page.mouse.move(1, 1);
  assert.equal(await cursor(page), "", "leaving the map clears the sword");
  await player.shot("battle-controls");
  await page.evaluate(() => window.seHome.fighting.controls.stop());
  assert.equal(await cursor(page), "", "ending battle controls leaves no action cursor");
}

async function cursor(page) {
  return page.locator("canvas").evaluate((canvas) => canvas.style.cursor);
}

async function click(page, at) {
  await page.mouse.move(at.x, at.y);
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.mouse.click(at.x, at.y);
}

async function bodyPoint(page, fighting, id, side = 1) {
  await page.evaluate(({ fighting, id, side }) => {
    const home = window.seHome;
    const unit = fighting ? home.fighting.battle.fighters.find((f) => !f.dead && f.isUnit && f.side === side && (id === null || f.item.id === id))
      : home.parts.town.items.find((p) => p.item.id === id);
    const at = fighting ? unit.at : { x: 54 * (unit.tx - unit.ty), y: 27 * (unit.tx + unit.ty) - 81 };
    home.parts.camera.lookAt({ x: at.x, y: at.y - (id === 2126 ? 160 : 40) });
  }, { fighting, id, side });
  await page.waitForFunction(({ fighting, id, side }) => {
    const home = window.seHome;
    const view = fighting ? home.fighting.view : home.parts.view;
    const units = fighting ? home.fighting.battle.fighters.filter((f) => !f.dead && f.isUnit && f.side === side && (id === null || f.item.id === id))
      : home.parts.town.items.filter((p) => p.item.id === id);
    // A raider may be wholly behind the harbour while another is visible.
    // Find a visible pixel of any eligible target; the real click must
    // still give that exact fighter the attack order.
    for (const unit of units) {
      const picture = fighting ? view.drawn.get(unit)?.slot.children[0] : view.slots.get(unit)?.children[0];
      if (!picture?.texture) continue;
      const b = window.combatVisibleBox(picture);
      const samples = [0.5, ...Array.from({ length: 19 }, (_, i) => (i + 1) / 20)];
      for (const fy of samples) for (const fx of samples) {
        const at = { x: b.x + b.width * fx, y: b.y + b.height * fy };
        if (document.elementFromPoint(at.x, at.y)?.tagName !== "CANVAS") continue;
        const picked = fighting ? view.fighterAt(at) : view.itemAt(at);
        if (picked === unit) {
          window.combatPoint = { ...at, key: unit.key };
          return true;
        }
      }
    }
    return false;
  }, { fighting, id, side }, { timeout: 30000 });
  return page.evaluate(() => window.combatPoint);
}
