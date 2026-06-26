import { createFileRoute } from "@tanstack/react-router";

import { PublicShell } from "@/components/site-shell";

export const Route = createFileRoute("/delete-account")({
  component: DeleteAccountPage,
});

const DELETED_DATA = [
  "Your profile",
  "Your matches",
  "Your chats",
  "Your meet-ups",
];

const SUPPORT_EMAIL = "hello@sipandspeak.nl";

export function DeleteAccountPage() {
  return (
    <PublicShell>
      <main className="container mx-auto max-w-2xl break-words px-4 py-12 leading-relaxed">
      <h1 className="mb-4 text-2xl font-bold sm:text-3xl">
        Delete your Sip &amp; Speak account and data
      </h1>

      <p className="mb-6 text-muted-foreground">
        You can permanently delete your Sip &amp; Speak account and all of your
        personal data at any time. This page explains how.
      </p>

      <section className="mb-6">
        <h2 className="mb-2 text-xl font-semibold">Delete from the app</h2>
        <ol className="list-decimal space-y-1 pl-6">
          <li>Open the Sip &amp; Speak app and go to your Profile.</li>
          <li>Tap Delete account.</li>
          <li>Confirm when prompted.</li>
        </ol>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-xl font-semibold">
          Can&apos;t access the app? Request deletion by email
        </h2>
        <p className="mb-2">
          If you can no longer sign in, you can ask us to delete your account and
          data for you. Email{" "}
          <a
            className="rounded-sm underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            href={`mailto:${SUPPORT_EMAIL}`}
          >
            {SUPPORT_EMAIL}
          </a>{" "}
          to make a request.
        </p>
        <p className="mb-2">
          Please email{" "}
          <strong>from the address linked to your account</strong> so we can
          verify the request is yours.
        </p>
        <p>
          We will delete your account and data within 30 days of a verified
          request.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-xl font-semibold">What gets deleted</h2>
        <p className="mb-2">
          Deleting your account permanently deletes all associated data. This
          includes:
        </p>
        <ul className="list-disc space-y-1 pl-6" data-testid="deleted-data">
          {DELETED_DATA.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-xl font-semibold">This cannot be undone</h2>
        <p>
          Deletion is immediate and irreversible. There is no recovery and no
          grace period — once your account is deleted, it and its data cannot be
          restored.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-xl font-semibold">What we keep</h2>
        <p className="mb-2">
          Some moderation records you created about other people — such as a
          comment or a flag you raised — are kept for the safety of the
          community, but your identity is removed so they can no longer be traced
          back to you.
        </p>
        <p>
          If your account was removed by a moderator (rather than deleted by
          you), your institutional email address may be retained to prevent
          re-registration.
        </p>
      </section>
      </main>
    </PublicShell>
  );
}
