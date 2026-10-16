import assert from "node:assert/strict";
import { test } from "node:test";
import type { Ticker } from "pixi.js";
import { GameLoop } from "./gameLoop.ts";

function game() {
  let now = 0, hidden = false;
  let draw = (_frame: { deltaMS: number }) => {}, timer = () => {}, visibility = () => {};
  const ticker = { add: (run: typeof draw) => { draw = run; }, stop() {}, start() {} } as unknown as Ticker;
  const loop = new GameLoop(ticker, {
    now: () => now, hidden: () => hidden,
    every: (run) => { timer = run; }, visibility: (run) => { visibility = run; },
  });
  const steps: number[] = [];
  loop.add((ms) => steps.push(ms));
  return { loop, steps, elapsed: () => steps.reduce((sum, ms) => sum + ms, 0),
    frame(ms: number) { now += ms; draw({ deltaMS: ms }); },
    staleFrame(ms: number) { draw({ deltaMS: ms }); },
    wait(ms: number) { now += ms; }, timer: () => timer(),
    hide(on: boolean) { hidden = on; visibility(); },
  };
}

test("hidden tabs advance without drawing and retain throttled elapsed time", () => {
  const g = game();
  g.frame(20);
  g.hide(true);
  g.wait(3250);
  g.timer();
  assert.equal(g.elapsed(), 3270);
  assert.ok(g.steps.every((ms) => ms <= 100), "walking and battles get safe steps");
  g.wait(750);
  g.hide(false);
  assert.equal(g.elapsed(), 4020);
  g.timer();
  assert.equal(g.elapsed(), 4020, "returning and the timer cannot count time twice");
  g.staleFrame(100);
  assert.equal(g.elapsed(), 4020, "the first animation frame cannot replay the hidden interval");
  g.frame(20);
  assert.equal(g.elapsed(), 4040);
});

test("manual pause excludes time spent paused even across visibility changes", () => {
  const g = game();
  g.frame(20);
  g.loop.stop();
  g.hide(true);
  g.wait(60000);
  g.timer();
  assert.equal(g.elapsed(), 20);
  g.loop.start();
  g.wait(500);
  g.timer();
  assert.equal(g.elapsed(), 520);
  g.hide(false);
  g.frame(20);
  assert.equal(g.elapsed(), 540);
});

test("a long browser suspension catches up in bounded batches without dropping time", () => {
  const g = game();
  g.hide(true);
  g.wait(65000);
  g.hide(false);
  assert.equal(g.steps.length, 100, "yield after ten seconds of simulation");
  for (let i = 0; i < 6; i++) g.timer();
  assert.equal(g.elapsed(), 65000);
  g.timer();
  assert.equal(g.elapsed(), 65000);
});
