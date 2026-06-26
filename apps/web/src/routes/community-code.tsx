import { createFileRoute } from "@tanstack/react-router";

import { PublicShell } from "@/components/site-shell";

export const Route = createFileRoute("/community-code")({
  component: CommunityCodePage,
});

const SUPPORT_EMAIL = "hello@sipandspeak.nl";

export function CommunityCodePage() {
  return (
    <PublicShell>
      <main className="container mx-auto max-w-2xl break-words px-4 py-12 leading-relaxed">
      <h1 className="mb-4 text-2xl font-bold sm:text-3xl">Community Code</h1>

      <p className="mb-6 text-muted-foreground">
        Sip &amp; Speak is about meeting people and feeling welcome. This code
        keeps it that way for everyone.
      </p>

      <section className="mb-6">
        <h2 className="mb-2 text-xl font-semibold">Be respectful</h2>
        <p>
          Treat others the way you would want to be treated. No harassment,
          hate speech, discrimination, or bullying — in chats, meet-ups, or
          anywhere on the platform.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-xl font-semibold">Be genuine</h2>
        <p>
          Use a real name and real details. Don’t impersonate others or create
          accounts to mislead people.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-xl font-semibold">Keep each other safe</h2>
        <p>
          Meet in public places, look after yourself and others, and don’t share
          someone else’s personal information without their consent. Nothing on
          Sip &amp; Speak is a substitute for your own judgement when meeting new
          people.
        </p>
      </section>

      <section className="mb-6" data-testid="report-section">
        <h2 className="mb-2 text-xl font-semibold">Report problems</h2>
        <p>
          If someone makes you uncomfortable or breaks this code, use the in-app
          reporting tools or email{" "}
          <a
            className="rounded-sm underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            href={`mailto:${SUPPORT_EMAIL}`}
          >
            {SUPPORT_EMAIL}
          </a>
          . Reports are taken seriously.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-xl font-semibold">Consequences</h2>
        <p>
          Breaking this code can lead to a warning, suspension, or permanent
          removal from the community, at our discretion and depending on
          severity.
        </p>
      </section>
      </main>
    </PublicShell>
  );
}
