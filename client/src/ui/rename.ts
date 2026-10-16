// Naming the empire (CLIENT.md, "The menus: rail and dock"), as the Flash
// client did from its top bar: the game's window ("NAME YOUR EMPIRE"), its
// parchment and band, the town's name to change, and its Save and Cancel.
// A name needs 3 letters or more; Enter saves too. (The original's Save
// button never worked, only Enter: ours works.)

import { ICONS } from "./icons.ts";

/** The shortest name the game takes, and the longest we let it be. */
export const NAME_SHORTEST = 3;
export const NAME_LONGEST = 30;

/** Open the window with the town's name; `save` hears the new one (trimmed, 3 to 30 characters). */
export function renameWindow(current: string, words: { title: string; save: string; cancel: string }, save: (name: string) => void): void {
  document.querySelector(".name-window")?.remove();
  const box = document.createElement("section");
  box.className = "name-window";
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-label", words.title);
  box.style.backgroundImage = `url("${ICONS["name-window"]}")`;
  const band = document.createElement("h2");
  band.className = "name-band";
  band.style.backgroundImage = `url("${ICONS["name-band"]}")`;
  band.textContent = words.title;
  const input = document.createElement("input");
  input.className = "name-input";
  input.type = "text";
  input.value = current;
  input.maxLength = NAME_LONGEST;
  input.setAttribute("aria-label", words.title);
  const buttons = document.createElement("div");
  buttons.className = "name-buttons";
  const button = (picture: string, label: string, run: () => void) => {
    const b = document.createElement("button");
    b.type = "button";
    b.setAttribute("aria-label", label);
    const image = document.createElement("img");
    image.src = picture;
    image.alt = "";
    b.append(image);
    b.addEventListener("click", run);
    return b;
  };
  const close = () => {
    box.remove();
    document.removeEventListener("keydown", keys, true);
  };
  const done = () => {
    const name = input.value.trim();
    if (name.length < NAME_SHORTEST) {
      input.focus();
      return;
    }
    close();
    if (name !== current) {
      save(name);
    }
  };
  const keys = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      done();
    } else if (e.key === "Escape") {
      e.stopPropagation();
      close();
    } else {
      e.stopPropagation();  // letters typed here aren't the game's shortcuts (B builds...)
    }
  };
  document.addEventListener("keydown", keys, true);
  input.addEventListener("input", () => box.classList.toggle("short", input.value.trim().length < NAME_SHORTEST));
  buttons.append(button(ICONS["name-save"], words.save, done), button(ICONS["name-cancel"], words.cancel, close));
  // The box fills the parchment's own name field (an input won't stretch between top and bottom: its holder does).
  const field = document.createElement("div");
  field.className = "name-field";
  field.append(input);
  box.append(band, field, buttons);
  document.body.append(box);
  input.focus();
  input.select();
}
