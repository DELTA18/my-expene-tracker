import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ProfileSetupScreen({ user, onSave }) {
  const [nameDraft, setNameDraft] = useState(user.displayName || "");
  const [usePhoto, setUsePhoto] = useState(true);

  function handleSubmit(e) {
    e.preventDefault();
    onSave(nameDraft, usePhoto);
  }

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-[560px] flex-col items-center justify-center gap-6 px-5 py-10 text-center">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Set up your profile
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">
          This is what people you split expenses with will see.
        </p>
      </div>
      <Card className="w-full">
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-left">
            <div>
              <Label htmlFor="profile-name">Your name</Label>
              <Input
                id="profile-name"
                type="text"
                required
                maxLength={40}
                placeholder="e.g. Raj"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                className="!h-auto mt-1.5 rounded-[calc(var(--radius)-2px)] border-input bg-secondary px-3.5 py-2.5 text-sm"
              />
            </div>
            {user.photoURL && (
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={usePhoto}
                  onChange={(e) => setUsePhoto(e.target.checked)}
                />
                Use my Google account photo
              </label>
            )}
            <Button type="submit" className="h-auto py-3 text-sm font-semibold">
              Save and continue
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
