import { Button } from "@/components/ui/button";

// Shared arrows+label shell for stepping through a month or a day. The label
// is centered relative to the two arrows, which stay equal-width so that
// centering holds regardless of label content. `labelSlot`, when given,
// replaces the plain text label with something interactive (e.g. a picker
// trigger) without disturbing that layout.
export function PeriodNav({ label, labelSlot, prevLabel, nextLabel, onPrev, onNext, nextDisabled }) {
  return (
    <div className="mb-3.5 flex items-center justify-between">
      <Button type="button" variant="outline" size="icon" aria-label={prevLabel} onClick={onPrev}>
        ‹
      </Button>
      {labelSlot ?? <span className="font-heading text-base font-semibold">{label}</span>}
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label={nextLabel}
        onClick={onNext}
        disabled={nextDisabled}
      >
        ›
      </Button>
    </div>
  );
}
