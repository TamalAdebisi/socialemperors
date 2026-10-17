import assert from "node:assert/strict";
import {PHONE} from "../lib.mjs";

async function buttonsFit(panel) {
 const errors=await panel.locator(".shop-details-button").evaluateAll((buttons)=>buttons.flatMap((button)=>{
  const box=button.getBoundingClientRect(),card=button.parentElement.getBoundingClientRect();
  const text=document.createRange();text.selectNodeContents(button);const label=text.getBoundingClientRect();
  return button.textContent!=="Details" || button.scrollWidth>button.clientWidth ||
   label.left<box.left || label.right>box.right || label.top<box.top || label.bottom>box.bottom ||
   box.left<card.left-1 || box.right>card.right+1 || box.bottom>card.bottom+1
   ? [button.getAttribute("aria-label")] : [];
 }));
 assert.deepEqual(errors,[],"Details text and buttons fit their grid cells");
}

async function onlyOnClick(page,card) {
 const details=page.locator(".shop-details");
 await card.locator(".shop-card").hover();
 assert.ok(await details.isHidden(),"hovering a card never opens details");
 const buy=card.locator("button.shop-card");
 if(await buy.count()) {
  await buy.focus();assert.ok(await details.isHidden(),"focusing a purchase never opens details");
 }
 const button=card.locator(".shop-details-button");
 await button.hover();assert.ok(await details.isHidden(),"hovering Details never opens it");
 await button.focus();assert.ok(await details.isHidden(),"focusing Details never opens it");
 assert.equal(await button.getAttribute("aria-expanded"),"false");
}

export default async function shopDetails({newPlayer}) {
 for(const phone of [false,true]) {
  const player=await newPlayer(phone?{phone:true,viewport:PHONE}:{}),{page}=player;
  await player.send([{cmd:"store_add_items",args:[JSON.stringify([1,29])]}]);
  await player.reload();
  const read=async()=>(await(await page.request.post(`${player.base}${player.settings.dynamicUrl}/get_player_info.php`,{form:{USERID:player.settings.userId,user_key:player.settings.userKey}})).json());
  await player.saved();const beforeInfo=await read(),before=beforeInfo.map;
  await player.menu("Build");await player.press("Houses");
  const panel=page.getByRole("dialog",{name:"Shop",exact:true});
  assert.equal(await panel.locator(".shop-category-icon").count(),6);
  const card=(name)=>panel.locator(".shop-items > li",{has:page.locator(".shop-name",{hasText:new RegExp(`^${name}$`)})});
  await onlyOnClick(page,card("House I"));
  const houseDetails=card("House I").getByRole("button",{name:"Details: House I",exact:true});
  await houseDetails.click();
  let details=page.getByRole("region",{name:"Details: House I",exact:true});
  await details.waitFor({state:"visible"});assert.match(await details.innerText(),/3 population/);
  assert.equal(await houseDetails.getAttribute("aria-expanded"),"true");
  await card("House II").locator(".shop-card").hover();
  assert.ok(await details.isVisible(),"hovering another item never replaces explicit details");
  await buttonsFit(panel);
  await player.shot(phone?"phone-house":"desktop-house");
  await houseDetails.click();assert.ok(await details.isHidden(),"Details toggles closed");
  await houseDetails.focus();await page.keyboard.press("Enter");
  await details.waitFor({state:"visible"});await page.keyboard.press("Escape");
  assert.ok(await details.isHidden());assert.ok(await panel.isVisible());
  await houseDetails.focus();await page.keyboard.press("Space");
  await details.waitFor({state:"visible"});
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
  await panel.locator(".shop-categories").getByRole("button",{name:"Defense",exact:true}).click();
  await card("Castle I").getByRole("button",{name:"Details: Castle I",exact:true}).click();
  details=page.getByRole("region",{name:"Details: Castle I",exact:true});
  assert.equal(await details.locator("[data-stat]").count(),10,"castle and trained-unit stats are both readable");
  await page.waitForFunction(()=>{
   const canvas=document.querySelector(".shop-details canvas");
   return canvas?.width && canvas.getContext("2d").getImageData(0,0,canvas.width,canvas.height).data.some((v,i)=>i%4===3&&v>0);
  },null,{timeout:30000});
  const bounds=await details.boundingBox(),viewport=page.viewportSize();
  assert.ok(bounds.y>=12 && bounds.y+bounds.height<=viewport.height-12,`tall details stay inside the viewport: ${JSON.stringify(bounds)}`);
  await player.shot(phone?"phone-castle":"desktop-castle");
  await details.getByRole("button",{name:"Close details",exact:true}).click();
  if(!phone) {
   // Exercise the real three-column cards at phone, landscape, tablet and
   // desktop widths, including the long names in Defense.
   for(const viewport of [{width:320,height:640},{width:360,height:740},PHONE,
    {width:720,height:400},{width:768,height:1024},{width:1000,height:1200},
    {width:1024,height:768},{width:1280,height:800}]) {
    await page.setViewportSize(viewport);
    await onlyOnClick(page,card("Castle I"));
    await buttonsFit(panel);
    await card("Castle I").getByRole("button",{name:"Details: Castle I",exact:true}).click();
    await details.waitFor({state:"visible"});
    const box=await details.boundingBox();
    assert.ok(box.x>=0 && box.x+box.width<=viewport.width && box.y>=0 && box.y+box.height<=viewport.height,
     `details fit ${viewport.width}x${viewport.height}: ${JSON.stringify(box)}`);
    await details.getByRole("button",{name:"Close details",exact:true}).click();
    await player.shot(`width-${viewport.width}`);
   }
  }
  await panel.locator(".shop-categories").getByRole("button",{name:"New",exact:true}).click();
  assert.ok(await panel.locator(".shop-new").count()>0,"original New badges are present");
  await player.shot(phone?"phone-new":"desktop-new");
  await page.keyboard.press("Escape");await player.menu("Storage");
  const storage=page.getByRole("dialog",{name:"Storage",exact:true});
  const storedHouse=storage.locator(".shop-items > li",{has:page.locator(".shop-name",{hasText:/^House I$/})});
  await onlyOnClick(page,storedHouse);await buttonsFit(storage);
  await storedHouse.getByRole("button",{name:"Details: House I",exact:true}).click();
  details=page.getByRole("region",{name:"Details: House I",exact:true});
  await details.waitFor({state:"visible"});assert.match(await details.innerText(),/3 population/);
  await player.shot(phone?"phone-storage":"desktop-storage");
  await storage.getByRole("button",{name:"Close window",exact:true}).click();
  assert.ok(await details.isHidden(),"closing Storage closes details");
  const after=await player.saved();assert.equal(after.items.length,before.items.length,"details never place or buy an item");
  assert.deepEqual(after.store,before.store,"details never place or sell stored items");
  const afterInfo=await read();
  assert.deepEqual(afterInfo.privateState.unlockedEarlyBuildings??{},beforeInfo.privateState.unlockedEarlyBuildings??{});
  assert.equal(afterInfo.playerInfo.cash,beforeInfo.playerInfo.cash);
  await page.context().close();
 }
}
