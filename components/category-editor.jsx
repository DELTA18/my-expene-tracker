import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SWATCHES, categoryColor, uid } from "@/lib/expense-utils";

export function CategoryEditor({ categories, onSave, onClose }) {
  // Normalize legacy hex-based categories onto the validated slot palette
  // the moment the editor is opened, so a plain Save migrates them.
  const [draft, setDraft] = useState(() =>
    categories.map((c, i) => ({
      key: c.key,
      label: c.label,
      colorSlot: c.colorSlot || ((i % 8) + 1),
    }))
  );
  const [newLabel, setNewLabel] = useState("");
  const [newColor, setNewColor] = useState(SWATCHES[0]);
  const [colorPickerFor, setColorPickerFor] = useState(null);

  function updateLabel(key, label) {
    setDraft((list) => list.map((c) => (c.key === key ? { ...c, label } : c)));
  }

  function updateColor(key, colorSlot) {
    setDraft((list) => list.map((c) => (c.key === key ? { ...c, colorSlot } : c)));
  }

  function removeCategory(key) {
    setDraft((list) => (list.length <= 1 ? list : list.filter((c) => c.key !== key)));
  }

  function addCategory() {
    const label = newLabel.trim();
    if (!label) return;
    setDraft((list) => [...list, { key: uid(), label, colorSlot: newColor }]);
    setNewLabel("");
  }

  async function handleSave() {
    const ok = await onSave(draft);
    if (ok) onClose();
  }

  return (
    <div className="flex flex-col gap-3 rounded-[calc(var(--radius)-2px)] border border-border bg-secondary/60 p-3">
      <p className="text-xs font-medium text-muted-foreground">Manage categories</p>
      <div className="flex flex-col gap-2">
        {draft.map((c) => (
          <div key={c.key} className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: categoryColor(c) }}
                aria-label={`Change color for ${c.label}`}
                onClick={() => setColorPickerFor((k) => (k === c.key ? null : c.key))}
              />
              <input
                type="text"
                value={c.label}
                maxLength={24}
                onChange={(e) => updateLabel(c.key, e.target.value)}
                className="h-8 flex-1 rounded-md border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring"
              />
              <button
                type="button"
                className="del-btn"
                aria-label={`Remove ${c.label}`}
                disabled={draft.length <= 1}
                onClick={() => removeCategory(c.key)}
              >
                ×
              </button>
            </div>
            {colorPickerFor === c.key && (
              <div className="swatch-picker pl-[18px]">
                {SWATCHES.map((slot) => (
                  <button
                    key={slot}
                    type="button"
                    className="swatch-btn"
                    style={{ "--sw-color": `var(--series-${slot})` }}
                    data-active={c.colorSlot === slot}
                    aria-label={`Pick color ${slot}`}
                    onClick={() => {
                      updateColor(c.key, slot);
                      setColorPickerFor(null);
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 pt-0.5">
        <span className="text-xs text-muted-foreground">New:</span>
        <div className="swatch-picker">
          {SWATCHES.map((slot) => (
            <button
              key={slot}
              type="button"
              aria-label={`Pick color ${slot}`}
              onClick={() => setNewColor(slot)}
              className="swatch-btn"
              style={{ "--sw-color": `var(--series-${slot})` }}
              data-active={newColor === slot}
            />
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={newLabel}
          maxLength={24}
          placeholder="New category"
          onChange={(e) => setNewLabel(e.target.value)}
          className="h-8 flex-1 rounded-md border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring"
        />
        <Button type="button" size="sm" variant="secondary" onClick={addCategory}>
          Add
        </Button>
      </div>

      <div className="flex justify-end gap-2 pt-0.5">
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button type="button" size="sm" onClick={handleSave}>
          Save
        </Button>
      </div>
    </div>
  );
}
