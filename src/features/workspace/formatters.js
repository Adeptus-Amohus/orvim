// Intl construction is expensive in calendar grids, pickers and large lists.
// Bound the caches so arbitrary currencies/options cannot grow them forever.
const dateFormatCache = new Map(),
  numberFormatCache = new Map();
function cachedFormatter(cache, Constructor, locale, options) {
  const key = JSON.stringify([locale, options]);
  if (!cache.has(key)) {
    const formatter = new Constructor(locale, options);
    if (cache.size >= 64) cache.delete(cache.keys().next().value);
    cache.set(key, formatter);
  }
  return cache.get(key);
}
export function dateFormat(locale, options) {
  return cachedFormatter(dateFormatCache, Intl.DateTimeFormat, locale, options);
}
export function numberFormat(locale, options) {
  return cachedFormatter(numberFormatCache, Intl.NumberFormat, locale, options);
}
