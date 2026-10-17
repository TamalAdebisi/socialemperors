// The original shop's facts per kind (InfoButtonOver, documented in
// docs/original/rules/shop-details.md). All numbers come from served items.
import type { ItemInfo } from "./config.ts";
import type { Words } from "./card.ts";
import { RESOURCES, type Resource } from "./production.ts";

export interface ShopFacts {
  descriptions: Words[];
  stats: { stat:"life"|"attack"|"delay"|"speed"|"range"|"room"; value:number }[];
  earns?: { amount:number; resource:Resource|"population"|"xp" };
  timer?: number; capacity?: number; discount?: number; lot?: number;
  trains?: ItemInfo;
}
const FEATURE_WORDS:Record<number,number>={
  224:58,343:58,299:57,344:57,221:59,325:59,366:60,222:61,223:62,266:63,352:63,373:64,
  387:65,389:66,416:67,470:68,486:1100,1233:1101,1255:1135,1283:1180,1284:1183,1299:1215,
  1345:1288,1346:1289,1394:1429,1463:1448,150:85,239:86,24:70,212:71,362:72,213:73,
  215:74,370:75,393:76,385:77,372:78,371:79,415:80,1358:1303,1359:1304,234:51,
  225:53,218:54,227:55,226:56,1364:70,384:81,429:82,469:83,369:84,
};
const EAGLE_LIFE:Record<number,number>={185:200,349:200,186:400,350:400,187:800,351:800,217:10000};
const LOTS:Record<number,number>={23:100,335:100,188:200,345:200,189:300,346:300};
const word=(id:number,fallback:string,args?:Words["args"]):Words=>({id,fallback,...(args?{args}:{})});
export function unitStats(item:ItemInfo):ShopFacts["stats"] {
  return [{stat:"life",value:item.life},{stat:"attack",value:item.attack},{stat:"delay",value:item.attackInterval},
    {stat:"speed",value:item.velocity},{stat:"range",value:item.attackRange},{stat:"room",value:item.population}];
}
export function shopFacts(item:ItemInfo,items:Map<number,ItemInfo>):ShopFacts {
  const facts:ShopFacts={descriptions:[],stats:[]};
  const feature=FEATURE_WORDS[item.id];
  if(feature) facts.descriptions.push(word(feature,""));
  if(item.isUnit) {facts.stats=unitStats(item);return facts;}
  const kind=item.subcategory;
  if(kind===111 && item.id!==234) {
    facts.descriptions.push(word(896,"Houses increase your population."));
    facts.earns={amount:item.population,resource:"population"};facts.timer=item.activation;
  } else if([121,122,124,123,138,511].includes(kind) && !feature) {
    if(kind===511 && item.population>0) facts.descriptions.push(word(87,"This wonder increases the #0# population limit by #1#.",[175,item.population]));
    else {
      facts.descriptions.push(word(kind===123?894:kind===138?897:kind===511?889:895,
        kind===123?"Put animals inside to produce food.":kind===138||kind===511?"Produces resources periodically.":"Put villagers inside to produce resources."));
      const resource=RESOURCES[item.collectType];
      if(resource) facts.earns={amount:item.collect,resource};
      facts.timer=item.activation;
      if([121,122,123,124].includes(kind)) facts.capacity=item.capacity;
    }
  } else if(kind===131 || kind===134) {
    facts.descriptions.push(word(kind===131?893:283,kind===131?"Reduces the cost of footmen, archers and mounted troops.":"Reduces the cost of siege engines by #0#%.",kind===134?[10]:undefined));
    facts.discount=10;
  } else if(kind===132) {
    facts.descriptions.push(word(892,"Trade resources here."));facts.lot=LOTS[item.id]??100;
  } else if(kind===136) {
    facts.descriptions.push(word(898,"Allows you to spy on enemies."));
    facts.stats=[{stat:"life",value:EAGLE_LIFE[item.id]??item.life}];
  } else if(kind===137) { facts.descriptions.push(word(281,"Heals nearby units when they are not in combat.")); facts.stats=[{stat:"attack",value:item.attack}]; }
  else if(kind===1311) facts.capacity=item.capacity;
  else if(kind===411) facts.earns={amount:item.xp,resource:"xp"};
  if([211,221,222,231,1711].includes(kind)) {
    facts.descriptions.unshift(word(kind===1711?1444:890,"Defensive structure"));
    facts.stats=[{stat:"life",value:item.life},{stat:"attack",value:item.attack},{stat:"delay",value:item.attackInterval},
      ...([211,231,1711].includes(kind)?[{stat:"range" as const,value:item.attackRange}]:[])];
  }
  if([133,311,321,331,341,231].includes(kind) && item.trains>0) {
    facts.trains=items.get(item.trains);
    facts.descriptions.unshift(word(891,"Allows you to train:"));
  }
  if(kind===139 && !feature) facts.descriptions.push(word(69,"A special building."));
  return facts;
}

export function limitedDays(expiration:string|undefined,now:number):number {
  if(!expiration) return 0;
  const [y,m,d]=expiration.slice(0,10).split("-").map(Number);
  return Math.max(0,Math.ceil((new Date(y,m-1,d).getTime()/1000-now)/86400))||0;
}
