import assert from "node:assert/strict";
import { PHONE } from "../lib.mjs";
const SUMMIT=[56,50],MARKET=[56,56];
export default async function socialMarket({newPlayer,offlineVillage}) {
  for(const phone of [false,true]) {
    let player=await newPlayer(phone?{phone:true,viewport:PHONE}:{});
    await player.send([
      {cmd:"rt_level_up",args:[60]},
      {cmd:"buy",args:[234,...SUMMIT,0,0,1,1,"b"]},
      {cmd:"buy",args:[266,...MARKET,0,0,1,1,"b"]},
      {cmd:"buy",args:[3,50,56,0,0,1,1,"b"]},
    ]);
    // Food to finish the delivery early: the original's 2 cash, in food since 29 October 2026.
    player=await offlineVillage(player,(save)=>{save.maps[0].food=5000;});
    const {page}=player;
    const read=async()=>(await(await page.request.post(`${player.base}${player.settings.dynamicUrl}/get_player_info.php`,{form:{USERID:player.settings.userId,user_key:player.settings.userKey}})).json());
    await player.saved();const before=await read();
    for(const [id,at] of [[234,SUMMIT],[266,MARKET]]) {
      const placed=before.map.items.find((p)=>p[0]===id);
      assert.ok(placed,`fixture building ${id} survives ordinary overlap cleanup`);
      assert.deepEqual(placed.slice(1,3),at);
    }
    await player.select(SUMMIT,"Allies Building");await player.press("Open");
    const panel=page.locator(".social-window:not([hidden])");
    for(let i=0;i<9;i++) await panel.getByRole("button",{name:"Hire helper for 3 cash",exact:true}).click();
    await player.shot(phone?"phone-allies-full":"desktop-allies-full");
    await panel.getByRole("button",{name:"Claim reward",exact:true}).click();
    await player.saved();let save=await read();
    assert.equal(save.map.items.filter((p)=>p[0]===576).length,9,"nine allied knights saved");
    assert.equal(save.playerInfo.cash,before.playerInfo.cash-27);
    const summit=save.map.items.find((p)=>p[0]===234);assert.equal(summit[7].si.length,0);
    await page.keyboard.press("Escape");
    await player.select(MARKET,"Allies Market");await player.press("Open");
    for(let i=0;i<3;i++) await panel.getByRole("button",{name:"Hire helper for 2 cash",exact:true}).click();
    await panel.getByRole("button",{name:"Order wood",exact:true}).click();
    assert.match(await panel.innerText(),/Delivery: 500 wood/);
    await player.shot(phone?"phone-order":"desktop-order");
    await panel.getByRole("button",{name:"Finish delivery for 1,000 food",exact:true}).click();
    await player.saved();save=await read();
    assert.equal(save.map.wood,before.map.wood+500);
    assert.equal(save.map.food,before.map.food-1000,"1,000 food to finish it early");
    assert.equal(save.playerInfo.cash,before.playerInfo.cash-27-6);
    assert.equal(save.map.resourceAlliesMarket,"n");
    assert.equal(save.map.items.find((p)=>p[0]===266)[7].si.length,0);
    await player.shot(phone?"phone-delivered":"desktop-delivered");
    await player.reload();await player.saved();save=await read();
    assert.equal(save.map.items.find((p)=>p[0]===234)[7].si.length,1,"free helper after emptied staff reload");
    assert.equal(save.map.items.find((p)=>p[0]===266)[7].si.length,1);
    assert.equal(save.playerInfo.cash,before.playerInfo.cash-33,"free opening helpers cost nothing");
    await page.context().close();
  }
}
