import assert from "node:assert/strict";
import test from "node:test";
import { machineRules, packDuration, skinUnlocked, timePackets, WEATHER_SKINS } from "./machines.ts";

test("time packets follow the config's order and price, not a second price list", () => {
  assert.deepEqual(machineRules({ items: [], globals: { TIME_MACHINE: [{ hours: "0.5", price: "2" }, { hours: 24, price: 75 }], COST_UNLOCK_SKIN: "20" } }),
    { packs: [{ hours: .5, price: 2 }, { hours: 24, price: 75 }], skinPrice: 20 });
});

test("packet ownership fills absent slots without sharing or changing the save", () => {
  const saved = [2, "1", -1];
  assert.deepEqual(timePackets(saved, 6), [2, 1, 0, 0, 0, 0]);
  assert.deepEqual(saved, [2, "1", -1]);
  assert.deepEqual(timePackets(undefined, 2), [0, 0]);
});

test("weather keeps the original missing look 3 and the original saved text flag", () => {
  assert.deepEqual(WEATHER_SKINS, [0, 1, 2, 4, 5, 6]);
  assert.equal(skinUnlocked(undefined, 0), true);
  assert.equal(skinUnlocked({ 2: "true" }, 2), true);
  assert.equal(skinUnlocked({ 2: true }, 2), false);
  assert.equal(skinUnlocked({}, 6), false);
});

test("time packs use the original hard-coded duration labels", () => {
  assert.deepEqual([.5, 1, 4, 8, 12, 24].map((hours) => packDuration({ hours, price: 0 })),
    ["30 mins", "1 hour", "4 hours", "8 hours", "12 hours", "1 day"]);
});
