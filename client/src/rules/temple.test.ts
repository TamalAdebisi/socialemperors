import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { itemsById } from "./config.ts";
import { readMagic } from "./magic.ts";
import type { PlacedItem, Town } from "./town.ts";
import { BAHAMUT_HEART, SUPREME_DRAGON, SUPREME_TEMPLE, TEMPLE_OFFERINGS, TEMPLE_WAIT,
  canOffer, claimTemple, offerAtTemple, readTemple, templeSeconds, writeTemple } from "./temple.ts";

const items = itemsById(JSON.parse(readFileSync(new URL("../../../config/game_config_20120826.json", import.meta.url), "utf8")));
const NOW = 1700000000;
function placed(id: number, tx = 50, ty = 50): PlacedItem {
  return { item: items.get(id)!, tx, ty, orientation: 0, unitsInside: 0, startedAt: null, workTime: 0 };
}
function town(): Town {
  return { id: 0, name: "", townName: "", level: 1, xp: 0, cash: 100, gold: 200000, stone: 200000, wood: 200000, food: 200000,
    race: "h", skin: 0, expansions: new Set([13]), unlocked: new Set(), gifts: new Map([[BAHAMUT_HEART, 2]]), store: new Map(),
    items: [placed(SUPREME_TEMPLE), ...[649, 684, 695, 853, 875].map((id, i) => placed(id, 45 + i, 45))], unknown: [] };
}

test("temple save accepts older text indexes and absent state; invalid and repeated steps do not inflate progress", () => {
  assert.deepEqual(readTemple({}), { done: [], since: 0 });
  assert.deepEqual(readTemple({ templeStep: [1, "2", 2, -1, 12, "bad"], timeStampTemple: String(NOW) }), { done: [1, 2], since: NOW });
  const saved = {};
  writeTemple(saved, { done: [11, 4], since: NOW });
  assert.deepEqual(saved, { templeStep: [11, 4], timeStampTemple: NOW });
});

test("each offering can be selected in any order; the full ritual pays the six resources and sacrifices the five map dragons", () => {
  const t = town(), magic = { mana: 80 };
  let state = readTemple({});
  const sacrificed: number[] = [];
  for (const step of [11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0]) {
    const now = NOW + (11 - step) * TEMPLE_WAIT;
    const change = offerAtTemple(t, magic, state, step, now)!;
    assert.ok(change);
    assert.equal(change.commands.at(-1)!.cmd, "next_temple_step");
    assert.equal(change.commands.at(-1)!.args[1], step);
    assert.equal(templeSeconds(change.state, now), TEMPLE_WAIT);
    assert.equal(offerAtTemple(t, magic, change.state, step, now + TEMPLE_WAIT), null, "an offering is paid once");
    if (change.removed) {
      sacrificed.push(change.removed.item.id);
      assert.equal(change.commands[0].cmd, "sell");
      assert.deepEqual(change.commands[0].args.slice(-2), [1, "DEBUG"]);
    }
    state = change.state;
  }
  assert.deepEqual(sacrificed, [875, 853, 695, 684, 649]);
  assert.deepEqual([t.gold, t.stone, t.wood, t.food, magic.mana, t.cash], [100000, 100000, 100000, 100000, 30, 50]);
  assert.equal(t.gifts.get(BAHAMUT_HEART), 2, "offering the Heart only checks it");
  assert.equal(claimTemple(t, items, t.items[0], state, NOW + 11 * TEMPLE_WAIT), null, "the final wait still applies");
  const claimed = claimTemple(t, items, t.items[0], state, NOW + 12 * TEMPLE_WAIT)!;
  assert.equal(claimed.placed!.item.id, SUPREME_DRAGON);
  assert.deepEqual(claimed.commands.map((c) => c.cmd), ["buy", "sell_stored_item", "reset_temple"]);
  assert.deepEqual(claimed.commands[0].args.slice(4), [0, 1, 1, "u"]);
  assert.deepEqual(claimed.state, { done: [], since: 0 });
  assert.equal(t.gifts.get(BAHAMUT_HEART), 1);
  assert.equal(t.xp, 0, "no extra experience from the free placement");
  assert.equal(t.cash, 50);
});

