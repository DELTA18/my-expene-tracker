import { Card, CardContent } from "@/components/ui/card";

export function ConnectDatabaseScreen() {
  return (
    <div className="mx-auto flex min-h-svh w-full max-w-[560px] flex-col justify-center gap-4 px-5 py-10">
      <Card>
        <CardContent className="flex flex-col gap-3">
          <h1 className="font-heading text-xl font-semibold">
            Almost there — connect a database
          </h1>
          <p className="text-sm text-muted-foreground">
            Pocket Ledger needs a free Firebase project to store your
            expenses. Create one, then add its config values to{" "}
            <code className="rounded bg-secondary px-1.5 py-0.5 font-mono text-xs">
              .env.local
            </code>{" "}
            (see <code className="rounded bg-secondary px-1.5 py-0.5 font-mono text-xs">README.md</code>{" "}
            in the project) and restart the app.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
