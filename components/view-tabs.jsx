export function ViewTabs({ view, onChange, hasBalances }) {
  return (
    <div className="tabs self-start">
      <button
        type="button"
        className="tab-btn"
        data-active={view === "ledger"}
        onClick={() => onChange("ledger")}
      >
        Ledger
      </button>
      <button
        type="button"
        className="tab-btn"
        data-active={view === "insights"}
        onClick={() => onChange("insights")}
      >
        Insights
      </button>
      <button
        type="button"
        className="tab-btn"
        data-active={view === "balances"}
        onClick={() => onChange("balances")}
      >
        Balances
        {hasBalances && <span className="tab-dot" />}
      </button>
    </div>
  );
}
