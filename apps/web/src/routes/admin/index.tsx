// Admin hub — the back-of-house overview. Live stat tiles surface what needs
// attention (open reports, suspended students) before linking into venue
// management, user moderation, the report queue, and the alumni registry.
// Server procedures enforce moderatorProcedure; the beforeLoad guard here only
// ensures an authenticated session (mirrors the other admin/moderator routes).

import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import {
  type LucideIcon,
  Flag,
  GraduationCap,
  MapPin,
  UserMinus,
  Users,
} from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/utils/trpc";

export const Route = createFileRoute("/admin/")({
  component: AdminHome,
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session.data) {
      redirect({ to: "/login", throw: true });
    }
    return { session };
  },
});

// Accent tone per tile — borrowed straight from the Barista Blend palette so the
// overview reads like the café, not a generic dashboard. The open-reports tile
// escalates to a destructive tone the moment anything is waiting.
type Tone = "alert" | "gold" | "teal" | "brown";

const TONE_CLASSES: Record<Tone, string> = {
  alert: "text-destructive",
  gold: "text-[var(--gold)]",
  teal: "text-secondary",
  brown: "text-tertiary",
};

function StatTile({
  label,
  value,
  icon: Icon,
  tone,
  muted,
}: {
  label: string;
  value: number | string;
  icon: LucideIcon;
  tone: Tone;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5">
      <span
        className={`grid size-11 shrink-0 place-items-center rounded-xl bg-muted/60 ${
          muted ? "text-muted-foreground" : TONE_CLASSES[tone]
        }`}
      >
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="font-heading text-2xl font-extrabold leading-none text-foreground">
          {value}
        </p>
        <p className="mt-1 truncate text-sm text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

type AdminCard = {
  to: string;
  title: string;
  description: string;
  icon: LucideIcon;
  testId: string;
};

const CARDS: AdminCard[] = [
  {
    to: "/admin/locations",
    title: "Locations",
    description: "Create, edit, and deactivate meetup venues.",
    icon: MapPin,
    testId: "admin-card-locations",
  },
  {
    to: "/admin/users",
    title: "Users",
    description: "Review students and suspend, lift, or remove accounts.",
    icon: Users,
    testId: "admin-card-users",
  },
  {
    to: "/admin/reports",
    title: "Reports",
    description: "Every report filed against a student, open and resolved.",
    icon: Flag,
    testId: "admin-card-reports",
  },
  {
    to: "/admin/alumni",
    title: "Alumni registry",
    description: "Manage non-TU/e emails allowed to register.",
    icon: GraduationCap,
    testId: "admin-card-alumni",
  },
];

function AdminHome() {
  const openFlags = useQuery({
    ...trpc.moderation.listOpenFlags.queryOptions(),
    retry: false,
  });
  const users = useQuery({
    ...trpc.moderation.listUsers.queryOptions(),
    retry: false,
  });
  const alumni = useQuery({
    ...trpc.adminAlumni.findAll.queryOptions(),
    retry: false,
  });
  const venues = useQuery({
    ...trpc.adminVenue.findAll.queryOptions(),
    retry: false,
  });

  const openCount = openFlags.data?.length ?? 0;
  const suspendedCount =
    users.data?.filter((u) => u.studentStatus === "suspended").length ?? 0;
  const alumniCount = alumni.data?.length ?? 0;
  const venueCount = venues.data?.length ?? 0;

  return (
    <div className="mx-auto max-w-4xl p-6 sm:p-8">
      <PageHeader
        eyebrow="back of house"
        title="Overview"
        description="Keep the community running smoothly — what needs a barista's eye today."
      />

      <div className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label={openCount === 1 ? "open report" : "open reports"}
          value={openCount}
          icon={Flag}
          tone="alert"
          muted={openCount === 0}
        />
        <StatTile
          label="suspended"
          value={suspendedCount}
          icon={UserMinus}
          tone="gold"
          muted={suspendedCount === 0}
        />
        <StatTile
          label="alumni emails"
          value={alumniCount}
          icon={GraduationCap}
          tone="teal"
        />
        <StatTile
          label={venueCount === 1 ? "venue" : "venues"}
          value={venueCount}
          icon={MapPin}
          tone="brown"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {CARDS.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.to}
              to={card.to}
              data-testid={card.testId}
              className="group flex items-start gap-4 rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                <Icon className="size-5" />
              </span>
              <div className="min-w-0">
                <h2 className="font-heading font-bold text-foreground">
                  {card.title}
                </h2>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {card.description}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
