import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useExpenseForm } from "@/hooks/useExpenseForm";
import { CategoryPicker } from "@/components/category-picker";
import { CategoryEditor } from "@/components/category-editor";
import { SplitSection } from "@/components/split-section";

export function ExpenseForm({ user, categories, categoryByKey, categoryRows, recentPeople, saveCategories, onError }) {
  const [editingCategories, setEditingCategories] = useState(false);
  const form = useExpenseForm({ user, categories, categoryByKey, recentPeople, onError });

  return (
    <Card className="fade-in-up">
      <CardContent>
        <form onSubmit={form.handleSubmit} className="flex flex-col gap-3.5">
          <div className="flex items-stretch gap-2.5">
            <div className="amount-field flex-1">
              <span className="currency">₹</span>
              <input
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
              className="w-[136px] shrink-0 !h-auto rounded-[calc(var(--radius)-2px)] border-input bg-secondary px-3 py-2.5 text-sm text-muted-foreground"
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

          <Button type="submit" className="h-auto py-3 text-sm font-semibold">
            Add expense
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
