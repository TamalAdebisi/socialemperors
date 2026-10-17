import type { ItemInfo } from "../rules/config.ts";
import { shopFacts, unitStats } from "../rules/shopDetails.ts";
import type { Words } from "../rules/card.ts";
import { ICONS, resourceIcon } from "./icons.ts";
import { duration } from "./format.ts";

interface Parts {
  items:Map<number,ItemInfo>; words:(id:number,fallback:string)=>string;
  thumbnail:(item:ItemInfo)=>string;
  preview:(item:ItemInfo,canvas:HTMLCanvasElement,active:()=>boolean)=>()=>void;
}
export function renderShopDetails(item:ItemInfo,parts:Parts,active:()=>boolean):HTMLElement {
  const facts=shopFacts(item,parts.items),box=document.createElement("div");
  const title=document.createElement("h3");title.textContent=item.name;box.append(title);
  const line=(words:Words)=>{
    let text=parts.words(words.id,words.fallback);
    words.args?.forEach((arg,i)=>{text=text.replaceAll(`#${i}#`,String(arg));});
    return text.trim();
  };
  for(const words of facts.descriptions) {
    const text=line(words);if(text){const p=document.createElement("p");p.textContent=text;box.append(p);}
  }
  const stats=(values:typeof facts.stats)=>{
    const dl=document.createElement("dl");dl.className="shop-detail-stats";
    const labels={life:"Life",attack:"Attack",delay:"Attack delay",speed:"Speed",range:"Range",room:"Population"};
    for(const {stat,value}of values){
      const key=document.createElement("dt"),image=new Image();image.src=ICONS[`stat-${stat}`];image.alt=labels[stat];key.append(image);
      const number=document.createElement("dd");number.textContent=String(value);number.dataset.stat=stat;dl.append(key,number);
    }
    return dl;
  };
  if(facts.stats.length)box.append(stats(facts.stats));
  const values=document.createElement("dl");values.className="shop-detail-values";
  const value=(label:string,text:string)=>{const dt=document.createElement("dt"),dd=document.createElement("dd");dt.textContent=label;dd.textContent=text;values.append(dt,dd);return dd;};
  if(facts.earns){
    const {amount,resource}=facts.earns;const dd=value("Earns",`${amount} ${resource}`),picture=new Image();
    picture.src=resource==="population"?ICONS.population:resource==="xp"?ICONS.xp:resourceIcon(resource);picture.alt="";picture.className="icon";dd.prepend(picture);
  }
  if(facts.timer!==undefined)value("Timer",duration(facts.timer));
  if(facts.capacity!==undefined)value("Capacity",String(facts.capacity));
  if(facts.discount!==undefined)value("Discount",`${facts.discount}%`);
  if(facts.lot!==undefined)value("Trade amount",String(facts.lot));
  box.append(values);
  const unit=facts.trains??(item.isUnit?item:null);
  if(unit){
    if(facts.trains){const name=document.createElement("strong");name.textContent=unit.name;box.append(name,stats(unitStats(unit)));}
    const image=new Image();image.src=parts.thumbnail(unit);image.alt="";image.className="collection-reward";
    const preview=document.createElement("canvas");preview.className="unit-book-preview";preview.setAttribute("aria-label",`${unit.name} animation`);
    box.append(image,preview);
    requestAnimationFrame(()=>{if(active()&&preview.isConnected)parts.preview(unit,preview,active);});
  }
  return box;
}
