import assert from "node:assert/strict";
import { test } from "node:test";
import { itemInfo, type GameConfig } from "./config.ts";
import { claimMix, givenMixer, legacyMixWarning, mixRemaining, mixerRules, mixingChoices, powerupMix, previewMix, readMixer, speedMix, startMix, SOUL_MIXER } from "./soulMixer.ts";
import { choices } from "./editing.ts";
import { canGoInside } from "./work.ts";
import type { ItemInfo } from "./config.ts";
import type { PlacedItem, Town } from "./town.ts";

// Synthetic content tests the recovered algorithm. It is never shipped as original content.
const unit = (id: number, power: number) => itemInfo({ id: String(id), name: `Unit ${id}`, type: "u", img_name: "", width: "1", height: "1", category_id: "2", subcat_functional: "78", race: "h", breeding_order: String(power), sm_training_time: "7201", population: "1" });
const units = Array.from({ length: 12 }, (_, n) => unit(500 + n, 10 + n * 10));
const buildingItem = itemInfo({ id: String(SOUL_MIXER), name: "Soul Mixer", type: "b", img_name: "", width: "4", height: "4", category_id: "1", subcat_functional: "139", race: "h", unit_capacity: "2" });
const house = itemInfo({ id: "1", name: "House", type: "b", img_name: "", width: "2", height: "2", category_id: "1", subcat_functional: "111", race: "h", population: "10" });
const items = new Map([buildingItem, house, ...units].map((item) => [item.id, item]));
const config = { items: [], globals: { SOUL_MIXER_MIN_LEVEL: 4, SOUL_MIXER_POWERUPS_LEVELS: [{ cash_cost: 1, order_increment: 0 }, { cash_cost: 2, order_increment: 1 }] } } as GameConfig;
const rules = mixerRules(config, items);
const placed = (item: ItemInfo, tx: number, ty: number): PlacedItem => ({ item, tx, ty, orientation: 0, unitsInside: 0, units: [], startedAt: null, workTime: 0 });
function fixture() {
  const building = placed(buildingItem, 55, 55);
  building.units = [500, 502]; building.unitsInside = 2;
  const town: Town = { id: 0, name: "", townName: "", level: 10, xp: 5, cash: 20, gold: 100, wood: 100, food: 100, stone: 100, race: "h", skin: 0,
    expansions: new Set([13]), unlocked: new Set(), gifts: new Map(), store: new Map(), items: [building, placed(house, 45, 45)], unknown: [], soulMixerReady: true };
  return { town, building, state: readMixer({}) };
}

test("the archived config cannot invent ranks, wait times, a minimum level or cash prices", () => {
  const missing = mixerRules({ items: [] }, items);
  assert.deepEqual(missing.missing, ["SOUL_MIXER_MIN_LEVEL", "SOUL_MIXER_POWERUPS_LEVELS"]);
  const noUnits = mixerRules({ items: [] }, new Map());
  assert.deepEqual(noUnits.missing, ["SOUL_MIXER_MIN_LEVEL", "breeding_order", "sm_training_time", "SOUL_MIXER_POWERUPS_LEVELS"]);
  const { town, building, state } = fixture();
  assert.equal(previewMix(noUnits, [500, 502]), null);
  assert.equal(givenMixer(town, noUnits, items), null);
  assert.match(String(startMix(town, building, noUnits, state, previewMix(rules, building.units!, () => 0)!, 100)), /unavailable/);
  assert.equal(state.queues.size, 0);
  assert.equal(town.cash, 20);
  const malformed = mixerRules({ items: [], globals: { ...config.globals, SOUL_MIXER_POWERUPS_LEVELS: [{ cash_cost: null, order_increment: 1 }] } }, items);
  assert.deepEqual(malformed.missing, ["SOUL_MIXER_POWERUPS_LEVELS"], "missing cash values never become a free power-up");
});

test("preview uses the original 30/70 weighted rank, twelve outcomes, and excludes both parents", () => {
  assert.equal(previewMix(rules, [500, 502], () => 0)!.unit.id, 503); // ceil(10*.3+30*.7) = 24; rank30 excluded, next40
  assert.equal(previewMix(rules, [500, 502], () => 0.99)!.unit.id, 503);
  assert.equal(previewMix(rules, [500, 500], () => 0)!.unit.id, 501); // equal-parent rank advances
  assert.equal(previewMix(rules, [500]), null);
});

