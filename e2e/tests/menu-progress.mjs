import assert from "node:assert/strict";
export default async function menuProgress({newPlayer}){
 const player=await newPlayer(),{page}=player;
 const commands=[{cmd:"rt_level_up",args:[20]}];
 for(let id=1;id<52;id++)commands.push({cmd:"complete_mission",args:[id,0]},{cmd:"reward_mission",args:[0,id]});
 await player.send(commands);await player.reload();
 await page.locator(".goal-cards",{hasText:"Spend 1 cash"}).waitFor();
 await player.menu("Army");await player.press("Collections");
 await page.locator('[data-collection="1"]').getByRole("button",{name:"Complete for 5 cash",exact:true}).click();
 const read=async()=>(await(await page.request.post(`${player.base}${player.settings.dynamicUrl}/get_player_info.php`,{form:{USERID:player.settings.userId,user_key:player.settings.userKey}})).json());
 await page.waitForFunction(async({base,dynamic,userId,userKey})=>{
  const response=await fetch(`${base}${dynamic}/get_player_info.php`,{method:"POST",body:new URLSearchParams({USERID:userId,user_key:userKey})});
  const save=await response.json();return save.privateState.rewardedMissions?.includes(52)&&save.privateState.rewardedMissions?.includes(54);
 },{base:player.base,dynamic:player.settings.dynamicUrl,userId:player.settings.userId,userKey:player.settings.userKey},{timeout:30000});
 const saved=await read();assert.ok(saved.privateState.completedMissions.includes(52));assert.ok(saved.privateState.rewardedMissions.includes(54),"collection opening also credits its own goal");
 await player.shot("menu-goals-saved");await player.reload();
 assert.ok((await read()).privateState.rewardedMissions.includes(52));

 // Reach each social goal with normal local fixture commands. The rewards
 // themselves must be claimed through the new window, not the command API.
 const reach=async(first,last,building,at,helpers)=>{
  const fixture=[];
  for(let id=first;id<=last;id++)fixture.push({cmd:"complete_mission",args:[id,0]},{cmd:"reward_mission",args:[0,id]});
  fixture.push({cmd:"buy",args:[building,...at,0,0,1,1,"b"]});
  for(let i=0;i<helpers;i++)fixture.push({cmd:"buy_si_help",args:[...at,0,building,1]});
  await player.send(fixture);await player.reload();
 };
 const rewarded=async(id)=>{
  await page.waitForFunction(async({base,dynamic,userId,userKey,id})=>{
   const response=await fetch(`${base}${dynamic}/get_player_info.php`,{method:"POST",body:new URLSearchParams({USERID:userId,user_key:userKey})});
   return (await response.json()).privateState.rewardedMissions?.includes(id);
  },{base:player.base,dynamic:player.settings.dynamicUrl,userId:player.settings.userId,userKey:player.settings.userKey,id},{timeout:30000});
 };
 await reach(53,103,387,[54,50],3);
 await page.locator(".goal-cards",{hasText:"Get recruitment prize"}).waitFor();
 await player.select([54,50],"Recruitment Prize");await player.press("Open");
 const social=page.locator(".social-window:not([hidden])");
 await social.getByRole("button",{name:"Claim reward",exact:true}).click();
 await rewarded(104);await player.shot("recruitment-goal-saved");
 await reach(105,114,266,[56,55],3);
 await page.locator(".goal-cards",{hasText:"Get wood Allies Market"}).waitFor();
 await player.select([56,55],"Allies Market");await player.press("Open");
 await social.getByRole("button",{name:"Order wood",exact:true}).click();
 await social.getByRole("button",{name:"Finish delivery for 2 cash",exact:true}).click();
 await rewarded(115);await player.shot("allied-market-goal-saved");
 await player.reload();const final=await read();
 for(const id of [52,54,104,115])assert.ok(final.privateState.rewardedMissions.includes(id),`menu goal ${id} survives reload`);
}
