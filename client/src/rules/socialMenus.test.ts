import assert from "node:assert/strict";
import { test } from "node:test";
import { itemInfo, type ConfigItem } from "./config.ts";
import { finishSocial, hireHelper, orderResource, socialCapacity, socialRules, socialWait } from "./socialMenus.ts";
import { freeHelpers } from "./social.ts";
import { readTown, type PlacedItem, type Town, type PlayerInfo } from "./town.ts";

const rules=socialRules({});
const item=(id:number,unit=false)=>({ ...itemInfo({id:String(id),name:`Item ${id}`,type:unit?"u":"b",img_name:"x",width:"1",height:"1",category_id:"1",subcat_functional:"139",race:"h",population:unit?"1":"0"} as ConfigItem),
  social:!unit,staffPlaces:id===234?9:id===470?20:8,workerCost:[234,266,352].includes(id)?2:0,activation:[266,352,389].includes(id)?86400:0 });
const items=new Map([234,266,352,387,389,470,576,603,606,569,556,602,533,534,535,550].map((id)=>[id,item(id,id>=500)]));
const placed=(id:number,staff=0)=>({ item:items.get(id)!,tx:50,ty:50,orientation:0,unitsInside:0,startedAt:0,workTime:0,staff,staffIds:Array(staff).fill("0") }) as PlacedItem;
const town=(building:PlacedItem)=>({id:0,name:"",townName:"",level:1,xp:0,cash:100,gold:0,wood:0,food:0,stone:0,race:"h",skin:0,expansions:new Set([13]),unlocked:new Set(),gifts:new Map(),store:new Map(),items:[building],unknown:[]}) as Town;
const finish=(t:Town,b:PlacedItem,resource="n",now=86401,recruit=0)=>finishSocial(t,b,items,{resource},rules,now,recruit,()=>0);

test("staff ids survive reading and free/paid hires stay in step",()=>{
  const info={result:"ok",timestamp:1,playerInfo:{name:"",cash:20},map:{id:0,race:"h",items:[[234,50,50,0,0,0,[],{si:["alice"],sif:{ualice:true}}]],expansions:[13]}} as unknown as PlayerInfo;
  const t=readTown(info,items), b=t.items[0];
  assert.deepEqual(b.staffIds,["alice"]);assert.equal(b.staffAsked?.size,1);
  assert.equal(freeHelpers(t).length,1);assert.deepEqual(b.staffIds,["alice","0"]);
  assert.ok(hireHelper(t,b,rules));assert.equal(t.cash,18);assert.equal(b.staff,3);assert.equal(b.staffIds?.length,3);
  b.staff=9; assert.equal(hireHelper(t,b,rules),null);
  t.items=[]; b.staff=0;assert.equal(hireHelper(t,b,rules),null);
});

test("Summit requires room for nine and creates nine saved free allies with a reset staff",()=>{
  const b=placed(234,9),t=town(b);
  assert.match(String(finish(t,b)),/room for 9/);assert.equal(b.staff,9);
  t.items.push({ ...placed(234),item:{...item(1),population:30,social:false} });
  const result=finish(t,b);assert.notEqual(typeof result,"string");if(typeof result==="string")return;
  assert.equal(result.added.length,9);assert.equal(new Set(result.added.map((p)=>`${p.tx},${p.ty}`)).size,9);
  assert.equal(result.commands.filter((c)=>c.cmd==="buy").length,9);assert.equal(result.commands.at(-1)?.cmd,"finish_si");
  assert.equal(b.staff,0);assert.equal(t.cash,100);
});

test("allied resource choice starts one day; collection/hurry has exact helper-scaled payment",()=>{
  const b=placed(266,3),t=town(b),state={resource:"n"};
  assert.deepEqual(orderResource(t,b,state,"w",100),{cmd:"set_resource_allies",args:["w",50,50,0,266]});
  assert.equal(orderResource(t,b,state,"g",100),null);assert.equal(socialWait(b,100),86400);
  t.cash=1;assert.match(String(finishSocial(t,b,items,state,rules,101)),/cash/);assert.equal(t.wood,0);
  t.cash=10;const result=finishSocial(t,b,items,state,rules,101);assert.notEqual(typeof result,"string");
  assert.equal(t.wood,500);assert.equal(t.cash,8);assert.equal(state.resource,"n");assert.equal(b.staff,0);
  assert.match(String(finishSocial(t,b,items,state,rules,101)),/resource first/);
  orderResource(t,b,state,"s",200);
  assert.notEqual(typeof finishSocial(t,b,items,state,rules,86600),"string");
  assert.equal(t.stone,125);assert.equal(t.cash,8);
});

test("Wonder uses cumulative fifths without consuming earlier friends and stops after five",()=>{
  const b=placed(470,4),t=town(b);
  assert.equal(socialCapacity(t,b,rules),4);assert.notEqual(typeof finish(t,b),"string");assert.equal(t.increasedPopulation,1);assert.equal(b.staff,4);
  assert.equal(socialCapacity(t,b,rules),8);assert.match(String(finish(t,b)),/More friends/);
  for(let stage=2;stage<=5;stage++) {b.staff=stage*4;assert.notEqual(typeof finish(t,b),"string");}
  assert.equal(t.increasedPopulation,5);assert.match(String(finish(t,b)),/complete/);
  assert.equal(hireHelper(t,b,rules),null,"no cash hiring for friend-only buildings");
});

test("recruitment gives the selected configured reward and resets; Round Table tiers wait then pay once",()=>{
  const b=placed(387,3); b.item={...b.item,staffPlaces:3};const t=town(b);
  const result=finish(t,b,"n",0,1);assert.notEqual(typeof result,"string");
  if(typeof result!=="string") {assert.equal(result.added.length,2);assert.equal(result.added[0].item.id,606);assert.equal(result.commands[0].cmd,"finish_si");}
  assert.equal(b.staff,0);
  for(const staff of [3,4,6,8]) {
    const round=placed(389,staff),player=town(round);
    assert.match(String(finish(player,round,"n",100)),/gathering/);
    const paid=finish(player,round);assert.notEqual(typeof paid,"string");
    assert.equal(player.gold,staff>=4?1000:0);assert.equal(player.xp,staff>=6?100:0);
    assert.equal(player.store.get(533)??0,staff>=8?1:0);
    assert.match(String(finish(player,round)),/gathering/,"collect resets the one-day clock");
  }
});
