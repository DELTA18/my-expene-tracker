import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronDown, Pencil, TriangleAlert } from "lucide-react";
import { dateKey, fmt, monthKey, todayStr } from "@/lib/expense-utils";
import { useCountUp } from "@/hooks/useCountUp";
import { PeriodNav } from "@/components/period-nav";
import { SegmentedTabs } from "@/components/segmented-tabs";
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
  filteredTotal,
  dailyBudget,
  saveDailyBudget,
}) {
  const isDaily = summaryView === "daily";
  const activeTotal = isDaily ? dayTotal : total;
  const activeBudget = isDaily ? dailyBudget : budget;
  const saveActiveBudget = isDaily ? saveDailyBudget : saveBudget;

  const isFiltered = filteredTotal !== null && filteredTotal !== undefined;
  const headlineTotal = isFiltered ? filteredTotal : activeTotal;

  // While an amount is flying in from the form (see ExpenseForm), the shown
  // totals are held at their pre-add values and released on impact.
  const totalRef = useRef(null);
  const liveRef = useRef({ headline: 0, total: 0 });
  const releaseTimer = useRef(null);
  const [held, setHeld] = useState(null);
  const [landKey, setLandKey] = useState(0);

  useEffect(() => {
    liveRef.current = { headline: headlineTotal, total: activeTotal };
  });

  useEffect(() => {
    function onPrepare(e) {
      const { date } = e.detail;
      const inPeriod = isDaily ? date === dateKey(viewDay) : date?.slice(0, 7) === monthKey(viewMonth);
      const el = totalRef.current;
      if (!inPeriod || isFiltered || !el) return;
      const r = el.getBoundingClientRect();
      if (r.top < 0 || r.bottom > window.innerHeight) return;

      function release(landed) {
        clearTimeout(releaseTimer.current);
        setHeld(null);
        if (landed) setLandKey((k) => k + 1);
      }
      setHeld(liveRef.current);
      clearTimeout(releaseTimer.current);
      releaseTimer.current = setTimeout(() => release(false), 2500);
      e.detail.target = el;
      e.detail.release = release;
    }
    window.addEventListener("expense-fly-prepare", onPrepare);
    return () => {
      window.removeEventListener("expense-fly-prepare", onPrepare);
      clearTimeout(releaseTimer.current);
    };
  }, [isDaily, viewDay, viewMonth, isFiltered]);

  // The headline follows the filters; the budget meter always tracks the
  // real total so it never looks healthier than it is.
  const meterTotal = held ? held.total : activeTotal;
  const animatedTotal = useCountUp(meterTotal);
  const animatedHeadline = useCountUp(held ? held.headline : headlineTotal);
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetDraft, setBudgetDraft] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);

  const budgetPct = activeBudget ? Math.round((meterTotal / activeBudget) * 100) : null;
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
          <span
            ref={totalRef}
            key={landKey}
            data-landed={landKey > 0 || undefined}
            className="total-figure font-mono text-[2.05rem] font-semibold tabular-nums leading-none"
          >
            {fmt(animatedHeadline)}
          </span>
          {!isDaily && !isFiltered && deltaPct !== null && deltaPct !== 0 && (
            <span className={`delta-pill ${deltaPct > 0 ? "bad" : "good"}`}>
              {deltaPct > 0 ? "▲" : "▼"} {Math.abs(deltaPct)}% vs last month
            </span>
          )}
          <SegmentedTabs
            className="ml-auto"
            size="sm"
            value={isDaily ? "daily" : "monthly"}
            onChange={(v) => {
              setEditingBudget(false);
              onChangeSummaryView(v);
            }}
            items={[
              { value: "monthly", label: "Monthly" },
              { value: "daily", label: "Daily" },
            ]}
          />
        </div>
        {isFiltered && (
          <p className="mt-1.5 text-xs text-muted-foreground">
            Filtered · of {fmt(activeTotal)} total
          </p>
        )}

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
                {budgetState === "over" && ` — ${fmt(meterTotal - activeBudget)} over`}
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
