import assert from "node:assert/strict";
import { test } from "node:test";
import { cantPayFood, FOOD_PER_CASH, foodText, inFood, payFood } from "./speedUps.ts";
import type { Town } from "./town.ts";

test("a speed-up's cash is paid in food at the game's own exchange: 500 a cash", () => {
  // The bank's 2,500 gold for 5 cash, and the market's food at a gold each.
  assert.equal(FOOD_PER_CASH, 500);
  assert.equal(inFood(3), 1500);
  assert.equal(foodText(15), "7,500");
});

test("the food is taken only when the town has it all; cash is never touched", () => {
  const town = { food: 7499, cash: 50 } as Town;
  assert.equal(cantPayFood(town, 15), "Not enough food: it takes 7,500.");
  assert.equal(payFood(town, 15), false);
  assert.deepEqual([town.food, town.cash], [7499, 50]);
  town.food = 7500;
  assert.equal(cantPayFood(town, 15), null);
  assert.equal(payFood(town, 15), true);
  assert.deepEqual([town.food, town.cash], [0, 50]);
});
