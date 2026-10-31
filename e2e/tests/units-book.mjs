import assert from "node:assert/strict";
import { PHONE, stored } from "../lib.mjs";

export default async function unitsBook({ newPlayer, offlineVillage }) {
  for (const phone of [false, true]) {
    let player = await newPlayer(phone ? { phone: true, viewport: PHONE } : {});
    await player.send([
      { cmd: "rt_level_up", args: [20] },
      { cmd: "buy", args: [509, 54, 54, 0, 0, 1, 1, "u"] },
      { cmd: "store_add_items", args: [JSON.stringify([510])] },
    ]);
    // Cash for four units at the book's least price, 51 each (economy.py, 31 October 2026).
    player = await offlineVillage(player, (save) => { save.playerInfo.cash = 300; });
    const { page } = player;
    const before = await page.evaluate(() => window.seHome.parts.town.cash);
    await player.menu("Army"); await player.press("Units book");
    const panel = page.getByRole("dialog", { name: "Units book", exact: true });
    await panel.waitFor({ state: "visible" });
    const first = panel.locator('[data-category="1"]');
    assert.match(await first.innerText(), /1 \/ 5/);
    assert.ok(await first.getByRole("button", { name: "Claim reward" }).isDisabled());
    await first.locator('[data-unit="510"] summary').click();
    assert.equal(await first.locator('[data-unit="510"] dl img').count(), 6, "six original stats");
    await page.waitForFunction(() => {
      const canvas = document.querySelector('[data-category="1"] [data-unit="510"] canvas');
      if (!canvas?.width) return false;
      const pixels = canvas.getContext("2d").getImageData(0,0,canvas.width,canvas.height).data;
      return pixels.some((value,index) => index % 4 === 3 && value > 0);
    }, null, { timeout: 30_000 });
    await player.shot(phone ? "phone-missing" : "desktop-missing");
    // Large values from the served book must fit narrow cards too. This
    // local layout fixture changes no server item or purchase statistics.
    const ordinary=await page.evaluate(()=>{
      const item=window.seHome.parts.items.get(510);
      const old={life:item.life,attack:item.attack,attackInterval:item.attackInterval};
      Object.assign(item,{life:10000,attack:500,attackInterval:175});return old;
    });
    await page.keyboard.press("Escape");await player.menu("Army");await player.press("Units book");
    await first.locator('[data-unit="510"] summary').click();
    const layout=await first.locator('[data-unit="510"]').evaluate((cell)=>{
      const bounds=cell.getBoundingClientRect(),numbers=[...cell.querySelectorAll("dd")];
      return {values:numbers.map((n)=>Number(n.textContent)),fits:numbers.every((n)=>{
        const box=n.getBoundingClientRect();return box.left>=bounds.left && box.right<=bounds.right;
      })};
    });
    assert.deepEqual(layout.values.slice(0,3),[10000,500,175]);
    assert.ok(layout.fits,"all six large values stay inside their unit card");
    await player.shot(phone?"phone-large-stats-layout-fixture":"desktop-large-stats-layout-fixture");
    await page.evaluate((old)=>Object.assign(window.seHome.parts.items.get(510),old),ordinary);
    await page.keyboard.press("Escape");await player.menu("Army");await player.press("Units book");
    for (const id of [510, 511, 539, 608]) {
      const cell = first.locator(`[data-unit="${id}"]`);
      if ((await cell.locator("details").getAttribute("open")) === null) await cell.locator("summary").click();
      await cell.getByRole("button", { name: "Buy for 51 cash" }).click();
    }
    assert.match(await first.innerText(), /5 \/ 5/);
    await first.getByRole("button", { name: "Claim reward" }).click();
    assert.ok(await first.getByRole("button", { name: "Completed", exact: true }).isDisabled());
    await player.shot(phone ? "phone-completed" : "desktop-completed");
    await player.saved();
    const save = await (await page.request.post(`${player.base}${player.settings.dynamicUrl}/get_player_info.php`,
      { form: { USERID: player.settings.userId, user_key: player.settings.userKey } })).json();
    assert.equal(save.playerInfo.cash, before - 4 * 51 + 1);
    assert.equal(stored(save.map.store, 510), 2, "the pre-existing stored unit and the book purchase");
    assert.equal(stored(save.privateState.gifts, 510), 0, "book purchases use town storage");
    assert.equal(stored(save.privateState.gifts, 608), 1);
    assert.ok(save.privateState.unitCollectionsCompleted.includes(1));
    for (const id of [510,511,539,608]) assert.ok(save.privateState.boughtUnits.includes(id));
    await player.reload(); await player.menu("Army"); await player.press("Units book");
    assert.ok(await first.getByRole("button", { name: "Completed", exact: true }).isDisabled());
    assert.match(await first.innerText(), /5 \/ 5/);
    await player.shot(phone ? "phone-reloaded" : "desktop-reloaded");
    await page.context().close();
  }
}
