// Units whose Flash files name their animations in other words (CLIENT.md,
// "Units by number"). The game finds a unit's animation by its number,
// never its label; the newer dragons say RESPIRAR, not QUIETO, for
// standing, and some draggies have no labels at all. A Red Djinn Dragon
// Rider stands, walks and stands again, drawn from its own pictures all the
// while and seen on the screen, and the save hears where it stopped. A
// Savage Draggy, whose frames are unlabelled, faces and walks too.

import assert from "node:assert/strict";
import { has } from "../lib.mjs";

// The tiles e2e/tests/walk.mjs walks a knight between: open in a new town.
const RIDER = 2228, DRAGGY = 2242, FROM = [50, 44], TO = [54, 55], DRAGGY_AT = [46, 44], DRAGGY_TO = [50, 61];

export default async function newerUnits({ newPlayer }) {
  const player = await newPlayer();
  const { page } = player;
  await player.send([
    { cmd: "buy", args: [RIDER, ...FROM, 0, 0, 1, 1] },
    { cmd: "buy", args: [DRAGGY, ...DRAGGY_AT, 0, 0, 1, 1] },
  ]);
  await player.reload();

  /** Which of the unit's animations its picture shows now, by the sheet's name for it ("RESPIRAR/3"). */
  const showing = (id) => page.evaluate(async (id) => {
    const { town, view } = window.seHome.parts;
    const placed = town.items.find((p) => p.item.id === id);
    const art = await view.art.get(placed.item.art);
    const picture = view.slots.get(placed)?.children.find((c) => c.texture && c.label !== "selected");
    if (!art || !picture) return null;
    for (const [name, textures] of art.animations) {
      if (textures.includes(picture.texture)) return name;
    }
    return "none of its own";
  }, id);
  const until = (id, pattern) => page.waitForFunction(async ([id, source]) => {
    const { town, view } = window.seHome.parts;
    const placed = town.items.find((p) => p.item.id === id);
    const art = placed && await view.art.get(placed.item.art);
    const picture = placed && view.slots.get(placed)?.children.find((c) => c.texture && c.label !== "selected");
    if (!art || !picture) return false;
    return [...art.animations].some(([name, textures]) => new RegExp(source).test(name) && textures.includes(picture.texture));
  }, [id, pattern.source], { timeout: 30_000, polling: 100 });

  // Standing: its own breathing pictures, where before it showed nothing.
  await until(RIDER, /^RESPIRAR\//);
  assert.match(await showing(RIDER), /^RESPIRAR\/[0-4]$/, "the rider stands in its RESPIRAR pictures");
  await player.shot("standing");

  // And they're on the screen: hiding the rider changes what's there.
  const around = player.screenOf(...FROM, 60);
  const box = { x: Math.round(around.x - 60), y: Math.round(around.y - 60), width: 120, height: 120 };
  const seen = await player.pixels(box);
  await page.evaluate((id) => {
    const { town, view } = window.seHome.parts;
    view.slots.get(town.items.find((p) => p.item.id === id)).visible = false;
  }, RIDER);
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const hidden = await player.pixels(box);
  await page.evaluate((id) => {
    const { town, view } = window.seHome.parts;
    view.slots.get(town.items.find((p) => p.item.id === id)).visible = true;
  }, RIDER);
  const changed = seen.filter((pixel, i) => pixel.some((value, c) => Math.abs(value - hidden[i][c]) > 24)).length;
  assert.ok(changed > seen.length / 20, `the rider is seen on the screen (${changed} of ${seen.length} pixels are its)`);

  // Its attack (a tree's chopping pose, as a renderer probe): ATACAR.
  await page.evaluate((id) => {
    const { town, view } = window.seHome.parts;
    view.pose(town.items.find((p) => p.item.id === id), "ATAQUE", { x: 52, y: 46 });
  }, RIDER);
  await until(RIDER, /^ATACAR\//);
  await player.shot("attacking");
  await page.evaluate((id) => {
    const { town, view } = window.seHome.parts;
    view.pose(town.items.find((p) => p.item.id === id), null);
  }, RIDER);
  await until(RIDER, /^RESPIRAR\//);

  // Walking, then standing where it stopped.
  await player.select(FROM, "Red Djinn Dragon Rider");
  await player.tapTile(TO);
  await until(RIDER, /^ANDAR\//);
  await player.shot("walking");
  await page.waitForFunction(([id, x, y]) =>
    window.seHome.parts.town.items.some((p) => p.item.id === id && p.tx === x && p.ty === y),
  [RIDER, ...TO], { timeout: 30_000 });
  await until(RIDER, /^RESPIRAR\//);
  await player.shot("arrived");
  const saved = await player.saved();
  assert.ok(has(saved, RIDER, TO), "the save has the rider where it stopped");
  await page.keyboard.press("Escape");

  // The Savage Draggy has no labels: its frames 0 to 4 stand, 5 to 9 walk.
  await until(DRAGGY, /^frame\/[0-4]$/);
  await player.select(DRAGGY_AT, "Savage Draggy");
  await player.tapTile(DRAGGY_TO);
  await until(DRAGGY, /^frame\/[5-9]$/);
  await player.shot("draggy-walking");
}
