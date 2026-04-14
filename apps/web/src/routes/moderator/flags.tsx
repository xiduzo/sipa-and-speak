// #78 — Moderator flag queue: list all open flags sorted oldest first
// TODO: Tighten auth guard to Moderator role once role field is added to user schema

import { useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";

import { authClient } from "@/lib/auth-client";
import { trpc } from "@/utils/trpc";

export const Route = createFileRoute("/moderator/flags")({
  component: ModeratorflagsScreen,
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session.data) {
      redirect({ to: "/login", throw: true });
    }
    return { session };
  },
});

function ModeratorflagsScreen() {
  const { data: flags = [], isLoading } = useQuery(
    trpc.moderation.listOpenFlags.queryOptions(),
  );

  if (isLoading) {
    return <p className="p-6 text-muted-foreground">Loading flag queue…</p>;
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Open flags</h1>
      <ul className="divide-y divide-border rounded-lg border">
        {flags.map((flag) => (
          <li key={flag.flagId} className="flex items-start gap-4 p-4">
            <div className="flex-1 space-y-1">
              <p className="font-medium">{flag.flaggedStudent.name ?? "Removed student"}</p>
              <p className="text-sm text-muted-foreground">{flag.reason}</p>
            </div>
            <time className="text-xs text-muted-foreground whitespace-nowrap">
              {new Date(flag.submittedAt).toLocaleString()}
            </time>
          </li>
        ))}
      </ul>
    </div>
  );
}
