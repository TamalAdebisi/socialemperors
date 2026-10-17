// The warehouse's own save box: walking in, paged slots, calling one back,
// buying room and putting the building away. The phone plays the same save.
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const WAREHOUSE = 1284, KNIGHT = 512, SPEARMAN = 509;
const AT = [58, 58], UNIT_AT = [59, 58], WALKER_AT = [52, 59];

export default async function warehouse({ newPlayer, out }) {
  const player = await newPlayer();
  const initial = await player.saved({ waitForBatch: false });
  // Make an honest clear footprint, retaining the town hall and housing.
  const clear = initial.items.filter((i) => i[1] >= 53 && i[1] <= 58 && i[2] >= 53 && i[2] <= 58);
  await player.send([
    { cmd: "rt_level_up", args: [18] },
    ...clear.map(([id, x, y]) => ({ cmd: "sell", args: [x, y, id, 0, 1, "fixture"] })),
    { cmd: "buy", args: [WAREHOUSE, ...AT, 0, 0, 1, 1, "b"] },
    ...Array.from({ length: 19 }, () => [
      { cmd: "buy", args: [KNIGHT, ...UNIT_AT, 0, 0, 1, 1, "u"] },
      { cmd: "add_unit_warehouse", args: [...UNIT_AT, 0, KNIGHT] },
    ]).flat(),
    // Start the walking unit in clear view, beyond the warehouse's large
    // foreground artwork; it then approaches through ordinary map controls.
    { cmd: "buy", args: [SPEARMAN, ...WALKER_AT, 0, 0, 1, 1, "u"] },
  ]);
  await player.reload();
  const { page } = player;
  const info = async (p = player) => (await p.page.request.post(`${p.base}${p.settings.dynamicUrl}/get_player_info.php`, {
    form: { USERID: p.settings.userId, user_key: p.settings.userKey },
  })).json();
  const flush = async (p = player) => assert.equal(await p.page.evaluate(() => window.seHome.parts.commands.flush()), true);
  const before = await info();
  assert.equal(before.map.warehousedUnits[KNIGHT], 19);

  const warehouseSpot = await player.select(AT, "Unit Warehouse");
  assert.doesNotMatch(warehouseSpot.text, /CAPACITY/, "the card does not advertise ordinary building occupants");
  await player.press("Close");
  await player.select(WALKER_AT, "Spearman");
  await page.evaluate(() => {
    const { town, view, editor } = window.seHome.parts;
    const started = performance.now();
    const samples = [];
    let previous = "";
    const sample = () => {
      const unit = town.items.find((p) => p.item.id === 509);
      const building = town.items.find((p) => p.item.id === 1284);
      const state = { unit: unit && [unit.tx, unit.ty], walking: unit && view.isWalking(unit),
        next: unit && view.headingFor(unit), warehouse: building && [building.tx, building.ty],
        stored: town.warehouse.get(509) ?? 0, selected: editor.lessonSelected?.item.id ?? null };
      const current = JSON.stringify(state);
      if (current !== previous) samples.push({ ms: Math.round(performance.now() - started), ...state });
      previous = current;
    };
    sample();
    window.warehouseEntryTrace = { samples, sample, timer: setInterval(sample, 250) };
  });
  try {
    await player.click(warehouseSpot.point);
    await page.waitForFunction(() => window.seHome.parts.town.warehouse.get(509) === 1, null, { timeout: 30_000 });
  } finally {
    const trace = await page.evaluate(() => {
      const trace = window.warehouseEntryTrace;
      trace.sample();
      clearInterval(trace.timer);
      return trace.samples;
    });
    writeFileSync(join(out, "admission-trace.json"), JSON.stringify({ trace, problems: player.problems }, null, 2));
  }
  await flush();
  const entered = await info();
  assert.equal(entered.map.warehousedUnits[SPEARMAN], 1);
  assert.equal(entered.map.items.some((i) => i[0] === SPEARMAN), false);
  assert.deepEqual(entered.map.items.find((i) => i[0] === WAREHOUSE)?.[6] ?? [], [], "separate from building occupants");

  await player.select(AT, "Unit Warehouse");
  await player.press("Open warehouse");
  const panel = page.locator(".warehouse-window:not([hidden])");
  assert.match(await panel.locator(".warehouse-counts").textContent(), /Slots used: 20.*Slots empty: 30/);
  assert.equal(await panel.locator(".warehouse-slot").count(), 18);
  assert.equal(await panel.locator(".warehouse-page").textContent(), "1 / 3");
  assert.equal(await panel.getByRole("button", { name: "Previous page" }).isDisabled(), true);
  await page.waitForFunction(() => [...document.querySelectorAll(".warehouse-slot img")].every((i) => i.complete && i.naturalWidth > 0));
  await player.shot("stored");
  await player.press("Next page");
  assert.equal(await panel.locator(".warehouse-slot.occupied").count(), 2);
  assert.equal(await panel.locator(".warehouse-slot.empty").count(), 16);
  await player.press("Next page");
  assert.equal(await panel.locator(".warehouse-slot").count(), 14);
  assert.equal(await panel.getByRole("button", { name: "Next page" }).isDisabled(), true);
  await player.shot("empty-slots");
  await player.press("Previous page");
  await player.press("Previous page");
  await panel.getByRole("button", { name: "Use Light Knight", exact: true }).first().click();
  assert.match(await panel.locator(".warehouse-status").textContent(), /Light Knight is back/);
  await player.press("Buy now");
  assert.match(await panel.locator(".warehouse-counts").textContent(), /Slots used: 19.*Slots empty: 32/);
  await flush();
  const deployed = await info();
  assert.deepEqual(deployed.map.warehousedUnits, { [KNIGHT]: 18, [SPEARMAN]: 1 });
  const knights = deployed.map.items.filter((i) => i[0] === KNIGHT);
  assert.equal(knights.length, before.map.items.filter((i) => i[0] === KNIGHT).length + 1);
  const unit = knights.find((i) => !before.map.items.some((previous) => previous[0] === KNIGHT && previous[1] === i[1] && previous[2] === i[2]));
  assert.ok(unit && Math.max(Math.abs(unit[1] - AT[0]), Math.abs(unit[2] - AT[1])) <= 4, "called back beside the building");
  assert.equal(deployed.map.warehouseAditionalCapacitySingle, 51);
  assert.equal(Number(deployed.playerInfo.cash), Number(before.playerInfo.cash) - 2);
  assert.equal(deployed.map.xp, before.map.xp, "deployment grants no experience");

  // The map selector searches visible pixels. Keep the unit whose saved
  // deployment was just checked away from the phone's building target,
  // so its selection does not issue a new order to enter the warehouse.
  await player.send([{ cmd: "move", args: [unit[1], unit[2], KNIGHT, 49, 56, 0, 0, "fixture"] }]);
  const phone = await player.onPhone();
  await phone.select(AT, "Unit Warehouse");
  await phone.press("Open warehouse");
  const sheet = phone.page.locator(".warehouse-window:not([hidden])");
  const box = await sheet.boundingBox();
  assert.ok(box && box.x >= 0 && box.x + box.width <= 390, "warehouse fits a phone");
  assert.equal(await sheet.locator(".warehouse-slots").evaluate((el) => el.scrollWidth <= el.clientWidth), true);
  await phone.page.waitForFunction(() => [...document.querySelectorAll(".warehouse-slot img")].every((i) => i.complete && i.naturalWidth > 0));
  await phone.shot("phone");
  await phone.press("Buy now");
  await flush(phone);
  assert.equal((await info(phone)).map.warehouseAditionalCapacitySingle, 52);
  await phone.page.keyboard.press("Escape");
  await phone.select(AT, "Unit Warehouse");
  await phone.press("Store");
  await flush(phone);
  const stored = await info(phone);
  assert.deepEqual(stored.map.warehousedUnits, {});
  assert.equal(stored.map.store[KNIGHT], 18);
  assert.equal(stored.map.store[SPEARMAN], 1);
  assert.equal(stored.map.store[WAREHOUSE], 1);
  assert.equal(stored.map.warehouseAditionalCapacitySingle, 52, "bought room is retained");
  assert.equal(Number(stored.playerInfo.cash), Number(before.playerInfo.cash) - 4);
  await phone.reload();
  assert.equal(await phone.page.evaluate(() => window.seHome.parts.town.warehouse.size), 0);
  await phone.menu("Storage");
  assert.match(await phone.page.locator(".panel:not([hidden])").textContent(), /Unit Warehouse/);
  await phone.shot("phone-stored");
}
