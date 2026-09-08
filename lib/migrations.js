import { collection, doc, getDoc, getDocs, setDoc, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { DEFAULT_CATEGORIES } from "@/lib/expense-utils";

// One-time move from the old per-user expense subcollection onto the flat,
// splittable /expenses collection every account now reads from. A personal
// expense becomes the one-participant case of the same shape: payer,
// createdBy and the sole participant are all this uid, and its whole amount
// is its own "split". Category label/color are snapshotted at migration time
// so the record renders correctly even if the category is later renamed —
// the same reason a freshly-created shared expense snapshots them too.
// Idempotent (checks a marker doc first), safe to run on every login.
export async function migrateToUnifiedExpenses(uid) {
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
