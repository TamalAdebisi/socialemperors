// Idle pictures must not alternate with scaffolds, animal counts or attack
// states. Exercise every audited stateful sheet in both/all facings, plus
// real nested effects, with the actual Pixi renderer and synchronized halo.
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { BUILDING_STATES } from "../../client/src/view/buildingStates.ts";
import { BLANK_BUILDING_ENDS } from "../../client/src/view/buildingAnimation.ts";
import { has } from "../lib.mjs";

export default async function structureIdle({ newPlayer }) {
  const player = await newPlayer();
  const { page } = player;
  await player.send([{ cmd: "buy", args: [77, 55, 56, 0, 0, 1, 1] }]);
  await player.reload();
  await player.select([55, 56], "Lumber Mill I");
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await player.shot("lumber-mill-selected");
  const mill = await page.evaluate(async () => {
    const { town, view } = window.seHome.parts;
    const placed = town.items.find((p) => p.item.id === 77);
    const picture = view.slots.get(placed).children.find((c) => c.texture && c.label !== "selected");
    const art = await view.art.get(placed.item.art);
    return { playing: Boolean(picture.playing), finished: picture.texture === art.animation("frame/0")[0] };
  });
  assert.equal(mill.playing, false, "the completed lumber mill never flashes its scaffold");
  assert.equal(mill.finished, true);
  await player.press("Close");
  await page.mouse.move(20, 10);

  const names = [...Object.keys(BUILDING_STATES), "electorre", "1360_tower", "1236_molino", "fuentemagma", "torredefensa6", ...Object.keys(BLANK_BUILDING_ENDS)];
  const report = [];
  for (let index = 0; index < names.length; index++) {
    // Release decoded atlases between batches, including the big animated
    // offers. Only one page/renderer is alive at a time.
    if (index > 0 && index % 6 === 0) await player.reload();
    const name = names[index];
    const result = await page.evaluate(async ({ name, states }) => {
      const { view, items } = window.seHome.parts;
      const item = [...items.values()].find((i) => !i.isUnit && i.art === name);
      if (!item) throw new Error(`No configured structure for ${name}`);
      const art = await view.art.get(name);
      if (!art) throw new Error(`No art for ${name}`);
      const faces = [];
      for (let facing = 0; facing < art.framesOf("frame"); facing++) {
        const placed = { item, tx: 55, ty: 56, orientation: facing, unitsInside: 0, units: [], startedAt: 0, workTime: 0 };
        view.showGhost(placed);
        await Promise.resolve();
        const slot = view.ghost.slot;
        const picture = slot.children.find((c) => c.texture);
        if (!picture) throw new Error(`No picture for ${name}/${facing}`);
        picture.stop?.();
        view.outline(slot, true);
        const halo = slot.getChildByLabel("outline");
        const frames = picture.textures ?? [picture.texture];
        const original = art.animation(`frame/${facing}`);
        const allowed = new Set(original.filter((_, frame) => frame % (states?.[facing] ?? 1) === 0));
        // Every displayed texture must be a valid sample; check each frame
        // deterministically, without waiting for an arbitrary wall clock.
        let valid = true;
        for (let f = 0; f < frames.length; f++) {
          picture.gotoAndStop?.(f);
          halo.onRender();
          valid &&= allowed.has(picture.texture) && halo.children.every((copy) => copy.texture === picture.texture);
        }
        picture.gotoAndStop?.(0);
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const synchronized = halo.children.every((copy) => copy.texture === picture.texture);
        faces.push({ facing, frames: frames.length, unique: new Set(frames).size, valid, synchronized,
          blank: frames.some((texture) => texture.frame.width <= 1 && texture.frame.height <= 1),
          first: picture.texture === original[0] });
      }
      return { name, faces };
    }, { name, states: BUILDING_STATES[name] });
    for (const face of result.faces) {
      assert.ok(face.valid && face.synchronized, `${name}/${face.facing} has a matching outline on every frame`);
      assert.ok(face.first, `${name}/${face.facing} starts in its idle state`);
    }
    if (["aserradero1", "oiltower", "torreagua", "adiestramientocaballos", "1527_dragonCity_cross"].includes(name)) {
      assert.ok(result.faces.every((f) => f.unique === 1), `${name} holds its empty/idle picture`);
    }
    if (["electorre", "1360_tower", "1236_molino", "fuentemagma", "workshop5"].includes(name)) {
      assert.ok(result.faces.every((f) => f.unique > 1), `${name} keeps its genuine idle motion`);
    }
    if (name === "torredefensa6") {
      assert.ok(result.faces.every((f) => f.frames === 1 && f.unique === 1), "the Fire Tower's original idle art is static");
    }
    if (name in BLANK_BUILDING_ENDS) {
      assert.ok(result.faces.every((f) => f.frames === BLANK_BUILDING_ENDS[name] - 1 && f.unique > 1 && !f.blank), `${name} cannot blink out at the loop boundary`);
    }
    if (["adiestramientocaballos", "rancho1_2", "rancho1_3"].includes(name)) {
      const occupied = await page.evaluate(async ({ name, states }) => {
        const { view, items } = window.seHome.parts;
        const item = [...items.values()].find((i) => i.art === name), art = await view.art.get(name);
        const counts = [];
        for (let unitsInside = 1; unitsInside <= item.capacity; unitsInside++) {
          view.showGhost({ item, tx: 55, ty: 56, orientation: 0, unitsInside, units: Array(unitsInside).fill(571), startedAt: 0, workTime: 0 });
          await Promise.resolve();
          const picture = view.ghost.slot.children.find((c) => c.texture);
          const allowed = new Set(art.animation("frame/0").filter((_, i) => i % states === unitsInside));
          const frames = picture.textures ?? [picture.texture];
          counts.push(frames.every((t) => allowed.has(t)) && (name === "adiestramientocaballos" ? frames.length === 318 : frames.length === 1));
        }
        return counts;
      }, { name, states: BUILDING_STATES[name][0] });
      assert.ok(occupied.every(Boolean), `${name} keeps the right animal count, including nested motion and unused states`);
    }
    // Each structure gets a rendered screenshot for the visual pass.
    await player.shot(`idle-${name}`);
    report.push(result);
    writeFileSync(join(player.out, "structure-idle-audit.json"), JSON.stringify(report, null, 2));
    await page.evaluate(() => window.seHome.parts.view.showGhost(null));
  }
  assert.ok(has(await player.saved(), 77, [55, 56]), "the selected mill remains in the server save");

  // Real battle view: acquiring and losing a target changes a pouring
  // tower's picture, without looping through the other state in between.
  await player.send([
    { cmd: "buy", args: [369, 56, 50, 0, 0, 1, 1] },
    { cmd: "buy", args: [429, 56, 53, 0, 0, 1, 1] },
  ]);
  await player.reload();
  await player.select([56, 50], "Oil Tower");
  await player.shot("oil-tower-selected");
  await player.press("Close");
  const towerStates = await page.evaluate(async () => {
    const home = window.seHome;
    // Create the real home battlefield with no orders. Check transitions
    // within this turn, before any combat simulation or saved consequence.
    home.engage([], home.parts.town.items.find((p) => p.item.isUnit));
    const { battle, view } = home.fighting;
    const target = battle.fighters.find((f) => f.isUnit);
    const results = [];
    for (const id of [369, 429]) {
      const fighter = battle.fighters.find((f) => f.item.id === id);
      const art = await home.parts.art.get(fighter.item.art);
      for (const attacking of [false, true, false]) {
        fighter.target = attacking ? target : null;
        view.update(0, 1);
        await Promise.resolve();
        const picture = view.drawn.get(fighter).slot.children.find((c) => c.texture);
        const frames = picture.textures ?? [picture.texture];
        const allowed = new Set(art.animation(`frame/${fighter.facing}`).filter((_, i) => i % 2 === Number(attacking)));
        results.push({ id, attacking, valid: frames.every((t) => allowed.has(t)), unique: new Set(frames).size });
      }
    }
    return results;
  });
  for (const state of towerStates) {
    assert.ok(state.valid, `${state.id} shows only its ${state.attacking ? "pouring" : "idle"} state`);
    assert.equal(state.unique > 1, state.attacking, "pouring moves, idle stays still");
  }
  const saved = await player.saved();
  assert.ok(has(saved, 369, [56, 50]) && has(saved, 429, [56, 53]), "both towers remain saved in place");
}
