import { useEffect, useState } from "react";
import { addDoc, collection } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { todayStr } from "@/lib/expense-utils";
import { useSplitForm } from "@/hooks/useSplitForm";

export function useExpenseForm({ user, categories, categoryByKey, recentPeople, onError }) {
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(categories[0]?.key || "");
  const [date, setDate] = useState(todayStr());
  const [note, setNote] = useState("");

  const split = useSplitForm(user, amount, recentPeople);

  useEffect(() => {
    if (categories.length && !categories.some((c) => c.key === category)) {
      setCategory(categories[0].key);
    }
  }, [categories, category]);

  async function handleSubmit(e) {
    e.preventDefault();
    const amt = Math.round(parseFloat(amount) * 100) / 100;
    if (!amt || amt <= 0 || !db || !user) return;

    let participants = [user.uid];
    let payer = user.uid;
    let splits = { [user.uid]: amt };

    if (split.splitEnabled) {
      if (split.splitPeople.length === 0) {
        onError?.("Add at least one person to split with.");
        return;
      }
      participants = [user.uid, ...split.splitPeople.map((p) => p.uid)];
      payer = split.splitPayer || user.uid;
      if (Math.abs(split.splitAmountsSum - amt) > 0.01) {
        onError?.("The shares don't add up to the total yet.");
        return;
      }
      splits = participants.reduce((acc, uid) => {
        acc[uid] = split.splitAmounts[uid] || 0;
        return acc;
      }, {});
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
      split.resetSplitFields();
    } catch {
      onError?.("Couldn't save that expense. Please try again.");
    }
  }

  return {
    amount,
    setAmount,
    category,
    setCategory,
    date,
    setDate,
    note,
    setNote,
    split,
    handleSubmit,
  };
}
