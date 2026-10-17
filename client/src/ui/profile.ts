import {honourRank,type HonourRank,type PublicProfile} from "../rules/profile.ts";
import {Panel} from "./panel.ts";

interface ProfileArt {ranks:HonourRank[];badge:(rank:HonourRank)=>string}
export function renderProfile(profile:PublicProfile,parts:ProfileArt):HTMLElement {
 const box=document.createElement("div");box.className="profile-content";
 const title=document.createElement("h3");title.textContent=profile.name;
 const portrait=document.createElement("span");portrait.className="portrait profile-portrait";portrait.textContent=profile.name[0].toUpperCase();portrait.setAttribute("aria-hidden","true");
 const rank=honourRank(profile.honor_points,parts.ranks);
 const badge=(entry:HonourRank)=>{const image=new Image();image.src=parts.badge(entry);image.alt=entry.rank;image.className="profile-badge";return image;};
 box.append(portrait,title);if(rank)box.append(badge(rank));
 const row=(text:string)=>{const p=document.createElement("p");p.textContent=text;box.append(p);};
 row(`Level ${profile.level}`);
 row(`Empire: ${profile.map_names[0]?.trim()||"—"}`);
 row(`Honour: ${profile.honor_points}`);
 row(`Rank: ${rank?.rank??"—"}`);
 row(`Attacks won: ${profile.attacks_won} · lost: ${profile.attacks_lost}`);
 row(`Last seen: ${profile.last_logged_in?new Date(profile.last_logged_in*1000).toLocaleString():"Never"}`);
 row(`Country: ${profile.country||"—"}`);
 if(parts.ranks.length){
  const toggle=document.createElement("a");toggle.href="#honour-ranks";toggle.textContent="Honour ranks";toggle.setAttribute("aria-expanded","false");
  const list=document.createElement("ol");list.className="profile-ranks";list.hidden=true;
  for(const entry of parts.ranks){const li=document.createElement("li"),image=badge(entry);image.loading="lazy";li.append(image,`${entry.points} — ${entry.rank}`);list.append(li);}
  toggle.addEventListener("click",(event)=>{event.preventDefault();list.hidden=!list.hidden;toggle.setAttribute("aria-expanded",String(!list.hidden));});
  box.append(toggle,list);
 }
 return box;
}
interface Parts extends ProfileArt {load:(pid:string)=>Promise<PublicProfile|null>}
export class ProfileWindow {
 private readonly panel:Panel;
 private readonly parts:Parts;
 private request=0;
 constructor(parts:Parts){this.parts=parts;this.panel=new Panel("army","Profile",{className:"profile-window",onClose:()=>{this.request++;}});}
 open(pid:string):void{
  const request=++this.request;
  const status=document.createElement("p");status.textContent="Loading profile…";status.setAttribute("role","status");
  this.panel.body.replaceChildren(status);this.panel.open();
  void this.parts.load(pid).then((profile)=>{
   if(request!==this.request||!this.panel.isOpen)return;
   if(profile)this.panel.body.replaceChildren(renderProfile(profile,this.parts));else this.failed(pid);
  },()=>{if(request===this.request&&this.panel.isOpen)this.failed(pid);});
 }
 private failed(pid:string):void{
  const text=document.createElement("p");text.textContent="This profile could not be loaded.";
  const retry=document.createElement("button");retry.type="button";retry.className="button small gold";retry.textContent="Retry";retry.addEventListener("click",()=>this.open(pid));
  this.panel.body.replaceChildren(text,retry);
 }
}
