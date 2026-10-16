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
