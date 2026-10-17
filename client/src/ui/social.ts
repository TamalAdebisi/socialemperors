import type { Command } from "../net/commands.ts";
import type { ItemInfo } from "../rules/config.ts";
import type { PlacedItem, Town } from "../rules/town.ts";
import { ALLIED_MARKETS, SOCIAL_BUILDINGS, finishSocial, hireHelper, orderResource, socialCapacity, socialWait,
  type AlliedState, type SocialRules } from "../rules/socialMenus.ts";
import { duration } from "./format.ts";
import { Panel } from "./panel.ts";
import { AskFriends } from "./askFriends.ts";

interface Parts {
  town:Town; items:Map<number,ItemInfo>; state:AlliedState; rules:SocialRules; clock:()=>number;
  roles:(id:number)=>string[]; name:(id:string)=>string;
  thumbnail:(item:ItemInfo)=>string;
  asking:AskFriends|null; flush:()=>Promise<boolean>;
  send:(commands:Command[])=>void; changed:(added:PlacedItem[])=>void;
  completed:(placed:PlacedItem,helpers:number)=>void;
  spent:(amount:number)=>void; tell:(text:string)=>void;
}

export class SocialWindow {
  private readonly parts:Parts;
  private readonly panel:Panel;
  private placed:PlacedItem|null=null;
  private recruit=0;
  private timer:ReturnType<typeof setInterval>|null=null;

