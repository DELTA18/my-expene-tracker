import { Card, CardContent } from "@/components/ui/card";
import { fmt } from "@/lib/expense-utils";
import { useCountUp } from "@/hooks/useCountUp";

export function DailySpendChart({ viewMonth, total, dailySeries, maxDaily }) {
  const animatedTotal = useCountUp(total);

  function fmtDayLabel(day) {
    const d = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day);
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  }

  return (
    <Card className="fade-in-up" style={{ "--fade-delay": "80ms" }}>
      <CardContent>
        <div className="mb-3 flex items-baseline justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Daily spend — {viewMonth.toLocaleDateString("en-IN", { month: "long" })}
          </p>
          <span className="font-mono text-sm font-semibold tabular-nums">
            {fmt(animatedTotal)}
          </span>
        </div>
        {dailySeries.every((d) => d.amount === 0) ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No spending yet this month.
          </p>
        ) : (
          <div
            className="viz-bars"
            role="img"
            aria-label={`Daily spending for ${viewMonth.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}`}
          >
            {dailySeries.map((d) => (
              <div className="viz-bar-col" key={d.day}>
                <button
                  type="button"
                  className="viz-bar-hit"
                  style={{
                    "--bar-h": Math.max(2, Math.round((d.amount / maxDaily) * 100)) + "%",
                    "--bar-color": "var(--series-1)",
                  }}
                  aria-label={`${fmtDayLabel(d.day)}: ${fmt(d.amount)}`}
                >
                  <span className="viz-bar-fill" />
                  <span className="viz-tooltip">
                    {fmtDayLabel(d.day)} · {fmt(d.amount)}
                  </span>
                </button>
                {(d.day === 1 ||
                  d.day === dailySeries.length ||
                  (d.day % 5 === 0 && d.day <= dailySeries.length - 2)) && (
                  <span className="viz-bar-tick">{d.day}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
