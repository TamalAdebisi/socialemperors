// Public profile fields and the original configured honour thresholds.
import {isTheirs} from "./editing.ts";
import type {Town} from "./town.ts";
export interface HonourRank {points:number;rank:string;badge:number}
export interface PublicProfile {
 pid:string;name:string;level:number;map_names:string[];honor_points:number;
 attacks_won:number;attacks_lost:number;last_logged_in:number;country:string;
}
const count=(value:unknown)=>{const n=Number(value);return Number.isFinite(n)?Math.max(0,Math.floor(n)):0;};
export function readProfile(raw:unknown):PublicProfile|null {
 if(!raw||typeof raw!=="object"||Array.isArray(raw))return null;
 const row=raw as Record<string,unknown>;
 if(typeof row.name!=="string"||row.name.length===0)return null;
 return {pid:typeof row.pid==="string"?row.pid:"",name:row.name,level:Math.max(1,count(row.level)),
  map_names:Array.isArray(row.map_names)?row.map_names.filter((name):name is string=>typeof name==="string"):[],
  honor_points:count(row.honor_points),attacks_won:count(row.attacks_won),attacks_lost:count(row.attacks_lost),
  last_logged_in:count(row.last_logged_in),country:typeof row.country==="string"?row.country:""};
}
export function honourRanks(raw:unknown):HonourRank[] {
 if(!Array.isArray(raw))return [];
 return raw.flatMap((row,index)=>row&&typeof row==="object"&&typeof row.rank==="string"&&Number.isFinite(Number(row.points))
  ?[{points:count(row.points),rank:row.rank,badge:index+1}]:[]).sort((a,b)=>a.points-b.points);
}
export function honourRank(points:number,ranks:HonourRank[]):HonourRank|null {
 return [...ranks].reverse().find((rank)=>rank.points<=points)??ranks[0]??null;
}
export function missingTownHall(town:Town):boolean {
 return !town.items.some((p)=>p.item.subcategory===135&&isTheirs(town,p.item));
}
