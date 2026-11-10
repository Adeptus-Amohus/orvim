// @ts-check
/** @typedef {{from: string, until: string}} StatsRange */
const monthNames = [
  "январ[ья]|january",
  "феврал[ья]|february",
  "март[а]?|march",
  "апрел[ья]|april",
  "ма[йя]|may",
  "июн[ья]|june",
  "июл[ья]|july",
  "август[а]?|august",
  "сентябр[ья]|september",
  "октябр[ья]|october",
  "ноябр[ья]|november",
  "декабр[ья]|december",
];
/** @param {Date} date */
export function statsDay(date) {
  return (
    date.getFullYear() +
    "-" +
    String(date.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(date.getDate()).padStart(2, "0")
  );
}
/** @param {string} day @param {number} offset */
export function statsShift(day, offset) {
  const date = new Date(day + "T12:00:00");
  date.setDate(date.getDate() + offset);
  return statsDay(date);
}
/** @param {number} year @param {number} month @param {number} day */
function validDay(year, month, day) {
  const date = new Date(year, month - 1, day, 12);
  return year >= 1900 &&
    year <= 2200 &&
    date.getFullYear() === year &&
    date.getMonth() + 1 === month &&
    date.getDate() === day
    ? statsDay(date)
    : null;
}
/** @param {string} from @param {string} until */
export function validStatsRange(from, until) {
  const valid = (/** @type {string} */ day) =>
    /^\d{4}-\d{2}-\d{2}$/.test(day) &&
    validDay(
      Number(day.slice(0, 4)),
      Number(day.slice(5, 7)),
      Number(day.slice(8)),
    ) === day;
  return valid(from) && valid(until) && from <= until;
}
/** @param {string} mode @param {string} value @returns {StatsRange | null} */
export function statsPeriod(mode, value) {
  if (
    typeof value !== "string" ||
    !(mode === "year" ? /^\d{4}$/ : /^\d{4}-\d{2}$/).test(value)
  )
    return null;
  const year = Number(value.slice(0, 4)),
    month = mode === "year" ? 1 : Number(value.slice(5, 7));
  if (year < 1900 || year > 2200 || month < 1 || month > 12) return null;
  return {
    from: statsDay(new Date(year, month - 1, 1, 12)),
    until: statsDay(new Date(year, mode === "year" ? 12 : month, 0, 12)),
  };
}
/** Resolve a range locally; malformed dates must be corrected before sharing data.
 * @param {string} prompt @param {Date} [now]
 * @returns {{period: StatsRange | null, issue: string | null, comparisons?: StatsRange[]}}
 */
export function analyzeLifePeriod(prompt, now = new Date()) {
  const text = String(prompt || "").toLocaleLowerCase(),
    today = statsDay(now);
  const invalid = () => ({
    period: null,
    issue: "Проверьте период: укажите существующие даты от начала к концу.",
  });
  const range = (
    /** @type {string | null} */ from,
    /** @type {string | null} */ until = from,
  ) =>
    from && until && validStatsRange(from, until)
      ? { period: { from, until }, issue: null }
      : invalid();
  const comparing = /сравн|compar/iu.test(text);
  const combine = (/** @type {StatsRange[]} */ periods) => {
    if (!periods.length) return invalid();
    const ordered = [...periods].sort((a, b) => a.from.localeCompare(b.from));
    if (
      !comparing &&
      periods.length > 1 &&
      periods[0].from > periods[periods.length - 1].until
    )
      return invalid();
    return {
      ...range(ordered[0].from, ordered[ordered.length - 1].until),
      ...(comparing && periods.length > 1 ? { comparisons: periods } : {}),
    };
  };
  const shortRange =
    /(?:^|\s)(?:с|from)\s+(\d{1,2})[./](\d{1,2})(?:[./](\d{3,}))?\s*(?:по|до|to|through|[–—-])\s*(\d{1,2})[./](\d{1,2})(?:[./](\d{3,}))?(?!\d)/iu.exec(
      text,
    );
  if (shortRange)
    return range(
      validDay(
        Number(shortRange[3] || shortRange[6] || now.getFullYear()),
        Number(shortRange[2]),
        Number(shortRange[1]),
      ),
      validDay(
        Number(shortRange[6] || shortRange[3] || now.getFullYear()),
        Number(shortRange[5]),
        Number(shortRange[4]),
      ),
    );
  const numeric = [
    ...text.matchAll(
      /\b(\d{4})-(\d{2})-(\d{2})\b|(?<!\d)(\d{1,2})[./](\d{1,2})[./](\d{3,})(?!\d)/gu,
    ),
  ];
  if (numeric.length) {
    const days = numeric.map((m) =>
      m[1]
        ? validDay(Number(m[1]), Number(m[2]), Number(m[3]))
        : validDay(Number(m[6]), Number(m[5]), Number(m[4])),
    );
    if (days.some((day) => !day) || days.length > 2) return invalid();
    return combine(
      days.map((day) => ({
        from: /** @type {string} */ (day),
        until: /** @type {string} */ (day),
      })),
    );
  }
  const names = monthNames.map((name) => "(?:" + name + ")").join("|");
  const shared = new RegExp(
    "(?:^|\\s)(?:с|from)\\s+(\\d{1,2})\\s*(?:по|до|to|through|[–—-])\\s*(\\d{1,2})\\s+(" +
      names +
      ")(?:\\s+(\\d{3,}))?(?=\\s|$|[,.?!])",
    "iu",
  ).exec(text);
  const monthIndex = (/** @type {string} */ name) =>
    monthNames.findIndex((pattern) =>
      new RegExp("^(?:" + pattern + ")$", "iu").test(name),
    ) + 1;
  if (shared)
    return range(
      validDay(
        Number(shared[4] || now.getFullYear()),
        monthIndex(shared[3]),
        Number(shared[1]),
      ),
      validDay(
        Number(shared[4] || now.getFullYear()),
        monthIndex(shared[3]),
        Number(shared[2]),
      ),
    );
  const named = [
    ...text.matchAll(
      new RegExp(
        "(?:^|\\s)(?:(\\d{1,2})\\s+)?(" +
          names +
          ")(?:\\s+(\\d{3,}))?(?=\\s|$|[,.?!])",
        "giu",
      ),
    ),
  ];
  if (named.length) {
    const periods = named.map((m) =>
      m[1]
        ? range(
            validDay(
              Number(m[3] || now.getFullYear()),
              monthIndex(m[2]),
              Number(m[1]),
            ),
          ).period
        : statsPeriod(
            "month",
            String(m[3] || now.getFullYear()) +
              "-" +
              String(monthIndex(m[2])).padStart(2, "0"),
          ),
    );
    if (periods.some((p) => !p) || periods.length > 2) return invalid();
    return combine(/** @type {StatsRange[]} */ (periods));
  }
  const rolling =
    /(?:последни[ехйю]\s+|last\s+|past\s+)(\d{1,3}|один|одну|два|две|три|четыре|one|two|three|four)\s*(дн[а-я]*|недел[а-я]*|days?|weeks?)/iu.exec(
      text,
    );
  if (rolling) {
    /** @type {Record<string, number>} */
    const words = {
      один: 1,
      одну: 1,
      one: 1,
      два: 2,
      две: 2,
      two: 2,
      три: 3,
      three: 3,
      четыре: 4,
      four: 4,
    };
    const count = Number(rolling[1]) || words[rolling[1]],
      days = count * (/недел|week/iu.test(rolling[2]) ? 7 : 1);
    return days >= 1 && days <= 366
      ? range(statsShift(today, 1 - days), today)
      : invalid();
  }
  if (
    /(?:последн|last\s+\S+\s+|past\s+\S+\s+).*(?:дн|недел|days|weeks)/iu.test(
      text,
    )
  )
    return invalid();
  const relatives = [];
  if (/позавчера|day before yesterday/iu.test(text))
    relatives.push(statsShift(today, -2));
  if (
    /вчера|yesterday|кеше/iu.test(
      text.replace(/позавчера|day before yesterday/giu, ""),
    )
  )
    relatives.push(statsShift(today, -1));
  if (/сегодня|today|бүгін/iu.test(text)) relatives.push(today);
  if (relatives.length)
    return combine(relatives.map((day) => ({ from: day, until: day })));
  if (/недел|week|апта/iu.test(text)) {
    const monday = statsShift(today, -((now.getDay() + 6) % 7));
    const previous = /прошл|предыдущ|last|previous|өткен/iu.test(text);
    const from = statsShift(monday, previous ? -7 : 0);
    if (comparing && previous && /(?:эту|текущ|this|current)/iu.test(text))
      return combine([
        { from, until: statsShift(from, 6) },
        { from: monday, until: statsShift(monday, 6) },
      ]);
    return range(from, statsShift(from, 6));
  }
  if (/месяц|month|айдың|айға/iu.test(text)) {
    const date = new Date(now);
    const previous = /прошл|предыдущ|last|previous|өткен/iu.test(text);
    if (previous) {
      date.setDate(1);
      date.setMonth(date.getMonth() - 1);
    }
    const period = statsPeriod("month", statsDay(date).slice(0, 7));
    if (comparing && previous && /этот|текущ|this|current/iu.test(text))
      return combine(
        /** @type {StatsRange[]} */ ([
          period,
          statsPeriod("month", today.slice(0, 7)),
        ]),
      );
    return {
      period,
      issue: null,
    };
  }
  if (/год|\byear|жыл/iu.test(text)) {
    const years = [...text.matchAll(/\b\d{3,}\b/gu)].map((m) => m[0]);
    const previous = /прошл|предыдущ|last|previous|өткен/iu.test(text);
    if (!years.length) {
      years.push(String(now.getFullYear() - (previous ? 1 : 0)));
      if (comparing && previous && /этот|текущ|this|current/iu.test(text))
        years.push(String(now.getFullYear()));
    }
    const periods = years.map((year) => statsPeriod("year", year));
    if (periods.some((p) => !p) || periods.length > 2) return invalid();
    return combine(/** @type {StatsRange[]} */ (periods));
  }
  return { period: null, issue: null };
}
/** @param {string} prompt @param {Date} [now] */
export function requestLifePeriod(prompt, now = new Date()) {
  return analyzeLifePeriod(prompt, now).period;
}
