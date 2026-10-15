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
