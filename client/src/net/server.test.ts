import assert from "node:assert/strict";
import { test } from "node:test";
import { GameServer, type PageSettings } from "./server.ts";

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
