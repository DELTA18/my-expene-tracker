import { useEffect, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db, firebaseReady } from "@/lib/firebase";

export function useProfile(user, onError) {
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    if (!firebaseReady || !db || !user) {
      setProfileLoading(false);
      return;
    }
    const unsub = onSnapshot(doc(db, "profiles", user.uid), (snap) => {
      setProfile(snap.exists() ? snap.data() : null);
      setProfileLoading(false);
    });
    return unsub;
  }, [user]);

  async function saveProfile(username, usePhoto) {
    const trimmed = username.trim();
    if (!trimmed || !user) return;
    const photoURL = usePhoto ? user.photoURL || null : null;
    try {
      await setDoc(doc(db, "profiles", user.uid), { username: trimmed, photoURL });
      if (user.email) {
        await setDoc(doc(db, "directory", user.email.toLowerCase()), { uid: user.uid });
      }
    } catch {
      onError?.("Couldn't save your profile. Please try again.");
    }
  }

  return { profile, profileLoading, saveProfile };
}
