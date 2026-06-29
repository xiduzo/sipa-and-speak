// Admin — user moderation. Lists active students with their moderation status
// and open-report count, and lets a moderator suspend (block), lift, or
// permanently remove an account. All mutations are guarded server-side by
// moderatorProcedure; the beforeLoad here only requires a session.

import { Button } from "@sip-and-speak/ui/components/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/utils/trpc";

export const Route = createFileRoute("/admin/users")({
  component: AdminUsersScreen,
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session.data) {
      redirect({ to: "/login", throw: true });
    }
    return { session };
  },
});

type StudentStatus = "active" | "suspended" | "removed";

type AdminUser = {
  id: string;
  name: string;
  email: string;
  studentStatus: StudentStatus;
  openFlagCount: number;
};

const STATUS_STYLES: Record<StudentStatus, string> = {
  active: "bg-green-500/10 text-green-600",
  suspended: "bg-amber-500/10 text-amber-600",
  removed: "bg-destructive/10 text-destructive",
};

type PendingAction = {
  user: AdminUser;
  type: "suspend" | "remove";
};

function useUsersInvalidation() {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries(trpc.moderation.listUsers.queryOptions());
}

function ConfirmDialog({
  action,
  onClose,
}: {
  action: PendingAction;
  onClose: () => void;
}) {
  const invalidate = useUsersInvalidation();

  const suspendMutation = useMutation(
    trpc.moderation.suspendUser.mutationOptions({
      onSuccess: () => {
        toast.success(`"${action.user.name}" has been suspended`);
        invalidate();
        onClose();
      },
      onError: (err) => {
        toast.error(err.message);
        onClose();
      },
    }),
  );

  const removeMutation = useMutation(
    trpc.moderation.removeUser.mutationOptions({
      onSuccess: () => {
        toast.success(`"${action.user.name}" has been removed`);
        invalidate();
        onClose();
      },
      onError: (err) => {
        toast.error(err.message);
        onClose();
      },
    }),
  );

  const isSuspend = action.type === "suspend";
  const isPending = suspendMutation.isPending || removeMutation.isPending;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-xl">
        <h2 className="text-foreground text-xl font-semibold mb-2">
          {isSuspend ? "Suspend student?" : "Remove student?"}
        </h2>
        <p className="text-muted-foreground mb-4">
          {isSuspend ? (
            <>
              "{action.user.name}" will be blocked from matching and messaging,
              and their active meetups will be cancelled. You can lift this
              later.
            </>
          ) : (
            <>
              "{action.user.name}" will be permanently removed and their email
              blocked from re-registering. This cannot be undone.
            </>
          )}
        </p>
        <div className="flex gap-2 justify-end mt-4">
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            data-testid="confirm-user-action-btn"
            disabled={isPending}
            onClick={() =>
              isSuspend
                ? suspendMutation.mutate({ targetId: action.user.id })
                : removeMutation.mutate({ targetId: action.user.id })
            }
          >
            {isSuspend ? "Suspend" : "Remove"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function UserRow({
  user,
  onAction,
}: {
  user: AdminUser;
  onAction: (action: PendingAction) => void;
}) {
  const invalidate = useUsersInvalidation();

  const liftMutation = useMutation(
    trpc.moderation.liftSuspension.mutationOptions({
      onSuccess: () => {
        toast.success(`"${user.name}"'s suspension has been lifted`);
        invalidate();
      },
      onError: (err) => toast.error(err.message),
    }),
  );

  return (
    <div
      data-testid="user-row"
      className="flex items-start justify-between gap-4 bg-card border border-border rounded-2xl p-4"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="text-foreground font-semibold truncate">
            {user.name}
          </span>
          <span
            data-testid="user-status"
            className={`text-xs px-2 py-0.5 rounded-full ${STATUS_STYLES[user.studentStatus]}`}
          >
            {user.studentStatus}
          </span>
          {user.openFlagCount > 0 && (
            <span
              data-testid="user-open-flags"
              className="text-xs px-2 py-0.5 rounded-full bg-destructive/10 text-destructive"
            >
              {user.openFlagCount} open{" "}
              {user.openFlagCount === 1 ? "report" : "reports"}
            </span>
          )}
        </div>
        <p className="text-muted-foreground text-sm truncate">{user.email}</p>
      </div>
      <div className="flex gap-2 shrink-0">
        {user.studentStatus === "active" && (
          <Button
            variant="outline"
            size="sm"
            data-testid="user-suspend-btn"
            onClick={() => onAction({ user, type: "suspend" })}
          >
            Suspend
          </Button>
        )}
        {user.studentStatus === "suspended" && (
          <Button
            variant="outline"
            size="sm"
            data-testid="user-lift-btn"
            disabled={liftMutation.isPending}
            onClick={() => liftMutation.mutate({ targetId: user.id })}
          >
            Lift
          </Button>
        )}
        {user.studentStatus !== "removed" && (
          <Button
            variant="destructive"
            size="sm"
            data-testid="user-remove-btn"
            onClick={() => onAction({ user, type: "remove" })}
          >
            Remove
          </Button>
        )}
      </div>
    </div>
  );
}

function AdminUsersScreen() {
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const usersQuery = useQuery(trpc.moderation.listUsers.queryOptions());
  const users = usersQuery.data ?? [];

  return (
    <div className="mx-auto max-w-3xl p-6 sm:p-8">
      <PageHeader
        eyebrow="back of house"
        title="Users"
        description="Review students and suspend, lift, or remove accounts."
      />

      {usersQuery.isPending ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : users.length === 0 ? (
        <p
          data-testid="empty-users"
          className="text-muted-foreground text-center py-16"
        >
          No users yet.
        </p>
      ) : (
        <div data-testid="users-list" className="flex flex-col gap-3">
          {users.map((u) => (
            <UserRow key={u.id} user={u} onAction={setPendingAction} />
          ))}
        </div>
      )}

      {pendingAction && (
        <ConfirmDialog
          action={pendingAction}
          onClose={() => setPendingAction(null)}
        />
      )}
    </div>
  );
}
