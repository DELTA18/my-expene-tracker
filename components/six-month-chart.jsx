import { Card, CardContent } from "@/components/ui/card";
import { fmt } from "@/lib/expense-utils";

export function SixMonthChart({ sixMonthSeries, maxSixMonth }) {
  return (
    <Card className="fade-in-up" style={{ "--fade-delay": "160ms" }}>
      <CardContent>
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Last 6 months
        </p>
        <div
          className="viz-bars"
          style={{ height: "150px" }}
          role="img"
          aria-label="Total spending, last 6 months"
        >
          {sixMonthSeries.map((m) => (
            <div className="viz-bar-col" key={m.key}>
              <button
                type="button"
                className="viz-bar-hit"
                style={{
                  "--bar-h": Math.max(2, Math.round((m.amount / maxSixMonth) * 100)) + "%",
                  "--bar-color": m.isCurrent ? "var(--primary)" : "var(--muted-foreground)",
                }}
                aria-label={`${m.label}: ${fmt(m.amount)}`}
              >
                <span className="viz-bar-fill" style={{ maxWidth: "34px" }} />
                <span className="viz-tooltip">
                  {m.label} · {fmt(m.amount)}
                </span>
              </button>
              <span className="viz-bar-tick">{m.label}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
