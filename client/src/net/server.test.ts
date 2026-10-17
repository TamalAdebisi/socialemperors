import assert from "node:assert/strict";
import { test } from "node:test";
import { GameServer, type PageSettings } from "./server.ts";
import type { TournamentInfo, TournamentRoom } from "../rules/tournaments.ts";

/** The fields emitted by tournaments.py's _view and _match_view. */
function tournamentInfoFixture(): TournamentInfo & { tournament: TournamentRoom } {
  const ids = ["player", "two", "three", "four"];
  return { tournament_reward_id: { "1": 3, "2": "2" },
    tournament_weekly: { "8": { open: "1", full: "0", timeLeft: 600 } }, tournament_friends: [],
    tournament: { tournament_id: "room", tournament_type_id: "1", reward_id: 0, private: "0",
      owner_id: "", owner: "", point_type: 1, date_ready: 1000, date_finished: null, match_playing: false,
      players: ids.map((user_id) => ({ user_id, user_name: user_id, level: 15, country: "",
        team: [511, ...Array(19).fill(0)], abandonned: 0,
        matches: ids.filter((id) => id !== user_id).map((victim_id) => ({ attacker_id: user_id, victim_id,
          finished: false, attacker_won: false, attacker_points: 0, date_started: null, date_finished: null })) })) } };
}

function replaceField(data: unknown, path: string, value: unknown): void {
  const keys = path.split(".");
  let record = data as Record<string, unknown>;
  for (const key of keys.slice(0, -1)) record = record[key] as Record<string, unknown>;
  record[keys.at(-1)!] = value;
}

test("tournament reads use the original authenticated service envelope and unwrap data", async (t) => {
  const data = { tournament: null, tournament_reward_id: { "1": 3 }, tournament_weekly: {}, tournament_friends: [] };
  t.mock.method(globalThis, "fetch", async (url: string, options: RequestInit) => {
    assert.equal(url, "/game/tournaments/get_tournament_info.php");
    assert.equal(options.method, "POST");
    const body = options.body as URLSearchParams;
    assert.equal(body.get("USERID"), "local-player");
    assert.equal(body.get("user_key"), "local-test-key");
    assert.equal(body.get("data"), "0".repeat(64) + ';{"user_id":"local-player"}');
    return new Response(JSON.stringify({ data }), { status: 200 });
  });
  const server = new GameServer({ dynamicUrl: "/game", userId: "local-player", userKey: "local-test-key" } as PageSettings);
  assert.deepEqual(await server.tournamentInfo(), data);
});

test("failed or malformed tournament replies cannot masquerade as an empty list", async (t) => {
  const server = new GameServer({ dynamicUrl: "/game" } as PageSettings);
  const fetch = t.mock.method(globalThis, "fetch", async () => new Response("failed", { status: 500 }));
  await assert.rejects(server.tournamentInfo(), /500/);
  fetch.mock.mockImplementation(async () => new Response('{"data":{"result":"NOK"}}'));
  await assert.rejects(server.tournamentInfo(), /not returned/);
});

test("tournament availability and reward maps reject arrays in reads and successful entries", async (t) => {
  const server = new GameServer({ dynamicUrl: "/game", userId: "player" } as PageSettings);
  const info = { tournament: null, tournament_reward_id: { "1": 3, "2": "2" },
    tournament_weekly: { "8": { open: "1", full: "0", timeLeft: 600 } }, tournament_friends: [] };
  let data: Record<string, unknown> = info;
  t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({ data })));
  assert.deepEqual(await server.tournamentInfo(), info, "keyed maps retain their original numeric and string values");
  for (const field of ["tournament_weekly", "tournament_reward_id"] as const) {
    for (const invalid of [[], Object.values(info[field])]) {
      data = { ...info, [field]: invalid };
      await assert.rejects(server.tournamentInfo(), /not returned/, `${field} must not become an empty list or missing prize`);
      data.result = "OK";
      await assert.rejects(server.joinTournament("1", 1, [511]), /not returned/, `${field} also validates after joining`);
      await assert.rejects(server.createTournament("1", [511], []), /not returned/, `${field} also validates after creation`);
    }
  }
  data = { ...info, tournament_weekly: {}, tournament_reward_id: {} };
  assert.deepEqual(await server.tournamentInfo(), data, "empty object maps remain a valid server response");
});

