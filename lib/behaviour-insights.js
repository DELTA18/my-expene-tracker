import { dateKey, myShare, shiftDay, todayStr } from "@/lib/expense-utils";

// Habits are read from a rolling window so one odd week can't make a
// pattern; month facts (streaks, silent days) are about the viewed month only.
const WINDOW_DAYS = 90;
const MIN_WINDOW_DAYS = 21;

const PAYDAY_LAST_DAY = 5;
const PAYDAY_RATIO = 1.4;
const WEEKEND_RATIO = 1.2;
const WEEKEND_DAYS_PER_MONTH = 8.7;
const QUIET_SHARE = 0.4;
const QUIET_RUN = 3;
const REVENGE_RATIO = 1.8;
const REVENGE_MIN_TIMES = 2;
const STREAK_SHARE = 1.5;
const STREAK_MIN_DAYS = 3;
const SILENT_MIN_DAYS = 2;
const SILENT_LOOKBACK_MONTHS = 12;

function rupees(n) {
  return "₹" + Math.round(n).toLocaleString("en-IN");
}

function times(ratio) {
  return `${ratio.toFixed(1)}×`;
}

function shortDate(d) {
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function avg(list) {
  return list.length ? list.reduce((s, d) => s + d.amount, 0) / list.length : 0;
}

// Every calendar day from start to end (inclusive), zero-spend days included.
function daysBetween(start, end, totals) {
  const days = [];
  for (let d = new Date(start); dateKey(d) <= dateKey(end); d = shiftDay(d, 1)) {
    const key = dateKey(d);
    days.push({ key, date: new Date(d), amount: totals[key] || 0 });
  }
  return days;
}

function payday(windowDays) {
  const early = windowDays.filter((d) => d.date.getDate() <= PAYDAY_LAST_DAY);
  const rest = windowDays.filter((d) => d.date.getDate() > PAYDAY_LAST_DAY);
  if (early.length < 5 || rest.length < 10) return null;
  const avgEarly = avg(early);
  const avgRest = avg(rest);
  if (!avgEarly || !avgRest) return null;
  const ratio = avgEarly / avgRest;
  if (ratio >= PAYDAY_RATIO) {
    return {
      id: "payday",
      title: `You spend ${times(ratio)} more in the first ${PAYDAY_LAST_DAY} days of a month`,
      detail: `${rupees(avgEarly)} a day on the 1st–${PAYDAY_LAST_DAY}th vs ${rupees(avgRest)} after`,
      score: ratio / PAYDAY_RATIO,
    };
  }
  if (1 / ratio >= PAYDAY_RATIO) {
    return {
      id: "payday",
      title: `You start months careful, then spend ${times(1 / ratio)} more`,
      detail: `${rupees(avgEarly)} a day on the 1st–${PAYDAY_LAST_DAY}th vs ${rupees(avgRest)} after`,
      score: 1 / ratio / PAYDAY_RATIO,
    };
  }
  return null;
}

function weekend(windowDays) {
  const isWeekend = (d) => d.date.getDay() === 0 || d.date.getDay() === 6;
  const weekends = windowDays.filter(isWeekend);
  const weekdays = windowDays.filter((d) => !isWeekend(d));
  if (weekends.length < 6 || weekdays.length < 15) return null;
  const avgWeekend = avg(weekends);
  const avgWeekday = avg(weekdays);
  if (!avgWeekend || !avgWeekday) return null;
  const detail = `An average weekend day is ${rupees(avgWeekend)} vs ${rupees(avgWeekday)} on weekdays`;
  if (avgWeekend / avgWeekday >= WEEKEND_RATIO) {
    return {
      id: "weekend",
      title: `Weekends cost you ${rupees((avgWeekend - avgWeekday) * WEEKEND_DAYS_PER_MONTH)} more a month`,
      detail,
      score: avgWeekend / avgWeekday / WEEKEND_RATIO,
    };
  }
  if (avgWeekday / avgWeekend >= WEEKEND_RATIO) {
    return {
      id: "weekend",
      title: `Weekdays are your expensive days — ${times(avgWeekday / avgWeekend)} your weekends`,
      detail,
      score: avgWeekday / avgWeekend / WEEKEND_RATIO,
    };
  }
  return null;
}

function revenge(windowDays, avgDay) {
  const quiet = avgDay * QUIET_SHARE;
  const after = [];
  let run = 0;
  windowDays.forEach((d) => {
    if (d.amount <= quiet) {
      run += 1;
      return;
    }
    if (run >= QUIET_RUN) after.push(d.amount);
    run = 0;
  });
  if (after.length < REVENGE_MIN_TIMES) return null;
  const avgAfter = after.reduce((s, a) => s + a, 0) / after.length;
  const ratio = avgAfter / avgDay;
  if (ratio < REVENGE_RATIO) return null;
  return {
    id: "revenge",
    title: `After ${QUIET_RUN}+ quiet days, you spend ${times(ratio)} more`,
    detail: `Happened ${after.length} times lately — ${rupees(avgAfter)} on average the day you break the streak`,
    score: ratio / REVENGE_RATIO,
  };
}

function streak(monthDays, avgDay) {
  const threshold = avgDay * STREAK_SHARE;
  let best = { len: 0 };
  let start = null;
  monthDays.forEach((d, i) => {
    if (d.amount > threshold) {
      if (start === null) start = i;
      const len = i - start + 1;
      if (len > best.len) best = { len, from: monthDays[start].date, to: d.date };
    } else {
      start = null;
    }
  });
  if (best.len < STREAK_MIN_DAYS) return null;
  return {
    id: "streak",
    title: `${best.len}-day spending streak`,
    detail: `${shortDate(best.from)} – ${shortDate(best.to)}, every day above ${rupees(threshold)} (1.5× your usual day)`,
    score: best.len / STREAK_MIN_DAYS,
  };
}

function silent(monthDays, viewMonth, firstDay, totals) {
  const count = monthDays.filter((d) => d.amount === 0).length;
  if (count < SILENT_MIN_DAYS) return null;

  // Walk back to the last month that matched or beat this one; how far back
  // that is decides the bragging rights.
  let record = null;
  for (let i = 1; i <= SILENT_LOOKBACK_MONTHS; i++) {
    const m = new Date(viewMonth.getFullYear(), viewMonth.getMonth() - i, 1);
    const mEnd = new Date(m.getFullYear(), m.getMonth() + 1, 0);
    if (mEnd < firstDay) {
      if (i > 1) record = "your most since you started logging";
      break;
    }
    const zeros = daysBetween(m < firstDay ? firstDay : m, mEnd, totals).filter((d) => d.amount === 0);
    if (zeros.length >= count) {
      if (i > 1) record = `your most since ${m.toLocaleDateString("en-IN", { month: "long" })}`;
      break;
    }
    if (i === SILENT_LOOKBACK_MONTHS) record = "your most in a year";
  }

  return {
    id: "silent",
    title: `${count} silent days`,
    detail: record ? `Days you spent nothing — ${record}` : "Days you spent nothing this month",
    score: record ? 1.4 : 0.8,
  };
}

const EMPTY = { items: [], from: null, to: null };

export function behaviourInsights(expenses, uid, viewMonth) {
  if (!uid || expenses.length === 0) return EMPTY;

  const totals = {};
  let firstKey = null;
  expenses.forEach((x) => {
    if (!x.date) return;
    totals[x.date] = (totals[x.date] || 0) + myShare(x, uid);
    if (!firstKey || x.date < firstKey) firstKey = x.date;
  });
  if (!firstKey) return EMPTY;

  const today = new Date(todayStr() + "T00:00:00");
  const firstDay = new Date(firstKey + "T00:00:00");
  const monthStart = viewMonth;
  const monthLast = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0);
  const end = monthLast < today ? monthLast : today;
  if (end < firstDay || monthStart > today) return EMPTY;

  const windowStart = shiftDay(end, -(WINDOW_DAYS - 1));
  const windowDays = daysBetween(windowStart < firstDay ? firstDay : windowStart, end, totals);
  const monthDays = daysBetween(monthStart < firstDay ? firstDay : monthStart, end, totals);
  const avgDay = avg(windowDays);
  const enoughHistory = windowDays.length >= MIN_WINDOW_DAYS && avgDay > 0;

  const monthOnly = (x) => x && { ...x, month: viewMonth };
  const items = [
    enoughHistory && payday(windowDays),
    enoughHistory && weekend(windowDays),
    enoughHistory && revenge(windowDays, avgDay),
    avgDay > 0 && monthOnly(streak(monthDays, avgDay)),
    monthOnly(silent(monthDays, viewMonth, firstDay, totals)),
  ]
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);

  return { items, from: windowDays[0].date, to: end };
}
