import { Button } from "@/components/ui/button";

export function AppHeader({ profile, onSignOut }) {
  return (
    <header className="flex items-center justify-between gap-3 px-0.5">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Pocket Ledger
        </h1>
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          every rupee, logged
        </span>
      </div>
      <div className="flex items-center gap-2">
        {profile.photoURL ? (
          <img
            src={profile.photoURL}
            alt=""
            referrerPolicy="no-referrer"
            className="h-7 w-7 shrink-0 rounded-full"
          />
        ) : (
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold">
            {profile.username.slice(0, 1).toUpperCase()}
          </span>
        )}
        <Button type="button" variant="ghost" size="sm" onClick={onSignOut}>
          Sign out
        </Button>
      </div>
    </header>
  );
}
