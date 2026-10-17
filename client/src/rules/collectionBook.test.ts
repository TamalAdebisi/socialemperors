import assert from "node:assert/strict";
import { test } from "node:test";
import { CollectionBook } from "./collectionBook.ts";
import type { Town } from "./town.ts";

const town = () => ({ cash: 500, gifts: new Map() }) as Town;
const fill = (book: CollectionBook, id: number, count = 1) => {
  for (let piece = 1; piece <= 5; piece++) for (let n = 0; n < count; n++) book.found({ collection: id, piece });
};

test("saved counts, duplicate pieces and cash discount survive exchanges", () => {
  const saved: Record<string, unknown> = {};
  const book = new CollectionBook(saved), player = town();
  book.found({ collection: 1, piece: 1 }); book.found({ collection: 1, piece: 1 });
  assert.equal(book.price(1), 4);
  assert.equal(book.finish(player, 1, false), null);
  assert.deepEqual(book.finish(player, 1, true), { cmd: "finish_collection", args: [1, 1, 4] });
  assert.equal(player.cash, 496); assert.equal(book.rows[1][1], 1);
  assert.equal(player.gifts.get(176), 1); assert.equal(book.finish(player, 1, true), null);
  fill(book, 1, 2);
  assert.deepEqual(book.finish(player, 1, false), { cmd: "finish_collection", args: [1] });
  assert.equal(player.gifts.get(176), 2);
  assert.deepEqual(new CollectionBook(saved).completed, [1]);
});

test("unique collections, no cash Heart, fixed prices and insufficient funds", () => {
  const book = new CollectionBook({}), player = town();
  fill(book, 10); fill(book, 20);
  assert.equal(book.price(10), 15); assert.equal(book.price(20), 20);
  fill(book, 21, 2); assert.ok(book.finish(player, 21, false));
  assert.equal(book.finish(player, 21, false), null); assert.equal(book.finish(player, 21, true), null);
  assert.equal(book.finish(player, 23, true), null);
  fill(book, 23, 2); assert.ok(book.finish(player, 23, false)); assert.ok(book.finish(player, 23, false));
  player.cash = 0;
  assert.equal(book.finish(player, 2, true), null); assert.equal(book.rows[2][0], 0);
});
