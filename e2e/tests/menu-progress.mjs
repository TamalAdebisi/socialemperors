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
}