test("cash power-ups retain original current-price/next-increment ordering and repeat the final tier", () => {
  const { town } = fixture();
  const preview = previewMix(rules, [500, 502], () => 0)!;
  assert.equal(powerupMix(town, rules, preview, () => 0), null);
  assert.equal(town.cash, 19);
  assert.equal(preview.unit.id, 505); // next unexcluded rank50, then one place
  assert.equal(powerupMix(town, rules, preview, () => 0), null);
  assert.equal(town.cash, 17);
  assert.equal(preview.unit.id, 507);
  assert.equal(powerupMix(town, rules, preview, () => 0), null);
  assert.equal(town.cash, 15);
  const before = preview.unit;
  town.cash = 0;
  assert.match(powerupMix(town, rules, preview)!, /cash/);
  assert.equal(preview.unit, before);
});

test("a power-up with no eligible result refuses before charging", () => {
  const { town } = fixture();
  const preview = { unit: units.at(-1)!, excluded: new Set(units.map((unit) => unit.id)), upgrades: 0, parents: [500, 502] };
  assert.match(powerupMix(town, rules, preview)!, /No further/);
  assert.equal(town.cash, 20);
});

test("legacy dragons need level20, while the selector lists eligible owned map units only", () => {
  const { town, building } = fixture();
  building.units = [2048, 500];
  assert.match(legacyMixWarning(town, building)!, /20/);
  town.level = 20;
  assert.equal(legacyMixWarning(town, building), null);
  town.items.push(placed(units[0]!, 50, 50), { ...placed(units[1]!, 51, 51), wild: true }, placed({ ...units[2]!, race: "t" }, 52, 52));
  assert.deepEqual(mixingChoices(town, rules).map((unit) => unit.item.id), [500]);
  const noncombat = placed({ ...units[0]!, subcategory: 71 }, 53, 53);
  town.items = [building, noncombat];
  assert.deepEqual(mixingChoices(town, rules), []);
});

test("start sends original power-up and queue commands once, preserves parents, and enforces result limits", () => {
  const { town, building, state } = fixture();
  const preview = previewMix(rules, building.units!, () => 0)!;
  powerupMix(town, rules, preview, () => 0);
  assert.deepEqual(startMix(town, building, rules, state, preview, 100.9), [
    { cmd: "buy_powerups", args: [0] }, { cmd: "push_queue_unit", args: [55, 55, 1529, 505, 1, 0] },
  ]);
  assert.deepEqual(state.queues.get("1"), { ts: 100, unit: 505, amount: 1 });
  assert.deepEqual(building.units, [500, 502]);
  assert.match(String(startMix(town, building, rules, state, preview, 200)), /already/);
  const next = fixture();
  preview.unit = { ...preview.unit, unitsLimit: 1 };
  next.town.items.push(placed(preview.unit, 50, 50));
  assert.match(String(startMix(next.town, next.building, rules, next.state, preview, 100)), /maximum/);
  const changed = fixture();
  changed.building.units = [501, 502];
  assert.match(String(startMix(changed.town, changed.building, rules, changed.state, preview, 100)), /souls changed/);
  assert.equal(changed.state.queues.size, 0, "a stale pair cannot schedule the old result or charge deferred upgrades");
});

test("queue restore preserves absolute clocks and rejects malformed saved work", () => {
  const restored = readMixer({ 1: { ts: "100", unit: "503", amount: 1 }, 2: { ts: "bad", unit: 503, amount: 1 }, 3: { ts: 0, unit: 503, amount: 0 } });
  assert.equal(restored.queues.size, 1);
  for (const ts of [null, "", " ", false, true, -1, undefined, NaN, Infinity]) {
    assert.equal(readMixer({ 1: { ts, unit: 503, amount: 1 } }).queues.size, 0, `invalid timestamp ${String(ts)} never means finished`);
  }
  assert.equal(readMixer({ 1: { ts: "0", unit: "503", amount: "1" } }).queues.size, 1, "explicit legacy numeric zero stays readable");
  assert.equal(mixRemaining(restored.queues.get("1")!, units[3]!, 200), 7101);
  assert.equal(mixRemaining({ ts: 100, unit: 503, amount: 1 }, { ...units[3]!, soulMixingTime: 0 }, 200), null);
  assert.equal(mixRemaining({ ts: 0, unit: 503, amount: 1 }, { ...units[3]!, soulMixingTime: 0 }, 200), 0);
});

