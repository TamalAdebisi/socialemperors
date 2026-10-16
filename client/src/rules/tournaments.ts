// Tournament browsing and team selection. The service owns rooms, fees and
// prizes; this slice only reads its list and saves the player's chosen team.
import type { GameConfig, ItemInfo } from "./config.ts";
import { SUBCAT } from "./battle.ts";
import { lastTeam, TEAM_SLOTS, teamSlots } from "./quest.ts";
import { readBox, type Box, type Town } from "./town.ts";

export const TOURNAMENT_HELP = "tournamentHelp";
export const MIN_LEVEL_TOURNAMENT = 15;
export { TEAM_SLOTS };

export interface TournamentPrize {
  g?: number | string;
  c?: number | string;
  u?: Record<string, number | string>;
}
export interface TournamentKind {
  id: number | string;
  name: string;
  resource_type: string;
  cost: number | string;
  prize: TournamentPrize[];
  picture: string;
  weekly_tournaments: number | string;
}
export interface TournamentInfo {
  tournament: { tournament_id: string; tournament_type_id: string; date_ready: number | null;
    date_finished: number | null } | null;
  tournament_reward_id: Record<string, number | string>;
  tournament_weekly: Record<string, { open: number | string; full: number | string; timeLeft: number | string }>;
  tournament_friends: { tournament_id: string; tournament_type_id: string; reward_id: number | string; owner: string }[];
}
export type TournamentTab = "everyday" | "weekly" | "own";
export interface TournamentCard {
  key: string;
  kind: TournamentKind;
  name: string;
  prize?: TournamentPrize;
  weekly?: { open: boolean; seconds: number };
}
export interface TournamentRules {
  enabled: boolean;
  banned: Set<number>;
  complexLimit: number;
  kinds: TournamentKind[];
}

export function tournamentRules(config: GameConfig): TournamentRules {
  return {
    enabled: Number(config.globals?.TOURNAMENT_ACTIVATED) === 1,
    banned: new Set((config.globals?.TOURNAMENT_UNITS_NOT_ALLOWED as unknown[] ?? []).map(Number)),
    complexLimit: Number(config.globals?.TOURNAMENT_MAX_NUMBER_COMPLEX_UNITS ?? TEAM_SLOTS),
    kinds: Object.values(config.tournament_type ?? {}) as TournamentKind[],
  };
}

/** Reward indices and weekly availability come from the server, not the local date. */
export function tournamentCards(rules: TournamentRules, info: TournamentInfo, tab: TournamentTab): TournamentCard[] {
  const kinds = new Map(rules.kinds.map((kind) => [String(kind.id), kind]));
  if (tab === "own") {
    return info.tournament_friends.flatMap((room) => {
      const kind = kinds.get(String(room.tournament_type_id));
      return kind ? [{ key: room.tournament_id, kind, name: `${room.owner}'s tournament`,
        prize: kind.prize[Number(room.reward_id)] }] : [];
    });
  }
  return rules.kinds.flatMap((kind): TournamentCard[] => {
    const id = String(kind.id);
    const weekly = Number(kind.weekly_tournaments) >= 1;
    if (tab === "everyday") {
      return weekly ? [] : [{ key: id, kind, name: kind.name, prize: kind.prize[Number(info.tournament_reward_id[id])] }];
    }
    const state = info.tournament_weekly[id];
    return !weekly || !state || Number(state.full) === 1 ? [] : [{ key: id, kind, name: kind.name,
      weekly: { open: Number(state.open) === 1, seconds: Math.max(0, Number(state.timeLeft) || 0) } }];
  });
}

const STAY_HOME = new Set<number>([SUBCAT.peasant, SUBCAT.cow, SUBCAT.sheep, SUBCAT.horse, SUBCAT.settler, SUBCAT.boar, SUBCAT.cart]);
const COMPLEX = new Set(["dragon", "god", "colossus"]);

/** All owned sources counted by the original: standing units, contained units,
 * warehouse and this town's storage. Unplaced gifts are a separate box. */
export function tournamentChoices(town: Town, warehouse: Box | undefined, items: Map<number, ItemInfo>, rules: TournamentRules): [number, number][] {
  const counts = new Map<number, number>();
  const add = (id: number, n = 1) => {
    const item = items.get(id);
    if (item?.isUnit && !STAY_HOME.has(item.subcategory) && !rules.banned.has(id) && n > 0) {
      counts.set(id, (counts.get(id) ?? 0) + n);
    }
  };
  for (const placed of town.items) {
    if (placed.item.race !== town.race && placed.item.race !== "a") continue;
    if (placed.item.isUnit) add(placed.item.id);
    else for (const id of placed.units ?? []) add(id);
  }
  for (const [id, n] of town.store) add(id, n);
  for (const [id, n] of readBox(warehouse)) add(id, n);
  return [...counts].map(([id, n]): [number, number] => [id, items.get(id)!.unitsLimit > 0 ? Math.min(n, items.get(id)!.unitsLimit) : n])
    .sort((a, b) => items.get(b[0])!.attack - items.get(a[0])!.attack);
}

/** The original compacts retained units on opening, and silently saves 20 slots.
 * It does not trim a restored team by the complex cap (weekly entry exempts it). */
export function restoredTournamentTeam(saved: unknown, choices: [number, number][]): number[] {
  return teamSlots(lastTeam(saved, choices));
}

export function complexUnits(team: number[], items: Map<number, ItemInfo>): number {
  return team.filter((id) => COMPLEX.has(items.get(id)?.groups ?? "")).length;
}

/** Validation on accepting the shared editor, which applies the complex cap
 * even though weekly entry itself does not. No entry or fee commands here. */
export function tournamentTeamProblem(team: number[], choices: [number, number][], items: Map<number, ItemInfo>, rules: TournamentRules): "empty" | "unavailable" | "complex" | null {
  if (team.length !== TEAM_SLOTS) return "unavailable";
  const left = new Map(choices);
  for (const id of team) {
    if (id === 0) continue;
    if ((left.get(id) ?? 0) <= 0) return "unavailable";
    left.set(id, left.get(id)! - 1);
  }
  if (!team.some((id) => id > 0) && choices.length) return "empty";
  return complexUnits(team, items) > rules.complexLimit ? "complex" : null;
}
