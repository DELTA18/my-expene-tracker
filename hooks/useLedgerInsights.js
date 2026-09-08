import { useMemo } from "react";
import { dateKey, daysInMonth, monthKey, myShare, shiftMonth } from "@/lib/expense-utils";

export function useLedgerInsights(expenses, settlements, user, viewMonth, viewDay, peopleProfiles) {
  const currentMonthExpenses = useMemo(
    () => expenses.filter((x) => x.date && x.date.slice(0, 7) === monthKey(viewMonth)),
    [expenses, viewMonth]
  );
  const priorMonthExpenses = useMemo(
    () =>
      expenses.filter(
        (x) => x.date && x.date.slice(0, 7) === monthKey(shiftMonth(viewMonth, -1))
      ),
    [expenses, viewMonth]
  );

  const total = currentMonthExpenses.reduce((s, x) => s + myShare(x, user?.uid), 0);
  const priorTotal = priorMonthExpenses.reduce((s, x) => s + myShare(x, user?.uid), 0);
  const deltaPct =
    priorTotal > 0 && total > 0 ? Math.round(((total - priorTotal) / priorTotal) * 100) : null;

  // Bucketed by the snapshotted label, not the raw category key — a shared
  // expense someone else created carries a category key from their own
  // list, which is meaningless (or worse, coincidentally collides) against
  // your own categories. The label snapshot is the only thing guaranteed
  // to mean the same thing regardless of who logged it.
  const categoryTotals = useMemo(() => {
    const byLabel = {};
    currentMonthExpenses.forEach((x) => {
      const label = x.categoryLabel || "Uncategorized";
      if (!byLabel[label]) byLabel[label] = { label, colorSlot: x.categoryColorSlot, amount: 0 };
      byLabel[label].amount += myShare(x, user?.uid);
    });
    return Object.values(byLabel).sort((a, b) => b.amount - a.amount);
  }, [currentMonthExpenses, user]);
  const maxCategoryAmount = categoryTotals[0]?.amount || 1;

  const groupedList = useMemo(() => {
    const sorted = [...currentMonthExpenses].sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
    const groups = [];
    let lastDate = null;
    sorted.forEach((x) => {
      if (x.date !== lastDate) {
        lastDate = x.date;
        groups.push({ date: x.date, items: [] });
      }
      groups[groups.length - 1].items.push(x);
    });
    return groups;
  }, [currentMonthExpenses]);

  const dailySeries = useMemo(() => {
    const nDays = daysInMonth(viewMonth);
    const totals = new Array(nDays + 1).fill(0);
    currentMonthExpenses.forEach((x) => {
      const day = parseInt(x.date.slice(8, 10), 10);
      if (day >= 1 && day <= nDays) totals[day] += myShare(x, user?.uid);
    });
    return Array.from({ length: nDays }, (_, i) => ({ day: i + 1, amount: totals[i + 1] }));
  }, [currentMonthExpenses, viewMonth, user]);
  const maxDaily = Math.max(1, ...dailySeries.map((d) => d.amount));

  const dayTotal = useMemo(() => {
    const key = dateKey(viewDay);
    return expenses
      .filter((x) => x.date === key)
      .reduce((s, x) => s + myShare(x, user?.uid), 0);
  }, [expenses, viewDay, user]);

  const sixMonthSeries = useMemo(() => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const m = shiftMonth(viewMonth, -i);
      const key = monthKey(m);
      const amount = expenses
        .filter((x) => x.date && x.date.slice(0, 7) === key)
        .reduce((s, x) => s + myShare(x, user?.uid), 0);
      months.push({
        key,
        label: m.toLocaleDateString("en-IN", { month: "short" }),
        amount,
        isCurrent: i === 0,
      });
    }
    return months;
  }, [expenses, viewMonth, user]);
  const maxSixMonth = Math.max(1, ...sixMonthSeries.map((m) => m.amount));

  // Net balance per person: positive = they owe you, negative = you owe
  // them. Always derived from raw expenses/settlements, never stored, so it
  // can't drift out of sync with the records it's summarizing.
  // Balances are always pairwise, even for a group expense: whoever paid is
  // owed by every other participant individually, and a non-payer only owes
  // the payer their own share — there's no 3-way netting, same as Splitwise.
  const balances = useMemo(() => {
    if (!user) return [];
    const net = {};
    expenses.forEach((x) => {
      if (!x.participants || x.participants.length < 2) return;
      if (x.payer === user.uid) {
        x.participants.forEach((p) => {
          if (p === user.uid) return;
          net[p] = (net[p] || 0) + (x.splits?.[p] || 0);
        });
      } else {
        net[x.payer] = (net[x.payer] || 0) - (x.splits?.[user.uid] || 0);
      }
    });
    settlements.forEach((s) => {
      const other = s.from === user.uid ? s.to : s.to === user.uid ? s.from : null;
      if (!other) return;
      net[other] = (net[other] || 0) + (s.from === user.uid ? s.amount : -s.amount);
    });
    return Object.entries(net)
      .map(([uid, amount]) => ({ uid, amount: Math.round(amount * 100) / 100 }))
      .filter((b) => Math.abs(b.amount) >= 0.01)
      .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
  }, [expenses, settlements, user]);

  // Everyone you've ever split an expense with, most recent first — a
  // one-click alternative to typing their email again. Only the profile
  // cache already built for rendering the ledger/balances is needed here;
  // no new data source.
  const recentPeople = useMemo(() => {
    if (!user) return [];
    const seen = new Map();
    [...expenses]
      .filter((x) => x.participants && x.participants.length > 1)
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      .forEach((x) => {
        x.participants.forEach((p) => {
          if (p !== user.uid && !seen.has(p)) seen.set(p, peopleProfiles[p]);
        });
      });
    return [...seen.entries()]
      .filter(([, p]) => p)
      .map(([uid, p]) => ({ uid, username: p.username, photoURL: p.photoURL }));
  }, [expenses, peopleProfiles, user]);

  return {
    currentMonthExpenses,
    total,
    deltaPct,
    categoryTotals,
    maxCategoryAmount,
    groupedList,
    dailySeries,
    maxDaily,
    dayTotal,
    sixMonthSeries,
    maxSixMonth,
    balances,
    recentPeople,
  };
}
