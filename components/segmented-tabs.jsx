"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

// Backs both the Ledger/Insights/Balances view switch and the Monthly/Daily
// toggle inside the summary card — same glass pill, same sliding-indicator
// behavior, just a different item list. Measures the active button's own
// box rather than assuming equal-width tabs, since label lengths (and the
// unread-balance dot) vary.
export function SegmentedTabs({ items, value, onChange, size = "default", className }) {
  const containerRef = useRef(null);
  const btnRefs = useRef({});
  const [rect, setRect] = useState(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const btn = btnRefs.current[value];
    if (!container || !btn) return;

    function measure() {
      const cRect = container.getBoundingClientRect();
      const bRect = btn.getBoundingClientRect();
      setRect({ x: bRect.left - cRect.left, width: bRect.width });
    }
    measure();

    // Re-measure on layout changes the value/items deps alone won't catch —
    // a label width shifting from font load, or the container resizing on
    // orientation change.
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, [value, items]);

  return (
    <div ref={containerRef} className={cn("tabs", size === "sm" && "tabs-sm", className)}>
      {rect && (
        <span
          className="tab-indicator"
          style={{ transform: `translateX(${rect.x}px)`, width: `${rect.width}px` }}
          aria-hidden="true"
        />
      )}
      {items.map((item) => (
        <button
          key={item.value}
          ref={(el) => {
            btnRefs.current[item.value] = el;
          }}
          type="button"
          className="tab-btn"
          data-active={value === item.value}
          onClick={() => onChange(item.value)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
