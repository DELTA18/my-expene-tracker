import { CategoryBreakdown } from "@/components/category-breakdown";
import { DailySpendChart } from "@/components/daily-spend-chart";
import { SixMonthChart } from "@/components/six-month-chart";

export function InsightsPanel({
  viewMonth,
  onShiftMonth,
  total,
  categoryTotals,
  maxCategoryAmount,
  dailySeries,
  maxDaily,
  sixMonthSeries,
  maxSixMonth,
}) {
  return (
    <>
      <CategoryBreakdown
        viewMonth={viewMonth}
        onShiftMonth={onShiftMonth}
        categoryTotals={categoryTotals}
        maxCategoryAmount={maxCategoryAmount}
      />
      <DailySpendChart
        viewMonth={viewMonth}
        total={total}
        dailySeries={dailySeries}
        maxDaily={maxDaily}
      />
      <SixMonthChart sixMonthSeries={sixMonthSeries} maxSixMonth={maxSixMonth} />
    </>
  );
}
