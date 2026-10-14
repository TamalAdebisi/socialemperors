// Talking to our server exactly as the Flash client does (CLIENT.md: "the new
// client sends the same commands"), so both clients play the same saves.
// Step 2 only reads: the game config and the player's town.

import type { GameConfig } from "../rules/config.ts";
import type { PlayerInfo } from "../rules/town.ts";

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

  private async post<T>(endpoint: string, fields: Record<string, string>): Promise<T> {
    const body = new URLSearchParams({ USERID: this.settings.userId, user_key: this.settings.userKey, ...fields });
    const response = await fetch(`${this.settings.dynamicUrl}/${endpoint}`, { method: "POST", body });
    if (!response.ok) {
      throw new Error(`${endpoint}: ${response.status} ${await response.text()}`);
    }
    return (await response.json()) as T;
  }
}
