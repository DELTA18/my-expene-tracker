import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { fmt } from "@/lib/expense-utils";

export function SplitSection({ split, amount, user }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Switch
          id="split-toggle"
          checked={split.splitEnabled}
          onCheckedChange={(checked) => {
            split.setSplitEnabled(checked);
            if (!checked) split.resetSplitFields();
          }}
        />
        <Label htmlFor="split-toggle" className="text-sm text-muted-foreground">
          Split with someone
        </Label>
      </div>

      {split.splitEnabled && (
        <div className="flex flex-col gap-3 rounded-[calc(var(--radius)-2px)] border border-border bg-secondary/60 p-3">
          {split.splitChipPeople.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">Split with</span>
              <div className="flex flex-wrap items-center gap-2">
                {split.splitChipPeople.map((p) => (
                  <button
                    key={p.uid}
                    type="button"
                    className="chip"
                    data-active={split.splitPeople.some((x) => x.uid === p.uid)}
                    onClick={() => split.toggleSplitPerson(p)}
                  >
                    {p.photoURL ? (
                      <img
                        src={p.photoURL}
                        alt=""
                        referrerPolicy="no-referrer"
                        className="h-4 w-4 rounded-full"
                      />
                    ) : (
                      <span className="dot" style={{ background: "var(--muted-foreground)" }} />
                    )}
                    {p.username}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div>
            <Label htmlFor="split-email" className="text-xs font-medium text-muted-foreground">
              {split.splitChipPeople.length > 0 ? "Add someone new — their email" : "Their email"}
            </Label>
            <Input
              id="split-email"
              type="email"
              placeholder="friend@example.com"
              value={split.splitEmail}
              onChange={(e) => {
                split.setSplitEmail(e.target.value);
                split.setSplitLookup(null);
              }}
              onBlur={(e) => split.resolveSplitEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  split.resolveSplitEmail(e.currentTarget.value);
                }
              }}
              className="!h-auto mt-1 rounded-[calc(var(--radius)-2px)] border-input bg-background px-3 py-2 text-sm"
            />
            {split.splitLookup === "checking" && (
              <p className="mt-1 text-xs text-muted-foreground">Looking them up…</p>
            )}
            {split.splitLookup === "not-found" && (
              <p className="mt-1 text-xs text-muted-foreground">
                No account found for that email — they need to sign in to Pocket
                Ledger once first.
              </p>
            )}
          </div>

          {split.splitPeople.length > 0 && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">Paid by</span>
                <div className="tabs flex-wrap">
                  <button
                    type="button"
                    className="tab-btn"
                    data-active={!split.splitPayer || split.splitPayer === user.uid}
                    onClick={() => split.setSplitPayer(null)}
                  >
                    You
                  </button>
                  {split.splitPeople.map((p) => (
                    <button
                      key={p.uid}
                      type="button"
                      className="tab-btn"
                      data-active={split.splitPayer === p.uid}
                      onClick={() => split.setSplitPayer(p.uid)}
                    >
                      {p.username}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">
                  Split amounts — starts equal, edit any one to adjust the rest
                </span>
                <div className="flex flex-col gap-1.5">
                  {[{ uid: user.uid, username: "You" }, ...split.splitPeople].map((p) => (
                    <div key={p.uid} className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm">{p.username}</span>
                      <div className="amount-field sm" style={{ width: "130px" }}>
                        <span className="currency">₹</span>
                        <input
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          min="0"
                          value={
                            p.uid in split.splitTouched
                              ? split.splitTouched[p.uid]
                              : (split.splitAmounts[p.uid] ?? 0).toFixed(2)
                          }
                          onChange={(e) => split.setSplitShare(p.uid, e.target.value)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                {Math.abs(split.splitAmountsSum - (parseFloat(amount) || 0)) > 0.01 && (
                  <p className="text-xs font-medium" style={{ color: "var(--destructive)" }}>
                    Shares add up to {fmt(split.splitAmountsSum)}, not{" "}
                    {fmt(parseFloat(amount) || 0)}.
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
