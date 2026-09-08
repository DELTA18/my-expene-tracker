import { useState } from "react";
import { Button } from "@/components/ui/button";

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Year browsed here is local and separate from the confirmed `value` — it
// only becomes the real selection once a month cell is clicked.
export function MonthPicker({ value, onSelect }) {
  const [year, setYear] = useState(value.getFullYear());

  return (
    <div className="w-56">
      <div className="mb-2 flex items-center justify-between">
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Previous year" onClick={() => setYear((y) => y - 1)}>
          ‹
        </Button>
        <span className="font-heading text-sm font-semibold">{year}</span>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Next year" onClick={() => setYear((y) => y + 1)}>
          ›
        </Button>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {MONTH_LABELS.map((label, i) => {
          const isSelected = year === value.getFullYear() && i === value.getMonth();
          return (
            <button
              key={label}
              type="button"
              data-active={isSelected}
              className="rounded-lg py-2 text-xs font-medium text-muted-foreground hover:bg-muted data-[active=true]:bg-primary data-[active=true]:text-primary-foreground"
              onClick={() => onSelect(new Date(year, i, 1))}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
