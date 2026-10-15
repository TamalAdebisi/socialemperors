// A window in the middle of the screen with the game's own words (and
// maybe its picture): a troll camp arriving, a chest opened. One button
// closes it; `then` hears it closed.

export function notice(title: string, text: string, picture: string | null, then: () => void = () => {}): void {
  const box = document.createElement("section");
  box.className = "quest-window notice";
  box.setAttribute("role", "dialog");
  const heading = document.createElement("h2");
  heading.textContent = title;
  box.append(heading);
  if (picture) {
    const image = document.createElement("img");
    image.className = "notice-picture";
    image.src = picture;
    image.alt = "";
    box.append(image);
  }
  const body = document.createElement("p");
  body.className = "notice-text";
  body.textContent = text;
  const row = document.createElement("div");
  row.className = "quest-buttons";
  const ok = document.createElement("button");
  ok.type = "button";
  ok.className = "button gold";
  ok.textContent = "OK";
  ok.addEventListener("click", () => {
    box.remove();
    then();
  });
  row.append(ok);
  box.append(body, row);
  document.body.append(box);
  ok.focus();
}

/**
 * The town's "under attack" alert, as the original showed it for 5
 * seconds by the missions: its button takes the camera there.
 */
export function attackAlert(text: string, help: string, go: () => void): void {
  document.querySelector(".attack-alert")?.remove();
  const box = document.createElement("div");
  box.className = "attack-alert";
  box.setAttribute("role", "alert");
  const words = document.createElement("span");
  words.textContent = text;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "button gold";
  button.textContent = help;
  button.addEventListener("click", () => {
    go();
    box.remove();
  });
  box.append(words, button);
  document.body.append(box);
  setTimeout(() => box.remove(), 5000);
}