test("complete waiting, active, finished and weekly responses retain their supported wire values", async (t) => {
  const waiting = tournamentInfoFixture();
  waiting.tournament.date_ready = null;
  waiting.tournament.players = waiting.tournament.players.slice(0, 1);
  waiting.tournament.players[0].matches = [];
  const active = tournamentInfoFixture();
  active.tournament.match_playing = true;
  active.tournament.players[0].matches[0].date_started = 1001;
  const finished = tournamentInfoFixture();
  finished.tournament.date_finished = 1100;
  finished.tournament.winner_id = "player";
  finished.tournament.point_type = 0; // Older rooms retain the original alternate score type.
  finished.tournament.players[1].abandonned = 1;
  for (const player of finished.tournament.players) for (const match of player.matches) {
    Object.assign(match, { finished: true, attacker_won: player.user_id === "player", attacker_points: 92.35,
      date_started: 1001, date_finished: 1100 });
  }
  const noWinner = structuredClone(finished);
  noWinner.tournament.winner_id = null;
  const privateRoom = structuredClone(waiting);
  Object.assign(privateRoom.tournament, { private: 1, reward_id: "2", owner_id: "player", owner: "<Player>" });
  const weekly = tournamentInfoFixture();
  weekly.tournament.tournament_type_id = "8";
  weekly.tournament.players[0].team = Array(20).fill(649); // Weekly entry exempts the complex-unit cap.
  for (const bot of weekly.tournament.players.slice(1)) bot.matches = [];
  const rank = { user_id: "player", user_name: "Player", points: 0, time: 0, matches: 0 };
  weekly.tournament.ranking = { total_user: 1, top: { "1": rank }, user: { ...rank, rank: 1 } };
  weekly.tournament_weekly["8"] = { open: 1, full: 1, timeLeft: "600" };
  const outOfPrizes = structuredClone(weekly);
  outOfPrizes.tournament.date_finished = 1100;
  outOfPrizes.tournament.ranking!.total_user = 11;
  outOfPrizes.tournament.ranking!.user.rank = 11;
  outOfPrizes.tournament.ranking!.top = { "1": { ...rank, user_id: "another", points: 300, matches: 3 },
    "10": { ...rank, user_id: "tenth", points: 1, matches: 3 } };
  const server = new GameServer({ dynamicUrl: "/game", userId: "player" } as PageSettings);
  let data: unknown;
  t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({ data })));
  for (const info of [waiting, tournamentInfoFixture(), active, finished, noWinner, privateRoom, weekly, outOfPrizes]) {
    data = info;
    assert.deepEqual(await server.tournamentInfo(), info);
    data = { ...info, result: "OK" };
    assert.deepEqual(await server.joinTournament("1", 1, [511]), data);
    assert.deepEqual(await server.createTournament("1", [511], []), data);
  }
});

test("missing or malformed room, player and match fields fail before reaching tournament views", async (t) => {
  const fixture = tournamentInfoFixture();
  const malformed: [string, unknown][] = [];
  for (const [path, record] of [["tournament", fixture.tournament],
    ["tournament.players.0", fixture.tournament.players[0]],
    ["tournament.players.0.matches.0", fixture.tournament.players[0].matches[0]]] as const) {
    for (const field of Object.keys(record)) malformed.push([`${path}.${field}`, undefined]);
  }
  malformed.push(
    ["tournament", []], ["tournament", "room"], ["tournament.tournament_id", ""],
    ["tournament.tournament_type_id", 1], ["tournament.reward_id", []], ["tournament.reward_id", -1],
    ["tournament.private", "false"], ["tournament.owner_id", null], ["tournament.owner", {}],
    ["tournament.point_type", "1"], ["tournament.date_ready", "1000"], ["tournament.date_finished", {}],
    ["tournament.match_playing", "false"], ["tournament.players", {}], ["tournament.players.0", null],
    ["tournament.players.0", []], ["tournament.players.0.user_id", ""], ["tournament.players.0.user_name", null],
    ["tournament.players.0.level", "15"], ["tournament.players.0.country", {}],
    ["tournament.players.0.abandonned", "false"], ["tournament.players.0.team", {}],
    ["tournament.players.0.team.0", null], ["tournament.players.0.team.0", "511"],
    ["tournament.players.0.team.0", -1], ["tournament.players.0.team.0", 511.5],
    ["tournament.players.0.matches", {}], ["tournament.players.0.matches.0", null],
    ["tournament.players.0.matches.0", []], ["tournament.players.0.matches.0.attacker_id", ""],
    ["tournament.players.0.matches.0.victim_id", null], ["tournament.players.0.matches.0.finished", "false"],
    ["tournament.players.0.matches.0.attacker_won", 0], ["tournament.players.0.matches.0.attacker_points", "0"],
    ["tournament.players.0.matches.0.attacker_points", -1], ["tournament.players.0.matches.0.date_started", "1000"],
    ["tournament.players.0.matches.0.date_finished", []], ["tournament.winner_id", 3], ["tournament.winner_id", ""],
  );
  const server = new GameServer({ dynamicUrl: "/game", userId: "player" } as PageSettings);
  let data: unknown;
  t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({ data })));
  for (const [path, invalid] of malformed) {
    const info = structuredClone(fixture);
    replaceField(info, path, invalid);
    data = info;
    const error = { name: "Error", message: "The tournament list was not returned." };
    await assert.rejects(server.tournamentInfo(), error, `${path}: ${String(invalid)}`);
    data = { ...info, result: "OK" };
    await assert.rejects(server.joinTournament("1", 1, [511]), error, `${path} after joining`);
    await assert.rejects(server.createTournament("1", [511], []), error, `${path} after creating`);
  }
});

