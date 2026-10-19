import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { itemsById, type GameConfig } from "./config.ts";
import { readTown, type PlayerInfo } from "./town.ts";
import { complexUnits, restoredTournamentTeam, tournamentCards, tournamentChoices, tournamentRules, tournamentTeamProblem,
  tournamentCategory, tournamentEntryProblem, tournamentEntryWarning, tournamentReady, tournamentFinished, tournamentDeadline,
  tournamentPlayerScore, tournamentLeaderboard, tournamentPrize, tournamentRankPrize, tournamentWeekOver,
  type TournamentInfo, type TournamentRoom, type TournamentPlayer } from "./tournaments.ts";

const config = JSON.parse(readFileSync(new URL("../../../config/game_config_20120826.json", import.meta.url), "utf8")) as GameConfig;
const items = itemsById(config);
const rules = tournamentRules(config);
const info: TournamentInfo = { tournament: null, tournament_reward_id: { "1": "3", "2": 0, "3": 1, "4": 2, "5": 3, "6": 4, "7": 0 },
  tournament_weekly: { "8": { open: "1", full: "0", timeLeft: 1234 } },
  tournament_friends: [{ tournament_id: "friend-room", tournament_type_id: "2", reward_id: 2, owner: "Friend" }] };
const padded = (...ids: number[]) => [...ids, ...Array(Math.max(0, 20 - ids.length)).fill(0)];

test("the configured switch, banned units and complex cap retain their original values", () => {
  assert.equal(rules.enabled, true);
  assert.equal(rules.complexLimit, 10);
  assert.ok(rules.banned.has(762));
  assert.equal(tournamentRules({ ...config, globals: { TOURNAMENT_ACTIVATED: "0" } }).enabled, false);
});

test("everyday and friends' prizes use their respective server indices without changing the config", () => {
  const before = JSON.stringify(config.tournament_type);
  const daily = tournamentCards(rules, info, "everyday");
  assert.deepEqual(daily.map((card) => card.key), ["1", "2", "3", "4", "5", "6", "7"]);
  assert.deepEqual(daily[0].prize, { g: 1500, u: { "712": 1 } });
  const own = tournamentCards(rules, info, "own");
  assert.equal(own[0].key, "friend-room");
  assert.equal(own[0].name, "Friend's tournament");
  // This fixture is the archived config, before the server's cash-prize patch.
  assert.deepEqual(own[0].prize, { c: 30, u: { "745": 1 } });
  assert.equal(JSON.stringify(config.tournament_type), before);
});

test("weekly cards distinguish closed, open and already entered; a missing server state is not guessed", () => {
  assert.deepEqual(tournamentCards(rules, info, "weekly")[0].weekly, { open: true, seconds: 1234 });
  const state = structuredClone(info);
  state.tournament_weekly["8"] = { open: 0, full: 0, timeLeft: "42" };
  assert.deepEqual(tournamentCards(rules, state, "weekly")[0].weekly, { open: false, seconds: 42 });
  state.tournament_weekly["8"].full = "1";
  assert.deepEqual(tournamentCards(rules, state, "weekly"), []);
  state.tournament_weekly = {};
  assert.deepEqual(tournamentCards(rules, state, "weekly"), []);
});

test("team counts aggregate town, buildings, storage and warehouse, but exclude gifts, civilians, enemies and bans", () => {
  const town = readTown({ playerInfo: { cash: 1 }, privateState: { gifts: { "511": 50 } }, map: {
    id: 0, race: "h", items: [[511, 50, 50], [511, 51, 50], [29, 52, 50, 0, 0, 0, [511, 509]],
      [500, 53, 50], [762, 54, 50], [900, 55, 50]], store: { "511": 3, "500": 5, "29": 3 }, expansions: [],
  } } as unknown as PlayerInfo, items);
  const choices = tournamentChoices(town, { "511": 4, "762": 2, "514": 2 }, items, rules);
  assert.equal(new Map(choices).get(511), 10);
  assert.equal(new Map(choices).get(509), 1);
  assert.equal(new Map(choices).get(514), 2);
  assert.deepEqual([...new Map(choices).keys()].sort(), [509, 511, 514]);
  assert.ok(choices.every(([id], i) => !i || items.get(choices[i - 1][0])!.attack >= items.get(id)!.attack));
});

test("the unit limit applies after adding all ownership sources; old array storage works too", () => {
  const limited = [...items.values()].find((item) => item.isUnit && item.race === "h" && item.unitsLimit > 0 && !rules.banned.has(item.id))!;
  const warehouse: number[] = Array(limited.id + 1).fill(0);
  warehouse[limited.id] = 40;
  const town = { items: [], race: "h", store: new Map([[limited.id, 40]]) } as unknown as ReturnType<typeof readTown>;
  assert.deepEqual(tournamentChoices(town, warehouse, items, rules), [[limited.id, limited.unitsLimit]]);
});

