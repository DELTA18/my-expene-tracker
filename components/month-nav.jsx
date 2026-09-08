import { PeriodNav } from "@/components/period-nav";

export function MonthNav({ viewMonth, onShift }) {
  return (
    <PeriodNav
      label={viewMonth.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
      prevLabel="Previous month"
      nextLabel="Next month"
      onPrev={() => onShift(-1)}
      onNext={() => onShift(1)}
    />
  );
}
