import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { GoogleIcon } from "@/components/google-icon";

export function SignInScreen({ authError, onSignIn }) {
  return (
    <div className="mx-auto flex min-h-svh w-full max-w-[560px] flex-col items-center justify-center gap-6 px-5 py-10 text-center">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Pocket Ledger
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">every rupee, logged</p>
      </div>
      <Card className="w-full">
        <CardContent className="flex flex-col items-center gap-4 py-8">
          <p className="text-sm text-muted-foreground">
            Sign in to see and add your own expenses.
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={onSignIn}
            className="h-auto gap-2.5 py-3 px-5 text-sm font-semibold"
          >
            <GoogleIcon /> Continue with Google
          </Button>
          {authError && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-left text-xs text-destructive">
              {authError}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
