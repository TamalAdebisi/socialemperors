# Combat controls — 17 October 2026

Bull Gladiator's exported sprite canvas includes large transparent borders.
Unit click margins now use the current visible frame, transformed with its
mirror and zoom, in town and battle. Original artwork, exact-hit priority,
the eight-pixel margin and 44-pixel minimum stay intact.

The original sword cursor describes an attack with armed units selected.
All battle modes use the shared controls; selection changes, pointer leave,
moving targets, camera movement, spell aiming and battle end refresh it.
The home repair bucket retains priority.

## Verification in progress

- Server: 449 tests run, 440 passed, 9 existing PostgreSQL skips.
- Client types passed; all 408 tests passed after the hitbox change.
- Focused browser verification is in progress. The first run found two
  test-fixture issues: the chosen raider was obscured by the harbour and
  the phone context did not inherit a screenshot-bounds helper. Those
  fixtures are corrected without removing their assertions.
- Full local browser verification and screenshot review are required
  before merge. No merge or deployment is claimed by this record yet.

Checks use local throwaway accounts and saves. Public art is read only;
the live game and owner account are never used for testing.

## Remaining combat slices

The controls repair does not complete the full combat workstream. The
source audit identifies these next slices:

1. Protection Dome, Tower Enhancer and the specialized towers' effects.
2. Last-island teams taking owned units from buildings, storage and the
   warehouse, following the tournament picker's ownership model.
3. Targeted rare moves: the current inventory contains 43 entries with
   66 remaining requirements; existing death and movement hooks are reused.
4. Squad regrouping, archer retreat and smaller shot/tower timings.
5. Local original-game comparisons, respecting the existing playthrough
   hold and recording ambiguous original behavior before changing rules.

Medusa Barracks is deliberately filtered by its base `in_store: 0` setting
(item 1267, level 8, 30 cash, training Medusa 749). Exposing it requires a
recorded availability decision; this slice does not change its setting.
Coordinate collection kill drops and Phoenix rebirth with the separate
collections and progression workstream.
