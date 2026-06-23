import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/delete-account")({
  component: DeleteAccountPage,
});

const DELETED_DATA = [
  "Your profile",
  "Your matches",
  "Your chats",
  "Your meet-ups",
];

export function DeleteAccountPage() {
  return (
    <main className="container mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-4 text-2xl font-bold">
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
        <h2 className="mb-2 text-xl font-semibold">Data retention</h2>
        <p>
          Some limited records may be retained where required (for example, to
          comply with legal obligations). This retention note is provisional and
          will be finalized once our data-deletion audit is complete.
        </p>
      </section>
    </main>
  );
}
