import assert from "node:assert/strict";
export default async function menuProgress({newPlayer,offlineVillage}){
 let player=await newPlayer();
 const commands=[{cmd:"rt_level_up",args:[20]}];
 for(let id=1;id<52;id++)commands.push({cmd:"complete_mission",args:[id,0]},{cmd:"reward_mission",args:[0,id]});
 await player.send(commands);
 // Food for the Allied Market's early delivery below (1,000: the original's 2 cash, in food since 29 October 2026).
 player=await offlineVillage(player,(save)=>{save.maps[0].food=Math.max(Number(save.maps[0].food)||0,5000);});
 const {page}=player;
 await page.locator(".goal-cards",{hasText:"Spend 1 cash"}).waitFor();
 await player.menu("Army");await player.press("Collections");
 await page.locator('[data-collection="1"]').getByRole("button",{name:"Complete for 5 cash",exact:true}).click();
 const read=async()=>(await(await page.request.post(`${player.base}${player.settings.dynamicUrl}/get_player_info.php`,{form:{USERID:player.settings.userId,user_key:player.settings.userKey}})).json());
 // Poll the actual saved response in Node. An async predicate is a truthy
 // Promise in this Playwright version's waitForFunction poller.
 const untilRewarded=async(ids)=>{
  const deadline=Date.now()+30000;
  while(Date.now()<deadline){
   const save=await read();
   if(ids.every((id)=>save.privateState.completedMissions?.includes(id)&&save.privateState.rewardedMissions?.includes(id)))return save;
   await new Promise((resolve)=>setTimeout(resolve,100));
  }
  assert.fail(`Timed out waiting for saved menu missions ${ids.join(", ")}`);
 };
 const saved=await untilRewarded([52,54]);
 assert.ok(saved.privateState.completedMissions.includes(52));
 assert.ok(saved.privateState.rewardedMissions.includes(54),"collection opening also credits its own goal");
 assert.equal(await page.evaluate(()=>window.seHome.parts.editor.doings.spent.get("c")),5,"the payment event and balance poll credit one expense");
 await player.shot("menu-goals-saved");await player.reload();
 assert.ok((await read()).privateState.rewardedMissions.includes(52));

 // Reach each social goal with normal local fixture commands. The rewards
 // themselves must be claimed through the new window, not the command API.
 const reach=async(first,last,building,at,helpers)=>{
  const fixture=[];
  for(let id=first;id<=last;id++)fixture.push({cmd:"complete_mission",args:[id,0]},{cmd:"reward_mission",args:[0,id]});
  fixture.push({cmd:"buy",args:[building,...at,0,0,1,1,"b"]});
  for(let i=0;i<helpers;i++)fixture.push({cmd:"buy_si_help",args:[...at,0,building,1]});
  await player.send(fixture);await player.reload();await player.saved();
  const placed=(await read()).map.items.find((p)=>p[0]===building);
  assert.ok(placed,"the social fixture survives ordinary overlap cleanup");assert.deepEqual(placed.slice(1,3),at);
 };
 const rewarded=async(id)=>{await untilRewarded([id]);};
 await reach(53,103,387,[56,50],3);
 await page.locator(".goal-cards",{hasText:"Get recruitment prize"}).waitFor();
 await player.select([56,50],"Recruitment Prize");await player.press("Open");
 const social=page.locator(".social-window:not([hidden])");
 await social.getByRole("button",{name:"Claim reward",exact:true}).click();
 await rewarded(104);await player.shot("recruitment-goal-saved");
 await reach(105,114,266,[56,56],3);
 await page.locator(".goal-cards",{hasText:"Get wood Allies Market"}).waitFor();
 await player.select([56,56],"Allies Market");await player.press("Open");
 await social.getByRole("button",{name:"Order wood",exact:true}).click();
 await social.getByRole("button",{name:"Finish delivery for 1,000 food",exact:true}).click();
 await rewarded(115);await player.shot("allied-market-goal-saved");
 await player.reload();const final=await read();
 for(const id of [52,54,104,115])assert.ok(final.privateState.rewardedMissions.includes(id),`menu goal ${id} survives reload`);
}