  constructor(parts:Parts) {
    this.parts=parts;
    this.panel=new Panel("social","Allies",{ className:"social-window",onClose:()=>{
      if(this.timer!==null) clearInterval(this.timer); this.timer=null;
    } });
  }
  windowOf(placed:PlacedItem):{ label:string; run:()=>void }|null {
    return SOCIAL_BUILDINGS.has(placed.item.id) ? { label:"Open",run:()=>this.open(placed) } : null;
  }
  open(placed:PlacedItem):void {
    this.placed=placed; this.recruit=0;
    this.render(); this.panel.open();
    if(this.timer!==null) clearInterval(this.timer);
    this.timer=setInterval(()=>{
      if(!this.parts.town.items.includes(placed)) { this.panel.close(); return; }
      this.clock();
    },1000);
  }
  private clock():void {
    if(!this.placed) return;
    const wait=socialWait(this.placed,this.parts.clock());
    const clock=this.panel.body.querySelector(".social-clock");
    if(clock) clock.textContent=duration(wait);
    const claim=this.panel.body.querySelector<HTMLButtonElement>("[data-social-claim]");
    if(claim && this.placed.item.id===389) claim.disabled=wait>0;
    if(claim && ALLIED_MARKETS.has(this.placed.item.id)) {
      claim.textContent=wait>0 ? "Finish delivery for 2 cash" : "Collect delivery";
      claim.disabled=wait>0 && this.parts.town.cash<2;
    }
  }
  private render():void {
    const placed=this.placed; if(!placed) return;
    const { town,rules }=this.parts, id=placed.item.id, staff=placed.staff??0;
    const capacity=socialCapacity(town,placed,rules);
    this.panel.title=placed.item.name;
    const heading=document.createElement("p"); heading.className="rows-note";
    heading.textContent=id===470 ? `Population increase ${Math.min((town.increasedPopulation??0)+1,rules.populationSteps)} of ${rules.populationSteps}. Added room: ${(town.increasedPopulation??0)*rules.populationIncrease}.` : `${staff} / ${capacity} helpers`;
    const picture=new Image(); picture.src=this.parts.thumbnail(placed.item);picture.alt="";picture.className="collection-reward";
    const contents:HTMLElement[]=[picture,heading];
    if(ALLIED_MARKETS.has(id)) {
      if(this.parts.state.resource==="n") {
        const choice=document.createElement("div"); choice.className="social-resources";
        for(const [resource,name] of [["g","gold"],["w","wood"],["s","stone"],["f","food"]]) {
          choice.append(this.button(`Order ${name}`,()=>{
            const command=orderResource(town,placed,this.parts.state,resource,this.parts.clock());
            if(command) { this.parts.send([command]);this.render(); }
          }));
        }
        contents.push(choice);
      } else {
        const order=document.createElement("p"); order.textContent=`Delivery: ${125*(staff+1)} ${({g:"gold",w:"wood",s:"stone",f:"food"} as Record<string,string>)[this.parts.state.resource]}`;
        contents.push(order);
      }
    }
    if(id===387) {
      const choice=document.createElement("div"); choice.className="shop-tabs";
      rules.recruits.forEach((reward,index)=>{
        const button=this.button(`${reward.count} ${this.parts.items.get(reward.id)?.name??reward.id}`,()=>{this.recruit=index;this.render();});
        button.setAttribute("aria-pressed",String(index===this.recruit));choice.append(button);
      }); contents.push(choice);
    }
    if(id===389) {
      const prizes=document.createElement("p");prizes.textContent="4 knights: 1,000 gold. 6: also 100 XP. 8: also a hero in Storage.";
      contents.push(prizes);
    }
    if(id===389 || ALLIED_MARKETS.has(id) && this.parts.state.resource!=="n") {
      const wait=document.createElement("p");wait.className="social-clock";contents.push(wait);
    }
    const roles=this.parts.roles(id), list=document.createElement("ol");list.className="social-staff";
    const start=id===470 ? (town.increasedPopulation??0)*Math.round((placed.item.staffPlaces??20)/rules.populationSteps) : 0;
    for(let i=start;i<capacity;i++) {
      const row=document.createElement("li"), filled=i<staff;
      const who=placed.staffIds?.[i];
      row.textContent=`${roles[i]??`Place ${i+1}`}: ${filled ? !who || who==="0" ? "Hired helper" : this.parts.name(who) : "Empty"}`;
      list.append(row);
    }
    contents.push(list);
    if(staff<capacity && !(id===470 && (town.increasedPopulation??0)>=rules.populationSteps)) {
      const ask=this.button("Ask friends",()=>void this.ask()); ask.disabled=!this.parts.asking;
      if(id===389) ask.disabled=ask.disabled || socialWait(placed,this.parts.clock())<=0 || (placed.staffAsked?.size??0)>=rules.maxPosts;
      contents.push(ask);
      if((placed.item.workerCost??0)>0) {
        const buy=this.button(`Hire helper for ${placed.item.workerCost} cash`,()=>{
          const command=hireHelper(town,placed,rules);
          if(command) {this.parts.send([command]);this.parts.spent(placed.item.workerCost??0);this.parts.changed([]);this.render();}
        });buy.disabled=town.cash<(placed.item.workerCost??0);contents.push(buy);
      }
    }
    const claim=this.button(id===470 ? `Increase population by ${rules.populationIncrease}` : "Claim reward",()=>this.claim());
    claim.dataset.socialClaim="yes";
    claim.disabled=id===470 ? staff<capacity || (town.increasedPopulation??0)>=rules.populationSteps
      : id===389 ? socialWait(placed,this.parts.clock())>0 : ALLIED_MARKETS.has(id) ? this.parts.state.resource==="n" : staff<capacity;
    if(!ALLIED_MARKETS.has(id) || this.parts.state.resource!=="n") contents.push(claim);
    this.panel.body.replaceChildren(...contents);this.clock();
  }
  private claim():void {
    const placed=this.placed; if(!placed) return;
    const before=this.parts.town.cash;
    const result=finishSocial(this.parts.town,placed,this.parts.items,this.parts.state,this.parts.rules,this.parts.clock(),this.recruit);
    if(typeof result==="string") {this.parts.tell(result);return;}
    this.parts.send(result.commands);this.parts.spent(Math.max(0,before-this.parts.town.cash));
    this.parts.completed(placed,result.helpers);this.parts.changed(result.added);this.parts.tell(result.note);this.render();
  }
  private async ask():Promise<void> {
    const placed=this.placed, asking=this.parts.asking; if(!placed || !asking) return;
    const box=document.createElement("div");box.textContent="Saving your building…";this.panel.body.replaceChildren(box);
    if(!await this.parts.flush()) {box.textContent="Your changes could not be saved. Reload before asking friends.";return;}
    if(this.placed!==placed || !this.panel.isOpen || !box.isConnected) return;
    asking.show(box,{kind:"staff",town:this.parts.town.id,x:placed.tx,y:placed.ty,item:placed.item.id},()=>this.render(),
      placed.item.id===389 ? {
        single:true,
        before:()=>socialWait(placed,this.parts.clock())<=0 ? "The Round Table's clock has finished." : (placed.staffAsked?.size??0)>=this.parts.rules.maxPosts ? "This round has reached its invitation limit." : "",
        asked:(ids)=>{
          for(const id of ids) {
            (placed.staffAsked??=new Set()).add(id);
            this.parts.send([{cmd:"assist_send_feed",args:[placed.tx,placed.ty,this.parts.town.id,placed.item.id,id]}]);
          }
        },
      } : undefined);
  }
  private button(text:string,run:()=>void):HTMLButtonElement {
    const button=document.createElement("button");button.type="button";button.className="button small gold";button.textContent=text;
    button.addEventListener("click",run);return button;
  }
}