test("nested availability, prize and ranking entries cannot invent a closed event or a result", async (t) => {
  const fixture = tournamentInfoFixture();
  const rank = { user_id: "player", user_name: "Player", points: 12.35, time: 20, matches: 1 };
  fixture.tournament.ranking = { total_user: 1, top: { "1": rank }, user: { ...rank, rank: 1 } };
  const malformed: [string, unknown][] = [];
  for (const invalid of [null, [], {}, "2", true]) malformed.push(["tournament_weekly.8", invalid]);
  for (const field of ["open", "full", "timeLeft"]) malformed.push([`tournament_weekly.8.${field}`, undefined]);
  for (const field of ["open", "full"]) for (const invalid of [null, [], {}, "", " ", "yes", 2, true]) {
    malformed.push([`tournament_weekly.8.${field}`, invalid]);
  }
  for (const invalid of [null, [], {}, "", " ", "later", "Infinity", true]) malformed.push(["tournament_weekly.8.timeLeft", invalid]);
  for (const invalid of [null, [], {}, "", " ", "unknown", "Infinity", -1, 0.5, true]) malformed.push(["tournament_reward_id.1", invalid]);
  for (const invalid of [null, [], "ranking"]) malformed.push(["tournament.ranking", invalid]);
  for (const [path, record] of [["tournament.ranking", fixture.tournament.ranking],
    ["tournament.ranking.top.1", rank], ["tournament.ranking.user", fixture.tournament.ranking.user]] as const) {
    for (const field of Object.keys(record)) malformed.push([`${path}.${field}`, undefined]);
  }
  for (const key of ["bad", "0", "-1", "1.5", " "]) malformed.push(["tournament.ranking.top", { [key]: rank }]);
  malformed.push(["tournament.ranking.total_user", "1"], ["tournament.ranking.top", []],
    ["tournament.ranking.top.1", null], ["tournament.ranking.top.1", []],
    ["tournament.ranking.top.1.user_id", ""], ["tournament.ranking.top.1.user_name", {}],
    ["tournament.ranking.top.1.points", "12.35"], ["tournament.ranking.top.1.time", -1],
    ["tournament.ranking.top.1.matches", 1.5], ["tournament.ranking.user", []],
    ["tournament.ranking.user.rank", 0], ["tournament.ranking.user.rank", "1"]);
  const server = new GameServer({ dynamicUrl: "/game", userId: "player" } as PageSettings);
  let data: unknown;
  t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({ data })));
  for (const [path, invalid] of malformed) {
    const info = structuredClone(fixture);
    replaceField(info, path, invalid);
    data = info;
    const error = { name: "Error", message: "The tournament list was not returned." };
    await assert.rejects(server.tournamentInfo(), error, `${path}: ${String(invalid)}`);
    data = { ...info, result: "OK" };
    await assert.rejects(server.joinTournament("1", 1, [511]), error, `${path} after joining`);
    await assert.rejects(server.createTournament("1", [511], []), error, `${path} after creating`);
  }
});

