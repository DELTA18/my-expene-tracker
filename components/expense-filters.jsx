"use client";

import { Check, ChevronDown, ListFilter, X } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { categoryColor } from "@/lib/expense-utils";

function toggle(list, value) {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

// Trigger text for a multi-select: nothing picked reads as the neutral
// "everything" label, one pick shows itself, more than one shows the first
// plus a count so the chip never grows past a line of text.
function summarize(selectedLabels, allLabel) {
  if (selectedLabels.length === 0) return allLabel;
  if (selectedLabels.length === 1) return selectedLabels[0];
  return `${selectedLabels[0]} +${selectedLabels.length - 1}`;
}

function FilterCheckbox({ checked, label, color, photoURL, onClick }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-foreground hover:bg-muted"
    >
      <span
        data-checked={checked}
        className="flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] border border-input data-[checked=true]:border-primary data-[checked=true]:bg-primary"
      >
        {checked && <Check className="size-3 text-primary-foreground" />}
      </span>
      {color && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />}
      {photoURL && (
        <img src={photoURL} alt="" referrerPolicy="no-referrer" className="h-5 w-5 shrink-0 rounded-full" />
      )}
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </button>
  );
}

// Same popover shell for both filters below — only the option list differs.
// Left uncontrolled (no open/onOpenChange) since picking an option no longer
// needs to close it: multiple picks happen in one sitting, closed by
// tapping the trigger again or clicking outside.
function FilterMenu({ triggerLabel, active, children }) {
  return (
    <Popover>
      <PopoverTrigger className="filter-chip max-w-[10.5rem]" data-active={active}>
        <span className="min-w-0 truncate">{triggerLabel}</span>
        <ChevronDown className="size-3.5 shrink-0" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-1.5">
        <div className="flex max-h-72 flex-col gap-0.5 overflow-y-auto">{children}</div>
      </PopoverContent>
    </Popover>
  );
}

export function ExpenseFilters({
  categories,
  filterCategories,
  onChangeCategories,
  userOptions,
  filterUsers,
  onChangeUsers,
}) {
  const userLabelByUid = Object.fromEntries(userOptions.map((p) => [p.uid, p.label]));
  const selectedUserLabels = filterUsers.map((uid) => userLabelByUid[uid]).filter(Boolean);
  const hasFilters = filterCategories.length > 0 || filterUsers.length > 0;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <ListFilter className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      <FilterMenu
        triggerLabel={summarize(filterCategories, "Category")}
        active={filterCategories.length > 0}
      >
        <button
          type="button"
          onClick={() => onChangeCategories([])}
          className="mb-1 flex w-full items-center rounded-lg border-b border-border px-2.5 pb-2 pt-1 text-left text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          All categories
        </button>
        {categories.map((c) => (
          <FilterCheckbox
            key={c.key}
            checked={filterCategories.includes(c.label)}
            label={c.label}
            color={categoryColor(c)}
            onClick={() => onChangeCategories(toggle(filterCategories, c.label))}
          />
        ))}
      </FilterMenu>

      <FilterMenu
        triggerLabel={summarize(selectedUserLabels, "Person")}
        active={filterUsers.length > 0}
      >
        <button
          type="button"
          onClick={() => onChangeUsers([])}
          className="mb-1 flex w-full items-center rounded-lg border-b border-border px-2.5 pb-2 pt-1 text-left text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          Everyone
        </button>
        {userOptions.map((p) => (
          <FilterCheckbox
            key={p.uid}
            checked={filterUsers.includes(p.uid)}
            label={p.label}
            photoURL={p.photoURL}
            onClick={() => onChangeUsers(toggle(filterUsers, p.uid))}
          />
        ))}
      </FilterMenu>

      {hasFilters && (
        <button
          type="button"
          aria-label="Clear filters"
          onClick={() => {
            onChangeCategories([]);
            onChangeUsers([]);
          }}
          className="flex shrink-0 items-center gap-1 rounded-full px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted"
        >
          <X className="size-3.5" />
          Clear
        </button>
      )}
    </div>
  );
}
