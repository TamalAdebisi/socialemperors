import assert from "node:assert/strict";
import { test } from "node:test";
import type { Texture } from "pixi.js";
import { ItemArt } from "./art.ts";

/** A sheet's animations as the exporter lists them: each label's frames in order, one picture per frame. */
function sheet(labels: [string, number][]): ItemArt {
  const animations = new Map<string, Texture[]>();
  for (const [label, frames] of labels) {
    for (let n = 0; n < frames; n++) {
      animations.set(`${label}/${n}`, [{ name: `${label}/${n}` } as unknown as Texture]);
    }
  }
  return new ItemArt("test", 30, animations, {});
}

const shown = (art: ItemArt, animation: number, way: number) =>
  art.pose(animation, way).map((texture) => (texture as unknown as { name: string }).name);

test("a newer dragon's poses are found by number, whatever their labels", () => {
  // 2228_redDjinnDragonRider, as its Flash file labels it.
  const djinn = sheet([["RESPIRAR", 5], ["ANDAR", 5], ["ATACAR", 5], ["MUERTE", 15],
    ["ESPECIAL1", 5], ["ESPECIAL2", 5], ["ESPECIAL3", 5], ["LIMIT ATTACK", 5]]);
  assert.deepEqual(shown(djinn, 0, 2), ["RESPIRAR/2"], "standing");
  assert.deepEqual(shown(djinn, 1, 4), ["ANDAR/4"], "walking");
  assert.deepEqual(shown(djinn, 2, 0), ["ATACAR/0"], "attacking");
  assert.deepEqual(shown(djinn, 3, 3), ["MUERTE/3"], "dying");
  assert.deepEqual(shown(djinn, 6, 1), ["ESPECIAL1/1"], "its first special move");

  // 2241_savageDragon and 2336_cerberusAncientDragon: other words again.
  const savage = sheet([["quietorl", 5], ["volandorl", 5], ["atacandorl", 5], ["muertorl", 35]]);
  assert.deepEqual(shown(savage, 0, 0), ["quietorl/0"]);
  assert.deepEqual(shown(savage, 1, 0), ["volandorl/0"]);
});

test("an older unit's poses are the ones its labels name", () => {
  const knight = sheet([["QUIETO", 5], ["ANDAR", 5], ["ATAQUE", 5], ["MUERTE", 5], ["PICAR", 10]]);
  assert.deepEqual(shown(knight, 0, 3), ["QUIETO/3"]);
  assert.deepEqual(shown(knight, 2, 1), ["ATAQUE/1"]);
  assert.deepEqual(shown(knight, 4, 2), ["PICAR/2"], "a villager picking at a rock");
  // The Golden Dragon Rider walks under "ANDAR CERCA": by label it couldn't walk.
  const golden = sheet([["QUIETO", 5], ["ANDAR CERCA", 5], ["ATAQUE", 5], ["MUERTE", 15]]);
  assert.deepEqual(shown(golden, 1, 4), ["ANDAR CERCA/4"]);
});

test("a pose the sheet hasn't got stands that way, or shows the first picture", () => {
  const short = sheet([["QUIETO", 5], ["ANDAR", 5], ["ATAQUE", 5], ["MUERTE", 5]]);
  assert.deepEqual(shown(short, 4, 3), ["QUIETO/3"], "no picking: it stands");
  // An egg: two unlabelled frames, nothing for the other ways.
  const egg = sheet([["frame", 2]]);
  assert.deepEqual(shown(egg, 0, 1), ["frame/1"]);
  assert.deepEqual(shown(egg, 1, 3), ["frame/0"]);
  assert.deepEqual(shown(sheet([]), 0, 0), [], "no pictures at all");
});
