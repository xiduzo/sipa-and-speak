# Account data-deletion audit

**Status:** verified against the schema in `packages/db/src/schema/` (Task #425, Feature #417).
**Database:** PostgreSQL (Drizzle `pgTable`). Deletion relies on database-level
`ON DELETE` foreign-key rules.

This audit is the source of truth for what the public `/delete-account` page and the
operator runbook may claim. The page's retention note (Task #427) and the cascade
guard test (Task #426) are derived from it.

## How deletion works

`trpc.profile.deleteAccount` (`packages/api/src/contexts/identity/profile.ts`) runs a
single statement:

```ts
await db.delete(user).where(eq(user.id, userId));
console.info("[AccountDeleted]", { userId });
```

It deletes the member's `user` row. Every other table that holds member data
references `user.id` with `onDelete: "cascade"` (removed) or `onDelete: "set null"`
(retained with the member's identity removed). There is **no** application-level
fan-out — correctness depends entirely on the FK rules below.

## Inventory — every table referencing `user.id`

| Table | File | Column → `user.id` | On delete | Member data held |
| --- | --- | --- | --- | --- |
| `user` | auth.ts | (aggregate root) | **row deleted** | name, surname, email, image, status |
| `session` | auth.ts | `userId` | cascade | session tokens, IP, user-agent |
| `account` | auth.ts | `userId` | cascade | OAuth tokens, password hash |
| `language_profile` | identity.ts | `userId` | cascade | bio, university, age, lat/long |
| `user_language` | identity.ts | `userId` | cascade | spoken/learning languages |
| `user_interest` | identity.ts | `userId` | cascade | interests |
| `user_device_token` | identity.ts | `userId` | cascade | push notification tokens |
| `conversation` | conversation.ts | `user1Id`, `user2Id` | cascade | chat threads |
| `message` | conversation.ts | `senderId` | cascade | message content |
| `message_read_status` | conversation.ts | `userId` | cascade | read tracking |
| `messaging_opt_in` | conversation.ts | `studentId` | cascade | messaging accept/decline |
| `conversation_presence` | conversation.ts | `studentId` | cascade | active-viewing state |
| `meetup` | scheduling.ts | `proposerId`, `receiverId` | cascade | proposed meet-ups |
| `meetup` | scheduling.ts | `rescheduleProposerId` | **set null** | reschedule pointer (see below) |
| `attendance_report` | scheduling.ts | `studentId` | cascade | attendance + rating |
| `match_request` | matching.ts | `requesterId`, `receiverId` | cascade | match requests |
| `student_match` | matching.ts | `studentAId`, `studentBId` | cascade | confirmed matches |
| `student_comment` | moderation.ts | `targetId` | cascade | comments about the member |
| `student_comment` | moderation.ts | `authorId` | **set null** | comments the member authored (see below) |
| `user_flag` | moderation.ts | `reporterId`, `targetId` | cascade | flags filed / received |
| `user_flag` | moderation.ts | `moderatorId` | **set null** | moderator audit pointer (see below) |

Tables with **no** `user.id` FK: `verification` (identifier-based), `venue`
(operator-owned), `blocked_email` (see retained data). Every `user.id` FK in the
schema declares an explicit `onDelete` rule — there are **no** undeclared references
that could orphan rows or error on delete.

## Disclosed categories — confirmed deleted

The public page lists **profile, matches, chats, meet-ups**. All are deleted:

- **Profile** → `user` row + `language_profile`, `user_language`, `user_interest`,
  `user_device_token` (all cascade). Includes name, email, surname, image, bio.
- **Matches** → `match_request`, `student_match` (cascade).
- **Chats** → `conversation`, `message`, `message_read_status`, `messaging_opt_in`,
  `conversation_presence` (cascade).
- **Meet-ups** → `meetup` (proposer/receiver cascade) + `attendance_report` (cascade).

## Retained / anonymized data — justified

When a member is deleted, three references are **nulled** rather than cascaded, and one
table is retained without a FK:

1. **`student_comment.authorId` → set null.** A comment the member wrote *about another
   student* survives the author's deletion, with the author's identity removed. The
   comment is moderation history about the **target**, not the author; nulling preserves
   that history while detaching the deleted member. (Comments *about* the member —
   `targetId` — are cascade-deleted.)
2. **`user_flag.moderatorId` → set null.** When the deleted member previously acted as a
   moderator resolving a flag about someone else, that resolution record is kept with the
   moderator identity removed. Preserves the audit trail of moderation outcomes.
3. **`meetup.rescheduleProposerId` → set null.** A soft pointer to whichever participant
   proposed the active reschedule. In practice the `meetup` row is already cascade-deleted
   via `proposerId`/`receiverId` (the reschedule proposer is always a participant), so this
   rule only avoids a delete-ordering constraint; it never retains standalone member data.
4. **`blocked_email`** retains a removed student's institutional email **only when a
   Moderator removes the student** (to prevent re-registration). Member-initiated
   `deleteAccount` does **not** write to `blocked_email`, so self-service deletion does not
   retain the email here.

## Disclosure mapping (for the page retention note — Task #427)

> Deleting your account permanently removes your profile, matches, chats, and meet-ups.
> Some moderation records you created about other people (a comment or a flag resolution)
> are kept for safety, but with your identity removed so they can no longer be traced to
> you. If you were removed by a moderator (rather than deleting yourself), your
> institutional email may be retained to prevent re-registration.

This wording is accurate to the schema above and can be used to finalize the page's
retention section.

## Keeping this accurate

This audit is a point-in-time snapshot. A new table that holds member data without a
cascade (or a justified set-null entry) would silently make the public disclosure false.
Task #426 adds an automated guard that fails CI when a new `user.id` reference is added
without `cascade` or an explicit allowlist entry pointing back to this document.
