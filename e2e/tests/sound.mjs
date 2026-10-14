// Sound (CLIENT.md, "Sound"): nothing plays before the first tap, as
// browsers want; then the town's music, a click for buttons and the game's
// sound for a unit sent off or a building placed. The music and sound
// buttons switch them off, and the page remembers. The page's audio is
// watched, not heard: each effect is known by its length.

import assert from "node:assert/strict";

const KNIGHT_AT = [50, 44], TO = [55, 56];
// The effects' lengths in seconds (client/src/sound/), give or take a little.
const LENGTH = { click: 0.42, place: 0.62 };

export default async function sound({ newPlayer }) {
  const player = await newPlayer();
  const { page } = player;
  await page.addInitScript(() => {
    window.__effects = [];
    window.__music = [];
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...args) {
      window.__effects.push(this.buffer?.duration ?? 0);
      return start.apply(this, args);
    };
    HTMLMediaElement.prototype.play = function () {
      window.__music.push(`play ${this.src}`);
      return Promise.resolve();
    };
    HTMLMediaElement.prototype.pause = function () {
      window.__music.push("pause");
    };
  });
  await player.reload();
  const effects = () => page.evaluate(() => window.__effects);
  // Playing: the page's last word to the music was play.
  const music = () => page.evaluate(() => window.__music.at(-1)?.startsWith("play") ?? false);
  const heard = async (name, since) => {
    await player.wait(600);  // each plays a moment after
    return (await effects()).slice(since).some((d) => Math.abs(d - LENGTH[name]) < 0.1);
  };

  // Before any tap: quiet.
  assert.deepEqual(await page.evaluate(() => window.__music), [], "no music before a tap");
  assert.equal(await page.getByRole("button", { name: "Music: on" }).count(), 1);
  assert.equal(await page.getByRole("button", { name: "Sounds: on" }).count(), 1);

  // The first tap: the town's music; a unit sent off makes its sound.
  await player.select(KNIGHT_AT, "Light Knight");
  assert.match((await page.evaluate(() => window.__music))[0], /^play .*\/music\/Spirit%20of%20Eternity\.mp3$/);
  let since = (await effects()).length;
  await player.tapTile(TO);
  assert.ok(await heard("place", since), `a unit sent off: ${await effects()}`);

  // A button clicks.
  since = (await effects()).length;
  await player.press("Close");
  assert.ok(await heard("click", since), `a button: ${await effects()}`);
  await player.shot("sound-buttons");

  // Sounds off: buttons are quiet now. Music off: it stops.
  await player.press("Sounds: on");
  await player.press("Music: on");
  assert.equal(await music(), false, "the music stopped");
  since = (await effects()).length;
  await player.menu("Build");
  await player.wait(600);
  assert.deepEqual((await effects()).slice(since), [], "no sounds");
  await page.keyboard.press("Escape");

  // Remembered: still off after a reload, even after a tap.
  await player.reload();
  assert.equal(await page.getByRole("button", { name: "Music: off" }).count(), 1);
  assert.equal(await page.getByRole("button", { name: "Sounds: off" }).count(), 1);
  await player.select(KNIGHT_AT, "Light Knight");
  assert.equal(await music(), false, "no music");
  await player.press("Music: off");
  assert.equal(await music(), true, "music on again");
}
