import { useState } from "react";
import { addDoc, collection } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { fmt } from "@/lib/expense-utils";

export function BalancesPanel({ balances, peopleProfiles, user, onError }) {
  const [settlingUid, setSettlingUid] = useState(null);
  const [settleDraft, setSettleDraft] = useState("");

  async function handleSettleUp(otherUid, amt, iAmPaying) {
    if (!amt || amt <= 0) return;
    try {
      await addDoc(collection(db, "settlements"), {
        from: iAmPaying ? user.uid : otherUid,
        to: iAmPaying ? otherUid : user.uid,
        amount: Math.round(amt * 100) / 100,
        at: Date.now(),
        participants: [user.uid, otherUid],
        createdBy: user.uid,
      });
    } catch {
      onError?.("Couldn't record that settlement. Please try again.");
    }
  }

  return (
    <Card>
      <CardContent>
        {balances.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No shared expenses yet. Split one from the Ledger tab to see balances here.
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {balances.map((b) => {
              const person = peopleProfiles[b.uid];
              const theyOweMe = b.amount > 0;
              return (
                <div className="expense-row" key={b.uid}>
                  {person?.photoURL ? (
                    <img
                      src={person.photoURL}
                      alt=""
                      referrerPolicy="no-referrer"
                      className="h-8 w-8 shrink-0 rounded-full"
                    />
                  ) : (
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold">
                      {(person?.username || "?").slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{person?.username || "Unknown"}</div>
                    <div className="text-xs text-muted-foreground/80">
                      {theyOweMe ? "owes you" : "you owe"}
                    </div>
                  </span>
                  <span
                    className="amt"
                    style={{ color: theyOweMe ? "var(--good)" : "var(--destructive)" }}
                  >
                    {fmt(Math.abs(b.amount))}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSettlingUid(b.uid);
                      setSettleDraft(String(Math.abs(b.amount)));
                    }}
                  >
                    Settle up
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        {settlingUid &&
          (() => {
            const bal = balances.find((b) => b.uid === settlingUid);
            const iAmPaying = bal ? bal.amount < 0 : true;
            const otherName = peopleProfiles[settlingUid]?.username || "them";
            return (
              <div className="mt-3 flex flex-col gap-2 rounded-[calc(var(--radius)-2px)] border border-border bg-secondary/60 p-3">
                <p className="text-xs text-muted-foreground">
                  Recording: <strong>{iAmPaying ? "You" : otherName}</strong> →{" "}
                  <strong>{iAmPaying ? otherName : "you"}</strong>
                </p>
                <div className="flex items-center gap-2">
                  <div className="amount-field flex-1">
                    <span className="currency">₹</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      autoFocus
                      value={settleDraft}
                      onChange={(e) => setSettleDraft(e.target.value)}
                    />
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setSettlingUid(null)}>
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={async () => {
                      const amt = parseFloat(settleDraft);
                      await handleSettleUp(settlingUid, amt, iAmPaying);
                      setSettlingUid(null);
                    }}
                  >
                    Save
                  </Button>
                </div>
              </div>
            );
          })()}
      </CardContent>
    </Card>
  );
}
