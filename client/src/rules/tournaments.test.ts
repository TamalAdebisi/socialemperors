import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { itemsById, type GameConfig } from "./config.ts";
import { readTown, type PlayerInfo } from "./town.ts";
import { complexUnits, restoredTournamentTeam, tournamentCards, tournamentChoices, tournamentRules, tournamentTeamProblem,
  type TournamentInfo } from "./tournaments.ts";

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
