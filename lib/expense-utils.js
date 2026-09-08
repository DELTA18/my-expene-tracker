// Slot order/hues are a validated categorical palette (see the dataviz skill's
// reference palette) — CVD-safe adjacent pairs in both light and dark, wired to
// --series-1..8 in globals.css. Never invent a 9th hue; reuse a slot instead.
export const DEFAULT_CATEGORIES = [
  { key: "food", label: "Food", colorSlot: 2 },
  { key: "transport", label: "Transport", colorSlot: 1 },
  { key: "shopping", label: "Shopping", colorSlot: 7 },
  { key: "bills", label: "Bills", colorSlot: 8 },
  { key: "health", label: "Health", colorSlot: 6 },
  { key: "fun", label: "Entertainment", colorSlot: 5 },
  { key: "other", label: "Other", colorSlot: 3 },
];
export const SWATCHES = [1, 2, 3, 4, 5, 6, 7, 8];

export function categoryColor(c) {
  if (!c) return "var(--muted-foreground)";
  if (c.colorSlot) return `var(--series-${c.colorSlot})`;
  if (c.color) return c.color; // legacy categories saved before the validated palette
  return "var(--muted-foreground)";
}

export function uid() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Date.now() + "-" + Math.random().toString(16).slice(2);
}

export function daysInMonth(d) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

export function dateKey(d) {
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d - tz).toISOString().slice(0, 10);
}

export function todayStr() {
  return dateKey(new Date());
}

export function shiftDay(d, delta) {
  const nd = new Date(d);
  nd.setDate(nd.getDate() + delta);
  return nd;
}

export function fmt(n) {
  return "₹" + Number(n).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function monthKey(d) {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
}

export function shiftMonth(d, delta) {
  return new Date(d.getFullYear(), d.getMonth() + delta, 1);
}

export function formatDateHeading(dateStr) {
  const today = todayStr();
  const yest = dateKey(shiftDay(new Date(), -1));
  if (dateStr === today) return "Today";
  if (dateStr === yest) return "Yesterday";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

// Splits a total into N shares that always sum back to it exactly — spreads
// the odd leftover paisa one cent at a time starting from index 0, rather
// than dumping it all on one person.
export function equalSplit(total, n) {
  const totalCents = Math.round(total * 100);
  const base = Math.floor(totalCents / n);
  const remainder = totalCents - base * n;
  return Array.from({ length: n }, (_, i) => (base + (i < remainder ? 1 : 0)) / 100);
}

// A viewer's own cost for an expense — their split if one exists, otherwise
// the full amount (defensive fallback only; every expense written by this
// app always has splits).
export function myShare(expense, uid) {
  return expense.splits && typeof expense.splits[uid] === "number"
    ? expense.splits[uid]
    : expense.amount;
}

export function authErrorMessage(err) {
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
