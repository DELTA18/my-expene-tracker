import { Card, CardContent } from "@/components/ui/card";
import { fmt } from "@/lib/expense-utils";
import { useCountUp } from "@/hooks/useCountUp";

// One huge day shouldn't flatten the rest of the month. Anything over 2×
// the 90th-percentile spending day is treated as an outlier: the scale is
// fitted to the normal days and outliers are drawn full height with a break
// mark and their amount, so they still read as "much bigger". Measuring
// against the 90th percentile (not the median) keeps ordinary busy days
// from being flagged just because most days are small.
const OUTLIER_FACTOR = 2;
const NORMAL_HEADROOM = 0.8;
// Labels closer than this many days would collide on a phone-width chart,
// so the later one is lifted to a second row.
const LABEL_MIN_GAP = 4;

function chartScale(dailySeries, maxDaily) {
  const spent = dailySeries.map((d) => d.amount).filter((a) => a > 0).sort((a, b) => a - b);
  if (spent.length === 0) return { scaleMax: maxDaily, cap: Infinity };
  const p90 = spent[Math.floor((spent.length - 1) * 0.9)];
  const cap = p90 * OUTLIER_FACTOR;
  if (maxDaily <= cap) return { scaleMax: maxDaily, cap: Infinity };
  const maxNormal = Math.max(...spent.filter((a) => a <= cap));
  return { scaleMax: maxNormal / NORMAL_HEADROOM, cap };
}

function labelRows(dailySeries, cap) {
  const rows = {};
  const lastInRow = [-Infinity, -Infinity];
  dailySeries.forEach((d) => {
    if (d.amount <= cap) return;
    const row = d.day - lastInRow[0] >= LABEL_MIN_GAP ? 0 : d.day - lastInRow[1] >= LABEL_MIN_GAP ? 1 : 0;
    lastInRow[row] = d.day;
    rows[d.day] = row;
  });
  return rows;
}

function fmtCompact(n) {
  return n >= 1000 ? `₹${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : `₹${Math.round(n)}`;
}

export function DailySpendChart({ viewMonth, total, dailySeries, maxDaily }) {
  const animatedTotal = useCountUp(total);
  const { scaleMax, cap } = chartScale(dailySeries, maxDaily);
  const rows = labelRows(dailySeries, cap);
  const hasRaisedLabel = Object.values(rows).includes(1);

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
            style={hasRaisedLabel ? { paddingTop: "38px" } : undefined}
            role="img"
            aria-label={`Daily spending for ${viewMonth.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}`}
          >
            {dailySeries.map((d) => {
              const clipped = d.amount > cap;
              return (
                <div className="viz-bar-col" key={d.day}>
                  <button
                    type="button"
                    className="viz-bar-hit"
                    style={{
                      "--bar-h": clipped
                        ? "100%"
                        : Math.max(2, Math.round((d.amount / scaleMax) * 100)) + "%",
                      "--bar-color": "var(--series-1)",
                    }}
                    aria-label={`${fmtDayLabel(d.day)}: ${fmt(d.amount)}`}
                  >
                    <span className="viz-bar-fill" data-clipped={clipped || undefined} />
                    {clipped && (
                      <span className="viz-bar-label" style={{ "--label-row": rows[d.day] }}>
                        {fmtCompact(d.amount)}
                      </span>
                    )}
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
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
