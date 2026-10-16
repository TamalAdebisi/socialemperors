import assert from "node:assert/strict";

export default async function battleSelection({ newPlayer }) {
  const player = await newPlayer();
  await player.send([
    { cmd: "buy", args: [514, 49, 55, 0, 0, 1, 1, "u"] },
    { cmd: "buy", args: [514, 53, 55, 0, 0, 1, 1, "u"] },
  ]);
  await player.reload();
  await check(player, false);
  const phone = await player.onPhone();
  await check(phone, true);
}

async function check(player, touch) {
  const { page } = player;
  await page.waitForFunction(() => window.seHome);
  await page.evaluate(() => window.seHome.hurry());
  await page.waitForFunction(() => window.seHome.fighting);
  await page.keyboard.press("a");
  await page.locator(".battle-selection-roster button").first().waitFor();
  assert.ok(await page.locator(".battle-selection-roster button").count() >= 2);
  // Clicking the picture of a unit must leave only that unit selected.
  const point = await mapPoint(page);
  if (touch) await page.touchscreen.tap(point.x, point.y);
  else await page.mouse.click(point.x, point.y);
  const selected = await page.evaluate(() => window.seHome.fighting.controls.selected.map((u) => u.key));
  assert.deepEqual(selected, [point.key]);
  if (!touch) {
    const other = await mapPoint(page, point.key);
    await page.keyboard.down("Shift");
    await page.mouse.click(other.x, other.y);
    assert.equal(await page.evaluate(() => window.seHome.fighting.controls.selected.length), 2);
    await page.mouse.click(other.x, other.y);
    await page.keyboard.up("Shift");
    assert.deepEqual(await page.evaluate(() => window.seHome.fighting.controls.selected.map((u) => u.key)), [point.key]);
  }
  assert.match(await page.locator(".battle-selection").textContent(), /health.*attack/);
  if (touch) {
    const box = await page.locator(".battle-selection").boundingBox();
    const tools = await page.locator(".corner").boundingBox();
    assert.ok(box.x >= 0 && box.x + box.width <= 390, "selection fits the phone");
    assert.ok(box.y + box.height <= tools.y, "the selection leaves the pointer tools uncovered");
  }
  await player.shot(touch ? "phone-inspect" : "inspect");
  await page.getByRole("button", { name: "Deselect", exact: true }).click();
  assert.equal(await page.evaluate(() => window.seHome.fighting.controls.selected.length), 0);
  assert.ok(await page.locator(".battle-selection").isHidden());
  // Portraits offer the same way out of Select all, even in a crowded army.
  await page.evaluate(() => window.seHome.fighting.controls.selectAll());
  await page.locator(".battle-selection-roster button").first().click();
  assert.equal(await page.evaluate(() => window.seHome.fighting.controls.selected.length), 1);
  await page.keyboard.press("Escape");
  assert.ok(await page.locator(".battle-selection").isHidden());
}

async function mapPoint(page, except = null) {
  await page.evaluate((except) => {
    const home = window.seHome;
    const unit = home.fighting.battle.fighters.find((u) => u.item.id === 514 && u.key !== except);
    home.parts.camera.lookAt(unit.at);
  }, except);
  await page.waitForFunction((except) => {
    const { fighting: fight } = window.seHome;
    const unit = fight.battle.fighters.find((u) => u.item.id === 514 && u.key !== except);
    const p = fight.view.root.toGlobal(unit.at);
    for (let dy = -70; dy <= 5; dy += 5) {
      const at = { x: p.x, y: p.y + dy };
      if (fight.view.fighterAt(at) === unit && at.y > 170 && at.y < innerHeight - 230) {
        window.selectionPoint = { ...at, key: unit.key };
        return true;
      }
    }
    return false;
  }, except, { timeout: 30000 });
  return page.evaluate(() => window.selectionPoint);
}
