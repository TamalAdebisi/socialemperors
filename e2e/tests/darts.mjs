// Real dormant schedule, then a local active-round fixture using original prizes.
import assert from "node:assert/strict";
import { balloonPrizes } from "../../client/src/rules/darts.ts";
import { PHONE, stored } from "../lib.mjs";

export default async function darts({ newPlayer }) {
  for (const phone of [false,true]) {
    const player = await newPlayer(phone ? { phone:true, viewport:PHONE } : {});
    const { page } = player;
    await player.menu("Army"); await player.press("Darts");
    const panel = page.getByRole("dialog", { name:"Darts",exact:true });
    assert.match(await panel.innerText(), /Come back/i);
    assert.equal(await panel.getByRole("button",{ name:/Play/ }).count(),0,"shipped empty pool is inactive");
    await player.shot(phone ? "phone-inactive" : "desktop-inactive");
    const pool = { id:1,start_date:"2000-01-01 23:00:00",items:[515,563,537,560,771,725],extra_item:847 };
    await page.route("**/get_game_config.php*", async (route) => {
      const response = await route.fetch(); const config = await response.json();
      config.darts_items = [pool,{ id:2,start_date:"2099-01-01 23:00:00",items:[],extra_item:0 }];
      await route.fulfill({ response,json:config });
    });
    await player.send([{ cmd:"rt_level_up",args:[60] }]);
    await player.reload();
    const offer = page.getByRole("dialog",{ name:"Free dart",exact:true });
    await offer.waitFor({ state:"visible" }); await offer.getByRole("button",{ name:"Later" }).click();
    await player.saved();
    const read = async () => (await (await page.request.post(`${player.base}${player.settings.dynamicUrl}/get_player_info.php`,
      { form:{ USERID:player.settings.userId,user_key:player.settings.userKey } })).json());
    assert.equal((await read()).privateState.dartsHasFree,true,"startup reset saved the free dart");
    await player.send([{ cmd:"darts_reset",args:[4242] }]); await player.reload();
    const before = await page.evaluate(() => window.seHome.parts.town.cash);
    assert.ok(before >= 100,"normal level rewards fund five paid throws");
    await player.menu("Army"); await player.press("Darts");
    const board = balloonPrizes(4242);
    const targets = [0,1,2,3,4,5].map((kind) => board.indexOf(kind));
    const expected = new Map();
    for (let i=0;i<targets.length;i++) {
      await panel.getByRole("button",{ name:i===0 ? "Play free" : "Play for 20 cash",exact:true }).click();
      await panel.locator(`[data-balloon="${targets[i]}"]`).click();
      assert.ok(await panel.locator(`[data-balloon="${targets[i]}"]`).isDisabled());
      const won = pool.items[i]; expected.set(won,(expected.get(won)??0)+1);
      assert.match(await panel.locator(".darts-result").innerText(),/now in Storage/);
    }
    assert.match(await panel.locator(".darts-result").innerText(),/Extra reward/);
    await player.shot(phone ? "phone-six-prizes" : "desktop-six-prizes");
    await player.saved();
    let save = await read();
    assert.equal(save.playerInfo.cash,before-100);
    assert.equal(save.privateState.dartsBalloonsShot.length,6);
    assert.equal(save.privateState.dartsGotExtra,true);
    for (const [id,count] of expected) assert.equal(stored(save.map.store,id),count);
    assert.equal(stored(save.map.store,847),1);
    await player.reload(); await player.menu("Army"); await player.press("Darts");
    assert.equal(await panel.locator(".darts-balloon.popped").count(),6);
    assert.equal(await panel.getByRole("button",{ name:"Play free",exact:true }).count(),0);
    await player.shot(phone ? "phone-reloaded" : "desktop-reloaded");
    save=await read(); assert.equal(stored(save.map.store,847),1,"reopening does not duplicate the extra");
    await page.context().close();
  }
}
