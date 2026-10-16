// The tournament service owns rooms, fees and prizes. These are the original
// client's selection, entry and result rules, shared by its windows and battles.
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
  num_players: number | string;
  duration: number | string;
  map_id: number | string;
  weekly_opponent?: Record<string, { user_name: string; level: number | string; country?: string;
    picture: string; team: number[] }>;
}
export interface TournamentMatch {
  attacker_id: string;
  victim_id: string;
  finished: boolean;
  attacker_won: boolean;
  attacker_points: number;
  date_started: number | null;
  date_finished: number | null;
}
export interface TournamentPlayer {
  user_id: string;
  user_name: string;
  level: number;
  country: string;
  team: number[];
  abandonned: number;
  matches: TournamentMatch[];
}
export interface TournamentRankRow {
  user_id: string;
  user_name: string;
  points: number;
  time: number;
  matches: number;
}
export interface TournamentRanking {
  total_user: number;
  top: Record<string, TournamentRankRow>;
  user: TournamentRankRow & { rank: number };
}
export interface TournamentRoom {
  tournament_id: string;
  tournament_type_id: string;
  reward_id: number | string;
  private: number | string;
  owner_id: string;
  owner: string;
  point_type: number;
  date_ready: number | null;
  date_finished: number | null;
  match_playing: boolean;
  players: TournamentPlayer[];
  ranking?: TournamentRanking;
  /** Authoritative public winner; the view's requester-first order cannot break exact ties. */
  winner_id?: string | null;
}
export interface TournamentInfo {
  tournament: TournamentRoom | null;
  tournament_reward_id: Record<string, number | string>;
  tournament_weekly: Record<string, { open: number | string; full: number | string; timeLeft: number | string }>;
  tournament_friends: { tournament_id: string; tournament_type_id: string; reward_id: number | string;
    owner: string; owner_id?: string }[];
}
export interface TournamentRefund { refund: number; tournament_type_id: string }
export interface TournamentMutationReply { result: "OK"; resources?: TournamentRefund }
export type TournamentEntryReply = (TournamentInfo & TournamentMutationReply) |
  { result: "NOK" | "NOTEAM" | "NOFRIENDS"; resources?: TournamentRefund };
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

/** Public rooms match the original five level brackets. The menu gates level 15. */
export function tournamentCategory(level: number): number {
  return level < MIN_LEVEL_TOURNAMENT ? 0 : level <= 20 ? 1 : level <= 25 ? 2 : level <= 30 ? 3 : level <= 40 ? 4 : 5;
}

/** Weekly entry skips the public card's ownership/complex check. The list has
 * already restored owned copies; every entry still obeys the server's unit bans. */
export function tournamentEntryProblem(team: number[], choices: [number, number][], items: Map<number, ItemInfo>,
  rules: TournamentRules, weekly = false): "empty" | "unavailable" | "complex" | null {
  if (team.length !== TEAM_SLOTS || team.some((id) => id !== 0 &&
    (!Number.isInteger(id) || !items.get(id)?.isUnit || rules.banned.has(id)))) return "unavailable";
  if (!team.some((id) => id > 0)) return "empty";
  return weekly ? null : tournamentTeamProblem(team, choices, items, rules);
}

/** The short-team warning takes precedence; Flash did not ask both warnings. */
export function tournamentEntryWarning(team: number[], weeklySeconds?: number): "short" | "ending" | null {
  if (team.filter((id) => id > 0).length < TEAM_SLOTS) return "short";
  return weeklySeconds !== undefined && weeklySeconds <= 600 ? "ending" : null;
}

export function tournamentReady(room: TournamentRoom, kind: TournamentKind): boolean {
  return room.date_ready !== null && Number(kind.num_players) > 0 && room.players.length >= Number(kind.num_players);
}

export function tournamentFinished(room: TournamentRoom): boolean {
  return room.date_finished !== null && !room.match_playing;
}

/** Unix seconds. Waiting rooms instead show the original minute-to-refresh clock. */
export function tournamentDeadline(room: TournamentRoom, kind: TournamentKind): number | null {
  return room.date_ready === null ? null : room.date_ready + Number(kind.duration) * 3600;
}

export function tournamentPlayerScore(player: TournamentPlayer): { points: number; seconds: number; matches: number } {
  const played = player.matches.filter((match) => match.finished);
  return {
    points: Math.round(played.reduce((sum, match) => sum + Number(match.attacker_points), 0) * 100) / 100,
    seconds: played.reduce((sum, match) => sum + Math.max(0, (match.date_finished ?? 0) - (match.date_started ?? 0)), 0),
    matches: played.length,
  };
}

export function tournamentLeaderboard(room: TournamentRoom): (ReturnType<typeof tournamentPlayerScore> & { player: TournamentPlayer })[] {
  return room.players.map((player) => ({ player, ...tournamentPlayerScore(player) }))
    .sort((a, b) => b.points - a.points || a.seconds - b.seconds ||
      Number(b.player.user_id === room.winner_id) - Number(a.player.user_id === room.winner_id));
}

/** Prizes are already paid by the server. Weekly rank is the paid rank even
 * when later entrants change the live top ten; public ties use its winner id. */
export function tournamentPrize(room: TournamentRoom, kind: TournamentKind, me: string): TournamentPrize | null {
  if (!tournamentFinished(room)) return null;
  if (Number(kind.weekly_tournaments) >= 1) {
    const rank = room.ranking?.user;
    return rank?.user_id === me && rank.rank >= 1 && rank.rank <= 10 ? kind.prize[rank.rank - 1] ?? null : null;
  }
  return room.winner_id === me ? kind.prize[Number(room.reward_id)] ?? null : null;
}
