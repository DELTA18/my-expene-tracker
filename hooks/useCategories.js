import { useEffect, useMemo, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db, firebaseReady } from "@/lib/firebase";
import { DEFAULT_CATEGORIES, uid } from "@/lib/expense-utils";

export function useCategories(user, expenses, onError) {
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [categoriesLoaded, setCategoriesLoaded] = useState(false);

  useEffect(() => {
    setCategoriesLoaded(false);
    if (!firebaseReady || !db || !user) return;
    const unsub = onSnapshot(doc(db, "users", user.uid, "meta", "categories"), (snap) => {
      const data = snap.data();
      setCategories(
        data && Array.isArray(data.items) && data.items.length
          ? data.items
          : DEFAULT_CATEGORIES
      );
      setCategoriesLoaded(true);
    });
    return unsub;
  }, [user]);

  // A category from someone else's shared expense that you don't have yet
  // gets copied into your own list automatically (same name/color, a new key
  // that's fully yours from then on — no ongoing link back to theirs).
  // Gated on categoriesLoaded (not just categories.length, which is always
  // >0 thanks to the DEFAULT_CATEGORIES fallback) so this can't fire against
  // that fallback before the real Firestore doc has loaded even once — doing
  // so would overwrite your saved list and silently drop anything in it that
  // isn't referenced by an expense yet (e.g. a category you just created).
  useEffect(() => {
    if (!firebaseReady || !db || !user || !categoriesLoaded) return;
    const known = new Set(categories.map((c) => c.label));
    const missing = new Map();
    expenses.forEach((x) => {
      if (x.categoryLabel && !known.has(x.categoryLabel) && !missing.has(x.categoryLabel)) {
        missing.set(x.categoryLabel, x.categoryColorSlot);
      }
    });
    if (missing.size === 0) return;
    const additions = [...missing.entries()].map(([label, colorSlot], i) => ({
      key: uid(),
      label,
      colorSlot: colorSlot || (((categories.length + i) % 8) + 1),
    }));
    setDoc(doc(db, "users", user.uid, "meta", "categories"), {
      items: [...categories, ...additions],
    }).catch(() => {});
  }, [expenses, categories, categoriesLoaded, user]);

  const categoryByKey = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.key, c])),
    [categories]
  );

  // Quick-pick order: most-used categories first, computed from expenses
  // already loaded (yours and shared-with-you, matched by name so a shared
  // expense someone else logged counts too) — no stored counter, no extra
  // reads, and it only shifts as usage actually accumulates, not on every
  // add, so the layout stays predictable.
  const categoryUsageOrder = useMemo(() => {
    const counts = {};
    expenses.forEach((x) => {
      if (x.categoryLabel) counts[x.categoryLabel] = (counts[x.categoryLabel] || 0) + 1;
    });
    return [...categories].sort(
      (a, b) => (counts[b.label] || 0) - (counts[a.label] || 0)
    );
  }, [categories, expenses]);

  // Split into two independent rows (top = more-used half) rather than a
  // grid/flex-wrap pairing, which would force each row-0/row-1 pair to share
  // a column width and leave gaps after the shorter one.
  const categoryRows = useMemo(() => {
    const half = Math.ceil(categoryUsageOrder.length / 2);
    return [categoryUsageOrder.slice(0, half), categoryUsageOrder.slice(half)];
  }, [categoryUsageOrder]);

  async function saveCategories(items) {
    const cleaned = items
      .map((c) => ({ ...c, label: c.label.trim() }))
      .filter((c) => c.label);
    if (cleaned.length === 0) {
      onError?.("Keep at least one category.");
      return false;
    }
    try {
      await setDoc(doc(db, "users", user.uid, "meta", "categories"), { items: cleaned });
      return true;
    } catch {
      onError?.("Couldn't save categories. Please try again.");
      return false;
    }
  }

  return { categories, categoryByKey, categoryUsageOrder, categoryRows, saveCategories };
}
