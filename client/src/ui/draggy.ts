// The free draggy at the end of Arthur's lessons (CLIENT.md, "Arthur's
// lessons"): the game's window offering three draggies, with no way out but
// choosing one; then the reminder that the dragon nest gives more. The
// game's own pictures and words (FREE DRAGGY!!, Choose the draggy...).

import type { ItemInfo } from "../rules/config.ts";
import { ICONS } from "./icons.ts";

/** A window of the game's: its parchment, title band and a body. */
function parchment(title: string, className: string): { box: HTMLElement; body: HTMLElement } {
  const box = document.createElement("section");
  box.className = `draggy-window ${className}`;
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-label", title);
  box.style.backgroundImage = `url("${ICONS["draggy-window"]}")`;
  const band = document.createElement("h2");
  band.className = "draggy-band";
  band.style.backgroundImage = `url("${ICONS["draggy-title"]}")`;
  band.textContent = title;
  const body = document.createElement("div");
  body.className = "draggy-body";
  box.append(band, body);
  document.body.append(box);
  return { box, body };
}

/** A picture in the game's golden frame, with its name under it. */
function framed(picture: string, name: string): HTMLElement {
  const slot = document.createElement("figure");
  slot.className = "draggy-slot";
  slot.style.backgroundImage = `url("${ICONS["draggy-frame"]}")`;
  const image = document.createElement("img");
  image.src = picture;
  image.alt = "";
  const caption = document.createElement("figcaption");
  caption.textContent = name;
  slot.append(image, caption);
  return slot;
}

/** "FREE DRAGGY!!": one of three, chosen with its Select; `chosen` hears which. */
export function chooseDraggy(draggies: ItemInfo[], thumbnail: (item: ItemInfo) => string, words: { title: string; header: string; line: string; select: string },
  chosen: (item: ItemInfo) => Promise<boolean>): void {
  const { box, body } = parchment(words.title, "choose");
  const header = document.createElement("p");
  header.className = "draggy-header";
  header.textContent = words.header;
  const line = document.createElement("p");
  line.className = "draggy-line";
  line.textContent = words.line;
  const row = document.createElement("div");
  row.className = "draggy-row";
  for (const item of draggies) {
    const choice = document.createElement("div");
    choice.className = "draggy-choice";
    const slot = framed(thumbnail(item), item.name);
    slot.title = `${item.name}: life ${item.life}, attack ${item.attack}, range ${item.attackRange}`;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "button gold";
    button.textContent = words.select;
    button.setAttribute("aria-label", `${words.select} ${item.name}`);
    button.addEventListener("click", async () => {
      row.querySelectorAll("button").forEach((b) => { b.disabled = true; });
      line.textContent = "Saving your draggy…";
      try {
        if (await chosen(item)) { box.remove(); return; }
      } catch { /* The saved reward can be recovered after a reload. */ }
      line.textContent = "Your gift couldn't be confirmed. Reload to continue; your saved choice will be kept.";
    });
    choice.append(slot, button);
    row.append(choice);
  }
  body.append(header, line, row);
  row.querySelector("button")?.focus();
}

/** "Dragon Nest: get more dragons in the Dragon Nest!", with the nest's picture and OK. */
export function nestReminder(nest: ItemInfo, picture: string, words: { title: string; text: string }, ok: () => void): void {
  const { box, body } = parchment(words.title, "reminder");
  const text = document.createElement("p");
  text.className = "draggy-line";
  text.textContent = words.text;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "draggy-ok";
  button.setAttribute("aria-label", "OK");
  button.innerHTML = `<img src="${ICONS["reminder-ok"]}" alt="">`;
  button.addEventListener("click", () => {
    box.remove();
    ok();
  });
  body.append(text, framed(picture, nest.name), button);
  button.focus();
}
