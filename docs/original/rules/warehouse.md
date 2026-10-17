# The Unit Warehouse

Read locally on 17 October 2026: `PopupUnitWarehouse`,
`popups/tournament/UnitWarehouseCard`, the warehouse branches of
`IsoUnit.CanGetInside`, `IsoBuilding.PushUnit`, `Base.storeItem` and save
loading, `IsoEngine.checkUnitLimit`, its player-unit counts and free-tile
search, `RecuadroInfo` and `PopupManager`. Also checked all references to
the warehouse and its commands, the ordinary selling path, the automatic
collision tidy-up and the config's globals. These are our notes, not the
original source.

- Each town loads `warehousedUnits` as counts by item id, and
  `warehouseAditionalCapacitySingle` as its **total** room. The starting
  room is 50. It is separate from a building's ordinary occupants.
- A player's living, nonsummoned, unconverted unit may enter their
  warehouse, whatever its kind: villagers, animals and siege engines too.
  The building must be finished and alive, and its separate box must have
  room. The map editor is paused during fighting, so battle-only units
  cannot be sent into town buildings here.
- On arrival the unit leaves the map; `add_unit_warehouse` names its last
  saved tile, the town and the unit id, and the batch is sent immediately.
  Warehoused units no longer take population. The building's occupant
  list and working clock do not change.
- Each portrait represents one unit. The window has 18 slots per page;
  the page count follows capacity, including empty pages. A portrait's
  hover names the unit. Use keeps the window open.
- Use first checks the unit kind's `units_limit`, counting the player's
  standing units and ordinary building occupants. It then checks room
  for people. The warehouse and ordinary storage do not count in either.
  Unlike some storage paths, this check has no Mummy or Ent exception.
- It searches outward from the warehouse's saved corner, at most four
  rings, taking the first ring with a free tile and the tile on it nearest
  the far corner. Failure keeps the unit in its box. Success removes one
  from the box and sends `place_warehoused_item` with facing zero; it
  grants no experience and costs nothing.
- Buying room adds **one** slot for the single-slot cash price (2), up to
  the maximum (1,000). At the maximum the purchase disappears. The older
  capacity-pack arrays and the help text's older 200-slot claim do not
  govern this window.
- Storing the building sends the ordinary storage command followed by
  `reset_warehouse`. Every warehoused unit goes to this town's ordinary
  storage. Bought room is retained. The automatic collision-store path
  calls this same rule in the original and in ours.
- Ordinary moving and selling do **not** reset the box. Moving does not
  let its contents out; selling leaves the off-map units for a replacement
  warehouse. The old server comment implying that selling resets it was
  corrected; no server behavior needed changing.

**Built:** `rules/warehouse.ts`, `rules/work.ts`, `rules/town.ts`,
`rules/cleanup.ts`, `editor.ts` and `ui/warehouse.ts`, with the original
commands and exported slot/button pictures. The shared panel fits three
columns; its 18-slot page is unchanged. It uses original thumbnail art
instead of running eighteen Flash portrait animations, and keeps names
visible for touch. A full box is refused before walking across town,
rather than making the unit walk there and failing on arrival. These
presentation choices are recorded in DECISIONS.md. The browser scenario
`warehouse` checks the screen and saved state on desktop and phone.
