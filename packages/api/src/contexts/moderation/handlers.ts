/**
 * Moderation cascade handlers.
 *
 * These handlers react to moderation domain events (StudentSuspended,
 * SuspensionLifted, StudentRemoved) and apply the resulting DB cascades —
 * cancelling active meetup proposals, transitioning conversation state, and
 * adding removed Students' emails to the registration blocklist.
 *
 * After cancelling proposals, this handler emits ProposalsCancelledByCascade
 * carrying the affected peer IDs. The notifications package subscribes to
 * that event — no second query needed there.
 *
 * The proposal cancellation is a deliberate bulk update rather than a per-row
 * `Meetup.cancel` aggregate call: the aggregate's cancel invariants (confirmed
 * only, before the meetup time) are participant rules, while the moderation
 * cascade must also sweep *pending* proposals and past-scheduled rows.
 *
 * Fire-and-forget: errors are logged in the dispatcher, never thrown to
 * callers.
 */
import { and, eq, inArray, or } from "drizzle-orm";
import { db } from "@sip-and-speak/db";
import { meetup } from "@sip-and-speak/db/schema/scheduling";
import { conversation } from "@sip-and-speak/db/schema/conversation";
import { user } from "@sip-and-speak/db/schema/auth";
import { domainEvents, type StudentRemovedEvent } from "../../domain-events";
import { addEmailToBlocklist } from "./blocklist";

/**
 * Cancel every active (pending or confirmed) meetup proposal the Student is
 * part of, then emit ProposalsCancelledByCascade with the affected peer IDs.
 * Shared by the suspension and removal cascades — the two are identical.
 */
async function cancelActiveProposalsFor(targetId: string): Promise<void> {
  const activeProposals = await db
    .select({ id: meetup.id, proposerId: meetup.proposerId, receiverId: meetup.receiverId })
    .from(meetup)
    .where(
      and(
        or(eq(meetup.proposerId, targetId), eq(meetup.receiverId, targetId)),
        inArray(meetup.status, ["pending", "confirmed"]),
      ),
    );

  if (activeProposals.length === 0) return;

  await db
    .update(meetup)
    .set({ status: "cancelled" })
    .where(
      and(
        or(eq(meetup.proposerId, targetId), eq(meetup.receiverId, targetId)),
        inArray(meetup.status, ["pending", "confirmed"]),
      ),
    );

  const peerIds = [...new Set(
    activeProposals.map((p) => (p.proposerId === targetId ? p.receiverId : p.proposerId)),
  )];
  domainEvents.emit("ProposalsCancelledByCascade", { targetId, peerIds });
}

type ConversationStatus = "open" | "suspended" | "closed";

/**
 * Transition every conversation the Student is part of from `from` to `to`.
 * Parameterises the three conversation cascades:
 *   - StudentSuspended:  open → suspended
 *   - SuspensionLifted:  suspended → open
 *   - StudentRemoved:    open → closed
 */
async function transitionConversations(
  targetId: string,
  from: ConversationStatus,
  to: ConversationStatus,
  logMessage: string,
): Promise<void> {
  const affected = await db
    .select({ id: conversation.id })
    .from(conversation)
    .where(
      and(
        or(eq(conversation.user1Id, targetId), eq(conversation.user2Id, targetId)),
        eq(conversation.status, from),
      ),
    );

  if (affected.length === 0) return;

  await db
    .update(conversation)
    .set({ status: to })
    .where(
      and(
        or(eq(conversation.user1Id, targetId), eq(conversation.user2Id, targetId)),
        eq(conversation.status, from),
      ),
    );

  console.info(`[moderation] ${logMessage}`, { targetId, count: affected.length });
}

// #109 — Block removed Student's email from re-registration
async function handleStudentRemovedBlocklistEmail(event: StudentRemovedEvent): Promise<void> {
  const [userRow] = await db
    .select({ email: user.email })
    .from(user)
    .where(eq(user.id, event.targetId))
    .limit(1);
  if (userRow?.email) {
    await addEmailToBlocklist(userRow.email);
  }
}

export function registerModerationHandlers(): void {
  domainEvents.on("StudentSuspended", (event) => {
    void cancelActiveProposalsFor(event.targetId);
    // If both Students in a shared conversation were suspended and only one is
    // lifted later, the conversation re-opens even though the other party is
    // still suspended. The per-send guard on user.studentStatus catches that
    // case at message time.
    void transitionConversations(
      event.targetId,
      "open",
      "suspended",
      "Suspended conversations on student suspension",
    );
  });
  domainEvents.on("SuspensionLifted", (event) => {
    void transitionConversations(
      event.targetId,
      "suspended",
      "open",
      "Re-opened conversations on suspension lift",
    );
  });
  domainEvents.on("StudentRemoved", (event) => {
    void cancelActiveProposalsFor(event.targetId);
    void transitionConversations(
      event.targetId,
      "open",
      "closed",
      "Closed conversations on removal",
    );
    void handleStudentRemovedBlocklistEmail(event);
  });
}
