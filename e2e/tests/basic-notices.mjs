import assert from "node:assert/strict";
import {PHONE} from "../lib.mjs";
export default async function basicNotices({newPlayer}){
 for(const phone of [false,true]){
  const player=await newPlayer(phone?{phone:true,viewport:PHONE}:{}),{page}=player;
  const before=await player.saved(),hall=before.items.find((p)=>p[0]===26);assert.ok(hall);
  // A legacy missing-hall fixture, created only through the local test server.
  await player.send([{cmd:"sell",args:[hall[1],hall[2],hall[0],0,1,"FIXTURE"]}]);await player.reload();
  const notice=page.locator(".notice",{has:page.getByRole("heading",{name:"Missing Townhall",exact:true})});
  await notice.waitFor({state:"visible"});assert.match(await notice.innerText(),/automatically lose/i);
  await player.shot(phone?"phone-no-townhall":"desktop-no-townhall");
  await notice.getByRole("button",{name:"OK",exact:true}).click();
  const saved=await player.saved();assert.equal(saved.items.some((p)=>p[0]===26),false,"notice does not replace or buy a hall");
  await player.reload();await notice.waitFor({state:"visible"});
  await page.context().close();
 }
}
