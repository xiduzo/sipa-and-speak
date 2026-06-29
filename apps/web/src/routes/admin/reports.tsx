// Admin — full report log. Every report ever filed against a student, open and
// resolved, newest first. Open reports link to the existing moderator detail
// view where they can be warned/suspended/removed. Guarded server-side by
// moderatorProcedure; beforeLoad here only requires a session.

import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";

import { PageHeader } from "@/components/page-header";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/utils/trpc";

export const Route = createFileRoute("/admin/reports")({
  component: AdminReportsScreen,
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session.data) {
      redirect({ to: "/login", throw: true });
    }
    return { session };
  },
});

const REASON_LABELS: Record<string, string> = {
  OFFENSIVE_LANGUAGE: "Offensive language",
  HARASSMENT: "Harassment",
  SPAM: "Spam",
  INAPPROPRIATE_BEHAVIOR: "Inappropriate behaviour",
  OTHER: "Other",
};

function reasonLabel(reason: string): string {
  return REASON_LABELS[reason] ?? reason;
}

function AdminReportsScreen() {
  const { data: reports = [], isLoading } = useQuery(
    trpc.moderation.listAllFlags.queryOptions(),
  );

  if (isLoading) {
    return <p className="p-6 text-muted-foreground">Loading reports…</p>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6 sm:p-8">
      <PageHeader
        eyebrow="back of house"
        title="Reports"
        description="Every report filed against a student, open and resolved — newest first."
      />

      {reports.length === 0 ? (
        <p
          data-testid="empty-reports"
          className="text-muted-foreground text-center py-16"
        >
          No reports have been filed.
        </p>
      ) : (
        <ul data-testid="reports-list" className="divide-y divide-border rounded-lg border">
          {reports.map((report) => {
            const isOpen = report.status === "open";
            const body = (
              <div className="flex items-start gap-4 p-4">
                <div className="flex-1 space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">
                      {report.targetName ?? "Removed student"}
                    </span>
                    <span
                      data-testid="report-status"
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        isOpen
                          ? "bg-amber-500/10 text-amber-600"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {isOpen ? "open" : `resolved${report.outcome ? ` · ${report.outcome}` : ""}`}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {reasonLabel(report.reason)}
                    {" · reported by "}
                    {report.reporterName ?? "deleted user"}
                  </p>
                  {report.detail && (
                    <p className="text-sm text-foreground/80 line-clamp-2">
                      {report.detail}
                    </p>
                  )}
                </div>
                <time className="text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(report.createdAt).toLocaleString()}
                </time>
              </div>
            );

            return (
              <li key={report.id} data-testid="report-row">
                {isOpen ? (
                  <Link
                    to="/moderator/flags/$flagId"
                    params={{ flagId: report.id }}
                    className="block hover:bg-muted/50 transition-colors"
                  >
                    {body}
                  </Link>
                ) : (
                  body
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
