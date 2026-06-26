import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
});

const SUPPORT_EMAIL = "hello@sipandspeak.nl";

// The controller is a natural person in the Netherlands. We show initials
// here; the full name and address are provided to data subjects on request
// (GDPR Art. 13). If a legal entity is formed later, replace with its name.
const CONTROLLER = "V.J.O.C.";

// TODO: keep this in sync whenever the statement changes.
const LAST_UPDATED = "25 June 2026";

export function PrivacyPage() {
  return (
    <main className="container mx-auto max-w-2xl break-words px-4 py-8 leading-relaxed">
      <h1 className="mb-4 text-2xl font-bold sm:text-3xl">Privacy Statement</h1>

      <p className="mb-6 text-muted-foreground">
        This statement explains what personal data Sip &amp; Speak collects, why,
        and the rights you have over it. Last updated {LAST_UPDATED}.
      </p>

      <section className="mb-6">
        <h2 className="mb-2 text-xl font-semibold">Who is responsible</h2>
        <p className="mb-2">
          The controller of your personal data is {CONTROLLER}, a natural
          person based in the Netherlands. The full controller name and address
          are available on request. For any question about your data or to
          exercise your rights, contact us at{" "}
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
        <h2 className="mb-2 text-xl font-semibold">What we collect</h2>
        <ul className="list-disc space-y-1 pl-6">
          <li>
            <strong>Email address</strong> — to create your account, sign you in
            (we send a one-time code), and contact you about your account.
          </li>
          <li>
            <strong>Name / display name</strong> — shown to others in the
            community.
          </li>
          <li>
            <strong>Profile details</strong> you choose to provide — and the
            content you create in the app (such as matches, chats, and meet-ups).
          </li>
        </ul>
        <p className="mt-2">
          We do <strong>not</strong> use analytics or tracking, and we do{" "}
          <strong>not</strong> send marketing email.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-xl font-semibold">Why we use it (legal basis)</h2>
        <p className="mb-2">
          We process your data to provide the service you sign up for — creating
          and securing your account and letting you take part in the community.
          The legal basis is <strong>performance of a contract</strong> (GDPR
          Article 6(1)(b)).
        </p>
        <p>
          Some limited data is kept for the <strong>safety of the community</strong>{" "}
          on the basis of our <strong>legitimate interest</strong> (Article
          6(1)(f)) — see “How long we keep it”.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-xl font-semibold">Where it is stored</h2>
        <p className="mb-2">
          Your data is stored on our own server in the Netherlands. We do not
          sell your data and we do not share it with third parties for their own
          purposes. We apply reasonable technical and organisational measures to
          keep it secure (GDPR Article 32).
        </p>
        <p className="mb-2">
          To run the service we rely on a small number of processors who handle
          data only on our instructions:
        </p>
        <ul className="list-disc space-y-1 pl-6">
          <li>
            <strong>Resend</strong> — sends your one-time sign-in codes and
            account emails. They receive your email address.
          </li>
          <li>
            <strong>Expo</strong> (with Apple and Google push services) —
            delivers push notifications to your device, if you enable them.
          </li>
        </ul>
        <p className="mt-2">
          These providers are based in the United States, so some of your data
          is transferred outside the European Economic Area. That transfer is
          covered by the European Commission’s Standard Contractual Clauses
          (GDPR Article 46).
        </p>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-xl font-semibold">How long we keep it</h2>
        <p className="mb-2">
          We keep your data for as long as your account exists. You can delete
          your account and data at any time — see{" "}
          <a
            className="rounded-sm underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            href="/delete-account"
          >
            Delete your account
          </a>
          . Deletion is immediate and permanent: your account and personal data
          are removed from our database straight away.
        </p>
        <p>
          Two things survive for the safety of the community. Comments you wrote
          about other members stay, but they are detached from you and shown as
          from a “Former Student”, so they no longer identify you. And if a
          moderator removes your account, your email may be kept on a block list
          to prevent re-registration.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-xl font-semibold">Your rights</h2>
        <p className="mb-2">
          Under the GDPR you have the right to access, correct, delete, restrict,
          or object to the processing of your data, and the right to data
          portability. To exercise any of these, email{" "}
          <a
            className="rounded-sm underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            href={`mailto:${SUPPORT_EMAIL}`}
          >
            {SUPPORT_EMAIL}
          </a>{" "}
          from the address linked to your account so we can verify the request.
        </p>
        <p>
          You also have the right to lodge a complaint with the Dutch data
          protection authority, the{" "}
          <a
            className="rounded-sm underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            href="https://autoriteitpersoonsgegevens.nl"
            target="_blank"
            rel="noreferrer"
          >
            Autoriteit Persoonsgegevens
          </a>
          .
        </p>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-xl font-semibold">Changes to this statement</h2>
        <p>
          If we change how we handle your data, we will update this page and the
          “last updated” date above.
        </p>
      </section>
    </main>
  );
}
