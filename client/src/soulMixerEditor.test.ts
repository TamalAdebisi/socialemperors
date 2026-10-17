import assert from "node:assert/strict";
import { test } from "node:test";
import { TownEditor } from "./editor.ts";
import { itemInfo } from "./rules/config.ts";
import type { PlacedItem } from "./rules/town.ts";

// A card's callbacks can outlive the idle state in which it was drawn.
// Calling the real mutation methods on that captured object must stop
// before any parent ejection, command, refund or map/view mutation.
for (const action of ["startMove", "store", "sell"] as const) {
  test(`a stale ${action} callback cannot discard an active Soul Mixer`, () => {
    const item = itemInfo({ id: "1529", name: "Soul Mixer", type: "b", img_name: "", width: "4", height: "4", category_id: "1", subcat_functional: "139" });
    const building: PlacedItem = { item, tx: 55, ty: 55, orientation: 0, unitsInside: 2, units: [509, 514], startedAt: 100, workTime: 0, soulMixing: false };
    const editor = Object.create(TownEditor.prototype) as Record<string, unknown>;
    const messages: string[] = [];
    editor.say = (message: string) => messages.push(message);
    const fail = () => assert.fail("stale callback reached a mutation after mixing started");
    for (const name of ["light", "letGo", "emptyOut", "send", "select", "refresh"]) editor[name] = fail;
    const captured = () => (editor[action] as (building: PlacedItem) => void).call(editor, building);
    building.soulMixing = true;
    captured();
    assert.deepEqual(building.units, [509, 514]);
    assert.equal(building.soulMixing, true);
    assert.match(messages[0]!, /Collect the mixed unit/);
  });
}
