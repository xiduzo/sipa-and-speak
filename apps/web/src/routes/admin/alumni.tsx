// Admin — TU/e alumni registry. Emails listed here may register despite not
// matching the TU/e institutional domain. Replaces the previously hardcoded
// list. Guarded server-side by moderatorProcedure; beforeLoad here only
// requires a session.

import { Button } from "@sip-and-speak/ui/components/button";
import { Input } from "@sip-and-speak/ui/components/input";
import { Label } from "@sip-and-speak/ui/components/label";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/utils/trpc";

export const Route = createFileRoute("/admin/alumni")({
  component: AdminAlumniScreen,
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session.data) {
      redirect({ to: "/login", throw: true });
    }
    return { session };
  },
});

function AdminAlumniScreen() {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  const invalidate = () =>
    queryClient.invalidateQueries(trpc.adminAlumni.findAll.queryOptions());

  const alumniQuery = useQuery(trpc.adminAlumni.findAll.queryOptions());
  const entries = alumniQuery.data ?? [];

  const addMutation = useMutation(
    trpc.adminAlumni.add.mutationOptions({
      onSuccess: () => {
        toast.success("Alumni email added");
        setEmail("");
        invalidate();
      },
      onError: (err) => setError(err.message),
    }),
  );

  const removeMutation = useMutation(
    trpc.adminAlumni.remove.mutationOptions({
      onSuccess: () => {
        toast.success("Alumni email removed");
        invalidate();
      },
      onError: (err) => toast.error(err.message),
    }),
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes("@")) {
      setError("Enter a valid email address.");
      return;
    }
    addMutation.mutate({ email: trimmed });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6 sm:p-8">
      <PageHeader
        eyebrow="back of house"
        title="Alumni registry"
        description="Emails here may register even without a TU/e institutional address."
      />

      <form onSubmit={handleSubmit} className="flex items-end gap-2">
        <div className="flex flex-col gap-1 flex-1">
          <Label htmlFor="alumni-email">Add email</Label>
          <Input
            id="alumni-email"
            data-testid="alumni-email-input"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError(null);
            }}
            placeholder="alumnus@gmail.com"
            disabled={addMutation.isPending}
          />
          {error && (
            <p data-testid="alumni-email-error" className="text-destructive text-sm">
              {error}
            </p>
          )}
        </div>
        <Button
          type="submit"
          data-testid="alumni-add-btn"
          disabled={addMutation.isPending}
        >
          Add
        </Button>
      </form>

      {alumniQuery.isPending ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : entries.length === 0 ? (
        <p
          data-testid="empty-alumni"
          className="text-muted-foreground text-center py-16"
        >
          No alumni emails yet. Add the first one.
        </p>
      ) : (
        <ul
          data-testid="alumni-list"
          className="divide-y divide-border rounded-lg border"
        >
          {entries.map((entry) => (
            <li
              key={entry.id}
              data-testid="alumni-row"
              className="flex items-center justify-between gap-4 p-4"
            >
              <span className="text-foreground truncate">{entry.email}</span>
              <Button
                variant="outline"
                size="sm"
                data-testid="alumni-remove-btn"
                disabled={removeMutation.isPending}
                onClick={() => removeMutation.mutate({ id: entry.id })}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
