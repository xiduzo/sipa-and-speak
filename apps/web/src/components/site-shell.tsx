import { Button } from "@sip-and-speak/ui/components/button";
import { Coffee } from "lucide-react";
import type { ReactNode } from "react";

export const SUPPORT_EMAIL = "hello@sipandspeak.nl";

// No public App Store / Play listing yet, so the primary action is an invite
// request by email. When store listings exist, point this at them instead —
// every CTA across the public site reads from this one constant.
export const INVITE_HREF = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
  "Sip & Speak — request an invite",
)}`;

// Shared link styling for the public site, matched to the legal pages.
export const LINK =
  "rounded-sm underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <a
      href="/"
      className={`flex items-center gap-2 font-heading text-lg font-extrabold tracking-tight ${className}`}
    >
      <span className="grid size-8 place-items-center rounded-xl bg-primary text-primary-foreground">
        <Coffee className="size-4" />
      </span>
      <span>
        Sip <span className="text-primary">&amp;</span> Speak
      </span>
    </a>
  );
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Wordmark />
        <nav className="hidden items-center gap-7 text-sm font-medium text-muted-foreground sm:flex">
          <a href="/#how" className="transition-colors hover:text-foreground">
            How it works
          </a>
          <a
            href="/#community"
            className="transition-colors hover:text-foreground"
          >
            Community
          </a>
        </nav>
        <Button render={<a href={INVITE_HREF} />}>Request an invite</Button>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-8 sm:grid-cols-[1.5fr_1fr_1fr]">
          <div>
            <Wordmark />
            <p className="mt-3 max-w-xs text-sm text-muted-foreground">
              Practise a language with a local, over coffee. Made in Eindhoven,
              the Netherlands.
            </p>
            <a
              className={`mt-3 inline-block text-sm ${LINK}`}
              href={`mailto:${SUPPORT_EMAIL}`}
            >
              {SUPPORT_EMAIL}
            </a>
          </div>

          <nav aria-label="Legal" className="text-sm">
            <h2 className="font-heading font-bold">Legal</h2>
            <ul className="mt-3 space-y-2 text-muted-foreground">
              <li>
                <a className={LINK} href="/privacy">
                  Privacy Statement
                </a>
              </li>
              <li>
                <a className={LINK} href="/terms">
                  Terms of Use
                </a>
              </li>
              <li>
                <a className={LINK} href="/community-code">
                  Community Code
                </a>
              </li>
              <li>
                <a className={LINK} href="/child-safety">
                  Child Safety Standards
                </a>
              </li>
              <li>
                <a className={LINK} href="/delete-account">
                  Delete your account
                </a>
              </li>
            </ul>
          </nav>

          <nav aria-label="Sip and Speak" className="text-sm">
            <h2 className="font-heading font-bold">Sip &amp; Speak</h2>
            <ul className="mt-3 space-y-2 text-muted-foreground">
              <li>
                <a className={LINK} href="/#how">
                  How it works
                </a>
              </li>
              <li>
                <a className={LINK} href="/#community">
                  Community
                </a>
              </li>
              <li>
                <a className={LINK} href={INVITE_HREF}>
                  Request an invite
                </a>
              </li>
            </ul>
          </nav>
        </div>

        <div className="mt-10 flex flex-col gap-1 border-t border-border/60 pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 Sip &amp; Speak</p>
          <p>
            made with ♥️ by{" "}
            <a
              className={LINK}
              href="https://www.xiduzo.com/"
              target="_blank"
              rel="noreferrer"
            >
              xiduzo
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}

/**
 * The public marketing shell: branded sticky header + branded footer wrapped
 * around page content. Used by the landing page and every public legal page so
 * they share one chrome (and never show the in-app dev header). Pages provide
 * their own `<main>`.
 */
export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-svh scroll-smooth bg-background font-sans text-foreground">
      <SiteHeader />
      {children}
      <SiteFooter />
    </div>
  );
}
