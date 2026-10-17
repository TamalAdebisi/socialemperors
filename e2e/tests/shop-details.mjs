import assert from "node:assert/strict";
import {PHONE} from "../lib.mjs";
export default async function shopDetails({newPlayer}) {
 for(const phone of [false,true]) {
  const player=await newPlayer(phone?{phone:true,viewport:PHONE}:{}),{page}=player;
  const read=async()=>(await(await page.request.post(`${player.base}${player.settings.dynamicUrl}/get_player_info.php`,{form:{USERID:player.settings.userId,user_key:player.settings.userKey}})).json());
  await player.saved();const beforeInfo=await read(),before=beforeInfo.map;
  await player.menu("Build");await player.press("Houses");
  const panel=page.getByRole("dialog",{name:"Shop",exact:true});
  assert.equal(await panel.locator(".shop-category-icon").count(),6);
  const card=(name)=>panel.locator(".shop-items > li",{has:page.locator(".shop-name",{hasText:new RegExp(`^${name}$`)})});
  if(phone)await card("House I").getByRole("button",{name:"Details: House I",exact:true}).click();
  else await card("House I").locator(".shop-card").hover();
  let details=page.getByRole("region",{name:"Details: House I",exact:true});
  await details.waitFor({state:"visible"});assert.match(await details.innerText(),/3 population/);
  await player.shot(phone?"phone-house":"desktop-house");
  await details.getByRole("button",{name:"Close details",exact:true}).click();
  await card("House II").getByRole("button",{name:"Details: House II",exact:true}).click();
  details=page.getByRole("region",{name:"Details: House II",exact:true});
  assert.match(await details.innerText(),/4 population/);
  assert.ok(await card("House II").locator(".locked").count(),"locked details do not unlock the house");
  await page.keyboard.press("Escape");assert.ok(await panel.isVisible(),"first Escape closes details");
  await panel.locator(".shop-categories").getByRole("button",{name:"Army",exact:true}).click();await player.press("Infantry");
  await card("Barracks I").getByRole("button",{name:"Details: Barracks I",exact:true}).click();
  details=page.getByRole("region",{name:"Details: Barracks I",exact:true});
  assert.equal(await details.locator("[data-stat]").count(),6);
  await page.waitForFunction(()=>{
   const canvas=document.querySelector(".shop-details canvas");
   return canvas?.width && canvas.getContext("2d").getImageData(0,0,canvas.width,canvas.height).data.some((v,i)=>i%4===3&&v>0);
  },null,{timeout:30000});
  await player.shot(phone?"phone-training":"desktop-training");
  await details.getByRole("button",{name:"Close details",exact:true}).click();
  await panel.locator(".shop-categories").getByRole("button",{name:"New",exact:true}).click();
  assert.ok(await panel.locator(".shop-new").count()>0,"original New badges are present");
  await player.shot(phone?"phone-new":"desktop-new");
  const after=await player.saved();assert.equal(after.items.length,before.items.length,"details never place or buy an item");
  const afterInfo=await read();
  assert.deepEqual(afterInfo.privateState.unlockedEarlyBuildings??{},beforeInfo.privateState.unlockedEarlyBuildings??{});
  assert.equal(afterInfo.playerInfo.cash,beforeInfo.playerInfo.cash);
  await page.context().close();
 }
}
