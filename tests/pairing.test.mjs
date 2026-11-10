import assert from "node:assert/strict";
import { parsePairingLink } from "../src/features/workspace/pairing.js";
import {
  syncConflictTitle,
  syncConflictValue,
  syncDifferences,
} from "../src/features/workspace/sync-review.js";
const valid =
  "lifeos://pair?id=11111111-1111-4111-8111-111111111111&address=192.168.0.11%3A42673&code=12345678";
assert.equal(parsePairingLink(valid).address, "192.168.0.11:42673");
assert.equal(
  parsePairingLink(valid.replace("lifeos:", "orvim:")).code,
  "12345678",
);
for (const bad of [
  valid.replace("192.168.0.11", "8.8.8.8"),
  valid.replace("192.168.0.11", "127.0.0.1"),
  valid.replace("42673", "22"),
  valid.replace("12345678", "1234"),
  valid.replace("lifeos://pair", "https://pair"),
  valid.replace("lifeos://pair", "lifeos://user@pair"),
  valid.replace("192.168.0.11", "192.168.000.11"),
  valid + "#javascript:alert(1)",
  "javascript:alert(1)",
])
  assert.throws(() => parsePairingLink(bad));
const c = { collection: "@settings", uid: "foodTarget", title: "@settings" };
assert.equal(syncConflictTitle(c), "Дневная цель калорий");
assert.equal(syncConflictValue(c, 2600), "2600 ккал в день");
assert.equal(syncConflictValue(c, 0), "Цель не задана");
const changes = syncDifferences(
  { data: { foodTarget: 0, waterTarget: 2000, financeCurrency: "KZT" } },
  { data: { foodTarget: 2600, waterTarget: 2000, financeCurrency: "KZT" } },
);
assert.equal(changes[0].title, "Дневная цель калорий");
console.log("Pairing validation and readable sync settings: 15 checks passed.");
