import { useEffect, useState } from "react";
import { deleteDoc, doc, onSnapshot, setDoc } from "firebase/firestore";
import { db, firebaseReady } from "@/lib/firebase";

export function useBudget(user, onError) {
  const [budget, setBudget] = useState(null);

  useEffect(() => {
    if (!firebaseReady || !db || !user) return;
    const unsub = onSnapshot(doc(db, "users", user.uid, "meta", "budget"), (snap) => {
      const data = snap.data();
      setBudget(typeof data?.amount === "number" ? data.amount : null);
    });
    return unsub;
  }, [user]);

  async function saveBudget(rawValue) {
    const trimmed = rawValue.trim();
    try {
      if (!trimmed) {
        await deleteDoc(doc(db, "users", user.uid, "meta", "budget"));
        return true;
      }
      const amt = parseFloat(trimmed);
      if (!amt || amt <= 0) {
        onError?.("Enter a budget greater than zero.");
        return false;
      }
      await setDoc(doc(db, "users", user.uid, "meta", "budget"), {
        amount: Math.round(amt * 100) / 100,
      });
      return true;
    } catch {
      onError?.("Couldn't save the budget. Please try again.");
      return false;
    }
  }

  return { budget, saveBudget };
}
