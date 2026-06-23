# Runbook: Email account-deletion requests

**Owner:** @xiduzo (Operator on call) · **Backup/escalation:** Tech Lead (@xiduzo)
**Service window:** account and data deleted within **30 days** of a _verified_ request.

This runbook covers deletion requests that arrive **by email** — the fallback for
members who can no longer access the app. Members who can open the app should use
the in-app flow (Profile → Delete account → confirm), which performs the same
deletion. The public page describing both paths lives at `/delete-account`
(`apps/web/src/routes/delete-account.tsx`).

> Deletion is **permanent and irreversible**. There is no soft-delete, no grace
> period, and no recovery. Treat every request with the same care as a
> destructive production operation.

---

## Where requests arrive

Requests land in the support inbox advertised on the public `/delete-account`
page. The Owner above is responsible for monitoring that inbox daily and ensuring
each verified request is fulfilled within the 30-day window.

## Procedure

1. **Receive.** Acknowledge the request so the requester knows it was seen and
   restate the 30-day window.

2. **Verify identity — _before_ any deletion.** Confirm the request comes from the
   **email address linked to the account**. The member was told on the public page
   to email from that address.
   - If the From-address matches an account → identity is established; continue.
   - If it does **not** match, or cannot be confirmed → do **not** delete. Reply
     asking them to send the request from the email address on their account.
     (See _Edge cases → Unverifiable requester_.)

3. **Perform the deletion.** Delete the account using the existing deletion
   mechanism — the same path the in-app flow uses:
   `trpc.profile.deleteAccount`
   (`packages/api/src/contexts/identity/profile.ts`). It hard-deletes the member's
   `user` row; all member-owned data is removed via cascading deletes (profile,
   matches, chats, meet-ups, and related records). Moderation/audit references are
   retained with the member's identity removed — see
   `docs/account-data-deletion-audit.md` for the exact data scope.

4. **Confirm completion.** Reply to the requester confirming that their account and
   associated data have been deleted.

5. **Record.** Note the completion (date + who actioned it) per current support
   practice, so the window can be audited.

## Completion signal

A successful deletion emits the log line `[AccountDeleted]` with the affected
`userId` (`console.info("[AccountDeleted]", { userId })`). Operators can use this
as the confirmation that the deletion executed.

---

## Edge cases

### Request matches no account
If the From-address (or any identifier provided) matches **no** account, there is
nothing to delete. Reply stating that no account is associated with that address
and take **no** destructive action.

### Unverifiable requester
If you cannot confirm the request comes from the account owner (mismatched
address, forwarded mail, third-party request), **do not delete**. Ask the member
to email from the address linked to their account. Identity verification is a
hard precondition for deletion.

### Requester later wants their data back
There is **no recovery**. Once deleted, the account and its data cannot be
restored. State this plainly; do not imply any possibility of restoration.

### Owner unavailable
If the Owner is away, the backup/escalation contact above assumes responsibility
for monitoring the inbox so the 30-day window is still met.

---

## Keep in sync

- The **30-day window** stated here must match the public `/delete-account` page
  copy (Feature #416).
- The **data scope** referenced in step 3 must match
  `docs/account-data-deletion-audit.md` (Feature #417). If the audit changes what
  is deleted vs. retained, update this runbook and the page together.
