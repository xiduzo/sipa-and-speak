// #80 — Moderator flag detail view
// #88 — Warn action with loading/success states
// #98 — Suspend action with loading/success states
// TODO: Tighten auth guard to Moderator role once role field is added to user schema

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  const queryClient = useQueryClient();
  const { data: flag, isLoading } = useQuery(
    trpc.moderation.getFlagDetail.queryOptions({ flagId }),
  );

  const warnMutation = useMutation(
    trpc.moderation.warnStudent.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.moderation.getFlagDetail.queryOptions({ flagId }));
        queryClient.invalidateQueries(trpc.moderation.listOpenFlags.queryOptions());
      },
    }),
  );

  const suspendMutation = useMutation(
    trpc.moderation.suspendStudent.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.moderation.getFlagDetail.queryOptions({ flagId }));
        queryClient.invalidateQueries(trpc.moderation.listOpenFlags.queryOptions());
      },
    }),
  );

  const liftSuspensionMutation = useMutation(
    trpc.moderation.liftSuspension.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.moderation.getFlagDetail.queryOptions({ flagId }));
      },
    }),
  );

  const warnError = warnMutation.isError
    ? "Action no longer available. The flag may have already been resolved."
    : undefined;

  const suspendError = suspendMutation.isError
    ? "Action no longer available. The flag may have already been resolved."
    : undefined;

  if (isLoading) {
    return <p className="p-6 text-muted-foreground">Loading flag detail…</p>;
  }

  if (!flag) {
    return <p className="p-6 text-destructive">Flag not found.</p>;
  }

  if (warnMutation.isSuccess) {
    return (
      <div className="p-6 space-y-4 max-w-2xl">
        <Link to="/moderator/flags" className="text-sm text-muted-foreground hover:underline">
          ← Back to queue
        </Link>
        <div
          className="rounded-md border border-green-500/40 bg-green-500/10 px-4 py-3 text-sm text-green-700"
          data-testid="warn-success"
        >
          Warning issued. The flag has been resolved.
        </div>
      </div>
    );
  }

  if (suspendMutation.isSuccess) {
    return (
      <div className="p-6 space-y-4 max-w-2xl">
        <Link to="/moderator/flags" className="text-sm text-muted-foreground hover:underline">
          ← Back to queue
        </Link>
        <div
          className="rounded-md border border-yellow-500/40 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-700"
          data-testid="suspend-success"
        >
          Student suspended. The flag has been resolved.
        </div>
      </div>
    );
  }

  const studentDisabled = flag.flaggedStudent.suspended || flag.flaggedStudent.removed;
  const disabledReason = flag.flaggedStudent.removed
    ? "Student has already been removed"
    : flag.flaggedStudent.suspended
      ? "Student is already suspended"
      : undefined;

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

      {warnError ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive" data-testid="warn-error">
          {warnError}
        </p>
      ) : null}

      {suspendError ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive" data-testid="suspend-error">
          {suspendError}
        </p>
      ) : null}

      {liftSuspensionMutation.isSuccess ? (
        <div className="rounded-md border border-green-500/40 bg-green-500/10 px-4 py-3 text-sm text-green-700" data-testid="lift-suspension-success">
          Suspension lifted. Student is now active again.
        </div>
      ) : null}

      <section className="flex gap-3 pt-2">
        <span title={disabledReason}>
          <button
            data-testid="btn-warn"
            disabled={studentDisabled || warnMutation.isPending}
            onClick={() => warnMutation.mutate({ flagId })}
            className="rounded-md border px-4 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {warnMutation.isPending ? "Warning…" : "Warn"}
          </button>
        </span>
        <span title={disabledReason}>
          <button
            data-testid="btn-suspend"
            disabled={studentDisabled || suspendMutation.isPending}
            onClick={() => suspendMutation.mutate({ flagId })}
            className="rounded-md border px-4 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {suspendMutation.isPending ? "Suspending…" : "Suspend"}
          </button>
        </span>
        <button
          disabled={flag.flaggedStudent.removed}
          className="rounded-md border px-4 py-2 text-sm font-medium opacity-50 cursor-not-allowed"
        >
          Remove
        </button>
        {flag.flaggedStudent.suspended ? (
          <button
            data-testid="btn-lift-suspension"
            disabled={liftSuspensionMutation.isPending || liftSuspensionMutation.isSuccess}
            onClick={() => liftSuspensionMutation.mutate({ targetId: flag.flaggedStudent.id })}
            className="rounded-md border px-4 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {liftSuspensionMutation.isPending ? "Lifting…" : "Lift Suspension"}
          </button>
        ) : null}
      </section>
    </div>
  );
}
