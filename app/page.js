"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  setDoc,
} from "firebase/firestore";
import { db, firebaseReady } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pencil } from "lucide-react";

// Slot order/hues are a validated categorical palette (see the dataviz skill's
// reference palette) — CVD-safe adjacent pairs in both light and dark, wired to
// --series-1..8 in globals.css. Never invent a 9th hue; reuse a slot instead.
const DEFAULT_CATEGORIES = [
  { key: "food", label: "Food", colorSlot: 2 },
  { key: "transport", label: "Transport", colorSlot: 1 },
  { key: "shopping", label: "Shopping", colorSlot: 7 },
  { key: "bills", label: "Bills", colorSlot: 8 },
  { key: "health", label: "Health", colorSlot: 6 },
  { key: "fun", label: "Entertainment", colorSlot: 5 },
  { key: "other", label: "Other", colorSlot: 3 },
];
const SWATCHES = [1, 2, 3, 4, 5, 6, 7, 8];
const UNKNOWN_CATEGORY = { label: "Uncategorized" };

function categoryColor(c) {
  if (!c) return "var(--muted-foreground)";
  if (c.colorSlot) return `var(--series-${c.colorSlot})`;
  if (c.color) return c.color; // legacy categories saved before the validated palette
  return "var(--muted-foreground)";
}

function uid() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Date.now() + "-" + Math.random().toString(16).slice(2);
}

function daysInMonth(d) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

function todayStr() {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d - tz).toISOString().slice(0, 10);
}

