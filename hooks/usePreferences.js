import { useEffect, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db, firebaseReady } from "@/lib/firebase";
import { applyTheme } from "@/lib/theme";

export function usePreferences(user, onError) {
  const [summaryView, setSummaryViewState] = useState("monthly");
  const [dailyBudget, setDailyBudget] = useState(null);
  const [theme, setThemeState] = useState("system");

  useEffect(() => {
    if (!firebaseReady || !db || !user) return;
    const unsub = onSnapshot(doc(db, "users", user.uid, "meta", "preferences"), (snap) => {
      const data = snap.data();
      setSummaryViewState(data?.summaryView === "daily" ? "daily" : "monthly");
      setDailyBudget(typeof data?.dailyBudget === "number" ? data.dailyBudget : null);
      const resolvedTheme = data?.theme === "light" || data?.theme === "dark" ? data.theme : "system";
      setThemeState(resolvedTheme);
      // Corrects whatever the pre-auth inline script guessed from
      // localStorage (nothing, on a device that's never seen this account)
      // now that the real stored preference is in.
      applyTheme(resolvedTheme);
    });
    return unsub;
  }, [user]);

  // Set optimistically — this only flips which meter is visible, so there's
  // nothing worth waiting on a round-trip for.
  async function setSummaryView(view) {
    setSummaryViewState(view);
    try {
      await setDoc(doc(db, "users", user.uid, "meta", "preferences"), { summaryView: view }, { merge: true });
    } catch {
      onError?.("Couldn't save your view preference.");
    }
  }

  async function saveDailyBudget(rawValue) {
    const trimmed = rawValue.trim();
    try {
      if (!trimmed) {
        await setDoc(doc(db, "users", user.uid, "meta", "preferences"), { dailyBudget: null }, { merge: true });
        return true;
      }
      const amt = parseFloat(trimmed);
      if (!amt || amt <= 0) {
        onError?.("Enter a budget greater than zero.");
        return false;
      }
      await setDoc(
        doc(db, "users", user.uid, "meta", "preferences"),
        { dailyBudget: Math.round(amt * 100) / 100 },
        { merge: true }
      );
      return true;
    } catch {
      onError?.("Couldn't save the daily budget. Please try again.");
      return false;
    }
  }

  // Applied immediately (before the write resolves) so there's no lag
  // between tapping the toggle and the page actually changing color.
  async function setTheme(next) {
    setThemeState(next);
    applyTheme(next);
    try {
      await setDoc(doc(db, "users", user.uid, "meta", "preferences"), { theme: next }, { merge: true });
    } catch {
      onError?.("Couldn't save your theme preference.");
    }
  }

  return { summaryView, setSummaryView, dailyBudget, saveDailyBudget, theme, setTheme };
}
