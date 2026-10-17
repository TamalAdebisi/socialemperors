# The units book

Read locally: PopupAllUnits, UnitCollectionsManager and IsoEngine's unit
registration. Server contract: shop.collection_unit and
shop.unit_collection_completed. These notes use our own words.

Categories come from units_collections_categories, sorted by position.
Three categories show per page. Each category supplies its units, its
reward, a general cash price and optional per-unit prices. A missing unit
is grey; its details show life, attack, attack delay, speed, range and
population, with a walking/attack/special preview. Buying a missing unit
uses buy_stored_item_cash and puts it in this town's storage. The purchase
is remembered in boughtUnits across page loads.

At startup, boughtUnits and the player's units currently on the map count.
Units already inside buildings, in Gifts, or in storage do not additionally
count unless the saved boughtUnits says so. Newly acquired map units count
for the current session even if later removed; that session recognition
is not written as a book purchase. A category completed through acquiring a
map unit announces that a reward waits. A full category pays its configured
reward into Gifts and one cash through unit_collections_completed. Each
category pays once. The original overall denominator sums category entries,
including one duplicated unit in the supplied configuration; retain that
count. Individual category counters stay independent.

Built: rules/unitBook.ts, ui/unitBook.ts, view/unitPreview.ts. Army opens it
on desktop and phone. Details expand on tap or keyboard and only one
preview plays at once. Tests: unitBook.test.ts and e2e/tests/units-book.mjs.
