import assert from "node:assert/strict";
import { test } from "node:test";

import { CommandSender } from "./commands.ts";
import type { PageSettings } from "./server.ts";

const settings: PageSettings = { userId: "u1", userKey: "k1", dynamicUrl: "/dyn", artUrl: "/art", classicUrl: "/ruffle.html" };

/** A sender whose network answers with the given statuses, one per request, and keeps what was sent. */
function sender(statuses: number[]) {
  const sent: { url: string; body: URLSearchParams }[] = [];
  const failures: string[] = [];
  const commands = new CommandSender(settings, {
    clock: () => 1700000000.7,
    post: async (url, body) => {
      sent.push({ url, body });
      const status = statuses.shift() ?? 200;
      return { ok: status === 200, status };
    },
    onFailure: (reason) => failures.push(reason),
  });
  return { commands, sent, failures };
}

function batchOf(body: URLSearchParams) {
  const data = body.get("data")!;
  assert.equal(data.indexOf(";"), 64);
  return JSON.parse(data.slice(65));
}

test("actions go in one batch, in the Flash client's format", async () => {
  const { commands, sent } = sender([200]);
  commands.add("move", 52, 52, 26, 50, 50, 0, 0, "MouseUsed");
  commands.add("orient", 50, 50, 1, 0);
  await commands.tick();
  assert.equal(sent.length, 1);
  assert.equal(sent[0].url, "/dyn/command.php");
  assert.equal(sent[0].body.get("USERID"), "u1");
  assert.equal(sent[0].body.get("user_key"), "k1");
  assert.deepEqual(batchOf(sent[0].body), {
    first_number: 0,
    commands: [
      { cmd: "move", args: [52, 52, 26, 50, 50, 0, 0, "MouseUsed"] },
      { cmd: "orient", args: [50, 50, 1, 0] },
    ],
    tries: 1,
    accessToken: "",
    publishActions: "0",
    ts: 1700000000,
  });
  assert.equal(commands.pending, 0);
});

test("nothing to send, nothing sent", async () => {
  const { commands, sent } = sender([]);
  await commands.tick();
  assert.equal(sent.length, 0);
});

test("batches count the commands sent before them", async () => {
  const { commands, sent } = sender([200, 200]);
  commands.add("a");
  commands.add("b");
  await commands.tick();
  commands.add("c");
  await commands.tick();
  assert.equal(batchOf(sent[1].body).first_number, 2);
});

test("a batch that fails is sent again, then the player is told", async () => {
  const { commands, sent, failures } = sender([500, 0, 500]);
  commands.add("sell", 1, 2, 3, 0, 0, "MouseUsed");
  await commands.tick();
  commands.add("later");  // waits for the failed batch
  await commands.tick();
  await commands.tick();
  assert.deepEqual(sent.map((s) => batchOf(s.body).tries), [1, 2, 3]);
  assert.deepEqual(sent.map((s) => batchOf(s.body).commands.length), [1, 1, 1]);
  assert.equal(failures.length, 1);
  assert.equal(commands.pending, 2);
});

test("a retry that works lets the queue go next", async () => {
  const { commands, sent, failures } = sender([500, 200, 200]);
  commands.add("first");
  await commands.tick();
  commands.add("second");
  await commands.tick();
  await commands.tick();
  assert.deepEqual(sent.map((s) => batchOf(s.body).commands.map((c: { cmd: string }) => c.cmd)), [["first"], ["first"], ["second"]]);
  assert.equal(batchOf(sent[2].body).first_number, 1);
  assert.deepEqual(failures, []);
});

test("an expired game token stops sending and says so", async () => {
  const { commands, failures } = sender([403]);
  commands.add("move");
  await commands.tick();
  assert.match(failures[0], /expired/);
});
