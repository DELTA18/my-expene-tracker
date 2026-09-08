import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Pencil, TriangleAlert } from "lucide-react";
import { fmt } from "@/lib/expense-utils";
import { useCountUp } from "@/hooks/useCountUp";
import { MonthNav } from "@/components/month-nav";

export function MonthSummaryCard({ viewMonth, onShiftMonth, total, deltaPct, budget, saveBudget }) {
  const animatedTotal = useCountUp(total);
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetDraft, setBudgetDraft] = useState("");

  const budgetPct = budget ? Math.round((total / budget) * 100) : null;
  const budgetState = budgetPct === null ? null : budgetPct >= 100 ? "over" : budgetPct >= 80 ? "warning" : "good";
  const budgetFillColor =
    budgetState === "over" ? "var(--destructive)" : budgetState === "warning" ? "var(--warning)" : "var(--good)";

  function openBudgetEditor() {
    setBudgetDraft(budget ? String(budget) : "");
    setEditingBudget(true);
  }

  async function handleSaveBudget() {
    const ok = await saveBudget(budgetDraft);
    if (ok) setEditingBudget(false);
  }

  return (
    <Card className="fade-in-up" style={{ "--fade-delay": "80ms" }}>
      <CardContent>
        <MonthNav viewMonth={viewMonth} onShift={onShiftMonth} />

        <div className="flex flex-wrap items-baseline gap-2.5">
          <span className="font-mono text-[2.05rem] font-semibold tabular-nums leading-none">
            {fmt(animatedTotal)}
          </span>
          {deltaPct !== null && deltaPct !== 0 && (
            <span className={`delta-pill ${deltaPct > 0 ? "bad" : "good"}`}>
              {deltaPct > 0 ? "▲" : "▼"} {Math.abs(deltaPct)}% vs last month
            </span>
          )}
        </div>

        <div className="mt-4 border-t border-border pt-4">
          {editingBudget ? (
            <div className="flex items-center gap-2">
              <div className="amount-field flex-1">
                <span className="currency">₹</span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  placeholder="Monthly budget"
                  autoFocus
                  value={budgetDraft}
                  onChange={(e) => setBudgetDraft(e.target.value)}
                />
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => setEditingBudget(false)}>
                Cancel
              </Button>
              <Button type="button" size="sm" onClick={handleSaveBudget}>
                Save
              </Button>
            </div>
          ) : budget ? (
            <>
              <div className="meter-head">
                <span className="meter-label">Budget</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Edit budget"
                  onClick={openBudgetEditor}
                >
                  <Pencil />
                </Button>
              </div>
              <div className="meter-track">
                <div
                  className="meter-fill"
                  style={{ width: Math.min(100, budgetPct) + "%", background: budgetFillColor }}
                />
              </div>
              <div className="meter-sub" data-state={budgetState}>
                {budgetState !== "good" && <TriangleAlert className="status-icon" />}
                <strong>{fmt(animatedTotal)}</strong> of {fmt(budget)} · {budgetPct}%
                {budgetState === "over" && ` — ${fmt(total - budget)} over`}
              </div>
            </>
          ) : (
            <button
              type="button"
              onClick={openBudgetEditor}
              className="text-xs font-medium text-muted-foreground underline underline-offset-2"
            >
              Set a monthly budget
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
