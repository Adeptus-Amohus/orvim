// Optional metadata extends existing records without rewriting their identifiers.
import { ledgerError } from "./finance-ledger.js";
export const foodNumbers = ["calories", "protein", "fat", "carbs"];
export const roundAmount = (value) => Math.round(value * 100) / 100;

export function foodPortion(values, grams, basis) {
  const factor = basis === "100g" ? grams / 100 : 1;
  return Object.fromEntries(
    foodNumbers.map((key) => [
      key,
      roundAmount(Number(values[key] || 0) * factor),
    ]),
  );
}

export function searchFragment(text, query, radius = 65) {
  const value = String(text || "");
  const index = value
    .toLocaleLowerCase()
    .indexOf(String(query).toLocaleLowerCase());
  if (index < 0) return value.slice(0, radius * 2);
  const start = Math.max(0, index - radius),
    end = Math.min(value.length, index + query.length + radius);
  return (
    (start ? "…" : "") +
    value.slice(start, end).replace(/\s+/g, " ") +
    (end < value.length ? "…" : "")
  );
}

export function accountBalances(accounts, rows, currency, through) {
  return accounts
    .filter((account) => !currency || account.currency === currency)
    .map((account) => {
      let cents = 0;
      for (const row of rows) {
        if (
          row.legacyFinance ||
          row.currency !== account.currency ||
          (through && row.date > through) ||
          (account.from && row.date < account.from)
        )
          continue;
        const amount = Math.round(row.amount * 100);
        if (row.type === "transfer") {
          if (row.accountKey === account.key) cents -= amount;
          if (row.toAccountKey === account.key) cents += amount;
        } else if (row.accountKey === account.key)
          cents += row.type === "income" ? amount : -amount;
      }
      return { ...account, balance: cents / 100 };
    });
}

export function validateExperienceData(data) {
  const number = (v, min, max) =>
    typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
  for (const item of [...(data.foodLogs || []), ...(data.savedMeals || [])]) {
    if (item.grams !== undefined && !number(item.grams, 0.1, 10000))
      throw Error("Некорректный вес порции.");
    if (
      item.nutritionBasis !== undefined &&
      !["portion", "100g"].includes(item.nutritionBasis)
    )
      throw Error("Некорректная основа пищевых данных.");
    if (
      item.nutritionBase !== undefined &&
      (!item.nutritionBase ||
        foodNumbers.some(
          (key) =>
            !number(
              item.nutritionBase[key],
              0,
              key === "calories" ? 10000 : 1000,
            ),
        ))
    )
      throw Error("Некорректные данные порции.");
  }
  for (const item of data.financeLogs || []) {
    if (
      item.legacyFinance !== undefined &&
      typeof item.legacyFinance !== "boolean"
    )
      throw Error("Некорректный статус старой операции.");
    if (
      item.type === "transfer" &&
      (!item.accountKey ||
        !item.toAccountKey ||
        item.accountKey === item.toAccountKey)
    )
      throw Error("Выберите разные счета для перевода.");
  }
  for (const item of data.checkins || []) {
    if (
      item.tags !== undefined &&
      (!Array.isArray(item.tags) ||
        item.tags.length > 12 ||
        item.tags.some(
          (tag) => typeof tag !== "string" || !tag.trim() || tag.length > 40,
        ))
    )
      throw Error("Некорректные метки самочувствия.");
  }
  const prefs = data.uiPreferences || {};
  if (
    prefs.taskDatesVersion === 1 &&
    !(data.projects || []).some(
      (row) =>
        row.system === "unassigned" && row.name === "Задачи без проекта и даты",
    )
  )
    throw Error("Системный раздел задач нельзя удалить или переименовать.");
  if (prefs.financeLedgerVersion === 1) {
    const error = ledgerError(
      prefs.financeAccounts || [],
      data.financeLogs || [],
    );
    if (error) throw Error(error);
  }
  if (prefs.financeAccounts !== undefined) {
    if (
      !Array.isArray(prefs.financeAccounts) ||
      prefs.financeAccounts.length > 100
    )
      throw Error("Некорректный список счетов.");
    const keys = new Set();
    for (const account of prefs.financeAccounts) {
      if (
        !account ||
        typeof account.key !== "string" ||
        !account.key ||
        keys.has(account.key) ||
        typeof account.name !== "string" ||
        !account.name.trim() ||
        account.name.length > 80 ||
        !/^[A-Z]{3}$/.test(account.currency) ||
        !number(account.opening, -1e12, 1e12) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(account.from)
      )
        throw Error("Некорректный счёт.");
      keys.add(account.key);
    }
  }
  if (
    prefs.financeBudgets !== undefined &&
    (!Array.isArray(prefs.financeBudgets) ||
      prefs.financeBudgets.length > 1000 ||
      prefs.financeBudgets.some(
        (item) =>
          !item ||
          typeof item.category !== "string" ||
          !item.category.trim() ||
          item.category.length > 100 ||
          !/^[A-Z]{3}$/.test(item.currency) ||
          !number(item.limit, 0.01, 1e12),
      ))
  )
    throw Error("Некорректные бюджеты категорий.");
}
