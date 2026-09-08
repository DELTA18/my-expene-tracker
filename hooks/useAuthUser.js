import { useEffect, useState } from "react";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { auth, firebaseReady, googleProvider } from "@/lib/firebase";
import { authErrorMessage } from "@/lib/expense-utils";
import { migrateToUnifiedExpenses } from "@/lib/migrations";

export function useAuthUser(onError) {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    if (!firebaseReady || !auth) {
      setAuthLoading(false);
      return;
    }
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!user) return;
    migrateToUnifiedExpenses(user.uid).catch(() => {
      onError?.("Couldn't move your old data over. It's still safe — try reloading.");
    });
  }, [user, onError]);

  async function handleSignIn() {
    if (!auth) return;
    setAuthError("");
    try {
      // Popup, not redirect — our authDomain (*.firebaseapp.com) is a
      // different origin than where this app is hosted, and browsers now
      // block the third-party storage handoff signInWithRedirect needs
      // between those two domains. Popup avoids that relay entirely.
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const msg = authErrorMessage(err);
      if (msg) setAuthError(msg);
    }
  }

  async function handleSignOut() {
    if (!auth) return;
    try {
      await signOut(auth);
    } catch {
      onError?.("Couldn't sign out. Please try again.");
    }
  }

  return { user, authLoading, authError, handleSignIn, handleSignOut };
}