test("restoring prunes missing, banned and excess copies, compacts holes and always pads to 20", () => {
  assert.deepEqual(restoredTournamentTeam([0, "511", 762, 511, 511, 999999, 514], [[511, 2], [514, 1]]), padded(511, 511, 514));
  assert.deepEqual(restoredTournamentTeam(null, [[511, 2]]), padded());
  assert.equal(restoredTournamentTeam(Array(25).fill(511), [[511, 25]]).filter(Boolean).length, 20);
});

test("the shared editor checks empty teams, current ownership, all 20 slots and the combined complex cap", () => {
  const dragons = [...items.values()].filter((item) => item.groups === "dragon" && !rules.banned.has(item.id)).slice(0, 11).map((item) => item.id);
  const choices: [number, number][] = dragons.map((id) => [id, 1]);
  assert.equal(tournamentTeamProblem(padded(), choices, items, rules), "empty");
  assert.equal(tournamentTeamProblem(padded(), [], items, rules), null, "the no-units editor can close");
  assert.equal(tournamentTeamProblem(padded(511, 511), [[511, 1]], items, rules), "unavailable");
  assert.equal(tournamentTeamProblem(Array(21).fill(511), [[511, 21]], items, rules), "unavailable");
  assert.equal(tournamentTeamProblem(padded(...dragons.slice(0, 10)), choices, items, rules), null);
  assert.equal(tournamentTeamProblem(padded(...dragons), choices, items, rules), "complex");
  assert.equal(complexUnits(padded(...dragons), items), 11);
  assert.deepEqual(restoredTournamentTeam(padded(...dragons), choices), padded(...dragons), "opening does not destroy a saved weekly team");
});

