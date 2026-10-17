// Idle pictures must not alternate with scaffolds, animal counts or attack
// states. Exercise every audited stateful sheet in both/all facings, plus
// real nested effects, with the actual Pixi renderer and synchronized halo.
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { BUILDING_STATES } from "../../client/src/view/buildingStates.ts";
import { BLANK_BUILDING_ENDS, STEADY_BUILDING } from "../../client/src/view/buildingAnimation.ts";
import { has } from "../lib.mjs";

export default async function structureIdle({ newPlayer }) {
  const player = await newPlayer();
  const { page } = player;
  const webkit = page.context().browser().browserType().name() === "webkit";
  const steadyImages = new Set();
  page.context().on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (/\/1527_dragonCity_cross(?:-\d+)?\.webp$/.test(path)) steadyImages.add(path);
  });
  await player.send([
    { cmd: "buy", args: [77, 55, 56, 0, 0, 1, 1] },
    { cmd: "buy", args: [500, 51, 58, 0, 0, 1, 1] },
  ]);
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

  // Outlines are shared with units. Exercise the real walking renderer:
  // its container movement must not be applied again by the frame sync.
  const walking = await page.evaluate(async () => {
    const { town, view } = window.seHome.parts;
    const unit = town.items.find((p) => p.item.id === 500 && p.tx === 51 && p.ty === 58);
    view.hover(unit, null);
    view.walk(unit, [{ x: 52, y: 58 }, { x: 53, y: 58 }], () => true, () => {});
    await Promise.resolve();
    const positions = new Set();
    let aligned = true;
    for (let frame = 0; frame < 12; frame++) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const slot = view.slots.get(unit);
      const picture = slot.children.find((c) => c.texture && c.label !== "selected");
      const halo = slot.getChildByLabel("outline");
      positions.add(picture.x);
      aligned &&= halo.children.every((copy) => copy.texture === picture.texture
        && Math.abs(halo.x + copy.x - picture.x) <= 2.01
        && Math.abs(halo.y + copy.y - picture.y) <= 2.01);
    }
    return { moved: positions.size > 1, aligned };
  });
  await player.shot("walking-outline");
  assert.ok(walking.moved && walking.aligned, "a walking unit and its outline move exactly once, on matching frames");
  // This is a renderer probe, not an order: restore the saved town.
  await player.reload();
  assert.ok(has(await player.saved(), 500, [51, 58]), "the renderer probe leaves the saved villager in place");

  const names = [...Object.keys(BUILDING_STATES), "electorre", "1360_tower", "1236_molino", "fuentemagma", "torredefensa6", ...Object.keys(BLANK_BUILDING_ENDS)];
  const report = [];
  for (let index = 0; index < names.length; index++) {
    // Release decoded atlases between batches, including the big animated
    // offers. Only one page/renderer is alive at a time.
    if (index > 0 && index % 6 === 0) await player.reload();
    const name = names[index];
    const result = await page.evaluate(async ({ name, states }) => {
      const { view, items } = window.seHome.parts;
      // Keep the gallery separate from nearby town art. Capture its actual
      // renderer output below, independently of camera/compositor timing.
      view.things.visible = false;
      view.markers.layer.visible = false;
      view.landSigns.visible = false;
      const item = [...items.values()].find((i) => !i.isUnit && i.art === name);
      if (!item) throw new Error(`No configured structure for ${name}`);
      const art = await view.art.get(name);
      if (!art) throw new Error(`No art for ${name}`);
      const faces = [];
      const captures = [];
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
        const synchronize = halo.onRender;
        halo.onRender = (renderer) => {
          synchronize();
          if (renderer) window.seStructureRenderer = renderer;
        };
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
        // Render the current object independently of camera/screenshot timing.
        // A valid frame index alone cannot prove that visible art was drawn.
        const renderer = window.seStructureRenderer;
        const pixels = renderer.extract.pixels({ target: slot });
        let visible = 0;
        for (let i = 3; i < pixels.pixels.length; i += 4) if (pixels.pixels[i] > 0) visible++;
        captures.push(await renderer.extract.base64({ target: slot, format: "png", clearColor: 0x5b9f30 }));
        faces.push({ facing, frames: frames.length, unique: new Set(frames).size, valid, synchronized,
          visible, image: picture.texture.source.label, imageType: picture.texture.source.resource?.constructor.name,
          mipmaps: picture.texture.source.autoGenerateMipmaps, mipLevels: picture.texture.source.mipLevelCount,
          blank: frames.some((texture) => texture.frame.width <= 1 && texture.frame.height <= 1),
          first: picture.texture === original[0] });
      }
      return { name, faces, captures };
    }, { name, states: BUILDING_STATES[name] });
    for (const face of result.faces) {
      assert.ok(face.valid && face.synchronized, `${name}/${face.facing} has a matching outline on every frame`);
      assert.ok(face.first, `${name}/${face.facing} starts in its idle state`);
      assert.ok(face.visible > 10, `${name}/${face.facing} actually renders visible pixels`);
      if (webkit) {
        assert.equal(face.imageType, "HTMLImageElement", `${name}/${face.facing} avoids Safari's ImageBitmap path`);
        assert.ok(!face.mipmaps && face.mipLevels === 1, `${name}/${face.facing} avoids Safari's mipmap generation path`);
      }
      writeFileSync(join(player.out, `idle-${name}-${face.facing}.png`), Buffer.from(result.captures[face.facing].split(",")[1], "base64"));
    }
    delete result.captures;
    if (name === STEADY_BUILDING) {
      const used = new Set(result.faces.map((face) => new URL(face.image).pathname));
      assert.deepEqual(steadyImages, used, "the fixed pose downloads only the image pages its facings use");
      assert.equal(steadyImages.size, 2, "the current export needs two images, not all 100 pages");
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
    if (name === "workshop5") {
      const live = await page.evaluate(async () => {
        const slot = window.seHome.parts.view.ghost.slot;
        const picture = slot.children.find((c) => c.texture);
        const halo = slot.getChildByLabel("outline");
        const seen = new Set([picture.texture]);
        let synchronized = true;
        picture.play();
        for (let frame = 0; frame < 20; frame++) {
          await new Promise((resolve) => requestAnimationFrame(resolve));
          seen.add(picture.texture);
          synchronized &&= halo.children.every((copy) => copy.texture === picture.texture);
        }
        picture.stop();
        return { changed: seen.size > 1, synchronized };
      });
      assert.ok(live.changed && live.synchronized, "the real ticker advances nested motion and its halo together");
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
