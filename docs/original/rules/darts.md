# Darts

Read locally: PopupDarts, GameDataManager.getDartsItems,
GameStatic.shuffleArrayWithSeed, RandomGenerator, Utils.isSameDay/date
parsing, GuiManager's darts action and PopupManager's startup sequence.
Server contract: darts.py, inventory.py and tests/test_pastimes.py.
These notes are our own words.

The dated pool at or before today is current, and the next dated pool is
shown as its ending. Dates use the player's local calendar and the original
date parser ignores the clock portion. An empty pool ends play. The shipped
last entry is empty, so darts is inactive today. Do not extend dates or
invent prize rotations.

An active pool has six items and an extra. Its board has 25 balloons:
counts 1,1,4,4,7,8 for the two rare, two uncommon and two common prizes.
A Park–Miller generator (16807 modulo 2147483647) supplies an index into
the shrinking list, preserving a saved seed across clients and reloads.
Popped balloons reveal their prize kind. Discover all six kinds to award
the extra once; popping all 25 ends the board.

A new pool resets the board, seed, free throw and bonus state through
`darts_reset`. A different local calendar day grants one free throw through
`darts_new_free` while fewer than 25 balloons have been popped. Free darts
never stack. The next throw uses it; later throws cost DART_COST_CASH.
Every prize is stored through `store_add_items` before
`darts_shoot_balloon(index, paid, bonus)`, then the batch is sent at once.
The extra's storage command accompanies its first eligible throw.

Built in rules/darts.ts and ui/darts.ts. Original balloon and target art
come through tools/art/export_ui.py. The panel has tap/keyboard controls;
closing an armed sheet cancels without spending, and prizes stay readable
until the next Play. No new server rule or event schedule is introduced.
Tests: darts.test.ts and e2e/tests/darts.mjs; active browser fixtures use
original item ids with local dates, while ordinary game data stays inactive.
