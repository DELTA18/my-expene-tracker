import { Card, CardContent } from "@/components/ui/card";
import { categoryColor, fmt } from "@/lib/expense-utils";
import { MonthNav } from "@/components/month-nav";

export function CategoryBreakdown({ viewMonth, onShiftMonth, categoryTotals, maxCategoryAmount }) {
  return (
    <Card className="fade-in-up">
      <CardContent>
        <MonthNav viewMonth={viewMonth} onShift={onShiftMonth} />

        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Category breakdown
        </p>
        {categoryTotals.length === 0 ? (
          <p className="py-1 text-center text-sm text-muted-foreground">
            No spending yet this month.
          </p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {categoryTotals.map((e) => {
              const color = categoryColor({ colorSlot: e.colorSlot });
              const pct = Math.max(6, Math.round((e.amount / maxCategoryAmount) * 100));
              return (
                <div className="cat-row" key={e.label}>
                  <span className="dot" style={{ background: color }} />
                  <span className="name">{e.label}</span>
                  <span className="bar-track">
                    <span className="bar-fill" style={{ width: pct + "%", background: color }} />
                  </span>
                  <span className="amt">{fmt(e.amount)}</span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
