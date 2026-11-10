import assert from "node:assert/strict";
const values = new Map();
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
  },
});
Object.defineProperty(globalThis, "navigator", {
  configurable: true,
  value: { language: "ru-RU" },
});
const { interfaceLanguage, rememberInterfaceLanguage, interfaceMessage } =
  await import("../src/features/workspace/ui-language.js");
assert.equal(interfaceLanguage(), "ru");
rememberInterfaceLanguage("en");
assert.equal(interfaceLanguage(), "en");
assert.equal(values.get("orvim-interface-language"), "en");
assert.equal(interfaceMessage("858 ккал"), "858 kcal");
assert.equal(
  interfaceMessage("Error: Повреждена копия."),
  "Error: The backup is damaged.",
);
rememberInterfaceLanguage("ru");
assert.equal(interfaceMessage("858 ккал"), "858 ккал");
rememberInterfaceLanguage("system");
assert.equal(interfaceLanguage(), "ru");
navigator.language = "en-US";
assert.equal(interfaceLanguage(), "en");
navigator.language = "ru-RU";
rememberInterfaceLanguage("en");
const restarted =
  await import("../src/features/workspace/ui-language.js?restart");
assert.equal(restarted.interfaceLanguage(), "en");
console.log(
  "Interface language: explicit choice overrides the OS, startup cache and errors passed",
);
