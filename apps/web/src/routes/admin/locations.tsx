import { Button } from "@sip-and-speak/ui/components/button";
import { Input } from "@sip-and-speak/ui/components/input";
import { Label } from "@sip-and-speak/ui/components/label";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import { trpc } from "@/utils/trpc";

export const Route = createFileRoute("/admin/locations")({
  component: RouteComponent,
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session.data) {
      redirect({ to: "/login", throw: true });
    }
    return { session };
  },
});

type Venue = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
};

type FormMode = { type: "add" } | { type: "edit"; venue: Venue } | null;

function useVenueListInvalidation() {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries(trpc.adminVenue.findAll.queryOptions());
}

function LocationForm({
  mode,
  onClose,
}: {
  mode: FormMode;
  onClose: () => void;
}) {
  const invalidate = useVenueListInvalidation();
  const initialVenue = mode?.type === "edit" ? mode.venue : null;

  const [name, setName] = useState(initialVenue?.name ?? "");
  const [description, setDescription] = useState(
    initialVenue?.description ?? "",
  );
  const [nameError, setNameError] = useState<string | null>(null);

  const createMutation = useMutation(
    trpc.adminVenue.create.mutationOptions({
      onSuccess: () => {
        toast.success("Location added");
        invalidate();
        onClose();
      },
      onError: (err) => {
        if (err.message.includes("already exists")) {
          setNameError("A location with this name already exists");
        } else {
          toast.error(err.message);
        }
      },
    }),
  );

  const updateMutation = useMutation(
    trpc.adminVenue.update.mutationOptions({
      onSuccess: () => {
        toast.success("Location updated");
        invalidate();
        onClose();
      },
      onError: (err) => {
        if (err.message.includes("already exists")) {
          setNameError("A location with this name already exists");
        } else {
          toast.error(err.message);
        }
      },
    }),
  );

  const isPending = createMutation.isPending || updateMutation.isPending;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setNameError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setNameError("Name is required");
      return;
    }

    if (mode?.type === "edit") {
      updateMutation.mutate({
        id: mode.venue.id,
        name: trimmedName,
        description: description.trim() || null,
      });
    } else {
      createMutation.mutate({
        name: trimmedName,
        description: description.trim() || undefined,
        latitude: 51.4483,
        longitude: 5.4903,
      });
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-xl">
        <h2 className="text-foreground text-xl font-semibold mb-4">
          {mode?.type === "edit" ? "Edit location" : "Add location"}
        </h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <Label htmlFor="loc-name">Name</Label>
            <Input
              id="loc-name"
              data-testid="location-name-input"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setNameError(null);
              }}
              placeholder="e.g. Metaforum Cantine"
              disabled={isPending}
            />
            {nameError && (
              <p
                data-testid="location-name-error"
                className="text-destructive text-sm"
              >
                {nameError}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="loc-desc">Description (optional)</Label>
            <Input
              id="loc-desc"
              data-testid="location-description-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short description of the location"
              disabled={isPending}
            />
          </div>

          <div className="flex gap-2 justify-end mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              data-testid="location-submit-btn"
              disabled={isPending}
            >
              {mode?.type === "edit" ? "Save changes" : "Add location"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DeactivateDialog({
  venue,
  onClose,
}: {
  venue: Venue;
  onClose: () => void;
}) {
  const invalidate = useVenueListInvalidation();
  const warningsQuery = useQuery(
    trpc.adminVenue.deactivateWarnings.queryOptions({ id: venue.id }),
  );

  const deactivateMutation = useMutation(
    trpc.adminVenue.deactivate.mutationOptions({
      onSuccess: () => {
        toast.success(`"${venue.name}" has been deactivated`);
        invalidate();
        onClose();
      },
      onError: (err) => {
        toast.error(err.message);
        onClose();
      },
    }),
  );

  const warnings = warningsQuery.data;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-xl">
        <h2 className="text-foreground text-xl font-semibold mb-2">
          Deactivate location?
        </h2>
        <p className="text-muted-foreground mb-4">
          "{venue.name}" will be hidden from the meetup proposal picker.
        </p>

        {warningsQuery.isPending ? (
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
          </div>
        ) : (
          <>
            {warnings?.hasPendingProposals && (
              <div
                data-testid="pending-proposals-warning"
                className="bg-amber-500/10 border border-amber-500/20 text-amber-600 text-sm rounded-xl p-3 mb-3"
              >
                This location has unconfirmed meetup proposals. They will not be
                automatically cancelled, but students won't be able to select
                this location for new proposals.
              </div>
            )}
            {warnings?.isLastActive && (
              <div
                data-testid="last-active-warning"
                className="bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-xl p-3 mb-3"
              >
                This is the last active location. After deactivation, students
                will be unable to create new meetup proposals.
              </div>
            )}
          </>
        )}

        <div className="flex gap-2 justify-end mt-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            data-testid="confirm-deactivate-btn"
            disabled={deactivateMutation.isPending}
            onClick={() => deactivateMutation.mutate({ id: venue.id })}
          >
            Deactivate
          </Button>
        </div>
      </div>
    </div>
  );
}

function LocationRow({
  venue,
  onEdit,
}: {
  venue: Venue;
  onEdit: (v: Venue) => void;
}) {
  const [showDeactivateDialog, setShowDeactivateDialog] = useState(false);
  const invalidate = useVenueListInvalidation();

  const reactivateMutation = useMutation(
    trpc.adminVenue.reactivate.mutationOptions({
      onSuccess: () => {
        toast.success(`"${venue.name}" has been reactivated`);
        invalidate();
      },
      onError: (err) => toast.error(err.message),
    }),
  );

  return (
    <>
      <div
        data-testid="location-row"
        className="flex items-start justify-between gap-4 bg-card border border-border rounded-2xl p-4"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              data-testid="location-name"
              className="text-foreground font-semibold truncate"
            >
              {venue.name}
            </span>
            <span
              data-testid="location-status"
              className={`text-xs px-2 py-0.5 rounded-full ${
                venue.isActive
                  ? "bg-green-500/10 text-green-600"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {venue.isActive ? "Active" : "Inactive"}
            </span>
          </div>
          {venue.description && (
            <p
              data-testid="location-description"
              className="text-muted-foreground text-sm"
            >
              {venue.description}
            </p>
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            data-testid="location-edit-btn"
            onClick={() => onEdit(venue)}
          >
            Edit
          </Button>
          {venue.isActive ? (
            <Button
              variant="outline"
              size="sm"
              data-testid="location-deactivate-btn"
              onClick={() => setShowDeactivateDialog(true)}
            >
              Deactivate
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              data-testid="location-reactivate-btn"
              disabled={reactivateMutation.isPending}
              onClick={() => reactivateMutation.mutate({ id: venue.id })}
            >
              Reactivate
            </Button>
          )}
        </div>
      </div>

      {showDeactivateDialog && (
        <DeactivateDialog
          venue={venue}
          onClose={() => setShowDeactivateDialog(false)}
        />
      )}
    </>
  );
}

function RouteComponent() {
  const [formMode, setFormMode] = useState<FormMode>(null);
  const venuesQuery = useQuery(trpc.adminVenue.findAll.queryOptions());
  const venues = venuesQuery.data ?? [];

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-foreground text-2xl font-bold">
          Location catalog
        </h1>
        <Button
          data-testid="add-location-btn"
          onClick={() => setFormMode({ type: "add" })}
        >
          Add location
        </Button>
      </div>

      {venuesQuery.isPending ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : venues.length === 0 ? (
        <p
          data-testid="empty-locations"
          className="text-muted-foreground text-center py-16"
        >
          No locations yet. Add the first one.
        </p>
      ) : (
        <div data-testid="locations-list" className="flex flex-col gap-3">
          {venues.map((v) => (
            <LocationRow
              key={v.id}
              venue={v}
              onEdit={(venue) => setFormMode({ type: "edit", venue })}
            />
          ))}
        </div>
      )}

      {formMode && (
        <LocationForm mode={formMode} onClose={() => setFormMode(null)} />
      )}
    </div>
  );
}
