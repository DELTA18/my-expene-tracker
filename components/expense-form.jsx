import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useExpenseForm } from "@/hooks/useExpenseForm";
import { CategoryPicker } from "@/components/category-picker";
import { CategoryEditor } from "@/components/category-editor";
import { SplitSection } from "@/components/split-section";
import { categoryColor, todayStr } from "@/lib/expense-utils";

const COIN_COLORS = ["var(--good)", "var(--primary)", "var(--chart-2)", "var(--chart-4)", "var(--chart-5)"];

// Ballistic burst: each particle gets a launch angle biased upward/outward,
// a peak (apex of the arc) and an end point well below the peak so the
// fall reads as gravity pulling it back down, not a straight-line fade.
// Distance is power-biased so most particles cluster near the button with
// a few flying further, giving the cluster depth instead of a uniform ring.
// Count/size scale gently with the expense amount so a big entry feels like
// a bigger deal than a small one.
function makeCoinBurst({ amt = 0, color } = {}) {
  const intensity = Math.max(10, Math.min(24, Math.round(10 + Math.log10(amt + 1) * 6)));
  const sizeScale = 1 + (Math.min(amt, 2000) / 2000) * 0.35;
  const palette = color ? [color, color, "var(--good)", color, "var(--primary)"] : COIN_COLORS;
  return Array.from({ length: intensity }, (_, i) => {
    const angle = ((Math.random() * 160 - 80) * Math.PI) / 180;
    const distance = (18 + Math.pow(Math.random(), 1.7) * 76) * sizeScale;
    const tx = Math.sin(angle) * distance;
    const peak = -(22 + Math.abs(Math.cos(angle)) * distance * 0.9);
    return {
      id: i,
      style: {
        "--tx": `${tx.toFixed(1)}px`,
        "--ty-peak": `${peak.toFixed(1)}px`,
        "--ty-end": `${(peak + 46 + Math.random() * 30).toFixed(1)}px`,
        "--rot": `${Math.round(Math.random() * 720 - 360)}deg`,
        "--delay": `${Math.round(Math.random() * 70)}ms`,
        "--size": `${((5 + Math.random() * 5) * sizeScale).toFixed(1)}px`,
        "--color": palette[i % palette.length],
        left: `${18 + Math.random() * 64}%`,
      },
    };
  });
}

// The typed amount lifts out of the field and drops into the summary total.
// The summary card answers the "prepare" event only when it's a sensible
// landing spot (right period, unfiltered, on screen) — it then holds its
// total until `release(true)` so the count-up starts on impact, not before.
const FLIGHT_MS = 750;

function prepareFlight(date) {
  const detail = { date, target: null, release: null };
  if (typeof window === "undefined") return detail;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return detail;
  window.dispatchEvent(new CustomEvent("expense-fly-prepare", { detail }));
  return detail;
}

function launchFlight({ fromEl, target, text, color, release }) {
  const from = fromEl.getBoundingClientRect();
  const to = target.getBoundingClientRect();

  const ghost = document.createElement("div");
  ghost.className = "fly-ghost";
  const xTrack = document.createElement("div");
  const yTrack = document.createElement("div");
  yTrack.className = "fly-track";
  const label = document.createElement("span");
  label.className = "fly-amount";
  label.textContent = text;
  label.style.color = color;
  yTrack.appendChild(label);
  xTrack.appendChild(yTrack);
  ghost.appendChild(xTrack);
  document.body.appendChild(ghost);

  const startX = from.left + label.offsetWidth / 2;
  const startY = from.top + from.height / 2;
  ghost.style.left = `${startX}px`;
  ghost.style.top = `${startY}px`;
  const dx = to.left + to.width / 2 - startX;
  const dy = to.top + to.height / 2 - startY;

  // Horizontal and vertical motion run on separate elements with different
  // easings — a steady glide across plus a hop-then-fall down traces a
  // ballistic arc without hand-computing a curve.
  xTrack.animate([{ transform: "translateX(0)" }, { transform: `translateX(${dx}px)` }], {
    duration: FLIGHT_MS,
    easing: "cubic-bezier(0.45, 0, 0.55, 1)",
    fill: "forwards",
  });
  const fall = yTrack.animate(
    [
      { transform: "translateY(0) scale(1)", easing: "cubic-bezier(0.2, 0.8, 0.4, 1)" },
      { transform: "translateY(-34px) scale(1.25)", offset: 0.28, easing: "cubic-bezier(0.55, 0, 0.9, 0.45)" },
      { transform: `translateY(${dy}px) scale(0.5)`, opacity: 0.85 },
    ],
    { duration: FLIGHT_MS, fill: "forwards" }
  );
  fall.finished
    .catch(() => {})
    .then(() => {
      ghost.remove();
      release(true);
    });
}

