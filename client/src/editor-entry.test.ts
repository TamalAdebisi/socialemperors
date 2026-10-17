import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { TownEditor } from "./editor.ts";
import type { Command } from "./net/commands.ts";
import { itemsById } from "./rules/config.ts";
import { DRAGON_TAMING } from "./rules/dragonRiders.ts";
import type { Point } from "./rules/geometry.ts";
import { readTown, type PlacedItem } from "./rules/town.ts";
import { UNIT_WAREHOUSE } from "./rules/warehouse.ts";

const items = itemsById(JSON.parse(readFileSync(new URL("../../config/game_config_20120826.json", import.meta.url), "utf8")));
for (const id of [UNIT_WAREHOUSE, DRAGON_TAMING]) {
  test(`moving building ${id} reroutes an approaching unit instead of admitting it at the old door`, () => {
    const town = readTown({ result: "OK", timestamp: 100, playerInfo: { cash: 0, name: "" },
      map: { id: 0, race: "h", skin: 0, level: 45, xp: 0, coins: 0, wood: 0, food: 0, stone: 0,
        expansions: [13], items: [[id, 55, 55, 0], [822, 50, 55, 0]] } }, items);
    const building = town.items[0]!, unit = town.items[1]!;
    const routes: Point[] = [], callbacks: (() => void)[] = [], sent: Command[] = [];
    let stopped = 0;
    const editor = Object.create(TownEditor.prototype) as TownEditor;
    Object.assign(editor, {
      town, selected: null, savedAt: new Map([[unit, { x: 50, y: 55 }]]),
      standingTile: (_unit: PlacedItem, target: PlacedItem) => ({ x: target.tx - 1, y: target.ty }),
      walkTo: (_unit: PlacedItem, tile: Point, arrived: () => void) => { routes.push(tile); callbacks.push(arrived); },
      unitStopped: () => { stopped++; }, reached: () => true, clock: () => 100,
      send: (commands: Command[]) => sent.push(...commands), emit: () => {}, refresh: () => {},
      doings: { pushedInto: () => {} }, view: { remove: () => {} }, commands: { flush: async () => true },
    });
    const arrival = editor as unknown as { goInto(unit: PlacedItem, target: PlacedItem): void };
    arrival.goInto(unit, building);
    building.tx = 61;
    building.ty = 60;
    callbacks[0]!();
    assert.deepEqual(routes, [{ x: 54, y: 55 }, { x: 60, y: 60 }]);
    assert.equal(stopped, 1);
    assert.ok(town.items.includes(unit), "the approaching unit remains outside until the new door is reached");
    assert.deepEqual(building.units, []);
    assert.deepEqual(sent, [], "no containment command is sent from the abandoned doorway");
  });
}
