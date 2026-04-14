// #80 — Moderator flag detail view
// TODO: Tighten auth guard to Moderator role once role field is added to user schema

import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";

import { authClient } from "@/lib/auth-client";
import { trpc } from "@/utils/trpc";

export const Route = createFileRoute("/moderator/flags/$flagId")({
  component: FlagDetailScreen,
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session.data) {
      redirect({ to: "/login", throw: true });
    }
    return { session };
  },
});

function FlagDetailScreen() {
  const { flagId } = Route.useParams();
  const { data: flag, isLoading } = useQuery(
    trpc.moderation.getFlagDetail.queryOptions({ flagId }),
  );

  if (isLoading) {
    return <p className="p-6 text-muted-foreground">Loading flag detail…</p>;
  }

  if (!flag) {
    return <p className="p-6 text-destructive">Flag not found.</p>;
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <Link to="/moderator/flags" className="text-sm text-muted-foreground hover:underline">
        ← Back to queue
      </Link>

      <section className="space-y-2">
        <h1 className="text-2xl font-semibold">Flag detail</h1>
        {flag.flaggedStudent.removed ? (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
            Student removed
          </p>
        ) : null}
      </section>

      <section className="space-y-1">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Flagged student
        </h2>
        <p className="font-medium">
          {flag.flaggedStudent.name ?? "Removed student"}
        </p>
      </section>

      <section className="space-y-1">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Reason
        </h2>
        <p>{flag.reason}</p>
        {flag.detail ? (
          <p className="text-sm text-muted-foreground">{flag.detail}</p>
        ) : null}
        <time className="text-xs text-muted-foreground">
          Submitted {new Date(flag.submittedAt).toLocaleString()}
        </time>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Prior flag history
        </h2>
        {flag.priorFlags.length === 0 ? (
          <p className="text-sm text-muted-foreground">No prior flags.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border">
            {flag.priorFlags.map((prior, i) => (
              <li key={i} className="flex items-start gap-4 p-3 text-sm">
                <div className="flex-1 space-y-0.5">
                  <p className="font-medium">{prior.reason}</p>
                  {prior.outcome ? (
                    <p className="text-muted-foreground capitalize">
                      Outcome: {prior.outcome}
                    </p>
                  ) : null}
                </div>
                <time className="text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(prior.resolvedAt).toLocaleString()}
                </time>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex gap-3 pt-2">
        <button
          disabled
          className="rounded-md border px-4 py-2 text-sm font-medium opacity-50 cursor-not-allowed"
        >
          Warn
        </button>
        <button
          disabled={flag.flaggedStudent.removed}
          className="rounded-md border px-4 py-2 text-sm font-medium opacity-50 cursor-not-allowed"
        >
          Suspend
        </button>
        <button
          disabled={flag.flaggedStudent.removed}
          className="rounded-md border px-4 py-2 text-sm font-medium opacity-50 cursor-not-allowed"
        >
          Remove
        </button>
      </section>
    </div>
  );
}
