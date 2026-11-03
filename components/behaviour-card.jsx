import { CalendarDays, Flame, Moon, PartyPopper, Zap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const ICONS = {
  payday: { Icon: CalendarDays, color: "var(--series-1)" },
  weekend: { Icon: PartyPopper, color: "var(--series-5)" },
  revenge: { Icon: Zap, color: "var(--warning)" },
  streak: { Icon: Flame, color: "var(--destructive)" },
  silent: { Icon: Moon, color: "var(--good)" },
};

function shortDate(d) {
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function BehaviourCard({ insights: { items, from, to } }) {
  return (
    <Card className="fade-in-up">
      <CardContent>
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Your patterns
          </p>
          {from && (
            <span className="text-[0.7rem] text-muted-foreground">
              {shortDate(from)} – {shortDate(to)}
            </span>
          )}
        </div>
        {items.length === 0 ? (
          <p className="py-2 text-center text-sm text-muted-foreground">
            Keep logging — patterns show up after a few weeks.
          </p>
        ) : (
          <div className="flex flex-col gap-3.5">
            {items.map((x) => {
              const { Icon, color } = ICONS[x.id];
              return (
                <div key={x.id} className="flex items-start gap-3">
                  <span
                    className="flex size-8 shrink-0 items-center justify-center rounded-lg"
                    style={{ background: `color-mix(in srgb, ${color} 16%, transparent)`, color }}
                  >
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-snug text-foreground">{x.title}</p>
                    <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{x.detail}</p>
                  </div>
                  {x.month && (
                    <span className="mt-0.5 shrink-0 rounded-full border border-border px-2 py-0.5 text-[0.65rem] font-medium text-muted-foreground">
                      {x.month.toLocaleDateString("en-IN", { month: "short" })}
                    </span>
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
