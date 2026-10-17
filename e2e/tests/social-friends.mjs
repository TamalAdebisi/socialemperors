import assert from "node:assert/strict";
import { PHONE,stored } from "../lib.mjs";
const RECRUIT=[54,50],WONDER=[50,54],ROUND=[56,56];
export default async function socialFriends({newPlayer}) {
  const asker=await newPlayer(),helpers=[];
  for(let i=0;i<4;i++) {
    const player=await newPlayer();const csrf=await player.csrf();
    helpers.push({player,csrf});await player.page.close();
  }
  const {page}=asker;
  await asker.send([{cmd:"rt_level_up",args:[30]},...[ [387,RECRUIT],[470,WONDER],[389,ROUND] ].map(([id,at])=>({cmd:"buy",args:[id,...at,0,0,1,1,"b"]}))]);
  await asker.reload();
  const read=async()=>(await(await page.request.post(`${asker.base}${asker.settings.dynamicUrl}/get_player_info.php`,{form:{USERID:asker.settings.userId,user_key:asker.settings.userKey}})).json());
  const panel=page.locator(".social-window:not([hidden])");
  const open=async(at,name)=>{await asker.select(at,name);await asker.press("Open");};
  const ask=async(picked)=>{
    await panel.getByRole("button",{name:"Ask friends",exact:true}).click();
    for(const {player} of picked) await panel.locator(".ask-friends label",{hasText:player.name}).locator("input").check();
    await panel.getByRole("button",{name:/^Ask(?: \d+ friends)?$/}).click();
    await page.waitForFunction(()=>/^Asked/.test(document.querySelector(".social-window .ask-status")?.textContent??""),null,{timeout:10000});
    await asker.shot(`asked-${picked.length}`);
    for(const {player,csrf} of picked) {
      const response=await player.page.request.post(`${player.base}/help/answer`,{form:{help:"all",csrf}});
      assert.ok(response.ok(),"friend's help accepted");
    }
    await asker.reload();
    if((await asker.bar())?.includes("your")) await asker.press("OK");
  };
  await open(RECRUIT,"Recruitment Prize");
  assert.equal(await panel.getByRole("button",{name:/Hire helper/}).count(),0,"recruitment has no cash hire");
  await ask(helpers.slice(0,3));
  await open(RECRUIT,"Recruitment Prize");
  await panel.locator(".shop-tabs button").nth(1).click();
  await panel.getByRole("button",{name:"Claim reward",exact:true}).click();
  await asker.saved();let save=await read();
  assert.equal(save.map.items.filter((p)=>p[0]===606).length,2,"selected pair of Vikings saved");
  assert.equal(save.map.items.find((p)=>p[0]===387)[7].si.length,0);
  await page.keyboard.press("Escape");
  await open(WONDER,"Great Church");await ask(helpers);
  await open(WONDER,"Great Church");
  const max=await page.evaluate(()=>document.querySelector("[data-people]").textContent);
  await page.setViewportSize(PHONE);asker.viewport=PHONE;
  await asker.shot("phone-wonder-ready");
  await panel.getByRole("button",{name:"Increase population by 10",exact:true}).click();
  await asker.saved();save=await read();
  assert.equal(save.map.increasedPopulation,1);assert.equal(save.map.items.find((p)=>p[0]===470)[7].si.length,4);
  const after=await page.evaluate(()=>document.querySelector("[data-people]").textContent);
  assert.equal(Number(after.split("/")[1]),Number(max.split("/")[1])+10);
  assert.ok(await panel.getByRole("button",{name:"Increase population by 10",exact:true}).isDisabled());
  await asker.shot("phone-wonder-next-step");await page.keyboard.press("Escape");
  await open(ROUND,"Round Table");
  await ask(helpers.slice(0,1));
  save=await read();assert.deepEqual(Object.keys(save.map.items.find((p)=>p[0]===389)[7].sif),[`u${helpers[0].player.settings.userId}`],"invitation records the original empire id, not the account id");
  await asker.send(Array.from({length:7},()=>({cmd:"buy_si_help",args:[...ROUND,0,389,1]})));
  await asker.reload();if((await asker.bar())?.includes("your"))await asker.press("OK");
  await open(ROUND,"Round Table");
  assert.ok(await panel.getByRole("button",{name:"Claim reward",exact:true}).isDisabled(),"one-day wait is enforced");
  // An elapsed-clock fixture; no runtime clock or server rule is changed.
  await page.evaluate(()=>{const p=window.seHome.parts.town.items.find((p)=>p.item.id===389);p.startedAt-=86401;});
  await page.waitForFunction(()=>!document.querySelector(".social-window [data-social-claim]")?.disabled,null,{timeout:10000});
  const before=await read();await panel.getByRole("button",{name:"Claim reward",exact:true}).click();
  await asker.saved();save=await read();
  assert.equal(save.map.coins,before.map.coins+1000);assert.equal(save.map.xp,before.map.xp+100);
  assert.equal([533,534,535,550].reduce((sum,id)=>sum+stored(save.map.store,id)-stored(before.map.store,id),0),1);
  const round=save.map.items.find((p)=>p[0]===389);assert.equal(round[7].si.length,0);assert.deepEqual(round[7].sif,{});
  await asker.shot("phone-round-paid");
  for(const {player}of helpers)await player.page.context().close();
}
