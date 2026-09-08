import { useState } from "react";
import { Button } from "@/components/ui/button";
import { dateKey, daysInMonth, shiftMonth, todayStr } from "@/lib/expense-utils";

const WEEKDAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

// Month browsed here is local and separate from the confirmed `value` — it
// only becomes the real selection once a day cell is clicked. Days after
// today are disabled, same as the next-day arrow in the card itself.
export function DayPicker({ value, onSelect }) {
  const [displayMonth, setDisplayMonth] = useState(new Date(value.getFullYear(), value.getMonth(), 1));

  const nDays = daysInMonth(displayMonth);
  const firstDow = new Date(displayMonth.getFullYear(), displayMonth.getMonth(), 1).getDay();
  const today = todayStr();
  const selectedKey = dateKey(value);

  return (
    <div className="w-64">
      <div className="mb-2 flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Previous month"
          onClick={() => setDisplayMonth((m) => shiftMonth(m, -1))}
        >
          ‹
        </Button>
        <span className="font-heading text-sm font-semibold">
          {displayMonth.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Next month"
          onClick={() => setDisplayMonth((m) => shiftMonth(m, 1))}
        >
          ›
        </Button>
      </div>
      <div className="grid grid-cols-7 text-center text-[0.7rem] font-medium text-muted-foreground">
        {WEEKDAY_LABELS.map((w) => (
          <span key={w} className="py-1">
            {w}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: firstDow }).map((_, i) => (
          <span key={"blank" + i} />
        ))}
        {Array.from({ length: nDays }, (_, i) => i + 1).map((day) => {
          const d = new Date(displayMonth.getFullYear(), displayMonth.getMonth(), day);
          const key = dateKey(d);
          const isFuture = key > today;
          return (
            <button
              key={day}
              type="button"
              disabled={isFuture}
              data-active={key === selectedKey}
              data-today={key === today}
              className="rounded-lg py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:pointer-events-none disabled:opacity-30 data-[today=true]:ring-1 data-[today=true]:ring-primary/50 data-[active=true]:bg-primary data-[active=true]:text-primary-foreground"
              onClick={() => onSelect(d)}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
