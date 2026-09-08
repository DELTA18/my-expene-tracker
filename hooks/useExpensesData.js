import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db, firebaseReady } from "@/lib/firebase";

export function useExpensesData(user, onError) {
  const [expenses, setExpenses] = useState([]);
  const [settlements, setSettlements] = useState([]);
  const [loading, setLoading] = useState(true);

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
        onError?.("Couldn't reach the database. Check your connection.");
        setLoading(false);
      }
    );
    return unsub;
  }, [user, onError]);

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

  return { expenses, settlements, loading };
}
