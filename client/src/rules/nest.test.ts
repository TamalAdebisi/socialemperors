import assert from "node:assert/strict";
import { test } from "node:test";

import {
  DRAGON_NEST, FEED, MONSTER_NEST, STEP_SECONDS, TAKE_CARE, buttonWord, clockText, friendsHelped, getGrown, opened, readNest,
  reopen, secondsLeft, speedUp, stepsDone, takeStep, writeNest,
} from "./nest.ts";

const NOW = 1_700_000_000;

test("the save is read as the server keeps it (-1: no wait; text numbers)", () => {
  const state = readNest(DRAGON_NEST, { dragonNestActive: 1, dragonNumber: "2", stepNumber: 7, timeStampTakeCare: -1 });
  assert.deepEqual(state, { active: true, number: 2, step: 7, since: 0 });
  assert.equal(readNest(MONSTER_NEST, { monsterNestActive: 0 }).active, false);
  const saved: Record<string, unknown> = {};
  writeNest(MONSTER_NEST, saved, { active: true, number: 1, step: 3, since: NOW });
  assert.deepEqual(saved, { monsterNestActive: 1, monsterNumber: 1, stepMonsterNumber: 3, timeStampTakeCareMonster: NOW });
});

test("a step starts a six-hour wait; the wait can be bought off", () => {
  const start = { active: true, number: 0, step: 7, since: 0 };
  const stepped = takeStep(DRAGON_NEST, start, NOW)!;
  assert.deepEqual(stepped.commands, [{ cmd: "next_step", args: [0] }]);
  assert.equal(stepped.state.step, 8);
  assert.equal(secondsLeft(stepped.state, NOW + 60), STEP_SECONDS - 60);
  assert.equal(stepsDone(stepped.state, NOW + 60), 7, "the step counts once its wait is over");
  assert.equal(takeStep(DRAGON_NEST, stepped.state, NOW + 60), null, "one at a time");
  assert.equal(stepsDone(stepped.state, NOW + STEP_SECONDS + 1), 8);
  const bought = speedUp(DRAGON_NEST, stepped.state, NOW + 60)!;
  assert.deepEqual(bought.commands, [{ cmd: "buy_step_cash", args: [3] }]);
  assert.equal(bought.cash, 3);
  assert.equal(secondsLeft(bought.state, NOW + 60), 0);
  assert.equal(speedUp(DRAGON_NEST, { ...start, number: 1, since: NOW }, NOW)!.cash, 15, "a fed dragon costs more");
  assert.equal(speedUp(MONSTER_NEST, { ...start, number: 1, since: NOW }, NOW)!.cash, 7);
  assert.equal(speedUp(DRAGON_NEST, start, NOW), null, "nothing to buy off");
});

test("eggs are taken care of, the others fed; at ten the grown one is got and the next starts", () => {
  assert.equal(buttonWord(DRAGON_NEST, { active: true, number: 0, step: 3, since: 0 }, NOW), TAKE_CARE);
  assert.equal(buttonWord(DRAGON_NEST, { active: true, number: 1, step: 3, since: 0 }, NOW), FEED);
  const ten = { active: true, number: 2, step: 10, since: 0 };
  assert.equal(buttonWord(DRAGON_NEST, ten, NOW), DRAGON_NEST.words.get);
  assert.equal(getGrown(DRAGON_NEST, { ...ten, since: NOW }, NOW + 5), null, "not before the last wait is over");
  const got = getGrown(DRAGON_NEST, ten, NOW)!;
  assert.equal(got.item, 651);
  assert.deepEqual(got.commands, [{ cmd: "next_dragon", args: ["0"] }]);
  assert.deepEqual(got.state, { active: true, number: 3, step: 0, since: 0 });
  assert.equal(getGrown(MONSTER_NEST, { active: true, number: 3, step: 10, since: 0 }, NOW)!.item, 653);
});

test("opening: an old save past ten moves on; past the last one the nest closes, and reopens for a price", () => {
  const past = opened(DRAGON_NEST, { active: true, number: 1, step: 11, since: NOW });
  assert.deepEqual(past.state, { active: true, number: 2, step: 0, since: 0 });
  assert.deepEqual(past.commands, [{ cmd: "next_dragon", args: ["0"] }]);
  const done = opened(DRAGON_NEST, { active: true, number: 6, step: 0, since: 0 });
  assert.deepEqual(done.state, { active: false, number: 0, step: 0, since: 0 });
  assert.deepEqual(done.commands, [{ cmd: "desactivate_dragon", args: [] }]);
  assert.deepEqual(opened(MONSTER_NEST, { active: true, number: 2, step: 4, since: 0 }).commands, []);
  assert.deepEqual(reopen(MONSTER_NEST, "c"), { state: { active: true, number: 0, step: 0, since: 0 }, commands: [{ cmd: "activate_monster", args: ["c"] }] });
});

test("friends' help: two steps each without a wait, up to ten, then the help is cleared", () => {
  const helped = friendsHelped({ active: true, number: 0, step: 3, since: 0 }, ["111", "222"]);
  assert.equal(helped.state.step, 7);
  assert.equal(helped.commands.filter((c) => c.cmd === "next_step").length, 4);
  assert.deepEqual(helped.commands.at(-1), { cmd: "finish_dragon_help", args: ['["111","222"]'] });
  const capped = friendsHelped({ active: true, number: 0, step: 8, since: NOW }, ["1", "2", "3"]);
  assert.deepEqual(capped.state, { active: true, number: 0, step: 10, since: 0 }, "the last wait goes too");
});

test("the countdown reads as the original's", () => {
  assert.equal(clockText(STEP_SECONDS), "6:00:00");
  assert.equal(clockText(5 * 3600 + 26 * 60 + 1), "5:26:01");
  assert.equal(clockText(-3), "0:00:00");
});
