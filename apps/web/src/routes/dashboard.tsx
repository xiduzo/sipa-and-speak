import { Button } from "@sip-and-speak/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";

import { PageHeader } from "@/components/page-header";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/utils/trpc";

export const Route = createFileRoute("/dashboard")({
  component: RouteComponent,
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session.data) {
      redirect({
        to: "/login",
        throw: true,
      });
    }
    const { data: customerState } = await authClient.customer.state();
    return { session, customerState };
  },
});

function RouteComponent() {
  const { session, customerState } = Route.useRouteContext();

  const privateData = useQuery(trpc.privateData.queryOptions());

  const hasProSubscription =
    (customerState?.activeSubscriptions?.length ?? 0) > 0;

  return (
    <div className="mx-auto max-w-3xl p-6 sm:p-8">
      <PageHeader
        eyebrow={`welcome back, ${session.data?.user.name?.split(" ")[0] ?? "friend"}`}
        title="Dashboard"
        description="Your Sip & Speak account at a glance."
      />

      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Current plan</p>
            <p className="mt-1 font-heading text-2xl font-extrabold text-foreground">
              {hasProSubscription ? "Pro" : "Free"}
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              hasProSubscription
                ? "bg-primary/10 text-primary"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {hasProSubscription ? "Active" : "No subscription"}
          </span>
        </div>

        <div className="mt-6">
          {hasProSubscription ? (
            <Button onClick={async () => await authClient.customer.portal()}>
              Manage subscription
            </Button>
          ) : (
            <Button
              onClick={async () => await authClient.checkout({ slug: "pro" })}
            >
              Upgrade to Pro
            </Button>
          )}
        </div>

        {privateData.data?.message && (
          <p className="mt-6 border-t border-border pt-4 text-xs text-muted-foreground">
            {privateData.data.message}
          </p>
        )}
      </div>
    </div>
  );
}
