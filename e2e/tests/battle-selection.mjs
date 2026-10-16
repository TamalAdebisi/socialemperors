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
  await page.evaluate(async () => {
    await window.seHome.fighting.view.load(() => {});
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  await page.evaluate(() => {
    window.selectionEvents = [];
    for (const type of ["pointerdown", "pointerup", "pointercancel"]) {
      document.querySelector("canvas").addEventListener(type, (event) => {
        const at = { x: event.offsetX, y: event.offsetY };
        window.selectionEvents.push({ type, ...at, time: performance.now(), stamp: event.timeStamp });
      }, true);
    }
  });
  await page.keyboard.press("a");
  await page.locator(".battle-selection-roster button").first().waitFor();
  assert.ok(await page.locator(".battle-selection-roster button").count() >= 2);
  // Clicking the picture of a unit must leave only that unit selected.
  const point = await mapPoint(page);
  if (touch) await page.touchscreen.tap(point.x, point.y);
  else await clickUnit(page, point);
  const selected = await page.evaluate(() => window.seHome.fighting.controls.selected.map((u) => u.key));
  if (selected.length !== 1 || selected[0] !== point.key) {
    console.log("selection diagnostic", await page.evaluate((point) => ({ point,
      hitNow: window.seHome.fighting.view.fighterAt(point)?.key,
      element: document.elementFromPoint(point.x, point.y)?.tagName,
      selectedNow: window.seHome.fighting.controls.selected.map((u) => u.key),
      events: window.selectionEvents,
    }), point));
  }
  assert.deepEqual(selected, [point.key]);
  if (!touch) {
    const other = await mapPoint(page, point.key);
    await page.keyboard.down("Shift");
    await clickUnit(page, other);
    assert.equal(await page.evaluate(() => window.seHome.fighting.controls.selected.length), 2);
    await clickUnit(page, other);
    await page.keyboard.up("Shift");
    assert.deepEqual(await page.evaluate(() => window.seHome.fighting.controls.selected.map((u) => u.key)), [point.key]);
  }
  assert.match(await page.locator(".battle-selection").textContent(), /health.*attack/);
  if (!touch) {
    // Dialogs keep their own Escape while the town is being defended.
    await page.locator(".hud-level.renames").click();
    await page.locator(".name-input").fill("Keep my selection");
    await page.keyboard.press("Escape");
    assert.equal(await page.locator(".name-window").count(), 0, "Escape closes the dialog");
    assert.deepEqual(await page.evaluate(() => window.seHome.fighting.controls.selected.map((u) => u.key)), [point.key],
      "dialog Escape leaves the army selection alone");
  }
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
  assert.equal(await page.evaluate(() => window.seHome.fighting.controls.selected.length), 0);
  if (!touch) {
    await page.evaluate(() => {
      const fight = window.seHome.fighting;
      fight.controls.select([fight.battle.fighters.find((f) => f.side === 1 && !f.isUnit)]);
    });
    const own = await mapPoint(page);
    await page.keyboard.down("Shift");
    await clickUnit(page, own);
    await page.keyboard.up("Shift");
    assert.deepEqual(await page.evaluate(() => [...window.seHome.fighting.view.selected].map((f) => f.key)), [own.key],
      "Shift starts a unit group without retaining the inspected building");
    // A form change must update the selected group's portraits as well as its statistics.
    const changed = await page.evaluate(() => {
      const { fighting: fight, parts } = window.seHome;
      const units = fight.battle.fighters.filter((f) => f.item.id === 514).slice(0, 2);
      fight.controls.select(units);
      const old = units[0].item;
      const next = parts.items.get(510);
      fight.specials.become(units[0], next, true);
      window.selectionOriginalForm = { unit: units[0], old };
      return next.name;
    });
    await page.getByRole("button", { name: `Inspect ${changed}`, exact: true }).waitFor();
    await page.evaluate(() => {
      const { unit, old } = window.selectionOriginalForm;
      window.seHome.fighting.specials.become(unit, old, true);
      window.seHome.fighting.controls.select([]);
    });
  }
}

async function clickUnit(page, point) {
  // Software WebKit can spend over a second drawing the first hover. Let
  // that render before pressing, so this is a click rather than a long hold.
  await page.mouse.move(point.x, point.y);
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.mouse.click(point.x, point.y);
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
    // Aim at the visible body, not the first hit at an animated edge.
    const box = fight.view.drawn.get(unit)?.slot.children[0]?.getBounds();
    if (!box || box.width <= 0 || box.height <= 0) return false;
    const at = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    if (fight.view.fighterAt(at) === unit && at.y > 170 && at.y < innerHeight - 230
        && document.elementFromPoint(at.x, at.y)?.tagName === "CANVAS") {
      window.selectionPoint = { ...at, key: unit.key };
      return true;
    }
    return false;
  }, except, { timeout: 30000 });
  return page.evaluate(() => window.selectionPoint);
}
