# Rule book: the Supreme Bahamut temple

Read locally on 17 October 2026: the whole temple window and
`popups/invocationtemple/InvocationStep.as`, its entry in
`GUI/RecuadroInfo.as`, `managers/PopupManager.as`, the free placement and
removal helpers in `core/MapInitializer.as`, the nearest-tile search in
`core/isoengine/IsoEngine.as`, the combined gift/store list in `core/Base.as`,
the admin-panel binding, and the collection reward table. These notes are our own words. The original source is never
committed or shared.

**Status:** built in `client/src/rules/temple.ts` and `ui/temple.ts`;
the existing `temple.py` commands and shared save are unchanged.

1. The Supreme Dragon Temple (1394) opens from its building card, using
   the same Open control as a nest. There is no new menu or start-up popup.
2. Twelve offerings are displayed in a fixed order, but the player may
   complete them in any order: 100,000 gold, stone, wood and food; 50 mana;
   50 cash; Furious Dragon (649), Stormy Dragon (684), Sayan Dragon (695),
   Red Bahamut (853), Golden Bahamut (875); collection 23's Bahamut Heart
   (1410). Opening selects the first unfinished offering. Completed ones
   are marked and cannot be paid twice. Availability is recalculated.
3. Resource offerings check affordability, subtract the actual amount,
   and send `next_temple_step` with the resource object and offering index.
   Mana is the same balance the Academy uses, including earned level mana.
4. Sacrifices require a living player-owned dragon standing on the map,
   excluding summoned and converted battle units. Dragons inside a
   building, the warehouse or storage do not qualify. The player confirms
   first. One matching dragon is removed with a no-resource `sell`, reason
   `DEBUG`, using its last server position, then `next_temple_step` records
   the offering. No sale money, death reward or graveyard entry is earned.
   A walking unit's last sent position belongs to TownEditor; a narrow
   removal callback reads it and releases walking/work handles before
   the view is removed, without sending a later arrival command.
   Our panel also refuses actions while a home fight is active; temporary
   battle fighters never enter its normal town-unit choices.
5. The Heart step checks the combined Storage list: shared gifts plus the
   current town's store, rather than collection pieces. The original
   helper's name suggests gifts alone, but its list is populated from
   both boxes. The Heart remains stored after the offering; only the
   progress command is sent at this stage.
6. Each offering starts a 48-hour wait from the server clock, including
   offering twelve. The countdown hides the action. The timestamp and
   indexes live in `privateState.timeStampTemple` and `templeStep` and
   survive reopening, travelling and reloads. When the timer expires,
   the first unfinished offering becomes selected, or Get Dragon is enabled.
7. The unused six-hour field does not set the real wait. More subtly,
   the 5-cash wait function is only bound by the admin panel; the ordinary
   temple window has no listener for it. Earlier index notes incorrectly
   described it as a normal public button. The new window preserves the
   ordinary wait; server support for `buy_temple_step_cash` remains.
8. When all twelve waits have finished, Get Dragon places unit 2003 for
   free beside the temple, with no population or unit-limit check and no
   extra experience. It uses the nearest free ring, preferring the tile
   towards the lower-right end of the map, as the shared revival helper
   does. A full map falls back to the temple tile.
9. Claim queues the free `buy`; if the Heart still exists in Storage it
   consumes one using `sell_stored_item`; then `reset_temple` clears both
   progress and timestamp. A Heart that was removed after its offering
   does not prevent claiming. The town's store is consumed first, then
   shared gifts, matching the existing server's command behavior.
   The window closes and a fresh ritual can begin.
10. The original help, offering information, confirmation words, dragon
    life/attack values, thumbnails, selected border, tick, action button
    and temple illustration are retained. The illustration is a still
    image in the responsive panel; the original four-second cosmetic
    ritual playback does not delay the already-saved offering.

Verification is recorded in `docs/verification-temple.md`. Six rule tests
cover the full ritual in reverse order, exact commands and payments,
eligibility, deadlines, last saved unit positions, Heart timing/box priority,
shared mana identity and claim.
The browser case checks the actual card entry, shared mana, confirmation,
saved waits and progress, desktop/phone screens, and the free claim/reset.
There is no dedicated temple goal in the shipped mission list; successful
resource offerings still feed the ordinary resource-spending counters.
