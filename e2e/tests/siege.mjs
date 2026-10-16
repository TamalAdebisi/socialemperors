// A siege (CLIENT.md, "Defending the town"): at level 27 the village
// siege lines up at the bottom of the map, its captain riding up and down
// calling his men to get ready; after a minute the siege engines go for
// the nearest building, then the first squad, then the second with the
// captain. (Brought on at once, and played four times as fast.)

import assert from "node:assert/strict";

export default async function siege({ newPlayer }) {
  const player = await newPlayer();
  await player.send([{ cmd: "rt_level_up", args: [27] }]);
  await player.reload();
  await player.page.waitForFunction(() => window.seHome, null, { timeout: 30_000 });
  await player.page.evaluate(() => {
    window.seHome.speed = 4;
    window.seHome.bring("siege");
  });
  await player.wait(1000);
  const { army, began } = await player.page.evaluate(() => {
    const raid = window.seHome.fighting.raids[0];
    return { army: raid.fighters.map((f) => f.item.id), began: raid.stageFrom };
  });
  assert.equal(army.length, 26, "20 soldiers, 5 engines and the captain");
  assert.equal(army.filter((id) => id === 520).length, 5, "a human town's siege brings scorpions");
  await player.page.evaluate(() => {
    const captain = window.seHome.fighting.raids[0].fighters.find((f) => f.item.id === 513);
    window.seHome.parts.camera.lookAt({ x: captain.at.x, y: captain.at.y });
  });
  await player.wait(1500);
  await player.shot("lined-up");
  // Wait for the siege's minute on the game clock. Software drawing can
  // make even the four-times clock run behind real time.
  await player.page.waitForFunction((began) => window.seHome.fighting?.battle.frame - began >= 1800,
    began, { timeout: 30_000 });
  const engines = await player.page.evaluate(() => window.seHome.fighting.raids[0].fighters
    .filter((f) => f.item.id === 520 && !f.dead).map((f) => f.target && !f.target.isUnit));
  assert.ok(engines.length > 0 && engines.every(Boolean), "the engines go for a building");
  await player.shot("engines");
}
