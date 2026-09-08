import { useState } from "react";
import { deleteDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Users } from "lucide-react";
import { categoryColor, formatDateHeading, fmt, myShare } from "@/lib/expense-utils";

export function ExpenseList({ loading, groupedList, emptyMessage, user, peopleProfiles, onError }) {
  const [confirmId, setConfirmId] = useState(null);

  async function handleDelete(id) {
    if (confirmId === id) {
      setConfirmId(null);
      try {
        await deleteDoc(doc(db, "expenses", id));
      } catch {
        onError?.("Couldn't delete that expense. Please try again.");
      }
    } else {
      setConfirmId(id);
      setTimeout(() => setConfirmId((c) => (c === id ? null : c)), 2500);
    }
  }

  if (loading) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>;
  }

  if (groupedList.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <div className="flex flex-col gap-1">
      {groupedList.map((group) => (
        <div key={group.date}>
          <div className="px-1 pb-1.5 pt-3.5 text-[0.72rem] uppercase tracking-wider text-muted-foreground/80 first:pt-1">
            {formatDateHeading(group.date)}
          </div>
          <div className="flex flex-col gap-1.5">
            {group.items.map((x) => {
              const color = categoryColor({ colorSlot: x.categoryColorSlot });
              const shared = x.participants && x.participants.length > 1;
              const otherUids = shared ? x.participants.filter((p) => p !== user.uid) : [];
              const otherNames = otherUids
                .map((uid) => peopleProfiles[uid]?.username)
                .filter(Boolean);
              let namesLabel = "…";
              if (otherNames.length === 1) namesLabel = otherNames[0];
              else if (otherNames.length === 2) namesLabel = `${otherNames[0]}, ${otherNames[1]}`;
              else if (otherNames.length > 2)
                namesLabel = `${otherNames[0]}, ${otherNames[1]} +${otherNames.length - 2} more`;
              const payerName =
                x.payer === user.uid ? "you" : peopleProfiles[x.payer]?.username || "they";
              const singleOtherPhoto =
                otherUids.length === 1 ? peopleProfiles[otherUids[0]]?.photoURL : null;
              return (
                <div className="expense-row" data-shared={shared} key={x.id}>
                  <span className="dot" style={{ background: color }} />
                  <span className="min-w-0 flex-1">
                    <div className="text-sm font-medium">
                      {x.categoryLabel || "Uncategorized"}
                    </div>
                    {x.note && (
                      <div className="truncate text-xs text-muted-foreground/80">
                        {x.note}
                      </div>
                    )}
                    {shared && (
                      <div className="split-badge">
                        {singleOtherPhoto ? (
                          <img src={singleOtherPhoto} alt="" referrerPolicy="no-referrer" />
                        ) : (
                          <Users />
                        )}
                        {namesLabel} · {payerName === "you" ? "you paid" : `${payerName} paid`}
                      </div>
                    )}
                  </span>
                  <span className="amt">{fmt(myShare(x, user.uid))}</span>
                  {x.createdBy === user.uid && (
                    <button
                      type="button"
                      className="del-btn"
                      data-confirm={confirmId === x.id}
                      aria-label="Delete expense"
                      onClick={() => handleDelete(x.id)}
                    >
                      {confirmId === x.id ? "Confirm" : "×"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
