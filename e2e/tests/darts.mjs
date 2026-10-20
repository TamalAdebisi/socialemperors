// The game's boards come round every week (DECISIONS.md, 20 October 2026):
// a round runs today, its free dart offered as the town opens. Then a local
// active-round fixture using original prizes.
import assert from "node:assert/strict";
import { balloonPrizes } from "../../client/src/rules/darts.ts";
import { PHONE, stored } from "../lib.mjs";

export default async function darts({ newPlayer }) {
  for (const phone of [false,true]) {
    const player = await newPlayer(phone ? { phone:true, viewport:PHONE, darts:true } : { darts:true });
    const { page } = player;
    const free = page.getByRole("dialog",{ name:"Free dart",exact:true });
    await free.waitFor({ state:"visible" }); await free.getByRole("button",{ name:"Later" }).click();
    await player.menu("Army"); await player.press("Darts");
    const panel = page.getByRole("dialog", { name:"Darts",exact:true });
    assert.match(await panel.innerText(), /Your free dart is ready/);
    assert.equal(await panel.getByRole("button",{ name:"Play free" }).count(),1,"this week's board is in play");
    await player.shot(phone ? "phone-this-week" : "desktop-this-week");
    await player.saved();
    const read = async () => (await (await page.request.post(`${player.base}${player.settings.dynamicUrl}/get_player_info.php`,
      { form:{ USERID:player.settings.userId,user_key:player.settings.userKey } })).json());
    assert.equal((await read()).privateState.dartsHasFree,true,"the opening reset saved the free dart");
    await page.keyboard.press("Escape");
    const pool = { id:1,start_date:"2000-01-01 23:00:00",items:[515,563,537,560,771,725],extra_item:847 };
    await page.route("**/get_game_config.php*", async (route) => {
      const response = await route.fetch(); const config = await response.json();
      config.darts_items = [pool,{ id:2,start_date:"2099-01-01 23:00:00",items:[],extra_item:0 }];
      await route.fulfill({ response,json:config });
    });
    await player.send([{ cmd:"rt_level_up",args:[60] }]);
    await player.send([{ cmd:"darts_reset",args:[4242] }]); await player.reload();
    const before = await page.evaluate(() => window.seHome.parts.town.cash);
    assert.ok(before >= 100,"normal level rewards fund five paid throws");
    await player.menu("Army"); await player.press("Darts");
    const board = balloonPrizes(4242);
    const targets = [0,1,2,3,4,5].map((kind) => board.indexOf(kind));
    const expected = new Map();
    let dart = 0;  // a paid dart's price: the game's 20, shrunk by economy.py
    for (let i=0;i<targets.length;i++) {
      const play = panel.getByRole("button",{ name:i===0 ? "Play free" : /^Play for \d+ cash$/ });
      if (i > 0) dart = Number((await play.textContent()).match(/\d+/)[0]);
      await play.click();
      await panel.locator(`[data-balloon="${targets[i]}"]`).click();
      assert.ok(await panel.locator(`[data-balloon="${targets[i]}"]`).isDisabled());
      const won = pool.items[i]; expected.set(won,(expected.get(won)??0)+1);
      assert.match(await panel.locator(".darts-result").innerText(),/now in Storage/);
    }
    assert.match(await panel.locator(".darts-result").innerText(),/Extra reward/);
    await player.shot(phone ? "phone-six-prizes" : "desktop-six-prizes");
    await player.saved();
    let save = await read();
    assert.equal(dart,15,"15 cash a dart");
    assert.equal(save.playerInfo.cash,before-5*dart);
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
