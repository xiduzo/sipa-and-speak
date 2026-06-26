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

import Header from "@/components/header";
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

function RootComponent() {
  // The landing page (/) is a full-bleed public marketing page with its own
  // header and footer, so the app chrome (Home/Dashboard nav, user menu) and
  // the fixed-height app shell are skipped there.
  const isLanding = useRouterState({
    select: (state) => state.location.pathname === "/",
  });

  return (
    <>
      <HeadContent />
      <ThemeProvider
        attribute="class"
        defaultTheme="dark"
        disableTransitionOnChange
        storageKey="vite-ui-theme"
      >
        {isLanding ? (
          <Outlet />
        ) : (
          <div className="grid grid-rows-[auto_1fr] h-svh">
            <Header />
            <Outlet />
          </div>
        )}
        <Toaster richColors />
      </ThemeProvider>
      <TanStackRouterDevtools position="bottom-left" />
      <ReactQueryDevtools position="bottom" buttonPosition="bottom-right" />
    </>
  );
}
