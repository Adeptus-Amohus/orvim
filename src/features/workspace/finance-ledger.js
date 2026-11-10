// Integer cents keep transfers exact. Different currencies never share a balance.
const ordered = (rows) =>
  [...rows].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      Number(Boolean(b.openingCredit)) - Number(Boolean(a.openingCredit)) ||
      Number(a.postedAt || a.id) - Number(b.postedAt || b.id) ||
      Number(a.id) - Number(b.id),
  );
const balancesFor = (accounts) =>
  new Map(accounts.map((account) => [account.key, 0]));
const accountMap = (accounts) =>
  new Map(accounts.map((account) => [account.key, account]));
function post(byKey, balances, row) {
  const account = byKey.get(row.accountKey),
    target = byKey.get(row.toAccountKey);
  if (!account || account.currency !== row.currency || row.date < account.from)
    return "Выберите счёт этой валюты и дату не раньше начала его учёта.";
  const amount = Math.round(row.amount * 100);
  if (
    row.type === "transfer" &&
    (!target ||
      target.key === account.key ||
      target.currency !== account.currency ||
      row.date < target.from)
  )
    return "Выберите два разных счёта одной валюты.";
  if (row.type !== "income" && balances.get(account.key) < amount)
    return (
      "Недостаточно средств на счёте «" +
      account.name +
      "» на " +
      row.date +
      ". Изменение не сохранено."
    );
  const next =
    balances.get(account.key) + (row.type === "income" ? amount : -amount);
  if (
    !Number.isSafeInteger(next) ||
    (row.type === "transfer" &&
      !Number.isSafeInteger(balances.get(target.key) + amount))
  )
    return "Сумма на счёте слишком велика для точного учёта.";
  balances.set(account.key, next);
  if (row.type === "transfer")
    balances.set(target.key, balances.get(target.key) + amount);
  return "";
}
export function ledgerError(accounts, rows) {
  if (accounts.some((account) => Number(account.opening || 0) !== 0))
    return "Деньги добавляются только операцией дохода.";
  const balances = balancesFor(accounts),
    byKey = accountMap(accounts);
  for (const row of ordered(rows.filter((row) => !row.legacyFinance))) {
    const error = post(byKey, balances, row);
    if (error) return error;
  }
  return "";
}
export function migrateFinance(accounts, rows, createId) {
  let changed = false;
  for (const account of accounts) {
    if (!account.opening) continue;
    const uid = "finance-opening-" + account.key;
    if (!rows.some((row) => row._syncId === uid))
      rows.push({
        id: createId(),
        _syncId: uid,
        date: account.from,
        type: account.opening > 0 ? "income" : "expense",
        amount: Math.abs(account.opening),
        currency: account.currency,
        category: "Начальный остаток",
        note: "Перенесено из прежнего начального остатка",
        accountKey: account.key,
        openingCredit: true,
        ...(account.opening < 0 ? { legacyFinance: true } : {}),
      });
    account.opening = 0;
    changed = true;
  }
  // IDs can be remapped on another device; persist the original posting order.
  for (const row of rows)
    if (row.postedAt === undefined) {
      row.postedAt = row.id;
      changed = true;
    }
  const balances = balancesFor(accounts),
    byKey = accountMap(accounts);
  for (const row of ordered(rows)) {
    if (row.legacyFinance) continue;
    if (post(byKey, balances, row)) {
      row.legacyFinance = true;
      changed = true;
    }
  }
  return changed;
}
