import assert from "node:assert/strict";
import { test } from "node:test";
import { BLANK_BUILDING_ENDS, buildingLoopLength, buildingStateCount, buildingStateFrames, pouringTower } from "./buildingAnimation.ts";
import { BUILDING_STATES } from "./buildingStates.ts";

test("the mill and mines stay finished, including their other facing", () => {
  for (const name of ["aserradero1", "minapiedra1", "minapiedra3", "minavikinga", "1316_necro_mill", "molino2", "molino4"]) {
    for (const facing of [0, 1]) assert.deepEqual(buildingStateFrames(name, facing, 2), [0, 0]);
  }
});

test("oil and water towers separate idle from pouring without shortening the loop", () => {
  for (const [name, length] of [["oiltower", 22], ["torreagua", 13]] as const) {
    for (let facing = 0; facing < 4; facing++) {
      const idle = buildingStateFrames(name, facing, length)!;
      const attack = buildingStateFrames(name, facing, length, 1)!;
      assert.equal(idle.length, length);
      assert.equal(attack.length, length);
      assert.ok(idle.every((i) => i % 2 === 0));
      assert.ok(attack.every((i) => i % 2 === 1 && i < length));
      assert.ok(pouringTower(name));
    }
  }
  assert.deepEqual(buildingStateFrames("torreagua", 0, 13, 1), [1, 1, 3, 3, 5, 5, 7, 7, 9, 9, 11, 11, 11]);
});

test("nested workshop motion stays in its state at the original loop duration", () => {
  const frames = buildingStateFrames("workshop5", 0, 410)!;
  assert.equal(frames.length, 410);
  assert.deepEqual(frames.slice(0, 8), [0, 0, 2, 2, 4, 4, 6, 6]);
  assert.equal(frames.at(-1), 408);
});

test("the stables' nested animation never changes how many animals are inside", () => {
  assert.equal(buildingStateCount("adiestramientocaballos", 0), 6);
  for (let animals = 0; animals <= 5; animals++) {
    const frames = buildingStateFrames("adiestramientocaballos", 0, 318, animals)!;
    assert.equal(frames.length, 318);
    assert.ok(frames.every((i) => i % 6 === animals && i < 318));
    assert.equal(new Set(frames).size, 53);
  }
});

test("genuine nested flames, lightning and windmill motion remain complete", () => {
  for (const name of ["1360_tower", "electorre", "1236_molino", "torredefensa6"]) {
    assert.equal(buildingStateFrames(name, 0, 60), null);
    assert.equal(pouringTower(name), false);
  }
  assert.equal(buildingStateFrames("molinotrol1", 0, 40), null, "this facing has its motion in a nested clip");
  assert.ok(buildingStateFrames("molinotrol1", 1, 40)!.every((i) => i === 0), "the other facing's direct child is held by the original game");
});

test("every audited state selector clamps safely and preserves the sheet duration", () => {
  for (const [name, facings] of Object.entries(BUILDING_STATES)) {
    for (const [facing, states] of facings.entries()) {
      for (const length of [1, states, states * 3 + 1]) {
        for (const state of [-1, 0, states - 1, states + 10]) {
          const frames = buildingStateFrames(name, facing, length, state);
          if (states === 1) assert.equal(frames, null);
          else {
            assert.equal(frames!.length, length);
            assert.ok(frames!.every((i) => i >= 0 && i < length));
            assert.equal(new Set(frames!.map((i) => i % states)).size, 1);
          }
        }
      }
    }
  }
  assert.equal(buildingStateFrames("aserradero1", 0, 0), null);
});

test("all seven affected structures loop before their blank last frame, retaining their motion", () => {
  for (const [art, length] of Object.entries(BLANK_BUILDING_ENDS)) {
    assert.equal(buildingLoopLength(art, length), length - 1);
    assert.equal(buildingLoopLength(art, length - 1), length - 1, "a corrected future sheet is left alone");
  }
  assert.equal(buildingLoopLength("other-art", 382), 382, "no blanket trimming of other buildings");
});
