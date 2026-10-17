import assert from "node:assert/strict";
import {test} from "node:test";
import {itemInfo,type ConfigItem} from "./config.ts";
import {shopFacts,limitedDays} from "./shopDetails.ts";
const item=(id:number,kind:number,more:Partial<ConfigItem>={})=>itemInfo({id:String(id),name:`Item ${id}`,type:"b",img_name:"x",width:"2",height:"2",category_id:"1",subcat_functional:String(kind),...more} as ConfigItem);
const unit=item(509,78,{type:"u",life:"200",attack:"12",attack_interval:"30",attack_range:"2",velocity:"3",population:"1"});
const items=new Map([[509,unit]]);
test("house, worker building, ranch and autonomous production show their original base values",()=>{
 const house=shopFacts(item(1,111,{population:"3",activation:"0"}),items);assert.deepEqual(house.earns,{amount:3,resource:"population"});assert.equal(house.timer,0);
 const mill=shopFacts(item(5,121,{collect:"300",collect_type:"f",activation:"3600",unit_capacity:"4"}),items);
 assert.deepEqual(mill.earns,{amount:300,resource:"food"});assert.equal(mill.capacity,4);assert.equal(mill.timer,3600);
 const ranch=shopFacts(item(11,123,{collect:"100",collect_type:"f",activation:"1800",unit_capacity:"2"}),items);assert.equal(ranch.descriptions[0].id,894);assert.equal(ranch.capacity,2);
 const shop=shopFacts(item(219,138,{collect:"200",collect_type:"g",activation:"60"}),items);assert.deepEqual(shop.earns,{amount:200,resource:"gold"});assert.equal(shop.capacity,undefined);
});
test("units and barracks use the trained unit's six stats; castles also retain their own stats",()=>{
 assert.deepEqual(shopFacts(unit,items).stats.map((s)=>s.value),[200,12,30,3,2,1]);
 const barracks=shopFacts(item(38,311,{trains:"509"}),items);assert.equal(barracks.trains,unit);assert.equal(barracks.descriptions[0].id,891);
 const castle=shopFacts(item(1500,231,{trains:"509",life:"500",attack:"75",attack_range:"8"}),items);assert.equal(castle.stats[0].value,500);assert.equal(castle.trains,unit);
});
test("eagles show scout life, markets their lot, discounts and population wonders original values",()=>{
 assert.equal(shopFacts(item(185,136,{life:"500"}),items).stats[0].value,200);
 assert.equal(shopFacts(item(217,136),items).stats[0].value,10000);
 assert.equal(shopFacts(item(188,132),items).lot,200);assert.equal(shopFacts(item(346,132),items).lot,300);
 assert.equal(shopFacts(item(22,131),items).discount,10);assert.equal(shopFacts(item(25,134),items).discount,10);
 assert.deepEqual(shopFacts(item(999,511,{population:"20"}),items).descriptions[0].args,[175,20]);
 assert.deepEqual(shopFacts(item(999,411,{xp:"7"}),items).earns,{amount:7,resource:"xp"});
});
test("special buildings keep descriptions instead of misleading production; walls and refuges use their own fields",()=>{
 const summit=shopFacts(item(234,111),items);assert.equal(summit.descriptions[0].id,51);assert.equal(summit.earns,undefined);
 const altar=shopFacts(item(225,124,{collect:"1000",collect_type:"g"}),items);assert.equal(altar.descriptions[0].id,53);assert.equal(altar.earns,undefined);
 assert.equal(shopFacts(item(299,139),items).descriptions[0].id,57);
 const wall=shopFacts(item(27,221,{life:"200"}),items);assert.equal(wall.stats.length,3);assert.equal(wall.stats[0].value,200);
 assert.equal(shopFacts(item(151,1311,{unit_capacity:"10"}),items).capacity,10);
});
test("limited expiry uses original local date parsing and rounds days up without reopening expired stock",()=>{
 const start=new Date(2026,9,17).getTime()/1000;
 assert.equal(limitedDays("2026-10-19 23:00:00",start+1),2);
 assert.equal(limitedDays("2012-01-01",start),0);assert.equal(limitedDays(undefined,start),0);
});
