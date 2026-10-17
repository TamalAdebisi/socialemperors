import assert from "node:assert/strict";
import { test } from "node:test";
import { DartsGame, balloonPrizes, dartsRound, roundStart, type DartsRound } from "./darts.ts";
import type { Town } from "./town.ts";

const rounds: DartsRound[] = [
  { id: 1, start_date: "2026-10-01 23:00:00", items: [10,11,12,13,14,15], extra_item: 99 },
  { id: 2, start_date: "2026-11-01 23:00:00", items: [], extra_item: 0 },
];
const now = roundStart("2026-10-17");
const town = () => ({ cash: 500, store: new Map() }) as Town;

test("schedule follows original local dates and honors the empty closing entry", () => {
  assert.equal(dartsRound(rounds, roundStart("2026-09-30")).current, null);
  assert.equal(dartsRound(rounds, now).current?.id, 1);
  assert.equal(dartsRound(rounds, roundStart("2026-11-01")).current, null);
  assert.equal(dartsRound(rounds, now).next?.id, 2);
});

test("seeded board has exactly the original six prize frequencies and stable zero seed", () => {
  const prizes = balloonPrizes(4242);
  assert.equal(prizes.length, 25);
  assert.deepEqual([0,1,2,3,4,5].map((id) => prizes.filter((p) => p === id).length), [1,1,4,4,7,8]);
  assert.deepEqual(prizes, balloonPrizes(4242));
  assert.notDeepEqual(prizes, balloonPrizes(4243));
  assert.deepEqual(balloonPrizes(0).slice(0,10), [0,1,2,3,2,3,2,3,2,3]);
});

test("new round resets once; free throws do not stack; a local day and a new round renew correctly", () => {
  const saved: Record<string,unknown> = {}, game = new DartsGame(rounds,saved,20), player = town();
  assert.deepEqual(game.opening(now,4242), [{ cmd: "darts_reset", args: [4242] }]);
  assert.deepEqual(game.opening(now,99), []);
  assert.equal(game.free, true);
  assert.ok(game.shoot(player,0,now)); assert.equal(player.cash,500);
  assert.deepEqual(game.opening(now+86400,99), [{ cmd: "darts_new_free", args: [] }]);
  assert.deepEqual(game.opening(now+86400,99), []);
  assert.ok(game.shoot(player,1,now+86400)); assert.equal(player.cash,500);
  assert.ok(game.shoot(player,2,now+86400)); assert.equal(player.cash,480);
  assert.deepEqual(game.opening(roundStart("2026-11-02"),99), []);
  assert.equal(game.shoot(player,3,roundStart("2026-11-02")),null);
});

test("all six kinds award the extra once, prizes go to town storage before the shoot command", () => {
  const saved: Record<string,unknown> = {}, game = new DartsGame(rounds,saved,20), player = town();
  game.opening(now,4242);
  let bonus = 0;
  for (let index = 0; index < 25; index++) {
    const won = game.shoot(player,index,now)!;
    if (won.bonus !== null) bonus++;
    assert.equal(won.commands.at(-1)?.cmd, "darts_shoot_balloon");
  }
  assert.equal(bonus,1); assert.equal(player.store.get(99),1);
  assert.equal(player.cash,20);
  assert.equal([...player.store.values()].reduce((a,b) => a+b),26);
  assert.equal(game.shoot(player,0,now),null);
  assert.deepEqual(game.opening(now+86400,99),[],"a finished board gets no further free darts");
  const loaded = new DartsGame(rounds,saved,20);
  assert.equal(loaded.shot.length,25); assert.equal(loaded.extra,true);
});

test("invalid, duplicate and unaffordable throws do not spend or grant anything", () => {
  const saved: Record<string,unknown> = {}, game = new DartsGame(rounds,saved,20), player=town();
  game.opening(now,1);
  for (const index of [-1,25,0.1,NaN]) assert.equal(game.shoot(player,index,now),null);
  game.shoot(player,0,now); player.cash=0;
  assert.equal(game.shoot(player,0,now),null); assert.equal(game.shoot(player,1,now),null);
  assert.equal(game.shot.length,1); assert.equal([...player.store.values()].reduce((a,b) => a+b),1);
});
