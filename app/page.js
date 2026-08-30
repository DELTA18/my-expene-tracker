"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { auth, db, firebaseReady, googleProvider } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pencil, TriangleAlert } from "lucide-react";

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

// One-time move from the old per-user expense subcollection onto the flat,
// splittable /expenses collection every account now reads from. A personal
// expense becomes the one-participant case of the same shape: payer,
// createdBy and the sole participant are all this uid, and its whole amount
// is its own "split". Category label/color are snapshotted at migration time
// so the record renders correctly even if the category is later renamed —
// the same reason a freshly-created shared expense snapshots them too.
// Idempotent (checks a marker doc first), safe to run on every login.
async function migrateToUnifiedExpenses(uid) {
  const migratedRef = doc(db, "users", uid, "meta", "migratedToUnified");
  const migratedSnap = await getDoc(migratedRef);
  if (migratedSnap.exists()) return;

  const [expensesSnap, catSnap] = await Promise.all([
    getDocs(collection(db, "users", uid, "expenses")),
    getDoc(doc(db, "users", uid, "meta", "categories")),
  ]);

  if (expensesSnap.empty) {
    await setDoc(migratedRef, { done: true, at: Date.now() });
    return;
  }

  const categoryByKey = Object.fromEntries(
    (catSnap.exists() && catSnap.data().items ? catSnap.data().items : DEFAULT_CATEGORIES).map(
      (c) => [c.key, c]
    )
  );

  const batch = writeBatch(db);
  expensesSnap.docs.forEach((d) => {
    const data = d.data();
    const meta = categoryByKey[data.category];
    batch.set(doc(db, "expenses", d.id), {
      ...data,
      payer: uid,
      createdBy: uid,
      participants: [uid],
      splits: { [uid]: data.amount },
      categoryLabel: meta?.label || "Uncategorized",
      categoryColorSlot: meta?.colorSlot || null,
    });
    batch.delete(d.ref);
  });
  batch.set(migratedRef, { done: true, at: Date.now() });
  await batch.commit();
}

// Splits a total into two shares that always sum back to it exactly (the
// second share absorbs any odd paisa left over from rounding the first).
function equalSplit(total) {
  const a = Math.round((total / 2) * 100) / 100;
  const b = Math.round((total - a) * 100) / 100;
  return [a, b];
}

// A viewer's own cost for an expense — their split if one exists, otherwise
// the full amount (defensive fallback only; every expense written by this
// app always has splits).
function myShare(expense, uid) {
  return expense.splits && typeof expense.splits[uid] === "number"
    ? expense.splits[uid]
    : expense.amount;
}

function authErrorMessage(err) {
  switch (err?.code) {
    case "auth/unauthorized-domain":
      return "This site isn't authorized for sign-in yet — add it under Firebase Console → Authentication → Settings → Authorized domains.";
    case "auth/operation-not-allowed":
      return "Google sign-in isn't enabled yet — turn it on under Firebase Console → Authentication → Sign-in method.";
    case "auth/network-request-failed":
      return "Sign-in failed — check your connection and try again.";
    case "auth/popup-blocked":
      return "Your browser blocked the sign-in popup. Allow popups for this site and try again.";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "";
    default:
      return "Couldn't sign in. Please try again.";
  }
}

function GoogleIcon(props) {
  return (
    <svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true" {...props}>
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.56 2.7-3.86 2.7-6.62z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.9v2.33A9 9 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.95 10.7A5.4 5.4 0 0 1 3.66 9c0-.59.1-1.17.29-1.7V4.97H.9A9 9 0 0 0 0 9c0 1.45.35 2.83.9 4.03z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .9 4.97L3.95 7.3C4.66 5.17 6.65 3.58 9 3.58z"
      />
    </svg>
  );
}

