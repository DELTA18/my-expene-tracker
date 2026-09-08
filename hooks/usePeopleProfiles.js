import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db, firebaseReady } from "@/lib/firebase";

// Resolve display name/photo for anyone else who shows up as a co-
// participant, one lookup per uid (not a live listener — a stale name
// until the next new shared expense/settlement is an acceptable tradeoff
// for not running N permanent listeners for people you split with).
export function usePeopleProfiles(user, expenses, settlements) {
  const [peopleProfiles, setPeopleProfiles] = useState({});

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

  return peopleProfiles;
}
