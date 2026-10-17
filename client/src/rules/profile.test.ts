import assert from "node:assert/strict";
import {test} from "node:test";
import {readProfile,honourRank,honourRanks,missingTownHall} from "./profile.ts";
import type {Town,PlacedItem} from "./town.ts";
test("public profile normalizes supported fields without inventing missing country or last-seen data",()=>{
 const profile=readProfile({name:"<Emperor>",level:"12",map_names:["Home",42],honor_points:"50",attacks_won:3,attacks_lost:-2});
 assert.ok(profile);assert.equal(profile.name,"<Emperor>");assert.equal(profile.level,12);assert.deepEqual(profile.map_names,["Home"]);
 assert.equal(profile.honor_points,50);assert.equal(profile.attacks_lost,0);assert.equal(profile.country,"");assert.equal(profile.last_logged_in,0);
 for(const bad of [null,[],{},"error",{name:3}])assert.equal(readProfile(bad),null);
});
test("honour rank thresholds are inclusive and retain original badge numbering",()=>{
 const ranks=honourRanks([{points:0,rank:"First"},{points:100,rank:"Third"},{points:50,rank:"Second"}]);
 assert.equal(honourRank(49,ranks)?.rank,"First");assert.equal(honourRank(50,ranks)?.rank,"Second");
 assert.equal(honourRank(50,ranks)?.badge,3);assert.equal(honourRank(999,ranks)?.rank,"Third");
 assert.equal(honourRank(1,[]),null);assert.deepEqual(honourRanks({}),[]);
});
test("missing-hall notice checks the player's hall, including a damaged hall, not an enemy's",()=>{
 const hall=(race:string)=>({item:{subcategory:135,race},ruined:true}) as PlacedItem;
 const town={race:"h",items:[]} as unknown as Town;
 assert.equal(missingTownHall(town),true);town.items=[hall("t")];assert.equal(missingTownHall(town),true);
 town.items.push(hall("h"));assert.equal(missingTownHall(town),false);
});
