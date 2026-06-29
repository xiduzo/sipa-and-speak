import { Button } from "@sip-and-speak/ui/components/button";
import { cn } from "@sip-and-speak/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  Coffee,
  Flag,
  GraduationCap,
  LayoutDashboard,
  type LucideIcon,
  MapPin,
  Menu,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { type ReactNode, useState } from "react";

import { trpc } from "@/utils/trpc";

import { ModeToggle } from "./mode-toggle";
import UserMenu from "./user-menu";

type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  badge?: number;
};

type NavGroup = {
  // Caveat-styled eyebrow — the chalkboard label for each station.
  eyebrow: string;
  items: NavItem[];
};

function Wordmark() {
  return (
    <Link
      to="/"
      className="flex items-center gap-2 font-heading text-lg font-extrabold tracking-tight text-foreground"
    >
      <span className="grid size-8 place-items-center rounded-xl bg-primary text-primary-foreground">
        <Coffee className="size-4" />
      </span>
      <span>
        Sip <span className="text-primary">&amp;</span> Speak
      </span>
    </Link>
  );
}

function NavLink({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      onClick={onNavigate}
      activeOptions={{ exact: item.exact ?? false }}
      activeProps={{
        "data-active": "true",
      }}
      className={cn(
        "group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium",
        "text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        // active state driven by the data-active attribute set above
        "data-[active=true]:bg-primary/10 data-[active=true]:text-foreground",
      )}
    >
      {/* orange counter marker for the active station */}
      <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary opacity-0 transition-opacity group-data-[active=true]:opacity-100" />
      <Icon className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground group-data-[active=true]:text-primary" />
      <span className="truncate">{item.label}</span>
      {item.badge ? (
        <span className="ml-auto grid min-w-5 place-items-center rounded-full bg-destructive px-1.5 text-xs font-semibold text-white">
          {item.badge}
        </span>
      ) : null}
    </Link>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  // Only moderators see the back-of-house station. This also gates the badge
  // query below so a normal member never triggers a forbidden request.
  const isModerator =
    useQuery(trpc.moderation.amIModerator.queryOptions()).data ?? false;

  // Open report count powers the live badge on the Reports station.
  const openFlags = useQuery({
    ...trpc.moderation.listOpenFlags.queryOptions(),
    enabled: isModerator,
    staleTime: 30_000,
  });
  const openCount = Array.isArray(openFlags.data) ? openFlags.data.length : 0;

  const groups: NavGroup[] = [
    {
      eyebrow: "the café",
      items: [
        { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      ],
    },
    ...(isModerator
      ? [
          {
            eyebrow: "back of house",
            items: [
              { to: "/admin", label: "Overview", icon: ShieldCheck, exact: true },
              { to: "/admin/locations", label: "Locations", icon: MapPin },
              { to: "/admin/users", label: "Users", icon: Users },
              {
                to: "/admin/reports",
                label: "Reports",
                icon: Flag,
                badge: openCount || undefined,
              },
              { to: "/admin/alumni", label: "Alumni", icon: GraduationCap },
            ],
          } satisfies NavGroup,
        ]
      : []),
  ];

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex h-16 items-center px-5">
        <Wordmark />
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-2">
        {groups.map((group) => (
          <div key={group.eyebrow}>
            <p className="px-3 pb-1 font-caveat text-lg font-bold leading-none text-muted-foreground">
              {group.eyebrow}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavLink key={item.to} item={item} onNavigate={onNavigate} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <div className="flex items-center justify-between gap-2">
          <UserMenu />
          <ModeToggle />
        </div>
      </div>
    </div>
  );
}

/**
 * The signed-in app shell: a persistent "service counter" sidebar (the café
 * back-of-house) wrapping a scrolling main area. On small screens the sidebar
 * collapses behind a top bar + slide-over drawer.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="grid h-svh bg-background lg:grid-cols-[16rem_1fr]">
      {/* Desktop sidebar */}
      <aside className="hidden border-r border-sidebar-border bg-sidebar lg:block">
        <SidebarContent />
      </aside>

      <div className="flex min-w-0 flex-col overflow-hidden">
        {/* Mobile top bar */}
        <header className="flex h-14 items-center justify-between border-b border-sidebar-border bg-sidebar px-3 lg:hidden">
          <Wordmark />
          <Button
            variant="outline"
            size="icon"
            aria-label="Open menu"
            onClick={() => setOpen(true)}
          >
            <Menu className="size-5" />
          </Button>
        </header>

        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-black/50"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] border-r border-sidebar-border bg-sidebar shadow-xl">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Close menu"
              className="absolute right-2 top-3 z-10"
              onClick={() => setOpen(false)}
            >
              <X className="size-5" />
            </Button>
            <SidebarContent onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