function fmt(n) {
  return "₹" + Number(n).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function monthKey(d) {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
}

function shiftMonth(d, delta) {
  return new Date(d.getFullYear(), d.getMonth() + delta, 1);
}

function formatDateHeading(dateStr) {
  const today = todayStr();
  const y = new Date();
  y.setDate(y.getDate() - 1);
  const tz = y.getTimezoneOffset() * 60000;
  const yest = new Date(y - tz).toISOString().slice(0, 10);
  if (dateStr === today) return "Today";
  if (dateStr === yest) return "Yesterday";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export default function Home() {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const [view, setView] = useState("ledger");

  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [editingCategories, setEditingCategories] = useState(false);
  const [categoryDraft, setCategoryDraft] = useState([]);
  const [newCatLabel, setNewCatLabel] = useState("");
  const [newCatColor, setNewCatColor] = useState(SWATCHES[0]);
  const [colorPickerFor, setColorPickerFor] = useState(null);

  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(DEFAULT_CATEGORIES[0].key);
  const [date, setDate] = useState(todayStr());
  const [note, setNote] = useState("");

  const [confirmId, setConfirmId] = useState(null);
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (!firebaseReady || !db) {
      setLoading(false);
      return;
    }
    const unsub = onSnapshot(
      collection(db, "expenses"),
      (snap) => {
        setExpenses(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      () => {
        showToast("Couldn't reach the database. Check your connection.");
        setLoading(false);
      }
    );
    return unsub;
  }, []);

  useEffect(() => {
    if (!firebaseReady || !db) return;
    const unsub = onSnapshot(doc(db, "meta", "categories"), (snap) => {
      const data = snap.data();
      setCategories(
        data && Array.isArray(data.items) && data.items.length
          ? data.items
          : DEFAULT_CATEGORIES
      );
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (categories.length && !categories.some((c) => c.key === category)) {
      setCategory(categories[0].key);
    }
  }, [categories, category]);

  const categoryByKey = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.key, c])),
    [categories]
  );

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 3200);
  }

  function openCategoryEditor() {
    // Normalize legacy hex-based categories onto the validated slot palette
    // the moment the editor is opened, so a plain Save migrates them.
    setCategoryDraft(
      categories.map((c, i) => ({
        key: c.key,
        label: c.label,
        colorSlot: c.colorSlot || ((i % 8) + 1),
      }))
    );
    setNewCatLabel("");
    setNewCatColor(SWATCHES[0]);
    setColorPickerFor(null);
    setEditingCategories(true);
  }

  function updateDraftLabel(key, label) {
    setCategoryDraft((list) => list.map((c) => (c.key === key ? { ...c, label } : c)));
  }

  function updateDraftColor(key, colorSlot) {
    setCategoryDraft((list) => list.map((c) => (c.key === key ? { ...c, colorSlot } : c)));
  }

  function removeDraftCategory(key) {
    setCategoryDraft((list) => (list.length <= 1 ? list : list.filter((c) => c.key !== key)));
  }

  function addDraftCategory() {
    const label = newCatLabel.trim();
    if (!label) return;
    setCategoryDraft((list) => [...list, { key: uid(), label, colorSlot: newCatColor }]);
    setNewCatLabel("");
  }

  async function saveCategoryEditor() {
    const cleaned = categoryDraft
      .map((c) => ({ ...c, label: c.label.trim() }))
      .filter((c) => c.label);
    if (cleaned.length === 0) {
      showToast("Keep at least one category.");
      return;
    }
    try {
      await setDoc(doc(db, "meta", "categories"), { items: cleaned });
      setEditingCategories(false);
    } catch {
      showToast("Couldn't save categories. Please try again.");
    }
  }

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

  const total = currentMonthExpenses.reduce((s, x) => s + x.amount, 0);
  const priorTotal = priorMonthExpenses.reduce((s, x) => s + x.amount, 0);
  const deltaPct =
    priorTotal > 0 && total > 0 ? Math.round(((total - priorTotal) / priorTotal) * 100) : null;

  const categoryTotals = useMemo(() => {
    const byCat = {};
    currentMonthExpenses.forEach((x) => {
      byCat[x.category] = (byCat[x.category] || 0) + x.amount;
    });
    return Object.entries(byCat)
      .map(([key, amount]) => ({ key, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [currentMonthExpenses]);
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
      if (day >= 1 && day <= nDays) totals[day] += x.amount;
    });
    return Array.from({ length: nDays }, (_, i) => ({ day: i + 1, amount: totals[i + 1] }));
  }, [currentMonthExpenses, viewMonth]);
  const maxDaily = Math.max(1, ...dailySeries.map((d) => d.amount));

  const sixMonthSeries = useMemo(() => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const m = shiftMonth(viewMonth, -i);
      const key = monthKey(m);
      const amount = expenses
        .filter((x) => x.date && x.date.slice(0, 7) === key)
        .reduce((s, x) => s + x.amount, 0);
      months.push({
        key,
        label: m.toLocaleDateString("en-IN", { month: "short" }),
        amount,
        isCurrent: i === 0,
      });
    }
    return months;
  }, [expenses, viewMonth]);
  const maxSixMonth = Math.max(1, ...sixMonthSeries.map((m) => m.amount));

  function fmtDayLabel(day) {
    const d = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day);
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!amt || amt <= 0 || !db) return;
    try {
      await addDoc(collection(db, "expenses"), {
        amount: Math.round(amt * 100) / 100,
        category,
        date: date || todayStr(),
        note: note.trim(),
        createdAt: Date.now(),
      });
      setAmount("");
      setNote("");
      setDate(todayStr());
      setCategory(categories[0]?.key || "");
    } catch {
      showToast("Couldn't save that expense. Please try again.");
    }
  }

  async function handleDelete(id) {
    if (!db) return;
    if (confirmId === id) {
      setConfirmId(null);
      try {
        await deleteDoc(doc(db, "expenses", id));
      } catch {
        showToast("Couldn't delete that expense. Please try again.");
      }
    } else {
      setConfirmId(id);
      setTimeout(() => setConfirmId((c) => (c === id ? null : c)), 2500);
    }
  }

  if (!firebaseReady) {
    return (
      <div className="mx-auto flex min-h-svh w-full max-w-[560px] flex-col justify-center gap-4 px-5 py-10">
        <Card>
          <CardContent className="flex flex-col gap-3">
            <h1 className="font-heading text-xl font-semibold">
              Almost there — connect a database
            </h1>
            <p className="text-sm text-muted-foreground">
              Pocket Ledger needs a free Firebase project to store your
              expenses. Create one, then add its config values to{" "}
              <code className="rounded bg-secondary px-1.5 py-0.5 font-mono text-xs">
                .env.local
              </code>{" "}
              (see <code className="rounded bg-secondary px-1.5 py-0.5 font-mono text-xs">README.md</code>{" "}
              in the project) and restart the app.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col gap-4 px-4 pb-20 pt-7 sm:px-5">
      <header className="flex items-baseline justify-between gap-3 px-0.5">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Pocket Ledger
        </h1>
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          every rupee, logged
        </span>
      </header>

      <div className="tabs self-start">
        <button
          type="button"
          className="tab-btn"
          data-active={view === "ledger"}
          onClick={() => setView("ledger")}
        >
          Ledger
        </button>
        <button
          type="button"
          className="tab-btn"
          data-active={view === "insights"}
          onClick={() => setView("insights")}
        >
          Insights
        </button>
      </div>

      {view === "ledger" && (
      <>
      <Card>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
            <div className="flex items-stretch gap-2.5">
              <div className="amount-field flex-1">
                <span className="currency">₹</span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <Input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-[136px] shrink-0 !h-auto rounded-[calc(var(--radius)-2px)] border-input bg-secondary px-3 py-2.5 text-sm text-muted-foreground"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {categories.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  className="chip"
                  style={{ "--chip-color": categoryColor(c) }}
                  data-active={category === c.key}
                  onClick={() => setCategory(c.key)}
                >
                  <span className="dot" style={{ background: categoryColor(c) }} />
                  {c.label}
                </button>
              ))}
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Edit categories"
                onClick={openCategoryEditor}
              >
                <Pencil />
              </Button>
            </div>

            {editingCategories && (
              <div className="flex flex-col gap-3 rounded-[calc(var(--radius)-2px)] border border-border bg-secondary/60 p-3">
                <p className="text-xs font-medium text-muted-foreground">
                  Manage categories
                </p>
                <div className="flex flex-col gap-2">
                  {categoryDraft.map((c) => (
                    <div key={c.key} className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ background: categoryColor(c) }}
                          aria-label={`Change color for ${c.label}`}
                          onClick={() =>
                            setColorPickerFor((k) => (k === c.key ? null : c.key))
                          }
                        />
                        <input
                          type="text"
                          value={c.label}
                          maxLength={24}
                          onChange={(e) => updateDraftLabel(c.key, e.target.value)}
                          className="h-8 flex-1 rounded-md border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring"
                        />
                        <button
                          type="button"
                          className="del-btn"
                          aria-label={`Remove ${c.label}`}
                          disabled={categoryDraft.length <= 1}
                          onClick={() => removeDraftCategory(c.key)}
                        >
                          ×
                        </button>
                      </div>
                      {colorPickerFor === c.key && (
                        <div className="swatch-picker pl-[18px]">
                          {SWATCHES.map((slot) => (
                            <button
                              key={slot}
                              type="button"
                              className="swatch-btn"
                              style={{ "--sw-color": `var(--series-${slot})` }}
                              data-active={c.colorSlot === slot}
                              aria-label={`Pick color ${slot}`}
                              onClick={() => {
                                updateDraftColor(c.key, slot);
                                setColorPickerFor(null);
                              }}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-2 pt-0.5">
                  <span className="text-xs text-muted-foreground">New:</span>
                  <div className="swatch-picker">
                    {SWATCHES.map((slot) => (
                      <button
                        key={slot}
                        type="button"
                        aria-label={`Pick color ${slot}`}
                        onClick={() => setNewCatColor(slot)}
                        className="swatch-btn"
                        style={{ "--sw-color": `var(--series-${slot})` }}
                        data-active={newCatColor === slot}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newCatLabel}
                    maxLength={24}
                    placeholder="New category"
                    onChange={(e) => setNewCatLabel(e.target.value)}
                    className="h-8 flex-1 rounded-md border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring"
                  />
                  <Button type="button" size="sm" variant="secondary" onClick={addDraftCategory}>
                    Add
                  </Button>
                </div>

                <div className="flex justify-end gap-2 pt-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingCategories(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="button" size="sm" onClick={saveCategoryEditor}>
                    Save
                  </Button>
                </div>
              </div>
            )}

            <Label htmlFor="note" className="sr-only">
              Note
            </Label>
            <Input
              id="note"
              type="text"
              placeholder="Add a note (optional)"
              maxLength={80}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="!h-auto rounded-[calc(var(--radius)-2px)] border-input bg-secondary px-3.5 py-2.5 text-sm"
            />

            <Button type="submit" className="h-auto py-3 text-sm font-semibold">
              Add expense
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <div className="mb-3.5 flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Previous month"
              onClick={() => setViewMonth((m) => shiftMonth(m, -1))}
            >
              ‹
            </Button>
            <span className="font-heading text-base font-semibold">
              {viewMonth.toLocaleDateString("en-IN", {
                month: "long",
                year: "numeric",
              })}
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Next month"
              onClick={() => setViewMonth((m) => shiftMonth(m, 1))}
            >
              ›
            </Button>
          </div>

          <div className="flex flex-wrap items-baseline gap-2.5">
            <span className="font-mono text-[2.05rem] font-semibold tabular-nums leading-none">
              {fmt(total)}
            </span>
            {deltaPct !== null && deltaPct !== 0 && (
              <span className={`delta-pill ${deltaPct > 0 ? "bad" : "good"}`}>
                {deltaPct > 0 ? "▲" : "▼"} {Math.abs(deltaPct)}% vs last month
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-1">
        {loading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
        ) : groupedList.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No expenses logged in{" "}
            {viewMonth.toLocaleDateString("en-IN", { month: "long" })} yet.
          </p>
        ) : (
          groupedList.map((group) => (
            <div key={group.date}>
              <div className="px-1 pb-1.5 pt-3.5 text-[0.72rem] uppercase tracking-wider text-muted-foreground/80 first:pt-1">
                {formatDateHeading(group.date)}
              </div>
              <div className="flex flex-col gap-1.5">
                {group.items.map((x) => {
                  const meta = categoryByKey[x.category] || UNKNOWN_CATEGORY;
                  return (
                    <div className="expense-row" key={x.id}>
                      <span className="dot" style={{ background: categoryColor(meta) }} />
                      <span className="min-w-0 flex-1">
                        <div className="text-sm font-medium">{meta.label}</div>
                        {x.note && (
                          <div className="truncate text-xs text-muted-foreground/80">
                            {x.note}
                          </div>
                        )}
                      </span>
                      <span className="amt">{fmt(x.amount)}</span>
                      <button
                        type="button"
                        className="del-btn"
                        data-confirm={confirmId === x.id}
                        aria-label="Delete expense"
                        onClick={() => handleDelete(x.id)}
                      >
                        {confirmId === x.id ? "Confirm" : "×"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
      </>
      )}

      {view === "insights" && (
        <>
          <Card>
            <CardContent>
              <div className="mb-3.5 flex items-center justify-between">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Previous month"
                  onClick={() => setViewMonth((m) => shiftMonth(m, -1))}
                >
                  ‹
                </Button>
                <span className="font-heading text-base font-semibold">
                  {viewMonth.toLocaleDateString("en-IN", {
                    month: "long",
                    year: "numeric",
                  })}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Next month"
                  onClick={() => setViewMonth((m) => shiftMonth(m, 1))}
                >
                  ›
                </Button>
              </div>

              <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Category breakdown
              </p>
              {categoryTotals.length === 0 ? (
                <p className="py-1 text-center text-sm text-muted-foreground">
                  No spending yet this month.
                </p>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {categoryTotals.map((e) => {
                    const meta = categoryByKey[e.key] || UNKNOWN_CATEGORY;
                    const pct = Math.max(6, Math.round((e.amount / maxCategoryAmount) * 100));
                    return (
                      <div className="cat-row" key={e.key}>
                        <span className="dot" style={{ background: categoryColor(meta) }} />
                        <span className="name">{meta.label}</span>
                        <span className="bar-track">
                          <span
                            className="bar-fill"
                            style={{ width: pct + "%", background: categoryColor(meta) }}
                          />
                        </span>
                        <span className="amt">{fmt(e.amount)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <div className="mb-3 flex items-baseline justify-between">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Daily spend —{" "}
                  {viewMonth.toLocaleDateString("en-IN", { month: "long" })}
                </p>
                <span className="font-mono text-sm font-semibold tabular-nums">
                  {fmt(total)}
                </span>
              </div>
              {dailySeries.every((d) => d.amount === 0) ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No spending yet this month.
                </p>
              ) : (
                <div
                  className="viz-bars"
                  role="img"
                  aria-label={`Daily spending for ${viewMonth.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}`}
                >
                  {dailySeries.map((d) => (
                    <div className="viz-bar-col" key={d.day}>
                      <button
                        type="button"
                        className="viz-bar-hit"
                        style={{
                          "--bar-h": Math.max(2, Math.round((d.amount / maxDaily) * 100)) + "%",
                          "--bar-color": "var(--series-1)",
                        }}
                        aria-label={`${fmtDayLabel(d.day)}: ${fmt(d.amount)}`}
                      >
                        <span className="viz-bar-fill" />
                        <span className="viz-tooltip">
                          {fmtDayLabel(d.day)} · {fmt(d.amount)}
                        </span>
                      </button>
                      {(d.day === 1 ||
                        d.day === dailySeries.length ||
                        (d.day % 5 === 0 && d.day <= dailySeries.length - 2)) && (
                        <span className="viz-bar-tick">{d.day}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Last 6 months
              </p>
              <div
                className="viz-bars"
                style={{ height: "150px" }}
                role="img"
                aria-label="Total spending, last 6 months"
              >
                {sixMonthSeries.map((m) => (
                  <div className="viz-bar-col" key={m.key}>
                    <button
                      type="button"
                      className="viz-bar-hit"
                      style={{
                        "--bar-h": Math.max(2, Math.round((m.amount / maxSixMonth) * 100)) + "%",
                        "--bar-color": m.isCurrent ? "var(--primary)" : "var(--muted-foreground)",
                      }}
                      aria-label={`${m.label}: ${fmt(m.amount)}`}
                    >
                      <span className="viz-bar-fill" style={{ maxWidth: "34px" }} />
                      <span className="viz-tooltip">
                        {m.label} · {fmt(m.amount)}
                      </span>
                    </button>
                    <span className="viz-bar-tick">{m.label}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <div className={`toast ${toast ? "show" : ""}`}>{toast}</div>
    </div>
  );
}
