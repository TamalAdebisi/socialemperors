# Collections

Read locally: `managers/CollectableManager`, `popups/popupCollections`,
`popups/PopUpCollectionComplete`, the collection goal entry in
`core/Constants`, and the server's `game_collections.py`. These notes are
our own words; original source is never distributed.

The panel shows three sets at a time, five counted pieces per set and the
reward's original thumbnail. Piece names come from the game's words.
Missing pieces fade. A completed full set trades one of each piece for a
reward in Storage. Cash completion consumes up to one of every piece
already held and charges the original price less one per different piece,
never less than one. Sets 10 and 20 keep their fixed cash price.

Cash completion disappears once that set has been finished. Full sets
remain exchangeable again, except the two unique sets, 21 and 22. Set 23
has no cash purchase. An exchange checks whether a non-decoration reward
already exists on the map (including inside buildings) or in Gifts; cash
completion follows the original separate check. The original share
prompt only publishes to Facebook and is omitted here.

Built in `rules/collectionBook.ts` and `ui/collections.ts`; entry from Army.
Harvest drop rules and the shared Piece interface remain in collections.ts.
Goal 54 now counts opening the window. Combat drops are separate work.
Tests: collectionBook.test.ts and e2e/tests/collection-book.mjs.
