import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import { categoryColor } from "@/lib/expense-utils";

export function CategoryPicker({ categoryRows, activeKey, onSelect, onEdit }) {
  return (
    <div className="flex items-center gap-2">
      <div className="cat-picker">
        {categoryRows.map((row, i) => (
          <div className="cat-picker-row" key={i}>
            {row.map((c) => (
              <button
                key={c.key}
                type="button"
                className="chip"
                style={{ "--chip-color": categoryColor(c) }}
                data-active={activeKey === c.key}
                onClick={() => onSelect(c.key)}
              >
                <span className="dot" style={{ background: categoryColor(c) }} />
                {c.label}
              </button>
            ))}
          </div>
        ))}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Edit categories"
        onClick={onEdit}
        className="shrink-0"
      >
        <Pencil />
      </Button>
    </div>
  );
}
