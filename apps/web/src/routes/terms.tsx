import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({
  component: TermsPage,
});

const SUPPORT_EMAIL = "hello@sipandspeak.nl";

// The provider is the same natural person as the controller named in the
// Privacy Statement. We show initials here to match it (see privacy.tsx); the
// full name and address are available on request. If a legal entity is formed
// later, replace with its name in both places.
const PROVIDER = "V.J.O.C.";

const LAST_UPDATED = "25 June 2026";

export function TermsPage() {
  return (
    <main className="container mx-auto max-w-2xl break-words px-4 py-8 leading-relaxed">
      <h1 className="mb-4 text-2xl font-bold sm:text-3xl">Terms of Use</h1>

      <p className="mb-6 text-muted-foreground">
        These terms govern your use of Sip &amp; Speak. By creating an account you
        agree to them. Last updated {LAST_UPDATED}.
      </p>

      <section className="mb-6">
        <h2 className="mb-2 text-xl font-semibold">Who we are</h2>
        <p>
          Sip &amp; Speak (“the service”) is provided by {PROVIDER}, based in the
          Netherlands. You can reach us at{" "}
          <a
            className="rounded-sm underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            href={`mailto:${SUPPORT_EMAIL}`}
          >
            {SUPPORT_EMAIL}
          </a>
          .
        </p>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-xl font-semibold">Your account</h2>
        <p>
          You must provide accurate information and keep access to your account
          secure. You are responsible for activity under your account. You may
          delete your account at any time via{" "}
          <a
            className="rounded-sm underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            href="/delete-account"
          >
            Delete your account
          </a>
          .
        </p>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-xl font-semibold">Acceptable use</h2>
        <p>
          When using the service you agree to follow our{" "}
          <a
            className="rounded-sm underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            href="/community-code"
          >
            Community Code
          </a>
          . You may not use the service unlawfully, harass others, or attempt to
          disrupt or gain unauthorised access to it. We may suspend or remove
          accounts that break these terms or the Community Code.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-xl font-semibold">Your content</h2>
        <p>
          You keep ownership of the content you create. You are responsible for
          it and grant us permission to host and display it as needed to run the
          service.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-xl font-semibold">The service is provided “as is”</h2>
        <p>
          We work to keep the service available and useful, but we provide it
          without warranties and cannot guarantee it will always be available or
          error-free. To the extent permitted by law, we are not liable for
          indirect or consequential loss arising from your use of the service.
          Nothing in these terms limits liability that cannot be limited under
          Dutch law.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-xl font-semibold">Privacy</h2>
        <p>
          How we handle your personal data is described in our{" "}
          <a
            className="rounded-sm underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            href="/privacy"
          >
            Privacy Statement
          </a>
          .
        </p>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-xl font-semibold">Changes and governing law</h2>
        <p className="mb-2">
          We may update these terms; we will post changes on this page and update
          the date above. Continued use means you accept the updated terms.
        </p>
        <p>
          These terms are governed by Dutch law, and disputes fall under the
          jurisdiction of the competent court in the Netherlands.
        </p>
      </section>
    </main>
  );
}
