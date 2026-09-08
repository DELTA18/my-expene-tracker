import { useEffect, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db, firebaseReady } from "@/lib/firebase";

export function usePreferences(user, onError) {
  const [summaryView, setSummaryViewState] = useState("monthly");
  const [dailyBudget, setDailyBudget] = useState(null);

  useEffect(() => {
    if (!firebaseReady || !db || !user) return;
    const unsub = onSnapshot(doc(db, "users", user.uid, "meta", "preferences"), (snap) => {
      const data = snap.data();
      setSummaryViewState(data?.summaryView === "daily" ? "daily" : "monthly");
      setDailyBudget(typeof data?.dailyBudget === "number" ? data.dailyBudget : null);
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

  return { summaryView, setSummaryView, dailyBudget, saveDailyBudget };
}