export default function Home() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState("");

  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileNameDraft, setProfileNameDraft] = useState("");
  const [profileUsePhoto, setProfileUsePhoto] = useState(true);
  const [peopleProfiles, setPeopleProfiles] = useState({});

  const [expenses, setExpenses] = useState([]);
  const [settlements, setSettlements] = useState([]);
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

  const [splitEnabled, setSplitEnabled] = useState(false);
  const [splitEmail, setSplitEmail] = useState("");
  const [splitLookup, setSplitLookup] = useState(null); // "checking" | "not-found" | {uid, username, photoURL}
  const [splitPayer, setSplitPayer] = useState("me"); // "me" | "them"
  const [splitMethod, setSplitMethod] = useState("equal"); // "equal" | "custom"
  const [splitMine, setSplitMine] = useState("");
  const [splitTheirs, setSplitTheirs] = useState("");

  const [confirmId, setConfirmId] = useState(null);
  const [toast, setToast] = useState("");

  const [budget, setBudget] = useState(null);
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetDraft, setBudgetDraft] = useState("");

  const [settlingUid, setSettlingUid] = useState(null);
  const [settleDraft, setSettleDraft] = useState("");

  useEffect(() => {
    if (!firebaseReady || !auth) {
      setAuthLoading(false);
      return;
    }
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!user) return;
    migrateToUnifiedExpenses(user.uid).catch(() => {
      showToast("Couldn't move your old data over. It's still safe — try reloading.");
    });
  }, [user]);

  useEffect(() => {
    if (!firebaseReady || !db || !user) {
      setProfileLoading(false);
      return;
    }
    const unsub = onSnapshot(doc(db, "profiles", user.uid), (snap) => {
      setProfile(snap.exists() ? snap.data() : null);
      setProfileLoading(false);
    });
    return unsub;
  }, [user]);

  useEffect(() => {
    if (!firebaseReady || !db || !user) {
      setLoading(false);
      return;
    }
    const unsub = onSnapshot(
      query(collection(db, "expenses"), where("participants", "array-contains", user.uid)),
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
  }, [user]);

  useEffect(() => {
    if (!firebaseReady || !db || !user) return;
    const unsub = onSnapshot(
      query(collection(db, "settlements"), where("participants", "array-contains", user.uid)),
      (snap) => {
        setSettlements(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      }
    );
    return unsub;
  }, [user]);

  // Resolve display name/photo for anyone else who shows up as a co-
  // participant, one lookup per uid (not a live listener — a stale name
  // until the next new shared expense/settlement is an acceptable tradeoff
  // for not running N permanent listeners for people you split with).
  useEffect(() => {
    if (!firebaseReady || !db || !user) return;
    const otherUids = new Set();
    expenses.forEach((x) => (x.participants || []).forEach((p) => p !== user.uid && otherUids.add(p)));
    settlements.forEach((s) => {
      if (s.from !== user.uid) otherUids.add(s.from);
      if (s.to !== user.uid) otherUids.add(s.to);
    });
    const missing = [...otherUids].filter((uid) => !(uid in peopleProfiles));
    if (!missing.length) return;
    Promise.all(
      missing.map((uid) =>
        getDoc(doc(db, "profiles", uid)).then((snap) => [uid, snap.exists() ? snap.data() : null])
      )
    ).then((pairs) => {
      // Record every lookup, including misses (as null), so a uid with no
      // profile doc isn't refetched on every render — that key existing at
      // all (even set to null) is what "already checked" means here.
      setPeopleProfiles((prev) => {
        const next = { ...prev };
        pairs.forEach(([uid, data]) => {
          next[uid] = data;
        });
        return next;
      });
    });
  }, [expenses, settlements, user, peopleProfiles]);

  useEffect(() => {
    if (!firebaseReady || !db || !user) return;
    const unsub = onSnapshot(doc(db, "users", user.uid, "meta", "categories"), (snap) => {
      const data = snap.data();
      setCategories(
        data && Array.isArray(data.items) && data.items.length
          ? data.items
          : DEFAULT_CATEGORIES
      );
    });
    return unsub;
  }, [user]);

  useEffect(() => {
    if (!firebaseReady || !db || !user) return;
    const unsub = onSnapshot(doc(db, "users", user.uid, "meta", "budget"), (snap) => {
      const data = snap.data();
      setBudget(typeof data?.amount === "number" ? data.amount : null);
    });
    return unsub;
  }, [user]);

  async function handleSignIn() {
    if (!auth) return;
    setAuthError("");
    try {
      // Popup, not redirect — our authDomain (*.firebaseapp.com) is a
      // different origin than where this app is hosted, and browsers now
      // block the third-party storage handoff signInWithRedirect needs
      // between those two domains. Popup avoids that relay entirely.
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const msg = authErrorMessage(err);
      if (msg) setAuthError(msg);
    }
  }

  async function handleSignOut() {
    if (!auth) return;
    try {
      await signOut(auth);
    } catch {
      showToast("Couldn't sign out. Please try again.");
    }
  }

  useEffect(() => {
    if (user && !profileLoading && !profile) {
      setProfileNameDraft((v) => v || user.displayName || "");
    }
  }, [user, profileLoading, profile]);

  async function saveProfile(e) {
    e.preventDefault();
    const username = profileNameDraft.trim();
    if (!username || !user) return;
    const photoURL = profileUsePhoto ? user.photoURL || null : null;
    try {
      await setDoc(doc(db, "profiles", user.uid), { username, photoURL });
      if (user.email) {
        await setDoc(doc(db, "directory", user.email.toLowerCase()), { uid: user.uid });
      }
    } catch {
      showToast("Couldn't save your profile. Please try again.");
    }
  }

  async function resolveSplitEmail(rawEmail) {
    const email = rawEmail.trim().toLowerCase();
    if (!email) {
      setSplitLookup(null);
      return;
    }
    if (user?.email && email === user.email.toLowerCase()) {
      setSplitLookup("not-found");
      return;
    }
    setSplitLookup("checking");
    try {
      const dirSnap = await getDoc(doc(db, "directory", email));
      if (!dirSnap.exists()) {
        setSplitLookup("not-found");
        return;
      }
      const otherUid = dirSnap.data().uid;
      const profSnap = await getDoc(doc(db, "profiles", otherUid));
      setSplitLookup({
        uid: otherUid,
        username: profSnap.exists() ? profSnap.data().username : "Unknown",
        photoURL: profSnap.exists() ? profSnap.data().photoURL : null,
      });
    } catch {
      setSplitLookup("not-found");
    }
  }

  function resetSplitFields() {
    setSplitEnabled(false);
    setSplitEmail("");
    setSplitLookup(null);
    setSplitPayer("me");
    setSplitMethod("equal");
    setSplitMine("");
    setSplitTheirs("");
  }

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
      await setDoc(doc(db, "users", user.uid, "meta", "categories"), { items: cleaned });
      setEditingCategories(false);
    } catch {
      showToast("Couldn't save categories. Please try again.");
    }
  }

  function openBudgetEditor() {
    setBudgetDraft(budget ? String(budget) : "");
    setEditingBudget(true);
  }

  async function saveBudget() {
    const trimmed = budgetDraft.trim();
    try {
      if (!trimmed) {
        await deleteDoc(doc(db, "users", user.uid, "meta", "budget"));
      } else {
        const amt = parseFloat(trimmed);
        if (!amt || amt <= 0) {
          showToast("Enter a budget greater than zero.");
          return;
        }
        await setDoc(doc(db, "users", user.uid, "meta", "budget"), {
          amount: Math.round(amt * 100) / 100,
        });
      }
      setEditingBudget(false);
    } catch {
      showToast("Couldn't save the budget. Please try again.");
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

  const total = currentMonthExpenses.reduce((s, x) => s + myShare(x, user?.uid), 0);
  const priorTotal = priorMonthExpenses.reduce((s, x) => s + myShare(x, user?.uid), 0);
  const deltaPct =
    priorTotal > 0 && total > 0 ? Math.round(((total - priorTotal) / priorTotal) * 100) : null;

  const budgetPct = budget ? Math.round((total / budget) * 100) : null;
  const budgetState = budgetPct === null ? null : budgetPct >= 100 ? "over" : budgetPct >= 80 ? "warning" : "good";
  const budgetFillColor =
    budgetState === "over" ? "var(--destructive)" : budgetState === "warning" ? "var(--warning)" : "var(--good)";

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
  const balances = useMemo(() => {
    if (!user) return [];
    const net = {};
    expenses.forEach((x) => {
      if (!x.participants || x.participants.length < 2) return;
      const other = x.participants.find((p) => p !== user.uid);
      if (!other) return;
      if (x.payer === user.uid) net[other] = (net[other] || 0) + (x.splits?.[other] || 0);
      else if (x.payer === other) net[other] = (net[other] || 0) - (x.splits?.[user.uid] || 0);
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

  function fmtDayLabel(day) {
    const d = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day);
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const amt = Math.round(parseFloat(amount) * 100) / 100;
    if (!amt || amt <= 0 || !db || !user) return;

    let participants = [user.uid];
    let payer = user.uid;
    let splits = { [user.uid]: amt };

    if (splitEnabled) {
      if (!splitLookup || typeof splitLookup !== "object") {
        showToast("Find who you're splitting with first.");
        return;
      }
      const otherUid = splitLookup.uid;
      payer = splitPayer === "me" ? user.uid : otherUid;
      participants = [user.uid, otherUid];
      if (splitMethod === "equal") {
        const [a, b] = equalSplit(amt);
        splits = { [user.uid]: a, [otherUid]: b };
      } else {
        const mine = Math.round(parseFloat(splitMine || "0") * 100) / 100;
        const theirs = Math.round(parseFloat(splitTheirs || "0") * 100) / 100;
        if (Math.abs(mine + theirs - amt) > 0.01) {
          showToast("The two shares need to add up to the total.");
          return;
        }
        splits = { [user.uid]: mine, [otherUid]: theirs };
      }
    }

    const meta = categoryByKey[category];
    try {
      await addDoc(collection(db, "expenses"), {
        amount: amt,
        category,
        categoryLabel: meta?.label || "Uncategorized",
        categoryColorSlot: meta?.colorSlot || null,
        date: date || todayStr(),
        note: note.trim(),
        createdAt: Date.now(),
        payer,
        createdBy: user.uid,
        participants,
        splits,
      });
      setAmount("");
      setNote("");
      setDate(todayStr());
      setCategory(categories[0]?.key || "");
      resetSplitFields();
    } catch {
      showToast("Couldn't save that expense. Please try again.");
    }
  }

  async function handleDelete(id) {
    if (!db || !user) return;
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

  async function handleSettleUp(otherUid, amt, iAmPaying) {
    if (!db || !user || !amt || amt <= 0) return;
    try {
      await addDoc(collection(db, "settlements"), {
        from: iAmPaying ? user.uid : otherUid,
        to: iAmPaying ? otherUid : user.uid,
        amount: Math.round(amt * 100) / 100,
        at: Date.now(),
        participants: [user.uid, otherUid],
        createdBy: user.uid,
      });
    } catch {
      showToast("Couldn't record that settlement. Please try again.");
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

  if (authLoading) {
    return (
      <div className="mx-auto flex min-h-svh w-full max-w-[560px] items-center justify-center px-5">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto flex min-h-svh w-full max-w-[560px] flex-col items-center justify-center gap-6 px-5 py-10 text-center">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Pocket Ledger
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">every rupee, logged</p>
        </div>
        <Card className="w-full">
          <CardContent className="flex flex-col items-center gap-4 py-8">
            <p className="text-sm text-muted-foreground">
              Sign in to see and add your own expenses.
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={handleSignIn}
              className="h-auto gap-2.5 py-3 px-5 text-sm font-semibold"
            >
              <GoogleIcon /> Continue with Google
            </Button>
            {authError && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-left text-xs text-destructive">
                {authError}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (profileLoading) {
    return (
      <div className="mx-auto flex min-h-svh w-full max-w-[560px] items-center justify-center px-5">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="mx-auto flex min-h-svh w-full max-w-[560px] flex-col items-center justify-center gap-6 px-5 py-10 text-center">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Set up your profile
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            This is what people you split expenses with will see.
          </p>
        </div>
        <Card className="w-full">
          <CardContent>
            <form onSubmit={saveProfile} className="flex flex-col gap-4 text-left">
              <div>
                <Label htmlFor="profile-name">Your name</Label>
                <Input
                  id="profile-name"
                  type="text"
                  required
                  maxLength={40}
                  placeholder="e.g. Raj"
                  value={profileNameDraft}
                  onChange={(e) => setProfileNameDraft(e.target.value)}
                  className="!h-auto mt-1.5 rounded-[calc(var(--radius)-2px)] border-input bg-secondary px-3.5 py-2.5 text-sm"
                />
              </div>
              {user.photoURL && (
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={profileUsePhoto}
                    onChange={(e) => setProfileUsePhoto(e.target.checked)}
                  />
                  Use my Google account photo
                </label>
              )}
              <Button type="submit" className="h-auto py-3 text-sm font-semibold">
                Save and continue
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col gap-4 px-4 pb-20 pt-7 sm:px-5">
      <header className="flex items-center justify-between gap-3 px-0.5">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Pocket Ledger
          </h1>
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            every rupee, logged
          </span>
        </div>
        <div className="flex items-center gap-2">
          {profile.photoURL ? (
            <img
              src={profile.photoURL}
              alt=""
              referrerPolicy="no-referrer"
              className="h-7 w-7 shrink-0 rounded-full"
            />
          ) : (
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold">
              {profile.username.slice(0, 1).toUpperCase()}
            </span>
          )}
          <Button type="button" variant="ghost" size="sm" onClick={handleSignOut}>
            Sign out
          </Button>
        </div>
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
        <button
          type="button"
          className="tab-btn"
          data-active={view === "balances"}
          onClick={() => setView("balances")}
        >
          Balances
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

            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={splitEnabled}
                  onChange={(e) => {
                    setSplitEnabled(e.target.checked);
                    if (!e.target.checked) resetSplitFields();
                  }}
                />
                Split with someone
              </label>

              {splitEnabled && (
                <div className="flex flex-col gap-3 rounded-[calc(var(--radius)-2px)] border border-border bg-secondary/60 p-3">
                  <div>
                    <Label htmlFor="split-email" className="text-xs font-medium text-muted-foreground">
                      Their email
                    </Label>
                    <Input
                      id="split-email"
                      type="email"
                      placeholder="friend@example.com"
                      value={splitEmail}
                      onChange={(e) => {
                        setSplitEmail(e.target.value);
                        setSplitLookup(null);
                      }}
                      onBlur={(e) => resolveSplitEmail(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          resolveSplitEmail(e.currentTarget.value);
                        }
                      }}
                      className="!h-auto mt-1 rounded-[calc(var(--radius)-2px)] border-input bg-background px-3 py-2 text-sm"
                    />
                    {splitLookup === "checking" && (
                      <p className="mt-1 text-xs text-muted-foreground">Looking them up…</p>
                    )}
                    {splitLookup === "not-found" && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        No account found for that email — they need to sign in to Pocket
                        Ledger once first.
                      </p>
                    )}
                    {splitLookup && typeof splitLookup === "object" && (
                      <p className="mt-1 text-xs" style={{ color: "var(--good)" }}>
                        Splitting with {splitLookup.username}
                      </p>
                    )}
                  </div>

                  {splitLookup && typeof splitLookup === "object" && (
                    <>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-medium text-muted-foreground">Paid by</span>
                        <div className="tabs">
                          <button
                            type="button"
                            className="tab-btn"
                            data-active={splitPayer === "me"}
                            onClick={() => setSplitPayer("me")}
                          >
                            You
                          </button>
                          <button
                            type="button"
                            className="tab-btn"
                            data-active={splitPayer === "them"}
                            onClick={() => setSplitPayer("them")}
                          >
                            {splitLookup.username}
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-medium text-muted-foreground">Split</span>
                        <div className="tabs">
                          <button
                            type="button"
                            className="tab-btn"
                            data-active={splitMethod === "equal"}
                            onClick={() => setSplitMethod("equal")}
                          >
                            Equal
                          </button>
                          <button
                            type="button"
                            className="tab-btn"
                            data-active={splitMethod === "custom"}
                            onClick={() => setSplitMethod("custom")}
                          >
                            Custom
                          </button>
                        </div>
                      </div>

                      {splitMethod === "custom" && (
                        <div className="flex items-center gap-2">
                          <div className="amount-field flex-1">
                            <span className="currency">₹</span>
                            <input
                              type="number"
                              inputMode="decimal"
                              step="0.01"
                              min="0"
                              placeholder="Your share"
                              value={splitMine}
                              onChange={(e) => setSplitMine(e.target.value)}
                            />
                          </div>
                          <div className="amount-field flex-1">
                            <span className="currency">₹</span>
                            <input
                              type="number"
                              inputMode="decimal"
                              step="0.01"
                              min="0"
                              placeholder="Their share"
                              value={splitTheirs}
                              onChange={(e) => setSplitTheirs(e.target.value)}
                            />
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
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

          <div className="mt-4 border-t border-border pt-4">
            {editingBudget ? (
              <div className="flex items-center gap-2">
                <div className="amount-field flex-1">
                  <span className="currency">₹</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    placeholder="Monthly budget"
                    autoFocus
                    value={budgetDraft}
                    onChange={(e) => setBudgetDraft(e.target.value)}
                  />
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => setEditingBudget(false)}>
                  Cancel
                </Button>
                <Button type="button" size="sm" onClick={saveBudget}>
                  Save
                </Button>
              </div>
            ) : budget ? (
              <>
                <div className="meter-head">
                  <span className="meter-label">Budget</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Edit budget"
                    onClick={openBudgetEditor}
                  >
                    <Pencil />
                  </Button>
                </div>
                <div className="meter-track">
                  <div
                    className="meter-fill"
                    style={{ width: Math.min(100, budgetPct) + "%", background: budgetFillColor }}
                  />
                </div>
                <div className="meter-sub" data-state={budgetState}>
                  {budgetState !== "good" && <TriangleAlert className="status-icon" />}
                  <strong>{fmt(total)}</strong> of {fmt(budget)} · {budgetPct}%
                  {budgetState === "over" && ` — ${fmt(total - budget)} over`}
                </div>
              </>
            ) : (
              <button
                type="button"
                onClick={openBudgetEditor}
                className="text-xs font-medium text-muted-foreground underline underline-offset-2"
              >
                Set a monthly budget
              </button>
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
                  const color = categoryColor({ colorSlot: x.categoryColorSlot });
                  const shared = x.participants && x.participants.length > 1;
                  const otherUid = shared ? x.participants.find((p) => p !== user.uid) : null;
                  const otherName = otherUid && peopleProfiles[otherUid]?.username;
                  return (
                    <div className="expense-row" key={x.id}>
                      <span className="dot" style={{ background: color }} />
                      <span className="min-w-0 flex-1">
                        <div className="text-sm font-medium">
                          {x.categoryLabel || "Uncategorized"}
                        </div>
                        {x.note && (
                          <div className="truncate text-xs text-muted-foreground/80">
                            {x.note}
                          </div>
                        )}
                        {shared && (
                          <div className="truncate text-xs text-muted-foreground/80">
                            Split with {otherName || "…"} · {x.payer === user.uid ? "You paid" : `${otherName || "They"} paid`}
                          </div>
                        )}
                      </span>
                      <span className="amt">{fmt(myShare(x, user.uid))}</span>
                      {x.createdBy === user.uid && (
                        <button
                          type="button"
                          className="del-btn"
                          data-confirm={confirmId === x.id}
                          aria-label="Delete expense"
                          onClick={() => handleDelete(x.id)}
                        >
                          {confirmId === x.id ? "Confirm" : "×"}
                        </button>
                      )}
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
                    const color = categoryColor({ colorSlot: e.colorSlot });
                    const pct = Math.max(6, Math.round((e.amount / maxCategoryAmount) * 100));
                    return (
                      <div className="cat-row" key={e.label}>
                        <span className="dot" style={{ background: color }} />
                        <span className="name">{e.label}</span>
                        <span className="bar-track">
                          <span className="bar-fill" style={{ width: pct + "%", background: color }} />
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

      {view === "balances" && (
        <Card>
          <CardContent>
            {balances.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No shared expenses yet. Split one from the Ledger tab to see balances here.
              </p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {balances.map((b) => {
                  const person = peopleProfiles[b.uid];
                  const theyOweMe = b.amount > 0;
                  return (
                    <div className="expense-row" key={b.uid}>
                      {person?.photoURL ? (
                        <img
                          src={person.photoURL}
                          alt=""
                          referrerPolicy="no-referrer"
                          className="h-8 w-8 shrink-0 rounded-full"
                        />
                      ) : (
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold">
                          {(person?.username || "?").slice(0, 1).toUpperCase()}
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <div className="text-sm font-medium">{person?.username || "Unknown"}</div>
                        <div className="text-xs text-muted-foreground/80">
                          {theyOweMe ? "owes you" : "you owe"}
                        </div>
                      </span>
                      <span
                        className="amt"
                        style={{ color: theyOweMe ? "var(--good)" : "var(--destructive)" }}
                      >
                        {fmt(Math.abs(b.amount))}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSettlingUid(b.uid);
                          setSettleDraft(String(Math.abs(b.amount)));
                        }}
                      >
                        Settle up
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}

            {settlingUid && (
              <div className="mt-3 flex items-center gap-2 rounded-[calc(var(--radius)-2px)] border border-border bg-secondary/60 p-3">
                <div className="amount-field flex-1">
                  <span className="currency">₹</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    autoFocus
                    value={settleDraft}
                    onChange={(e) => setSettleDraft(e.target.value)}
                  />
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => setSettlingUid(null)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={async () => {
                    const amt = parseFloat(settleDraft);
                    const bal = balances.find((b) => b.uid === settlingUid);
                    await handleSettleUp(settlingUid, amt, bal ? bal.amount < 0 : true);
                    setSettlingUid(null);
                  }}
                >
                  Save
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className={`toast ${toast ? "show" : ""}`}>{toast}</div>
    </div>
  );
}
