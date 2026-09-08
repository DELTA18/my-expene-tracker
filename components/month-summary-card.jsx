import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronDown, Pencil, TriangleAlert } from "lucide-react";
import { dateKey, fmt, todayStr } from "@/lib/expense-utils";
import { useCountUp } from "@/hooks/useCountUp";
import { PeriodNav } from "@/components/period-nav";
import { MonthPicker } from "@/components/month-picker";
import { DayPicker } from "@/components/day-picker";

export function MonthSummaryCard({
  viewMonth,
  onShiftMonth,
  onSetMonth,
  viewDay,
  onShiftDay,
  onSetDay,
  total,
  deltaPct,
  budget,
  saveBudget,
  summaryView,
  onChangeSummaryView,
  dayTotal,
  dailyBudget,
  saveDailyBudget,
}) {
  const isDaily = summaryView === "daily";
  const activeTotal = isDaily ? dayTotal : total;
  const activeBudget = isDaily ? dailyBudget : budget;
  const saveActiveBudget = isDaily ? saveDailyBudget : saveBudget;

  const animatedTotal = useCountUp(activeTotal);
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetDraft, setBudgetDraft] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);

  const budgetPct = activeBudget ? Math.round((activeTotal / activeBudget) * 100) : null;
  const budgetState = budgetPct === null ? null : budgetPct >= 100 ? "over" : budgetPct >= 80 ? "warning" : "good";
  const budgetFillColor =
    budgetState === "over" ? "var(--destructive)" : budgetState === "warning" ? "var(--warning)" : "var(--good)";

  function openBudgetEditor() {
    setBudgetDraft(activeBudget ? String(activeBudget) : "");
    setEditingBudget(true);
  }

  async function handleSaveBudget() {
    const ok = await saveActiveBudget(budgetDraft);
    if (ok) setEditingBudget(false);
  }

  function handlePickMonth(d) {
    onSetMonth(d);
    setPickerOpen(false);
  }

  function handlePickDay(d) {
    onSetDay(d);
    setPickerOpen(false);
  }

  const label = isDaily
    ? viewDay.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
    : viewMonth.toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  const labelSlot = (
    <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
      <PopoverTrigger className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-heading text-base font-semibold hover:bg-muted">
        {label}
        <ChevronDown className="size-3.5 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent>
        {isDaily ? (
          <DayPicker value={viewDay} onSelect={handlePickDay} />
        ) : (
          <MonthPicker value={viewMonth} onSelect={handlePickMonth} />
        )}
      </PopoverContent>
    </Popover>
  );

  return (
    <Card className="fade-in-up" style={{ "--fade-delay": "80ms" }}>
      <CardContent>
        {isDaily ? (
          <PeriodNav
            labelSlot={labelSlot}
            prevLabel="Previous day"
            nextLabel="Next day"
            onPrev={() => onShiftDay(-1)}
            onNext={() => onShiftDay(1)}
            nextDisabled={dateKey(viewDay) >= todayStr()}
          />
        ) : (
          <PeriodNav
            labelSlot={labelSlot}
            prevLabel="Previous month"
            nextLabel="Next month"
            onPrev={() => onShiftMonth(-1)}
            onNext={() => onShiftMonth(1)}
          />
        )}

        <div className="flex flex-wrap items-baseline gap-2.5">
          <span className="font-mono text-[2.05rem] font-semibold tabular-nums leading-none">
            {fmt(animatedTotal)}
          </span>
          {!isDaily && deltaPct !== null && deltaPct !== 0 && (
            <span className={`delta-pill ${deltaPct > 0 ? "bad" : "good"}`}>
              {deltaPct > 0 ? "▲" : "▼"} {Math.abs(deltaPct)}% vs last month
            </span>
          )}
          <div className="tabs tabs-sm ml-auto">
            <button
              type="button"
              className="tab-btn"
              data-active={!isDaily}
              onClick={() => {
                setEditingBudget(false);
                onChangeSummaryView("monthly");
              }}
            >
              Monthly
            </button>
            <button
              type="button"
              className="tab-btn"
              data-active={isDaily}
              onClick={() => {
                setEditingBudget(false);
                onChangeSummaryView("daily");
              }}
            >
              Daily
            </button>
          </div>
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
                  placeholder={isDaily ? "Daily budget" : "Monthly budget"}
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
          ) : activeBudget ? (
            <>
              <div className="meter-head">
                <span className="meter-label">{isDaily ? "Daily budget" : "Budget"}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={isDaily ? "Edit daily budget" : "Edit budget"}
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
                <strong>{fmt(animatedTotal)}</strong> of {fmt(activeBudget)} · {budgetPct}%
                {budgetState === "over" && ` — ${fmt(activeTotal - activeBudget)} over`}
              </div>
            </>
          ) : (
            <button
              type="button"
              onClick={openBudgetEditor}
              className="text-xs font-medium text-muted-foreground underline underline-offset-2"
            >
              Set a {isDaily ? "daily" : "monthly"} budget
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
