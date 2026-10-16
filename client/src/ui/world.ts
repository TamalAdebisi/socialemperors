// The battle windows (CLIENT.md, "The menus: rail and dock"): a row for each
// way to fight, with its icon, a line on what it is, and Play. On a wide
// screen Quests and Battle are separate rail buttons; on a phone World holds
// them all. Quests are played here (ui/islands.ts, questPlay.ts), and attacks
// on players from the world map (ui/worldMap.ts, attackPlay.ts), and
// survival (ui/survival.ts, survivalPlay.ts); tournaments still open the
// classic game, which plays them on the same empire.

import { ICONS } from "./icons.ts";
import { Panel } from "./panel.ts";

interface Mode {
  name: string;
  about: string;
  icon: string;
  verb: string;
  /** Played here: what Play does. Otherwise it opens the classic game. */
  run?: () => void;
}

const QUESTS: Mode = { name: "Quests", about: "The islands and their bosses", icon: ICONS.quests, verb: "Go" };
/** The attacks made and received (the Flash client's Battle Results, from the world map's bar). */
const RESULTS: Mode = { name: "Battle Results", about: "The last attacks you made and received", icon: ICONS.pvp, verb: "Open" };
const BATTLES: Mode[] = [
  { name: "Attack a player", about: "Send your army against another empire", icon: ICONS.pvp, verb: "Play" },
  { name: "Survival", about: "Hold out against wave after wave", icon: ICONS.survival, verb: "Play" },
  { name: "Tournament", about: "Fight for a place in the ranking", icon: ICONS.tournament, verb: "Play" },
];

export class WorldWindows {
  private readonly islands: { toggle(): void; open(): void };
  private readonly battles: Panel;
  private readonly world: Panel;

  /**
   * `attack`: opens the world map (ui/worldMap.ts); `survival`: the Survival window (ui/survival.ts);
   * `results`: the Battle Results window (ui/attackHistory.ts).
   */
  constructor(classicUrl: string, islands: { toggle(): void; open(): void }, attack: () => void, results: () => void,
    survival: () => void) {
    this.islands = islands;
    const quests = { ...QUESTS, run: () => islands.open() };
    const runs: Record<string, () => void> = { "Attack a player": attack, "Survival": survival };
    const battles = BATTLES.map((mode) => runs[mode.name] ? { ...mode, run: runs[mode.name] } : mode);
    const history = { ...RESULTS, run: results };
    this.battles = window_("battle", "Battles", [...battles, history], classicUrl);
    this.world = window_("world", "World", [quests, ...battles, history], classicUrl);
  }

  toggleQuests(): void {
    this.islands.toggle();
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
    play.textContent = mode.verb;
    if (mode.run) {
      const run = mode.run;
      play.href = "#";
      play.addEventListener("click", (e) => {
        e.preventDefault();
        run();
      });
    } else {
      play.href = classicUrl;
      play.setAttribute("aria-label", `${mode.name}: ${mode.verb.toLowerCase()} in the classic game`);
    }
    row.append(icon, text, play);
    list.append(row);
  }
  const note = document.createElement("p");
  note.className = "rows-note";
  note.textContent = "Tournaments open in the classic game for now, on the same empire.";
  panel.body.append(list, note);
  return panel;
}