export function ExpenseForm({ user, categories, categoryByKey, categoryRows, recentPeople, saveCategories, onError }) {
  const [editingCategories, setEditingCategories] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [burst, setBurst] = useState(null);
  const amountRef = useRef(null);
  const currencyRef = useRef(null);
  const form = useExpenseForm({ user, categories, categoryByKey, recentPeople, onError });
  // The date sticks between submits so a batch of backdated entries only
  // needs it picked once — flagged here so it isn't left there by accident.
  const isBackdated = form.date !== todayStr();

  // A PWA home-screen shortcut (see manifest.js) links to /?add=1 so
  // forgetting to log something has less friction to overcome — no tab
  // navigation, land straight in the amount field with the keyboard already
  // up. The param is stripped right after so a later reload doesn't refocus.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("add") !== "1") return;
    amountRef.current?.focus();
    const url = new URL(window.location.href);
    url.searchParams.delete("add");
    window.history.replaceState({}, "", url);
  }, []);

  async function handleSubmit(e) {
    const amt = parseFloat(form.amount) || 0;
    const color = categoryColor(categoryByKey[form.category]);
    const flight = prepareFlight(form.date);
    const ok = await form.handleSubmit(e);
    if (ok && flight.target && currencyRef.current) {
      launchFlight({
        fromEl: currencyRef.current,
        target: flight.target,
        text: `₹${amt.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`,
        color,
        release: flight.release,
      });
    } else {
      flight.release?.(false);
    }
    if (ok) {
      setJustSaved(true);
      setBurst({ key: Date.now(), color, particles: makeCoinBurst({ amt, color }) });
      if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(10);
      setTimeout(() => setJustSaved(false), 1100);
      setTimeout(() => setBurst(null), 850);
    }
  }

  return (
    <Card className="fade-in-up">
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          <div className="flex items-stretch gap-2.5">
            <div className="amount-field flex-1">
              <span ref={currencyRef} className="currency">₹</span>
              <input
                ref={amountRef}
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                placeholder="0.00"
                required
                value={form.amount}
                onChange={(e) => form.setAmount(e.target.value)}
              />
            </div>
            <Input
              type="date"
              required
              value={form.date}
              onChange={(e) => form.setDate(e.target.value)}
              data-past={isBackdated}
              className="w-[136px] shrink-0 !h-auto rounded-[calc(var(--radius)-2px)] border-input bg-secondary px-3 py-2.5 text-sm text-muted-foreground data-[past=true]:border-primary/40 data-[past=true]:bg-primary/10 data-[past=true]:font-medium data-[past=true]:text-primary"
            />
          </div>

          <CategoryPicker
            categoryRows={categoryRows}
            activeKey={form.category}
            onSelect={form.setCategory}
            onEdit={() => setEditingCategories(true)}
          />

          {editingCategories && (
            <CategoryEditor
              categories={categories}
              onSave={saveCategories}
              onClose={() => setEditingCategories(false)}
            />
          )}

          <SplitSection split={form.split} amount={form.amount} user={user} />

          <Label htmlFor="note" className="sr-only">
            Note
          </Label>
          <Input
            id="note"
            type="text"
            placeholder="Add a note (optional)"
            maxLength={80}
            value={form.note}
            onChange={(e) => form.setNote(e.target.value)}
            className="!h-auto rounded-[calc(var(--radius)-2px)] border-input bg-secondary px-3.5 py-2.5 text-sm"
          />

          <Button
            type="submit"
            data-saved={justSaved}
            className="submit-btn h-auto py-3 text-sm font-semibold"
          >
            {justSaved ? (
              <span className="flex items-center justify-center gap-1.5">
                <Check className="check-icon size-4" /> Added
              </span>
            ) : (
              "Add expense"
            )}
            {burst && (
              <span className="coin-burst" aria-hidden="true">
                <span className="coin-shock" style={{ "--shock-color": burst.color }} />
                {burst.particles.map((p) => (
                  <span key={`${burst.key}-${p.id}`} className="coin-particle" style={p.style} />
                ))}
              </span>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
