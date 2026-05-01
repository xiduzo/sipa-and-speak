/**
 * Moderation cascade handlers.
 *
 * These handlers react to moderation domain events (StudentSuspended,
 * SuspensionLifted, StudentRemoved) and apply the resulting DB cascades —
 * cancelling active meetup proposals, transitioning conversation state, and
 * adding removed Students' emails to the registration blocklist.
 *
 * The push-notification side effects of those same events live in the
 * notifications package as INDEPENDENT subscribers on the same domain
 * events. We deliberately avoid having the moderation context emit a new
 * "internal" event for notifications to consume — that would either create
 * a circular package dependency (api ↔ notifications) or require a third
 * shared package. Two independent subscribers is simpler; the cost is one
 * duplicated peer-id query.
 *
 * Fire-and-forget: errors are logged in the dispatcher, never thrown to
 * callers.
 */
import { and, eq, inArray, or } from "drizzle-orm";
import { db } from "@sip-and-speak/db";
import { meetup, conversation } from "@sip-and-speak/db/schema/sip-and-speak";
import { user } from "@sip-and-speak/db/schema/auth";
import {
  domainEvents,
  type StudentSuspendedEvent,
  type SuspensionLiftedEvent,
  type StudentRemovedEvent,
} from "../../domain-events";
import { addEmailToBlocklist } from "./moderation-persist";

async function handleStudentSuspendedCancelProposals(event: StudentSuspendedEvent): Promise<void> {
  const activeProposals = await db
    .select({ id: meetup.id, proposerId: meetup.proposerId, receiverId: meetup.receiverId })
    .from(meetup)
    .where(
      and(
        or(eq(meetup.proposerId, event.targetId), eq(meetup.receiverId, event.targetId)),
        inArray(meetup.status, ["pending", "confirmed"]),
      ),
    );

  if (activeProposals.length === 0) return;

  await db
    .update(meetup)
    .set({ status: "cancelled" })
    .where(
      and(
        or(eq(meetup.proposerId, event.targetId), eq(meetup.receiverId, event.targetId)),
        inArray(meetup.status, ["pending", "confirmed"]),
      ),
    );
}

async function handleStudentSuspendedSuspendConversations(event: StudentSuspendedEvent): Promise<void> {
  const openConversations = await db
    .select({ id: conversation.id })
    .from(conversation)
    .where(
      and(
        or(eq(conversation.user1Id, event.targetId), eq(conversation.user2Id, event.targetId)),
        eq(conversation.status, "open"),
      ),
    );

  if (openConversations.length === 0) return;

  await db
    .update(conversation)
    .set({ status: "suspended" })
    .where(
      and(
        or(eq(conversation.user1Id, event.targetId), eq(conversation.user2Id, event.targetId)),
        eq(conversation.status, "open"),
      ),
    );

  console.info("[moderation] Suspended conversations on student suspension", { targetId: event.targetId, count: openConversations.length });
}

// If both Students in a shared conversation were suspended and only one is lifted,
// the conversation re-opens here even though the other party is still suspended.
// The per-send guard on user.studentStatus catches that case at message time.
async function handleSuspensionLiftedReopenConversations(event: SuspensionLiftedEvent): Promise<void> {
  const suspendedConversations = await db
    .select({ id: conversation.id })
    .from(conversation)
    .where(
      and(
        or(eq(conversation.user1Id, event.targetId), eq(conversation.user2Id, event.targetId)),
        eq(conversation.status, "suspended"),
      ),
    );

  if (suspendedConversations.length === 0) return;

  await db
    .update(conversation)
    .set({ status: "open" })
    .where(
      and(
        or(eq(conversation.user1Id, event.targetId), eq(conversation.user2Id, event.targetId)),
        eq(conversation.status, "suspended"),
      ),
    );

  console.info("[moderation] Re-opened conversations on suspension lift", { targetId: event.targetId, count: suspendedConversations.length });
}

async function handleStudentRemovedCancelProposals(event: StudentRemovedEvent): Promise<void> {
  const activeProposals = await db
    .select({ id: meetup.id, proposerId: meetup.proposerId, receiverId: meetup.receiverId })
    .from(meetup)
    .where(
      and(
        or(eq(meetup.proposerId, event.targetId), eq(meetup.receiverId, event.targetId)),
        inArray(meetup.status, ["pending", "confirmed"]),
      ),
    );

  if (activeProposals.length === 0) return;

  await db
    .update(meetup)
    .set({ status: "cancelled" })
    .where(
      and(
        or(eq(meetup.proposerId, event.targetId), eq(meetup.receiverId, event.targetId)),
        inArray(meetup.status, ["pending", "confirmed"]),
      ),
    );
}

async function handleStudentRemovedCloseConversations(event: StudentRemovedEvent): Promise<void> {
  const openConversations = await db
    .select({ id: conversation.id })
    .from(conversation)
    .where(
      and(
        or(eq(conversation.user1Id, event.targetId), eq(conversation.user2Id, event.targetId)),
        eq(conversation.status, "open"),
      ),
    );

  if (openConversations.length === 0) return;

  await db
    .update(conversation)
    .set({ status: "closed" })
    .where(
      and(
        or(eq(conversation.user1Id, event.targetId), eq(conversation.user2Id, event.targetId)),
        eq(conversation.status, "open"),
      ),
    );

  console.info("[moderation] Closed conversations on removal", { targetId: event.targetId, count: openConversations.length });
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
    void handleStudentSuspendedCancelProposals(event);
    void handleStudentSuspendedSuspendConversations(event);
  });
  domainEvents.on("SuspensionLifted", (event) => {
    void handleSuspensionLiftedReopenConversations(event);
  });
  domainEvents.on("StudentRemoved", (event) => {
    void handleStudentRemovedCancelProposals(event);
    void handleStudentRemovedCloseConversations(event);
    void handleStudentRemovedBlocklistEmail(event);
  });
}