test("friends' cards validate before either a list or successful entry reaches the window", async (t) => {
  const server = new GameServer({ dynamicUrl: "/game", userId: "player" } as PageSettings);
  const friend = { tournament_id: "friend-room", tournament_type_id: "1", reward_id: 2, owner: "<Friend>" };
  let data: Record<string, unknown> = { tournament: null, tournament_reward_id: {}, tournament_weekly: {}, tournament_friends: [friend] };
  t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({ data })));
  assert.deepEqual((await server.tournamentInfo()).tournament_friends, [friend]);
  data.tournament_friends = [{ ...friend, reward_id: "2", owner_id: "friend" }];
  assert.equal((await server.tournamentInfo()).tournament_friends[0].reward_id, "2", "the original numeric-string index remains supported");
  for (const invalid of [null, "friend-room", [], {}, { ...friend, tournament_id: null },
    { ...friend, tournament_type_id: 1 }, { ...friend, owner: null }, { ...friend, reward_id: "unknown" },
    { ...friend, reward_id: -1 }, { ...friend, reward_id: 1.5 }]) {
    data.tournament_friends = [invalid];
    await assert.rejects(server.tournamentInfo(), /not returned/);
  }
  data = { ...data, result: "OK", tournament_friends: [null] };
  await assert.rejects(server.joinTournament("1", 1, [511]), /not returned/);
  await assert.rejects(server.createTournament("1", [511], []), /not returned/);
});

test("entry and room mutations preserve original service names and payloads", async (t) => {
  const calls: { service: string; payload: Record<string, unknown> }[] = [];
  const info = { tournament: null, tournament_reward_id: {}, tournament_weekly: {}, tournament_friends: [] };
  t.mock.method(globalThis, "fetch", async (url: string, options: RequestInit) => {
    const body = options.body as URLSearchParams;
    assert.equal(body.get("USERID"), "player");
    assert.equal(body.get("user_key"), "local-test-key");
    const encoded = body.get("data")!;
    assert.equal(encoded.slice(0, 65), "0".repeat(64) + ";");
    const service = url.slice(url.lastIndexOf("/") + 1, -4);
    calls.push({ service, payload: JSON.parse(encoded.slice(65)) });
    const data = service === "join_tournament" || service === "create_tournament" ? { result: "OK", ...info } : { result: "OK" };
    return new Response(JSON.stringify({ data }));
  });
  const server = new GameServer({ dynamicUrl: "/game", userId: "player", userKey: "local-test-key" } as PageSettings);
  const team = [511, ...Array(19).fill(0)];
  await server.joinTournament("1", 3, team);
  await server.joinTournament("2", 3, team, "friends-room");
  await server.createTournament("1", team, ["friend-one", "friend-two", "friend-three"]);
  await server.leaveTournament("room");
  await server.cancelTournament("room");
  await server.startTournamentMatch("room", "opponent");
  await server.finishTournamentMatch("room", "opponent", true, 98.123);
  await server.cleanTournament();
  await server.cleanTournament("room");
  const who = { user_id: "player" };
  assert.deepEqual(calls, [
    { service: "join_tournament", payload: { ...who, tournament_type_id: "1", category: 3, team, tournament_id: "", flashSubResources: 1 } },
    { service: "join_tournament", payload: { ...who, tournament_type_id: "2", category: 3, team, tournament_id: "friends-room", flashSubResources: 1 } },
    { service: "create_tournament", payload: { ...who, tournament_type_id: "1", team, usersFriends: ["friend-one", "friend-two", "friend-three"], flashSubResources: 1 } },
    { service: "leave_tournament", payload: { ...who, tournament_id: "room" } },
    { service: "cancel_tournament", payload: { ...who, tournament_id: "room" } },
    { service: "start_tournament_match", payload: { ...who, victim_id: "opponent", tournament_id: "room" } },
    { service: "finish_tournament_match", payload: { ...who, victim_id: "opponent", attacker_won: true, attacker_points: "98.12", victim_points: 0, tournament_id: "room" } },
    { service: "clean_tournament", payload: who },
    { service: "clean_tournament", payload: { ...who, tournament_id: "room" } },
  ]);
});

test("refused entries remain distinguishable from an unconfirmed action or malformed room", async (t) => {
  const server = new GameServer({ dynamicUrl: "/game", userId: "player" } as PageSettings);
  let data: unknown = { result: "NOFRIENDS", resources: { refund: 1, tournament_type_id: "1" } };
  t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({ data })));
  assert.deepEqual(await server.createTournament("1", [511], []), data);
  await assert.rejects(server.leaveTournament("room"), /not confirmed/);
  data = { result: "OK" };
  await assert.rejects(server.joinTournament("1", 1, [511]), /not returned/);
  data = { tournament: { tournament_id: "room", tournament_type_id: "1" },
    tournament_reward_id: {}, tournament_weekly: {}, tournament_friends: [] };
  await assert.rejects(server.tournamentInfo(), /not returned/);
  data = undefined;
  await assert.rejects(server.cleanTournament(), /not returned/);
});