test("entry uses the five original level brackets and distinct public/weekly team checks", () => {
  assert.deepEqual([14, 15, 20, 21, 25, 26, 30, 31, 40, 41, 90].map(tournamentCategory), [0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
  const dragons = [...items.values()].filter((item) => item.groups === "dragon" && !rules.banned.has(item.id)).slice(0, 11).map((item) => item.id);
  const choices: [number, number][] = dragons.map((id) => [id, 1]);
  assert.equal(tournamentEntryProblem(padded(), [], items, rules), "empty", "entry always needs an army");
  assert.equal(tournamentEntryProblem(padded(511, 511), [[511, 1]], items, rules), "unavailable");
  assert.equal(tournamentEntryProblem(padded(...dragons), choices, items, rules), "complex");
  assert.equal(tournamentEntryProblem(padded(...dragons), choices, items, rules, true), null);
  assert.equal(tournamentEntryProblem(padded(511), [], items, rules, true), null, "weekly keeps the card's original check");
  assert.equal(tournamentEntryProblem(padded(762), [[762, 1]], items, rules, true), "unavailable", "server bans still apply");
  assert.equal(tournamentEntryProblem(padded(-1), [], items, rules, true), "unavailable");
  assert.equal(tournamentEntryProblem([511], [[511, 1]], items, rules, true), "unavailable", "send exactly twenty places");
});

test("short-team confirmation takes precedence over the final ten-minute weekly warning", () => {
  assert.equal(tournamentEntryWarning(padded(511)), "short");
  assert.equal(tournamentEntryWarning(padded(511), 10), "short");
  const full = Array(20).fill(511);
  assert.equal(tournamentEntryWarning(full), null);
  assert.equal(tournamentEntryWarning(full, 601), null);
  assert.equal(tournamentEntryWarning(full, 600), "ending");
  assert.equal(tournamentEntryWarning(full, 0), "ending");
});

const entrant = (id: string): TournamentPlayer => ({ user_id: id, user_name: id, level: 15, country: "",
  team: padded(511), abandonned: 0, matches: [] });
const room = (): TournamentRoom => ({ tournament_id: "room", tournament_type_id: "1", reward_id: 0,
  private: "0", owner_id: "", owner: "", point_type: 1, date_ready: null, date_finished: null,
  match_playing: false, players: ["one", "two", "three", "four"].map(entrant) });

test("readiness uses both server start time and four seats; its battle deadline is separate from refresh", () => {
  const state = room();
  const kind = rules.kinds[0];
  assert.equal(tournamentReady(state, kind), false);
  assert.equal(tournamentDeadline(state, kind), null);
  state.date_ready = 1000;
  assert.equal(tournamentReady(state, kind), true);
  assert.equal(tournamentDeadline(state, kind), 1000 + 24 * 3600);
  state.players.pop();
  assert.equal(tournamentReady(state, kind), false);
  assert.equal(tournamentFinished(state), false);
  state.date_finished = 2000;
  state.match_playing = true;
  assert.equal(tournamentFinished(state), false);
  state.match_playing = false;
  assert.equal(tournamentFinished(state), true);
});

test("scores count finished matches only and rank by points then time with the paid winner breaking exact ties", () => {
  const state = room();
  const played = (who: string, points: number, seconds: number, finished = true) => ({ attacker_id: who, victim_id: "other",
    finished, attacker_won: true, attacker_points: points, date_started: 1000, date_finished: finished ? 1000 + seconds : null });
  state.players[0].matches = [played("one", 20.15, 30), played("one", 30.25, 60), played("one", 100, 0, false)];
  state.players[1].matches = [played("two", 50.4, 90)];
  state.players[2].matches = [played("three", 50.4, 100)];
  state.players[3].matches = [played("four", 80, 300)];
  state.winner_id = "two";
  assert.deepEqual(tournamentPlayerScore(state.players[0]), { points: 50.4, seconds: 90, matches: 2 });
  assert.deepEqual(tournamentLeaderboard(state).map(({ player }) => player.user_id), ["four", "two", "one", "three"]);
  assert.equal(state.players[0].user_id, "one", "sorting must not mutate server order");
});

test("weekly prizes wait for the end of the week, and its tournaments end with it", () => {
  const weekly = rules.kinds.find((kind) => Number(kind.weekly_tournaments) > 0)!;
  const state = room();
  state.date_ready = 1000;
  state.date_finished = 2000;
  state.ranking = { total_user: 2, top: {}, user: { user_id: "one", user_name: "One", points: 20, time: 50, matches: 3, rank: 1 },
    final: 0, ends: 1000 + 3600 };
  assert.equal(tournamentWeekOver(state), false);
  assert.equal(tournamentPrize(state, weekly, "one"), null, "first so far is not a prize yet");
  assert.deepEqual(tournamentRankPrize(state, weekly, "one"), weekly.prize[0], "the prize this place would win");
  assert.equal(tournamentDeadline(state, weekly), 1000 + 3600, "the week ends before its 24 hours are up");
  state.ranking.ends = 1000 + 48 * 3600;
  assert.equal(tournamentDeadline(state, weekly), 1000 + 24 * 3600);
  state.ranking.final = 1;
  state.ranking.user.rank = 2;
  assert.equal(tournamentWeekOver(state), true);
  assert.deepEqual(tournamentPrize(state, weekly, "one"), weekly.prize[1], "the final rank's prize");
});

test("public prizes require the server winner and weekly prizes use the frozen paid rank", () => {
  const state = room();
  const kind = rules.kinds[0];
  state.winner_id = "one";
  assert.equal(tournamentPrize(state, kind, "one"), null);
  state.date_finished = 2000;
  assert.deepEqual(tournamentPrize(state, kind, "one"), kind.prize[0]);
  assert.equal(tournamentPrize(state, kind, "two"), null);
  delete state.winner_id;
  assert.equal(tournamentPrize(state, kind, "one"), null, "requester-first row cannot decide a tie");
  const weekly = rules.kinds.find((kind) => Number(kind.weekly_tournaments) > 0)!;
  state.ranking = { total_user: 20, top: {}, user: { user_id: "one", user_name: "One", points: 200, time: 50, matches: 3, rank: 2 } };
  assert.deepEqual(tournamentPrize(state, weekly, "one"), weekly.prize[1]);
  assert.equal(tournamentPrize(state, weekly, "two"), null);
  state.ranking.user.rank = 11;
  assert.equal(tournamentPrize(state, weekly, "one"), null);
});

test("an abandoned high scorer stays in the original score table but cannot take the eligible winner's prize", () => {
  const state = room();
  state.date_ready = 1000;
  state.date_finished = 1100;
  state.winner_id = "two";
  for (const [index, player] of state.players.entries()) {
    player.matches = state.players.filter((opponent) => opponent !== player).map((opponent) => ({
      attacker_id: player.user_id, victim_id: opponent.user_id, finished: true,
      attacker_won: true, attacker_points: index === 0 ? 100 : 90 - index,
      date_started: 1000, date_finished: 1010,
    }));
  }
  state.players[0].abandonned = 1;
  const table = tournamentLeaderboard(state);
  assert.deepEqual(table.map(({ player }) => player.user_id), ["one", "two", "three", "four"]);
  assert.equal(table[0].points, 300, "leaving does not erase completed-match points");
  assert.equal(table[0].player.abandonned, 1, "the view can mark this row as having left");
  assert.equal(tournamentPrize(state, rules.kinds[0], "one"), null, "score-table position alone never grants a prize");
  assert.deepEqual(tournamentPrize(state, rules.kinds[0], "two"), rules.kinds[0].prize[0]);
});
