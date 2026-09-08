import { Button } from "@/components/ui/button";

export function MonthNav({ viewMonth, onShift }) {
  return (
    <div className="mb-3.5 flex items-center justify-between">
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="Previous month"
        onClick={() => onShift(-1)}
      >
        ‹
      </Button>
      <span className="font-heading text-base font-semibold">
        {viewMonth.toLocaleDateString("en-IN", {
          month: "long",
          year: "numeric",
        })}
      </span>
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="Next month"
        onClick={() => onShift(1)}
      >
        ›
      </Button>
    </div>
  );
}
