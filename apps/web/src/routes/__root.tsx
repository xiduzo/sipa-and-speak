import { Toaster } from "@sip-and-speak/ui/components/sonner";
import type { QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import {
  HeadContent,
  Outlet,
  createRootRouteWithContext,
  useRouterState,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

import { AppShell } from "@/components/app-shell";
import { ThemeProvider } from "@/components/theme-provider";
import type { trpc } from "@/utils/trpc";

import "../index.css";

export interface RouterAppContext {
  trpc: typeof trpc;
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterAppContext>()({
  component: RootComponent,
  head: () => ({
    meta: [
      {
        title: "Sip & Speak — practise a language over coffee in Eindhoven",
      },
      {
        name: "description",
        content:
          "Sip & Speak pairs you with a local in Eindhoven who speaks the language you’re learning — and is learning yours. Meet in person, over a drink.",
      },
    ],
    links: [
      {
        rel: "icon",
        href: "/favicon.ico",
      },
    ],
  }),
});

// Public, customer-facing routes carry their own branded shell (header +
// footer) and always render in the warm light "Barista Blend" theme — they must
// not show the in-app dev header or the dark app theme a logged-in user picked.
const PUBLIC_ROUTES = new Set([
  "/",
  "/privacy",
  "/terms",
  "/community-code",
  "/child-safety",
  "/delete-account",
]);

function RootComponent() {
  const isPublic = useRouterState({
    select: (state) => PUBLIC_ROUTES.has(state.location.pathname),
  });

  return (
    <>
      <HeadContent />
      <ThemeProvider
        attribute="class"
        defaultTheme="dark"
        forcedTheme={isPublic ? "light" : undefined}
        disableTransitionOnChange
        storageKey="vite-ui-theme"
      >
        {isPublic ? (
          <Outlet />
        ) : (
          <AppShell>
            <Outlet />
          </AppShell>
        )}
        <Toaster richColors />
      </ThemeProvider>
      <TanStackRouterDevtools position="bottom-left" />
      <ReactQueryDevtools position="bottom" buttonPosition="bottom-right" />
    </>
  );
}
