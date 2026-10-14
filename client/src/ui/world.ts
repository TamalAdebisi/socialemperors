// The battle windows (CLIENT.md, "The menus: rail and dock"): a row for each
// way to fight, with its icon, a line on what it is, and Play. On a wide
// screen Quests and Battle are separate rail buttons; on a phone World holds
// them all. Battles come to the new client in Beta 2: until then Play opens
// the classic game, which plays them on the same empire.

import { ICONS } from "./icons.ts";
import { Panel } from "./panel.ts";

interface Mode {
  name: string;
  about: string;
  icon: string;
  verb: string;
}

const QUESTS: Mode = { name: "Quests", about: "The islands and their bosses", icon: ICONS.quests, verb: "Go" };
const BATTLES: Mode[] = [
  { name: "Attack a player", about: "Send your army against another empire", icon: ICONS.pvp, verb: "Play" },
  { name: "Survival", about: "Hold out against wave after wave", icon: ICONS.survival, verb: "Play" },
  { name: "Tournament", about: "Fight for a place in the ranking", icon: ICONS.tournament, verb: "Play" },
];

export class WorldWindows {
  private readonly quests: Panel;
  private readonly battles: Panel;
  private readonly world: Panel;

  constructor(classicUrl: string) {
    this.quests = window_("quests", "Quests", [QUESTS], classicUrl);
    this.battles = window_("battle", "Battles", BATTLES, classicUrl);
    this.world = window_("world", "World", [QUESTS, ...BATTLES], classicUrl);
  }

  toggleQuests(): void {
    this.quests.toggle();
  }

  toggleBattles(): void {
    this.battles.toggle();
  }

  toggleWorld(): void {
    this.world.toggle();
  }
}

function window_(key: string, title: string, modes: Mode[], classicUrl: string): Panel {
  const panel = new Panel(key, title, { className: "list-window" });
  const list = document.createElement("ul");
  list.className = "rows";
  for (const mode of modes) {
    const row = document.createElement("li");
    row.className = "row";
    const icon = document.createElement("img");
    icon.className = "row-icon";
    icon.src = mode.icon;
    icon.alt = "";
    const text = document.createElement("span");
    text.className = "row-text";
    const name = document.createElement("strong");
    name.textContent = mode.name;
    const about = document.createElement("small");
    about.textContent = mode.about;
    text.append(name, about);
    const play = document.createElement("a");
    play.className = "button tiny gold";
    play.href = classicUrl;
    play.textContent = mode.verb;
    play.setAttribute("aria-label", `${mode.name}: ${mode.verb.toLowerCase()} in the classic game`);
    row.append(icon, text, play);
    list.append(row);
  }
  const note = document.createElement("p");
  note.className = "rows-note";
  note.textContent = "Battles open in the classic game for now, on the same empire.";
  panel.body.append(list, note);
  return panel;
}