test("wait boundaries, missing resources and missing/inside/wild dragons block without payment", () => {
  const t = town(), magic = { mana: 49 }, state = { done: [], since: NOW };
  assert.equal(templeSeconds(state, NOW + TEMPLE_WAIT - 0.1), 1);
  assert.equal(templeSeconds(state, NOW + TEMPLE_WAIT), 0);
  const before = t.cash;
  assert.equal(offerAtTemple(t, magic, state, 5, NOW + 1), null);
  assert.equal(t.cash, before);
  assert.equal(offerAtTemple(t, magic, { done: [], since: 0 }, 4, NOW), null);
  t.gold = 99999;
  assert.equal(canOffer(t, magic.mana, TEMPLE_OFFERINGS[0]), false);
  t.items = t.items.filter((p) => p.item.id !== 649);
  t.items[0].units = [649];
  assert.equal(canOffer(t, magic.mana, TEMPLE_OFFERINGS[6]), false);
  t.items.push({ ...placed(649), wild: true });
  assert.equal(canOffer(t, magic.mana, TEMPLE_OFFERINGS[6]), false);
  assert.equal(offerAtTemple(t, magic, { done: [], since: 0 }, -1, NOW), null);
  assert.equal(offerAtTemple(t, magic, { done: [], since: 0 }, 12, NOW), null);
});

test("sacrifice uses the editor's last sent position; Heart can be stored and is optional at the later claim", () => {
  const t = town(), magic = { mana: 50 };
  const dragon = t.items.find((p) => p.item.id === 649)!;
  dragon.serverAt = { x: 47, y: 48 };
  let prepared: PlacedItem | undefined;
  const offering = offerAtTemple(t, magic, readTemple({}), 6, NOW, (unit) => { prepared = unit; return { x: 46, y: 49 }; })!;
  assert.equal(prepared, dragon);
  assert.deepEqual(offering.commands[0].args, [46, 49, 649, 0, 1, "DEBUG"]);
  t.gifts.clear();
  t.store.set(BAHAMUT_HEART, 1);
  assert.equal(canOffer(t, magic.mana, TEMPLE_OFFERINGS[11]), true);
  const all = { done: TEMPLE_OFFERINGS.map((_, i) => i), since: 0 };
  const claimed = claimTemple(t, items, t.items[0], all, NOW)!;
  assert.deepEqual(claimed.commands.map((c) => c.cmd), ["buy", "sell_stored_item", "reset_temple"]);
  assert.equal(t.store.has(BAHAMUT_HEART), false, "a stored Heart is consumed at claim");
  const noHeart = claimTemple(t, items, t.items[0], all, NOW)!;
  assert.deepEqual(noHeart.commands.map((c) => c.cmd), ["buy", "reset_temple"], "the Heart need not still be present");
  assert.equal(claimTemple(t, items, placed(SUPREME_TEMPLE), all, NOW), null, "the temple must still be on the map");
});

test("claim consumes the town store before shared gifts, matching sell_stored_item", () => {
  const t = town();
  t.store.set(BAHAMUT_HEART, 2);
  const claimed = claimTemple(t, items, t.items[0], { done: TEMPLE_OFFERINGS.map((_, i) => i), since: 0 }, NOW)!;
  assert.equal(t.store.get(BAHAMUT_HEART), 1);
  assert.equal(t.gifts.get(BAHAMUT_HEART), 2);
  assert.equal(claimed.commands[1].cmd, "sell_stored_item");
});

test("temple, Academy and later battle reads share the same mana state for one save", () => {
  const saved = { mana: 55 }, t = town(), magic = readMagic(saved);
  assert.ok(offerAtTemple(t, magic, { done: [], since: 0 }, 4, NOW));
  assert.equal(readMagic(saved), magic);
  assert.equal(readMagic(saved).mana, 5);
  readMagic(saved).mana = 60;
  assert.equal(canOffer(t, magic.mana, TEMPLE_OFFERINGS[4]), true);
});
