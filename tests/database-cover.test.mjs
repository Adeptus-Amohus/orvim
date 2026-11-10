import assert from "node:assert/strict";
import {
  proposedSnapshot,
  editableCollections,
} from "../src/features/workspace/changes.js";
const oldImage = "data:image/png;base64,AAAA",
  newImage = "data:image/jpeg;base64,BBBB";
const initial = {
  data: {
    ...Object.fromEntries(editableCollections.map((key) => [key, []])),
    nextId: 10,
    archiveCategories: ["Книги"],
    archiveItems: [
      {
        id: 1,
        name: "Книга",
        category: "Книги",
        date: "2026-10-15",
        rating: null,
        review: "",
      },
    ],
  },
  covers: [[1, oldImage]],
};
const change = (data, id = 1) => ({
  collection: "archiveItems",
  operation: "upsert",
  id,
  data: JSON.stringify(data),
});
let result = proposedSnapshot(
  initial,
  [change({ coverQuery: "Dune", kind: "book" })],
  new Map([[0, { image: newImage }]]),
);
assert.deepEqual(result.covers, [[1, newImage]]);
assert.equal(result.data.archiveItems[0].name, "Книга");
assert.ok(!("coverQuery" in result.data.archiveItems[0]));
assert.deepEqual(initial.covers, [[1, oldImage]]);
result = proposedSnapshot(initial, [change({ review: "Новая заметка" })]);
assert.deepEqual(result.covers, [[1, oldImage]]);
result = proposedSnapshot(
  initial,
  [change({ coverQuery: "Не найдено" })],
  new Map([[0, { error: "Not found" }]]),
);
assert.deepEqual(result.covers, [[1, oldImage]]);
result = proposedSnapshot(initial, [change({ coverUrl: null })]);
assert.deepEqual(result.covers, []);
result = proposedSnapshot(
  initial,
  [
    change(
      {
        name: "Новая книга",
        category: "Книги",
        date: "2026-10-15",
        rating: null,
        review: "",
        coverQuery: "Dune",
        kind: "book",
      },
      null,
    ),
  ],
  new Map([[0, { image: newImage }]]),
);
assert.deepEqual(result.covers, [
  [1, oldImage],
  [10, newImage],
]);
assert.equal(result.data.archiveItems[1].id, 10);
result = proposedSnapshot(initial, [
  { operation: "delete", collection: "archiveItems", id: 1, data: null },
]);
assert.deepEqual(result.covers, []);
assert.throws(
  () => proposedSnapshot(initial, [change({ coverQuery: "x".repeat(201) })]),
  /значение поля/,
);
assert.throws(
  () => proposedSnapshot(initial, [change({ coverUrl: "x".repeat(2049) })]),
  /значение поля/,
);
console.log(
  "Database covers: 12 assertions passed (preview, IDs, explicit clearing, failure preservation, no request-field leakage, input limits).",
);
