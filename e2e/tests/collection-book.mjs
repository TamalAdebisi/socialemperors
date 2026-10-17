// Collection exchanges and cash completion, including saved counts and phone layout.
import assert from "node:assert/strict";
import { PHONE } from "../lib.mjs";

export default async function collectionBook({ newPlayer }) {
  for (const phone of [false, true]) {
    const player = await newPlayer(phone ? { phone: true, viewport: PHONE } : {});
    const { page } = player;
    const pieces = [1, 2, 3, 4, 5].map((piece) => ({ cmd: "add_collectable", args: [1, piece] }));
    await player.send([{ cmd: "rt_level_up", args: [20] }, ...pieces, ...pieces, { cmd: "add_collectable", args: [2, 1] }]);
    await player.reload();
    await player.menu("Army");
    await player.press("Collections");
    const panel = page.getByRole("dialog", { name: "Collections", exact: true });
    await panel.waitFor({ state: "visible" });
    const first = panel.locator('[data-collection="1"]');
    const second = panel.locator('[data-collection="2"]');
    assert.equal(await first.locator(".collection-pieces").innerText(), "×2\n×2\n×2\n×2\n×2");
    const before = await page.evaluate(() => window.seHome.parts.town.cash);
    await first.getByRole("button", { name: /claim reward/i }).click();
    await first.getByRole("button", { name: /claim reward/i }).click();
    assert.ok(await first.getByRole("button", { name: /claim reward/i }).isDisabled());
    await second.getByRole("button", { name: /4 cash/ }).click();
    assert.equal(await page.evaluate(() => window.seHome.parts.town.cash), before - 4);
    await player.shot(phone ? "phone-exchanged" : "desktop-exchanged");
    for (let i = 0; i < 7; i++) await panel.getByRole("button", { name: "Next", exact: true }).click();
    assert.equal(await panel.locator('[data-collection="23"]').getByRole("button").count(), 1, "Heart has no cash purchase");
    assert.ok(await panel.getByRole("button", { name: "Next", exact: true }).isDisabled());
    await player.shot(phone ? "phone-last-page" : "desktop-last-page");
    await player.saved();
    const read = async () => (await (await page.request.post(`${player.base}${player.settings.dynamicUrl}/get_player_info.php`,
      { form: { USERID: player.settings.userId, user_key: player.settings.userKey } })).json());
    const save = await read();
    assert.deepEqual(save.privateState.collections[1], [1, 0, 0, 0, 0, 0]);
    assert.equal(save.privateState.gifts[176], 2);
    assert.equal(save.privateState.gifts[177], 1);
    assert.equal(save.playerInfo.cash, before - 4);
    await player.reload();
    await player.menu("Army"); await player.press("Collections");
    assert.match(await first.innerText(), /Completed/);
    assert.equal(await first.getByRole("button", { name: /complete for/i }).count(), 0);
    await player.shot(phone ? "phone-reloaded" : "desktop-reloaded");
    await page.context().close();
  }
}