test("speed-up costs one cash per started hour, marks ready, and refuses an extra charge", () => {
  const { town, building, state } = fixture();
  startMix(town, building, rules, state, previewMix(rules, building.units!, () => 0)!, 100);
  const unavailable = mixerRules({ items: [] }, items);
  assert.match(String(speedMix(town, building, state, units[3]!, 100, unavailable)), /unavailable/);
  assert.equal(town.cash, 20, "readable legacy waits cannot spend while original data is missing");
  assert.deepEqual(speedMix(town, building, state, units[3]!, 100, rules), { cmd: "speed_up_queue", args: ["1"] });
  assert.equal(town.cash, 17);
  assert.equal(state.queues.get("1")!.ts, 0);
  assert.match(String(speedMix(town, building, state, units[3]!, 100, rules)), /ready/);
  assert.equal(town.cash, 17);
  town.items = town.items.filter((item) => item !== building);
  assert.match(String(speedMix(town, building, state, units[3]!, 100, rules)), /no longer/);
  assert.match(String(claimMix(town, building, state, items, 100)), /no longer/);
  assert.equal(town.cash, 17, "stale window actions cannot spend or create units");
});

test("completed work waits for Get unit, checks population, returns both parents and gives no XP", () => {
  const { town, building, state } = fixture();
  const preview = previewMix(rules, building.units!, () => 0)!;
  startMix(town, building, rules, state, preview, 100);
  assert.match(String(claimMix(town, building, state, items, 101)), /not ready/);
  state.queues.get("1")!.ts = 0;
  const claimed = claimMix(town, building, state, items, 101);
  assert.equal(typeof claimed, "object");
  if (typeof claimed === "string") return;
  assert.deepEqual(claimed.units.map((unit) => unit.item.id).sort(), [500, 502, 503]);
  assert.deepEqual(claimed.commands.map((command) => command.cmd), ["pop_queue_unit", "pop_unit", "pop_unit"]);
  assert.deepEqual(building.units, []);
  assert.equal(town.xp, 5);
  assert.equal(state.queues.size, 0);
  assert.match(String(claimMix(town, building, state, items, 101)), /not ready/);
  const full = fixture();
  full.town.items = [full.building];
  startMix(full.town, full.building, rules, full.state, preview, 1);
  full.state.queues.get("1")!.ts = 0;
  assert.match(String(claimMix(full.town, full.building, full.state, items, 1)), /houses/);
  assert.equal(full.state.queues.size, 1);
});

test("active mixers keep their parents and cannot be moved, stored or sold", () => {
  const { town, building } = fixture();
  building.soulMixing = true;
  assert.deepEqual(choices(town, building), { move: false, turn: false, store: false, sell: false, why: "Collect the mixed unit before moving, storing or selling this building." });
  building.item = { ...building.item, facings: 2 };
  assert.equal(choices(town, building).turn, true, "the original still allows turning");
});

test("ordinary map entry also respects Soul Mixer eligibility, capacity and queued work", () => {
  const { town, building } = fixture();
  building.units = []; building.unitsInside = 0;
  assert.equal(canGoInside(town, units[0]!, building), true);
  town.soulMixerReady = false;
  assert.equal(canGoInside(town, units[0]!, building), false, "partly restored ranks never bypass the complete-data gate");
  town.soulMixerReady = true;
  assert.equal(canGoInside(town, { ...units[0]!, breedingOrder: 0 }, building), false);
  building.unitsInside = 2;
  assert.equal(canGoInside(town, units[0]!, building), false);
  building.unitsInside = 0; building.soulMixing = true;
  assert.equal(canGoInside(town, units[0]!, building), false);
});

test("the passive grant waits for original content/level and never duplicates a placed or stored mixer", () => {
  const { town } = fixture();
  town.items = [placed(house, 45, 45)];
  town.level = 3;
  assert.equal(givenMixer(town, rules, items), null);
  town.level = 4;
  const given = givenMixer(town, rules, items)!;
  assert.equal(given.placed.item.id, SOUL_MIXER);
  assert.deepEqual(given.commands[0]!.args.slice(3), [0, 0, 1, 1, "b"]);
  assert.equal(givenMixer(town, rules, items), null);
  town.items = [placed(house, 45, 45)]; town.gifts.set(SOUL_MIXER, 1);
  assert.equal(givenMixer(town, rules, items), null);
});
