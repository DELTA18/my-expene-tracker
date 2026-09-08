import { useEffect, useMemo, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { equalSplit } from "@/lib/expense-utils";

// Owns everything about "who is this expense split with" — the recent-people
// chips, email lookup, payer selection, and the per-person share amounts.
// Only *manually edited* shares are stored — everyone else's amount is
// derived (see splitAmounts) as an equal share of whatever's left. This is
// the whole "type one, the rest rebalance" behavior: there's no separate
// equal/custom mode, just an increasing set of locked-in numbers.
export function useSplitForm(user, amount, recentPeople) {
  const [splitEnabled, setSplitEnabled] = useState(false);
  const [splitEmail, setSplitEmail] = useState("");
  const [splitLookup, setSplitLookup] = useState(null); // "checking" | "not-found" | null — transient state for the email field only
  const [splitPeople, setSplitPeople] = useState([]); // everyone else in the split: [{uid, username, photoURL}]
  const [splitPayer, setSplitPayer] = useState(null); // uid of whoever paid; null means "you"
  const [splitTouched, setSplitTouched] = useState({}); // { [uid]: "raw input string" }

  // If whoever's currently marked as payer gets removed from the split,
  // fall back to "you" rather than leaving a stale/invalid uid selected.
  useEffect(() => {
    if (splitPayer && splitPayer !== user?.uid && !splitPeople.some((p) => p.uid === splitPayer)) {
      setSplitPayer(null);
    }
  }, [splitPeople, splitPayer, user]);

  // Recent chips plus anyone just added by email, deduped — the full set of
  // people selectable in the split picker.
  const splitChipPeople = useMemo(() => {
    const seen = new Map();
    recentPeople.forEach((p) => seen.set(p.uid, p));
    splitPeople.forEach((p) => seen.set(p.uid, p));
    return [...seen.values()];
  }, [recentPeople, splitPeople]);

  // Every participant's current share. Anyone in splitTouched keeps exactly
  // what they typed (parsed); everyone else splits whatever's left equally
  // — so editing one field live-rebalances the untouched ones, and the
  // whole thing starts as a plain equal split when nobody's touched anything.
  // Whoever paid absorbs the odd leftover paisa when they're untouched,
  // otherwise the first untouched person does.
  const splitAmounts = useMemo(() => {
    if (!user) return {};
    const participantUids = [user.uid, ...splitPeople.map((p) => p.uid)];
    const amt = parseFloat(amount) || 0;
    const payerUid = splitPayer || user.uid;

    const result = {};
    let touchedSum = 0;
    const untouchedUids = [];
    participantUids.forEach((uid) => {
      if (uid in splitTouched) {
        const v = Math.round((parseFloat(splitTouched[uid]) || 0) * 100) / 100;
        result[uid] = v;
        touchedSum += v;
      } else {
        untouchedUids.push(uid);
      }
    });

    if (untouchedUids.length > 0) {
      const remaining = Math.max(0, Math.round((amt - touchedSum) * 100) / 100);
      const ordered = untouchedUids.includes(payerUid)
        ? [payerUid, ...untouchedUids.filter((uid) => uid !== payerUid)]
        : untouchedUids;
      equalSplit(remaining, ordered.length).forEach((share, i) => {
        result[ordered[i]] = share;
      });
    }
    return result;
  }, [splitPeople, splitTouched, amount, splitPayer, user]);

  const splitAmountsSum = useMemo(
    () => Object.values(splitAmounts).reduce((s, v) => s + v, 0),
    [splitAmounts]
  );

  // Resolving an email adds that person straight to the split (same action
  // as tapping a "recent" chip) rather than just previewing a single match —
  // the field is for adding someone new to the group, not picking "the" person.
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
      const resolved = {
        uid: otherUid,
        username: profSnap.exists() ? profSnap.data().username : "Unknown",
        photoURL: profSnap.exists() ? profSnap.data().photoURL : null,
      };
      setSplitPeople((list) => (list.some((p) => p.uid === otherUid) ? list : [...list, resolved]));
      setSplitEmail("");
      setSplitLookup(null);
    } catch {
      setSplitLookup("not-found");
    }
  }

  function toggleSplitPerson(p) {
    setSplitPeople((list) =>
      list.some((x) => x.uid === p.uid) ? list.filter((x) => x.uid !== p.uid) : [...list, p]
    );
    // Drop any manually-entered share for someone who's leaving the split —
    // otherwise it'd linger and reappear if they're re-added later.
    setSplitTouched((m) => {
      if (!(p.uid in m)) return m;
      const next = { ...m };
      delete next[p.uid];
      return next;
    });
  }

  // Typing a value locks that person's share; clearing the field unlocks it
  // back to auto-balancing (see splitAmounts).
  function setSplitShare(uid, rawValue) {
    // Always sets, even to "" — once you edit a field it stays touched (and
    // shows exactly what you type) rather than trying to detect "clear to
    // unlock", which just snaps an already-untouched field straight back to
    // its computed value before you can type anything into it.
    setSplitTouched((m) => ({ ...m, [uid]: rawValue }));
  }

  function resetSplitFields() {
    setSplitEnabled(false);
    setSplitEmail("");
    setSplitLookup(null);
    setSplitPeople([]);
    setSplitPayer(null);
    setSplitTouched({});
  }

  return {
    splitEnabled,
    setSplitEnabled,
    splitEmail,
    setSplitEmail,
    splitLookup,
    setSplitLookup,
    splitPeople,
    splitPayer,
    setSplitPayer,
    splitTouched,
    splitChipPeople,
    splitAmounts,
    splitAmountsSum,
    resolveSplitEmail,
    toggleSplitPerson,
    setSplitShare,
    resetSplitFields,
  };
}
