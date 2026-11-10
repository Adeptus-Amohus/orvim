import test from "node:test";
import assert from "node:assert/strict";
import {
  defaultCollection,
  collectionSettings,
  collectionRating,
  collectionStatus,
  validateCollectionSettings,
} from "../src/features/workspace/collection-settings.js";
import { validateDatabaseExtras } from "../src/features/workspace/database.js";

test("collection defaults provide useful game statuses and optional ratings", () => {
  assert.deepEqual(
    defaultCollection("Игры").statuses.map((s) => s.label),
    ["Не пройдено", "Играю", "Пройдено"],
  );
  assert.equal(defaultCollection("Документы").ratingEnabled, false);
  assert.equal(defaultCollection("Книги").kind, "book");
});

test("custom settings are scoped to their collection", () => {
  const config = { ...defaultCollection("Игры"), ratingMax: 10 };
  const state = { uiPreferences: { databaseCollections: [config] } };
  assert.equal(collectionSettings(state, "Игры"), config);
  assert.equal(collectionSettings(state, "Книги").ratingMax, 5);
  assert.equal(
    collectionSettings({ uiPreferences: { databaseCollections: {} } }, "Игры")
      .kind,
    "game",
  );
});

test("rating scale changes preserve original values and half steps", () => {
  const item = { rating: 8.5, ratingMax: 10 };
  assert.equal(collectionRating(item, { ratingMax: 5 }), 4.5);
  assert.equal(collectionRating(item, { ratingMax: 10 }), 8.5);
  assert.deepEqual(item, { rating: 8.5, ratingMax: 10 });
  assert.equal(collectionRating({ rating: 4.5 }, { ratingMax: 10 }), 9);
  assert.equal(collectionRating({ rating: null }, { ratingMax: 10 }), null);
});

test("missing custom statuses fall back by their phase", () => {
  const config = {
    ...defaultCollection("Игры"),
    statuses: [
      { id: "planned", label: "Не пройдено", phase: "planned" },
      { id: "status-20", label: "Пройдено", phase: "done" },
    ],
  };
  assert.equal(
    collectionStatus({ status: "status-21", statusPhase: "done" }, config),
    "status-20",
  );
  assert.equal(collectionStatus({ status: "done" }, config), "status-20");
  assert.equal(collectionStatus({ status: "active" }, config), "planned");
});

test("backup accepts custom collections, genres, project materials and drafts", () => {
  const config = {
    ...defaultCollection("Игры"),
    ratingMax: 10,
    genres: ["RPG"],
    statuses: [{ id: "status-20", label: "Пройдено", phase: "done" }],
  };
  const item = {
    kind: "game",
    status: "status-20",
    statusPhase: "done",
    rating: 8.5,
    ratingMax: 10,
    genres: ["RPG"],
    originProjectId: 1,
    url: "https://example.com/game",
  };
  assert.doesNotThrow(() =>
    validateDatabaseExtras({
      archiveItems: [item],
      uiPreferences: {
        databaseCollections: [config],
        databaseDrafts: {
          "project-1": { ...item, url: "https:", name: "Draft" },
        },
      },
    }),
  );
});

test("backup rejects invalid settings and duplicate status names", () => {
  const config = defaultCollection("Игры");
  for (const bad of [
    { ...config, ratingMax: 11 },
    { ...config, statuses: [] },
    { ...config, statuses: [{ id: "<script>", label: "X", phase: "done" }] },
    {
      ...config,
      statuses: [
        { id: "planned", label: "X", phase: "planned" },
        { id: "done", label: "x", phase: "done" },
      ],
    },
    { ...config, genres: [42] },
  ]) {
    assert.throws(
      () =>
        validateCollectionSettings({
          uiPreferences: { databaseCollections: [bad] },
        }),
      /Некорректные настройки/,
    );
  }
});

test("backup rejects unsafe URLs, draft keys and malformed extra fields", () => {
  for (const bad of [
    { url: "javascript:alert(1)" },
    { ratingMax: 6 },
    { status: "arbitrary" },
    { originProjectId: -1 },
    { genres: ["RPG", "RPG"] },
  ]) {
    assert.throws(
      () => validateDatabaseExtras({ archiveItems: [bad] }),
      /Некорректные материалы/,
    );
  }
  assert.throws(
    () =>
      validateDatabaseExtras({
        uiPreferences: { databaseDrafts: { "project--1": {} } },
      }),
    /Некорректные черновики/,
  );
});
