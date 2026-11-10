import assert from "node:assert/strict";
import { createPersistence } from "../src/features/workspace/persistence.ts";
const document = { revision: 1, data: { value: 0 }, covers: [] },
  writes = [],
  statuses = [];
let release,
  fail = false;
const store = createPersistence(
  document,
  async (document) => {
    writes.push(structuredClone(document));
    if (fail) throw Error("Disk full");
    if (release) await new Promise((resolve) => (release = resolve));
    return document.revision + 1;
  },
  (value) => statuses.push(value),
);
store.persist({ data: { value: 1 }, covers: [] });
store.persist({ data: { value: 2 }, covers: [] });
await store.flush();
assert.equal(writes.length, 1);
assert.equal(writes[0].data.value, 2);
assert.equal(writes[0].revision, 1);
store.persist({ data: { value: 2 }, covers: [] });
await store.flush();
assert.equal(writes.length, 1);
fail = true;
store.persist({ data: { value: 3 }, covers: [] });
await assert.rejects(store.flush(), /Disk full/);
assert.match(statuses.at(-1), /Disk full/);
fail = false;
store.persist({ data: { value: 4 }, covers: [] });
await store.flush();
assert.equal(writes.at(-1).data.value, 4);
assert.equal(writes.at(-1).revision, 2);
assert.equal(statuses.at(-1), null);
release = () => {};
store.persist({ data: { value: 5 }, covers: [] });
const flushing = store.flush();
store.persist({ data: { value: 6 }, covers: [[1, "cover"]] });
const finish = release;
release = null;
finish();
await flushing;
assert.equal(writes.at(-1).data.value, 6);
assert.deepEqual(writes.at(-1).covers, [[1, "cover"]]);
assert.equal(writes.at(-1).revision, 4);
const snapshot = { data: { value: 7 }, covers: [] };
store.persist(snapshot);
snapshot.data.value = 999;
await store.flush();
assert.equal(writes.at(-1).data.value, 7);
console.log(
  "Persistence queue: 12 assertions passed (coalescing, revisions, retry, concurrent save, covers, snapshot isolation).",
);
let finishWrite;
const revertingWrites = [];
const reverting = createPersistence(
  document,
  async (doc) => {
    revertingWrites.push(structuredClone(doc));
    if (revertingWrites.length === 1)
      await new Promise((resolve) => {
        finishWrite = resolve;
      });
    return doc.revision + 1;
  },
  () => {},
);
reverting.persist({ data: { value: 1 }, covers: [] });
const waiting = reverting.flush();
reverting.persist({ data: { value: 0 }, covers: [] });
finishWrite();
await waiting;
assert.equal(revertingWrites.length, 2);
assert.equal(revertingWrites[1].data.value, 0);
assert.equal(revertingWrites[1].revision, 2);
console.log("Persistence in-flight revert: 3 assertions passed.");
