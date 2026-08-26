"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
} from "firebase/firestore";
import { db, firebaseReady } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const CATEGORIES = [
  { key: "food", label: "Food", color: "#B87A16" },
  { key: "transport", label: "Transport", color: "#3E7CB1" },
  { key: "shopping", label: "Shopping", color: "#8B5FBF" },
  { key: "bills", label: "Bills", color: "#B04A3F" },
  { key: "health", label: "Health", color: "#2F7D5A" },
  { key: "fun", label: "Entertainment", color: "#C15B8C" },
  { key: "other", label: "Other", color: "#6B6F63" },
];
const CATEGORY_BY_KEY = Object.fromEntries(CATEGORIES.map((c) => [c.key, c]));

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

  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("food");
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

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 3200);
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
      setCategory("food");
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

            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  className="chip"
                  style={{ "--chip-color": c.color }}
                  data-active={category === c.key}
                  onClick={() => setCategory(c.key)}
                >
                  <span className="dot" style={{ background: c.color }} />
                  {c.label}
                </button>
              ))}
            </div>

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

          <div className="mb-4 flex flex-wrap items-baseline gap-2.5">
            <span className="font-mono text-[2.05rem] font-semibold tabular-nums leading-none">
              {fmt(total)}
            </span>
            {deltaPct !== null && deltaPct !== 0 && (
              <span className={`delta-pill ${deltaPct > 0 ? "bad" : "good"}`}>
                {deltaPct > 0 ? "▲" : "▼"} {Math.abs(deltaPct)}% vs last month
              </span>
            )}
          </div>

          {categoryTotals.length === 0 ? (
            <p className="py-1 text-center text-sm text-muted-foreground">
              No spending yet this month.
            </p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {categoryTotals.map((e) => {
                const meta = CATEGORY_BY_KEY[e.key] || CATEGORY_BY_KEY.other;
                const pct = Math.max(6, Math.round((e.amount / maxCategoryAmount) * 100));
                return (
                  <div className="cat-row" key={e.key}>
                    <span className="dot" style={{ background: meta.color }} />
                    <span className="name">{meta.label}</span>
                    <span className="bar-track">
                      <span
                        className="bar-fill"
                        style={{ width: pct + "%", background: meta.color }}
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
                  const meta = CATEGORY_BY_KEY[x.category] || CATEGORY_BY_KEY.other;
                  return (
                    <div className="expense-row" key={x.id}>
                      <span className="dot" style={{ background: meta.color }} />
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

      <div className={`toast ${toast ? "show" : ""}`}>{toast}</div>
    </div>
  );
}
