// Repeatable social buildings. Ordinary buildings retain the server's
// existing automatic opening; these six keep their staff between uses.
import type { Command } from "../net/commands.ts";
import type { ItemInfo } from "./config.ts";
import { isTheirs } from "./editing.ts";
import { standBeside } from "./graveyard.ts";
import { population } from "./training.ts";
import { RESOURCES } from "./production.ts";
import type { PlacedItem, Town } from "./town.ts";
import { cantPayFood, payFood } from "./speedUps.ts";

export const SOCIAL_BUILDINGS = new Set([234,266,352,387,389,470]);
export const ALLIED_MARKETS = new Set([266,352]);
/** Finishing an Allied Market's delivery early: the original's 2 cash, paid in food (rules/speedUps.ts). */
export const DELIVERY_HURRY_CASH = 2;
export interface SocialRules {
  populationSteps: number; populationIncrease: number; maxPosts: number;
  recruits: { id: number; count: number }[];
}
export function socialRules(globals: Record<string,unknown>): SocialRules {
  return { populationSteps:Number(globals.POPULATION_INCREASE_QTY)||5,
    populationIncrease:Number(globals.POPULATION_INCREASE)||10, maxPosts:Number(globals.MAX_FEEDS_ROUND_TABLE)||60,
    recruits:String(globals.NEWFRIENDS_REWARD_ID_UNIT ?? "603.1,606.2,569.2,556.1,602.1").split(",")
      .map((text) => { const [id,count]=text.split(".").map(Number); return { id,count }; }) };
}
export function socialCapacity(town: Town, placed: PlacedItem, rules: SocialRules): number {
  const total=placed.item.staffPlaces ?? 0;
  return placed.item.id===470 ? Math.min(total, Math.round(total/rules.populationSteps)*((town.increasedPopulation??0)+1)) : total;
}
export function socialWait(placed: PlacedItem, now: number): number {
  return Math.max(0,placed.item.activation-(now-(placed.startedAt??now)));
}
export function socialAt(town: Town, placed: PlacedItem): unknown[] { return [placed.tx,placed.ty,town.id,placed.item.id]; }
function valid(town: Town, placed: PlacedItem): boolean {
  return town.items.includes(placed) && isTheirs(town,placed.item) && SOCIAL_BUILDINGS.has(placed.item.id);
}
function resetStaff(placed: PlacedItem): void { placed.staff=0; placed.staffIds=[]; }
export function hireHelper(town: Town, placed: PlacedItem, rules: SocialRules): Command | null {
  const cost=placed.item.workerCost??0;
  if (!valid(town,placed) || cost<=0 || town.cash<cost || (placed.staff??0)>=socialCapacity(town,placed,rules)) return null;
  town.cash-=cost; placed.staff=(placed.staff??0)+1; (placed.staffIds??=[]).push("0");
  return { cmd:"buy_si_help",args:socialAt(town,placed) };
}
export interface AlliedState { resource: string }
export function orderResource(town: Town, placed: PlacedItem, state: AlliedState, resource: string, now: number): Command | null {
  if (!valid(town,placed) || !ALLIED_MARKETS.has(placed.item.id) || state.resource!=="n" || !["g","w","s","f"].includes(resource)) return null;
  state.resource=resource; placed.startedAt=now;
  return { cmd:"set_resource_allies",args:[resource,...socialAt(town,placed)] };
}
export interface SocialResult { commands: Command[]; added: PlacedItem[]; helpers: number; note: string }
export function finishSocial(town: Town, placed: PlacedItem, items: Map<number,ItemInfo>, state: AlliedState,
  rules: SocialRules, now: number, recruit=0, random: () => number=Math.random): SocialResult | string {
  if (!valid(town,placed)) return "This building is no longer here.";
  const id=placed.item.id, helpers=placed.staff??0, at=socialAt(town,placed);
  const commands: Command[]=[], added: PlacedItem[]=[];
  let note="";
  if (id===470) {
    if ((town.increasedPopulation??0)>=rules.populationSteps) return "All population increases are complete.";
    if (helpers<socialCapacity(town,placed,rules)) return "More friends are needed for this population increase.";
    town.increasedPopulation=(town.increasedPopulation??0)+1;
    commands.push({ cmd:"increase_population",args:[town.id] });
    note=`Room for ${rules.populationIncrease} more people.`;
  } else if (ALLIED_MARKETS.has(id)) {
    const resource=RESOURCES[state.resource];
    if (!resource || state.resource==="c") return "Choose a resource first.";
    // Early, for the original's 2 cash paid in food (the owner's rule, 29 October 2026; rules/speedUps.ts).
    const price=socialWait(placed,now)>0 ? DELIVERY_HURRY_CASH : 0;
    const short=cantPayFood(town,price);
    if (short) return short;
    payFood(town,price);
    const amount=125*(helpers+1); town[resource]+=amount;
    commands.push({ cmd:"finish_si",args:at }, { cmd:"set_resource_allies",args:["n",...at] });
    state.resource="n"; resetStaff(placed); note=`${amount} ${resource} delivered.`;
  } else if (id===389) {
    if (socialWait(placed,now)>0) return "The Round Table is still gathering knights.";
    const gold=helpers>=4 ? 1000 : 0, xp=helpers>=6 ? 100 : 0;
    const hero=helpers>=8 ? [533,534,535,550][Math.floor(random()*4)] : 0;
    town.gold+=gold; town.xp+=xp;
    if (hero) town.store.set(hero,(town.store.get(hero)??0)+1);
    commands.push({ cmd:"finish_si",args:[...at,gold,xp,hero] }, { cmd:"collect_new",args:at });
    placed.startedAt=now; resetStaff(placed); placed.staffAsked=new Set();
    note=`Round Table: ${gold} gold, ${xp} XP${hero ? ` and ${items.get(hero)?.name??"a hero"} in Storage` : ""}.`;
  } else {
    if (helpers<socialCapacity(town,placed,rules)) return "More friends are needed before claiming this reward.";
    const reward=id===234 ? { id:576,count:9 } : rules.recruits[recruit];
    const unit=reward && items.get(reward.id);
    if (!unit) return "Choose a recruitment reward.";
    if (id===234) {
      const people=population(town,items,rules.populationIncrease);
      if (people.current+9>people.max) return "You need room for 9 more people.";
    }
    if (id===387) commands.push({ cmd:"finish_si",args:at });
    for (let n=0;n<reward.count;n++) {
      const unitPlaced=standBeside(town,unit,placed); added.push(unitPlaced);
      commands.push({ cmd:"buy",args:[unit.id,unitPlaced.tx,unitPlaced.ty,0,town.id,1,1,"u"] });
    }
    if (id===234) commands.push({ cmd:"finish_si",args:at });
    resetStaff(placed); note=`${reward.count} ${unit.name} arrived.`;
  }
  return { commands,added,helpers,note };
}
