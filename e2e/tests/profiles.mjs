import assert from "node:assert/strict";
import {PHONE} from "../lib.mjs";
export default async function profiles({newPlayer}) {
 const rival=await newPlayer();await rival.page.close();
 for(const phone of [false,true]){
  const player=await newPlayer(phone?{phone:true,viewport:PHONE}:{}),{page}=player;
  await player.send([{cmd:"rt_level_up",args:[20]},{cmd:"name_map",args:[0,"Profile Empire"]}]);await player.reload();
  const self=async()=>{await player.menu("Army");await player.press("My profile");};
  const panel=page.locator(".profile-window:not([hidden])");
  await self();await panel.getByRole("heading",{name:player.name,exact:true}).waitFor();
  assert.match(await panel.innerText(),/Level 20/);assert.match(await panel.innerText(),/Profile Empire/);assert.match(await panel.innerText(),/Honour: 0/);assert.match(await panel.innerText(),/Peasant with Spear/);
  await panel.locator(".profile-content > .profile-badge").evaluate((image)=>image.decode());
  await player.shot(phone?"phone-self":"desktop-self");
  await panel.getByRole("link",{name:"Honour ranks",exact:true}).click();assert.ok(await panel.locator(".profile-ranks:not([hidden]) li").count()>1);
  await player.shot(phone?"phone-ranks":"desktop-ranks");
  await player.menu("Neighbours");await page.getByRole("button",{name:`Profile of ${rival.name}`,exact:true}).click();
  await panel.getByRole("heading",{name:rival.name,exact:true}).waitFor();assert.match(await panel.innerText(),/Attacks won: 0 · lost: 0/);
  await player.shot(phone?"phone-neighbour":"desktop-neighbour");
  await page.route("**/get_public_player_info.php?**",(route)=>route.fulfill({json:null}),{times:1});
  await self();await panel.getByText("This profile could not be loaded.",{exact:true}).waitFor();
  await panel.getByRole("button",{name:"Retry",exact:true}).click();await panel.getByRole("heading",{name:player.name,exact:true}).waitFor();
  if(!phone){
   await page.keyboard.press("Escape");
   let release;const gate=new Promise((resolve)=>{release=resolve;});let started;const entered=new Promise((resolve)=>{started=resolve;});
   await page.route("**/get_public_player_info.php?**",async(route)=>{const response=await route.fetch();started();await gate;await route.fulfill({response});},{times:1});
   await self();await entered;await page.keyboard.press("Escape");
   await player.menu("Neighbours");await page.getByRole("button",{name:`Profile of ${rival.name}`,exact:true}).click();
   await panel.getByRole("heading",{name:rival.name,exact:true}).waitFor();
   const stale=page.waitForResponse((response)=>response.url().includes("get_public_player_info.php")&&response.url().includes(player.settings.userId));
   release();const reply=await stale;await reply.finished();
   await page.evaluate(()=>new Promise((resolve)=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   assert.equal(await panel.locator(".profile-content h3").innerText(),rival.name,"late closed profile cannot replace the new profile");
   await player.shot("late-profile-ignored");
  }
  await page.context().close();
 }
 await rival.page.context().close();
}
