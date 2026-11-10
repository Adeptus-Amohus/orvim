import { englishLabels, translateAdditionalLabel } from "./english-labels.js";

// Appearance metadata only: loading/error screens need the chosen language
// before the encrypted workspace has finished opening.
const key = "orvim-interface-language";
let remembered;
export function rememberInterfaceLanguage(mode) {
  if (!["ru", "en", "system"].includes(mode) || remembered === mode) return;
  remembered = mode;
  try {
    localStorage.setItem(key, mode);
  } catch {
    /* Restricted storage. */
  }
}
export function interfaceLanguage() {
  let mode = remembered;
  if (!mode)
    try {
      mode = localStorage.getItem(key);
    } catch {
      /* Use system. */
    }
  return mode === "en" || mode === "ru"
    ? mode
    : navigator.language.toLowerCase().startsWith("en")
      ? "en"
      : "ru";
}
export function interfaceMessage(value, language = interfaceLanguage()) {
  if (language !== "en") return value;
  const translate = (text) =>
    englishLabels[text] || translateAdditionalLabel(text, translate);
  return translate(String(value)) || String(value);
}
