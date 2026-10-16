// Talking to our server exactly as the Flash client does (CLIENT.md: "the new
// client sends the same commands"), so both clients play the same saves.
// Step 2 only reads: the game config and the player's town.

import type { GameConfig } from "../rules/config.ts";
import type { PlayerInfo } from "../rules/town.ts";
import type { Continent } from "../rules/world.ts";

/** What the game page (templates/client.html) tells the client. */
export interface PageSettings {
  /** The empire being played, and the signed token that proves it's ours. */
  userId: string;
  userKey: string;
  /** Where the game's server calls live (get_game_config.php...). */
  dynamicUrl: string;
  /** Where the sprite sheets are: <artUrl>/<img_name>.json and .webp. */
  artUrl: string;
  /** Where the game's other files are, as the Flash client finds them (buildingthumbs/...). */
  assetsUrl: string;
  /** The Flash client's page, to go back to. */
  classicUrl: string;
  /** The page's form token, for the site's own windows (the bank). */
  csrf?: string;
  /** Days since the empire was made (the welcome-back chest). */
  days?: number;
}

export function readPageSettings(doc: Document = document): PageSettings {
  const element = doc.getElementById("se-settings");
  if (!element?.textContent) {
    throw new Error("The page has no game settings (se-settings).");
  }
  return JSON.parse(element.textContent) as PageSettings;
}

export class GameServer {
  readonly settings: PageSettings;

  constructor(settings: PageSettings) {
    this.settings = settings;
  }

  /** Every item, level and text of the game (about 2 MB). */
  gameConfig(): Promise<GameConfig> {
    return this.post("get_game_config.php", {});
  }

  /**
   * The player's town (or another of their towns, by number), or another
   * player's town to visit (`user`: their id), as the Flash client asks.
   */
  playerInfo(options: { town?: number; user?: string } = {}): Promise<PlayerInfo> {
    const fields: Record<string, string> = {};
    if (options.town !== undefined) {
      fields.map = String(options.town);
    }
    if (options.user) {
      fields.user = options.user;
    }
    return this.post("get_player_info.php", fields);
  }

  /** The world map: the town's continent (or `continent`, another to look at), as the Flash client asks (worlds.py). */
  continent(options: { town: number; continent?: number; relocate?: boolean; moveOn?: boolean }): Promise<Continent> {
    const fields: Record<string, string> = { map: String(options.town) };
    if (options.continent !== undefined) {
      fields.level_id = String(options.continent);
    }
    if (options.relocate) {
      fields.relocate = "1";
    }
    if (options.moveOn) {
      fields.worldChange = "1";
    }
    return this.get("get_continent_ranking.php", fields);
  }

  /** What the world map's Profile shows of a player, or null. */
  async publicProfile(pid: string): Promise<Record<string, unknown> | null> {
    try {
      return await this.get("get_public_player_info.php", { USERID: pid });
    } catch {
      return null;
    }
  }

  /** The two world map pages answer a GET, as the Flash client asked them. */
  private async get<T>(endpoint: string, fields: Record<string, string>): Promise<T> {
    const query = new URLSearchParams({ USERID: this.settings.userId, user_key: this.settings.userKey, ...fields });
    const response = await fetch(`${this.settings.dynamicUrl}/${endpoint}?${query}`);
    if (!response.ok) {
      throw new Error(`${endpoint}: ${response.status} ${await response.text()}`);
    }
    return (await response.json()) as T;
  }

  private async post<T>(endpoint: string, fields: Record<string, string>): Promise<T> {
    const body = new URLSearchParams({ USERID: this.settings.userId, user_key: this.settings.userKey, ...fields });
    const response = await fetch(`${this.settings.dynamicUrl}/${endpoint}`, { method: "POST", body });
    if (!response.ok) {
      throw new Error(`${endpoint}: ${response.status} ${await response.text()}`);
    }
    return (await response.json()) as T;
  }
}
