import assert from "node:assert/strict";
import { test } from "node:test";
import { dragonMatches, matchingDragon, RECOVERY_SECONDS, recoverRider, recoveryLeft, riderKinds, riderState, saveRider, trainRider } from "./dragonRiders.ts";

const kinds = riderKinds({ DRAGON_RIDERS: { 1: { unlockLevel: 35, steps: 5, stepCost: 15 },
  2: { unlockLevel: 40, steps: 6, stepCost: 15 }, 3: { unlockLevel: 45, steps: 7, stepCost: 15 } } });
const NOW = 1_700_000_000;

test("each rider keeps its configured level, steps and recovery price", () => {
  assert.deepEqual(kinds.map((k) => [k.item, k.level, k.steps, k.cash]), [[822, 35, 5, 15], [823, 40, 6, 15], [824, 45, 7, 15]]);
  const state = riderState({ riderNumber: "2", riderStepNumber: "3", riderTimeStamp: -1 });
  assert.deepEqual(state, { number: 2, step: 3, since: -1 });
  const saved: Record<string, unknown> = {};
  saveRider(saved, state);
  assert.deepEqual(saved, { riderNumber: 2, riderStepNumber: 3, riderTimeStamp: -1 });
});

test("a completed adventure starts the 15-hour recovery; no next step during recovery or after the end", () => {
  const start = { number: 1, step: 0, since: -1 };
  const next = trainRider(kinds[0]!, start, NOW)!;
  assert.deepEqual(next.commands, [{ cmd: "rider_next_step", args: ["1"] }]);
  assert.equal(next.state.step, 1);
  assert.equal(recoveryLeft(next.state, NOW + 60), RECOVERY_SECONDS - 60);
  assert.equal(trainRider(kinds[0]!, next.state, NOW + 60), null);
  assert.ok(trainRider(kinds[0]!, next.state, NOW + RECOVERY_SECONDS));
  assert.equal(trainRider(kinds[0]!, { ...start, step: 5 }, NOW), null);
  assert.equal(trainRider(kinds[1]!, start, NOW), null);
});

test("food removes just the recovery; too little keeps the state", () => {
  // The original's 15 cash, paid in food since 29 October 2026 (rules/speedUps.ts): 7,500.
  const state = { number: 1, step: 1, since: NOW };
  assert.equal(recoverRider(kinds[0]!, state, NOW, 7499), null);
  const recovered = recoverRider(kinds[0]!, state, NOW, 7500)!;
  assert.deepEqual(recovered.commands, [{ cmd: "rider_buy_step_cash", args: [15] }]);
  assert.deepEqual(recovered.state, { number: 1, step: 1, since: -1 });
  assert.equal(recoverRider(kinds[0]!, recovered.state, NOW, 7500), null);
});

test("taming requires exactly the matching rider and dragon, in either order; both configured output spellings work", () => {
  const matches = dragonMatches({ DRAGONS: { 684: { rider: "1", tamedId: "833" }, 2177: { rider: "3", tamed_id: "2179" } } });
  assert.equal(matchingDragon([822, 684], matches)?.tamed, 833);
  assert.equal(matchingDragon([684, 822], matches)?.tamed, 833);
  assert.equal(matchingDragon([824, 2177], matches)?.tamed, 2179);
  for (const units of [[823, 684], [822, 823], [684], [822, 684, 684], [833, 822]]) assert.equal(matchingDragon(units, matches), null);
});
