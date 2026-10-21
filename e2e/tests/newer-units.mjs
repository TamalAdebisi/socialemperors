// Units whose Flash files name their animations in other words (CLIENT.md,
// "Units by number"). The game finds a unit's animation by its number,
// never its label; the newer dragons say RESPIRAR, not QUIETO, for
// standing, and some draggies have no labels at all. A Red Djinn Dragon
// Rider stands, walks and stands again, drawn from its own pictures all the
// while and seen on the screen, and the save hears where it stopped. A
// Savage Draggy, whose frames are unlabelled, stands and walks too.

import assert from "node:assert/strict";
import { has } from "../lib.mjs";

// The tiles e2e/tests/walk.mjs walks a knight between: open in a new town.
const RIDER = 2228, DRAGGY = 2242, FROM = [50, 44], TO = [54, 55], DRAGGY_AT = [46, 44];

export default async function newerUnits({ newPlayer }) {
  const player = await newPlayer();
  const { page } = player;
  await player.send([
    { cmd: "buy", args: [RIDER, ...FROM, 0, 0, 1, 1] },
    { cmd: "buy", args: [DRAGGY, ...DRAGGY_AT, 0, 0, 1, 1] },
  ]);
  await player.reload();

  /** Where a unit stands now: the town tidies units off what's in their way as it opens. */
  const tileOf = (id) => page.evaluate((id) => {
    const placed = window.seHome.parts.town.items.find((p) => p.item.id === id);
    return [placed.tx, placed.ty];
  }, id);
  /**
   * The names of the unit's animations ("RESPIRAR/3") whose pictures its
   * sprite plays now: none while it shows nothing. These dragons walk in
   * their breathing pictures, so RESPIRAR/n and ANDAR/n come together.
   */
  const showing = (id) => page.evaluate(async (id) => {
    const { town, view } = window.seHome.parts;
    const placed = town.items.find((p) => p.item.id === id);
    const art = placed && await view.art.unit(placed.item.art);  // the map's copy (CLIENT.md, "Big units in town")
    const picture = placed && view.slots.get(placed)?.children.find((c) => c.texture && c.label !== "selected");
    if (!art || !picture) return [];
    const drawn = new Set(picture.textures ?? [picture.texture]);
    return [...art.animations].filter(([, textures]) => textures.length > 0
      && new Set(textures).size === drawn.size && textures.every((texture) => drawn.has(texture))).map(([name]) => name);
  }, id);
  /** Waits until the unit plays an animation `pattern` names (polled here: the page's check is async). */
  const until = async (id, pattern) => {
    const deadline = Date.now() + 30_000;
    for (let names = await showing(id); !names.some((name) => pattern.test(name)); names = await showing(id)) {
      if (Date.now() > deadline) throw new Error(`item ${id} plays ${names.join(", ") || "none of its pictures"}, not ${pattern}`);
      await player.wait(100);
    }
  };
  const pose = (id, wanted, face) => page.evaluate(([id, wanted, face]) => {
    const { town, view } = window.seHome.parts;
    view.pose(town.items.find((p) => p.item.id === id), wanted, face ?? undefined);
  }, [id, wanted, face ?? null]);

  // Standing: its own breathing pictures, where before it showed nothing.
  await until(RIDER, /^RESPIRAR\/[0-4]$/);
  await player.shot("standing");

  // And they're on the screen: hiding the rider changes what's there.
  const around = player.screenOf(...await tileOf(RIDER), 60);
  const box = { x: Math.round(around.x - 60), y: Math.round(around.y - 60), width: 120, height: 120 };
  const seen = await player.pixels(box);
  const show = (id, visible) => page.evaluate(([id, visible]) => {
    const { town, view } = window.seHome.parts;
    view.slots.get(town.items.find((p) => p.item.id === id)).visible = visible;
  }, [id, visible]);
  await show(RIDER, false);
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const hidden = await player.pixels(box);
  await show(RIDER, true);
  const changed = seen.filter((pixel, i) => pixel.some((value, c) => Math.abs(value - hidden[i][c]) > 24)).length;
  assert.ok(changed > seen.length / 20, `the rider is seen on the screen (${changed} of ${seen.length} pixels are its)`);

  // Its attack, which battles draw from the whole sheet (the map keeps only
  // standing and walking: CLIENT.md, "Big units in town"): ATACAR, by number.
  const attack = await page.evaluate(async (id) => {
    const { town, art } = window.seHome.parts;
    const whole = await art.get(town.items.find((p) => p.item.id === id).item.art);
    const run = new Set(whole.pose(2, 0));
    return [...whole.animations].filter(([, textures]) => textures.length > 0 && new Set(textures).size === run.size
      && textures.every((texture) => run.has(texture))).map(([name]) => name);
  }, RIDER);
  assert.ok(attack.includes("ATACAR/0"), `the rider attacks in its ATACAR pictures, not ${attack.join(", ")}`);

  // Walking, then standing where it stopped.
  await player.select(await tileOf(RIDER), "Red Djinn Dragon Rider");
  await player.tapTile(TO);
  await page.waitForFunction((id) => {
    const { town, view } = window.seHome.parts;
    return view.walkers.has(town.items.find((p) => p.item.id === id));
  }, RIDER, { timeout: 15_000 });
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

  // The Savage Draggy has no labels: frames 0 to 4 stand (and walk: the
  // same pictures as 5 to 9), 10 to 14 attack, one per way. By label it
  // showed frame 0, facing up, whatever it did. The rider's wings cover it
  // on the screen, so it attacks and walks as renderer probes, the way
  // e2e/tests/structure-idle.mjs walks its villager.
  const [x, y] = await tileOf(DRAGGY);
  await until(DRAGGY, /^frame\/[0-4]$/);
  await pose(DRAGGY, "ATAQUE", { x: x + 2, y });
  await until(DRAGGY, /^frame\/1[0-4]$/);
  await pose(DRAGGY, null);
  // Walking down the screen to the right: way 3, not up (way 0).
  await page.evaluate(([id, x, y]) => {
    const { town, view } = window.seHome.parts;
    view.walk(town.items.find((p) => p.item.id === id), [{ x: x + 1, y }, { x: x + 2, y }, { x: x + 3, y }], () => true, () => {});
  }, [DRAGGY, x, y]);
  await until(DRAGGY, /^frame\/[6-9]$/);
  await player.shot("draggy-walking");
}
