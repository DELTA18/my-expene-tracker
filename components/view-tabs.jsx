import { SegmentedTabs } from "@/components/segmented-tabs";

export function ViewTabs({ view, onChange, hasBalances }) {
  return (
    <SegmentedTabs
      className="self-start"
      value={view}
      onChange={onChange}
      items={[
        { value: "ledger", label: "Ledger" },
        { value: "insights", label: "Insights" },
        {
          value: "balances",
          label: (
            <>
              Balances
              {hasBalances && <span className="tab-dot" />}
            </>
          ),
        },
      ]}
    />
  );
}
