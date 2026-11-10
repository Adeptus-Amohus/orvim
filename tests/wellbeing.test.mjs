import { test } from "node:test";
import assert from "node:assert/strict";
import {
  wellbeingDue,
  wellbeingSlots,
  wellbeingPeriodStart,
  nextWellbeingPeriod,
  nextWellbeingReminder,
} from "../src/features/workspace/wellbeing.js";
const t = (day, hour, minute = 0) =>
  new Date(2026, 9, day, hour, minute).getTime();
test("wellbeing uses local morning, afternoon, evening and skips a completed period", () => {
  assert.equal(wellbeingPeriodStart(t(7, 11, 59)), t(7, 0));
  assert.equal(wellbeingPeriodStart(t(7, 12)), t(7, 12));
  assert.equal(wellbeingPeriodStart(t(7, 18)), t(7, 18));
  assert.equal(wellbeingDue(t(7, 8), t(7, 11, 59)), false);
  assert.equal(wellbeingDue(t(7, 8), t(7, 12)), true);
  assert.equal(wellbeingDue(t(7, 12), t(7, 17, 59)), false);
  assert.equal(wellbeingDue(t(7, 12), t(7, 18)), true);
  assert.equal(wellbeingDue(t(7, 18), t(8, 0)), true);
  assert.equal(nextWellbeingPeriod(t(7, 19)), t(8, 0));
  assert.equal(nextWellbeingReminder(t(7, 8), 0), t(7, 9));
  assert.equal(nextWellbeingReminder(t(7, 8), t(7, 7)), t(7, 15));
  assert.equal(nextWellbeingReminder(t(7, 12), 0), t(7, 15));
  assert.equal(nextWellbeingReminder(t(7, 14), t(7, 13)), t(7, 21));
  assert.equal(nextWellbeingReminder(t(7, 19), t(7, 18)), t(8, 9));
  assert.equal(nextWellbeingReminder(t(7, 22), 0), t(8, 9));
  assert.equal(nextWellbeingReminder(t(7, 8), t(7, 10)), t(7, 9));
});

test("configurable frequency is consistent across check-ins and reminder plans", () => {
  for (let count = 1; count <= 6; count++) {
    const slots = wellbeingSlots(count);
    assert.equal(slots.length, count);
    assert.equal(new Set(slots.map((s) => s.hour)).size, count);
    for (const slot of slots) {
      assert.equal(
        nextWellbeingReminder(t(7, slot.hour - 1, 59), 0, count),
        t(7, slot.hour),
      );
      assert.equal(
        wellbeingPeriodStart(t(7, slot.hour), count),
        t(7, slot.start),
      );
      assert.ok(
        nextWellbeingReminder(t(7, slot.hour), t(7, slot.hour), count) >
          t(7, slot.hour),
      );
    }
    assert.equal(nextWellbeingPeriod(t(7, 23), count), t(8, 0));
  }
  for (const invalid of [0, 7, -1, 2.5, NaN, "2"])
    assert.deepEqual(wellbeingSlots(invalid), wellbeingSlots(3));
});
