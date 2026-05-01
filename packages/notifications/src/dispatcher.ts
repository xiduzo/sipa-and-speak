/**
 * Wires domain events to push notifications.
 * Fire-and-forget: errors are logged in the dispatcher, never thrown to callers.
 *
 * NOTE: moderation cascades (cancelling proposals, transitioning conversation
 * state, blocklisting removed Students' emails) live in
 * @sip-and-speak/api/contexts/moderation/handlers.ts. This package only owns
 * push-notification handlers. Where the same event has both a cascade and a
 * push, the two subscribe independently — see e.g. handleProposalCancelledOnSuspended.
 */
import { and, eq, or } from "drizzle-orm";
import { db } from "@sip-and-speak/db";
import { conversationPresence, meetup } from "@sip-and-speak/db/schema/sip-and-speak";
import {
  domainEvents,
  type MatchRequestSentEvent,
  type MatchRequestAcceptedEvent,
  type MatchRequestDeclinedEvent,
  type MeetupProposedEvent,
  type MeetupConfirmedEvent,
  type MeetupCounterProposedEvent,
  type MeetupDeclinedEvent,
  type MeetupCancelledEvent,
  type MeetupRescheduleProposedEvent,
  type MeetupRescheduledEvent,
  type MeetupRescheduleDeclinedEvent,
  type SipAndSpeakMomentCompletedEvent,
  type MeetupNotAttendedEvent,
  type MessagingOptInPromptedEvent,
  type MessagingNudgeNeededEvent,
  type ConversationOpenedEvent,
  type MessagingDeclineOutcomeEvent,
  type MessageSentEvent,
  type StudentWarnedEvent,
  type StudentSuspendedEvent,
  type SuspensionLiftedEvent,
  type StudentRemovedEvent,
} from "@sip-and-speak/api/domain-events";
import {
  buildMatchRequestSentRecipes,
  buildMatchRequestAcceptedRecipes,
  buildMatchRequestDeclinedRecipes,
  buildMeetupProposedRecipes,
  buildMeetupConfirmedRecipes,
  buildMeetupCounterProposedRecipes,
  buildMeetupDeclinedRecipes,
  buildMeetupCancelledRecipes,
  buildMeetupRescheduleProposedRecipes,
  buildMeetupRescheduledRecipes,
  buildMeetupRescheduleDeclinedRecipes,
  buildSipAndSpeakMomentCompletedRecipes,
  buildMeetupNotAttendedRecipes,
  buildMessagingOptInPromptedRecipes,
  buildMessagingNudgeRecipes,
  buildConversationOpenedRecipes,
  buildMessagingDeclineOutcomeRecipes,
  buildMessageSentRecipes,
  buildStudentWarnedRecipes,
  buildStudentSuspendedNotifyRecipes,
  buildSuspensionLiftedRecipes,
  buildStudentRemovedNotifyRecipes,
  buildProposalCancelledRecipes,
} from "./builders";
import { dispatch } from "./recipe";

async function handleMatchRequestSent(event: MatchRequestSentEvent): Promise<void> {
  await dispatch(buildMatchRequestSentRecipes(event));
}

export async function handleMatchRequestAccepted(event: MatchRequestAcceptedEvent): Promise<void> {
  await dispatch(buildMatchRequestAcceptedRecipes(event));
}

export async function handleMatchRequestDeclined(event: MatchRequestDeclinedEvent): Promise<void> {
  await dispatch(buildMatchRequestDeclinedRecipes(event));
}

async function handleMeetupProposed(event: MeetupProposedEvent): Promise<void> {
  await dispatch(buildMeetupProposedRecipes(event));
}

async function handleMeetupConfirmed(event: MeetupConfirmedEvent): Promise<void> {
  await dispatch(buildMeetupConfirmedRecipes(event));
}

async function handleMeetupCounterProposed(event: MeetupCounterProposedEvent): Promise<void> {
  await dispatch(buildMeetupCounterProposedRecipes(event));
}

async function handleMeetupDeclined(event: MeetupDeclinedEvent): Promise<void> {
  await dispatch(buildMeetupDeclinedRecipes(event));
}

async function handleMeetupCancelled(event: MeetupCancelledEvent): Promise<void> {
  await dispatch(buildMeetupCancelledRecipes(event));
}

async function handleMeetupRescheduleProposed(event: MeetupRescheduleProposedEvent): Promise<void> {
  await dispatch(buildMeetupRescheduleProposedRecipes(event));
}

async function handleMeetupRescheduled(event: MeetupRescheduledEvent): Promise<void> {
  await dispatch(buildMeetupRescheduledRecipes(event));
}

async function handleMeetupRescheduleDeclined(event: MeetupRescheduleDeclinedEvent): Promise<void> {
  await dispatch(buildMeetupRescheduleDeclinedRecipes(event));
}

async function handleSipAndSpeakMomentCompleted(event: SipAndSpeakMomentCompletedEvent): Promise<void> {
  await dispatch(buildSipAndSpeakMomentCompletedRecipes(event));
}

async function handleMeetupNotAttended(event: MeetupNotAttendedEvent): Promise<void> {
  await dispatch(buildMeetupNotAttendedRecipes(event));
}

export async function handleMessagingOptInPrompted(event: MessagingOptInPromptedEvent): Promise<void> {
  await dispatch(buildMessagingOptInPromptedRecipes(event));
}

export async function handleMessagingNudge(event: MessagingNudgeNeededEvent): Promise<void> {
  await dispatch(buildMessagingNudgeRecipes(event));
}

export async function handleConversationOpened(event: ConversationOpenedEvent): Promise<void> {
  await dispatch(buildConversationOpenedRecipes(event));
}

export async function handleMessagingDeclineOutcome(event: MessagingDeclineOutcomeEvent): Promise<void> {
  await dispatch(buildMessagingDeclineOutcomeRecipes(event));
}

// Suppress when recipient is actively viewing this conversation
export async function handleMessageSent(event: MessageSentEvent): Promise<void> {
  const [presence] = await db
    .select({ activeUntil: conversationPresence.activeUntil })
    .from(conversationPresence)
    .where(
      and(
        eq(conversationPresence.studentId, event.recipientId),
        eq(conversationPresence.conversationId, event.conversationId),
      ),
    )
    .limit(1);
  if (presence && presence.activeUntil > new Date()) return;
  await dispatch(buildMessageSentRecipes(event));
}

async function handleStudentWarned(event: StudentWarnedEvent): Promise<void> {
  await dispatch(buildStudentWarnedRecipes(event));
}

async function handleStudentSuspendedNotify(event: StudentSuspendedEvent): Promise<void> {
  await dispatch(buildStudentSuspendedNotifyRecipes(event));
}

async function handleSuspensionLifted(event: SuspensionLiftedEvent): Promise<void> {
  await dispatch(buildSuspensionLiftedRecipes(event));
}

async function handleStudentRemovedNotify(event: StudentRemovedEvent): Promise<void> {
  await dispatch(buildStudentRemovedNotifyRecipes(event));
}

// Push side of the suspension cascade. The DB cancellation lives in the
// moderation context; this handler runs independently against the same
// event and re-queries the affected peers so it can dispatch the
// "proposal cancelled" push. Duplicated query is intentional — see
// header comment.
async function handleProposalCancelledOnSuspended(event: StudentSuspendedEvent): Promise<void> {
  const activeProposals = await db
    .select({ id: meetup.id, proposerId: meetup.proposerId, receiverId: meetup.receiverId })
    .from(meetup)
    .where(
      or(eq(meetup.proposerId, event.targetId), eq(meetup.receiverId, event.targetId)),
    );

  if (activeProposals.length === 0) return;

  const peerIds = [...new Set(
    activeProposals.map((p) => (p.proposerId === event.targetId ? p.receiverId : p.proposerId)),
  )];

  await dispatch(buildProposalCancelledRecipes(peerIds));
}

// Push side of the removal cascade. See handleProposalCancelledOnSuspended.
async function handleProposalCancelledOnRemoved(event: StudentRemovedEvent): Promise<void> {
  const activeProposals = await db
    .select({ id: meetup.id, proposerId: meetup.proposerId, receiverId: meetup.receiverId })
    .from(meetup)
    .where(
      or(eq(meetup.proposerId, event.targetId), eq(meetup.receiverId, event.targetId)),
    );

  if (activeProposals.length === 0) return;

  const peerIds = [...new Set(
    activeProposals.map((p) => (p.proposerId === event.targetId ? p.receiverId : p.proposerId)),
  )];

  await dispatch(buildProposalCancelledRecipes(peerIds));
}

export function registerNotificationHandlers(): void {
  domainEvents.on("MatchRequestSent", (event) => { void handleMatchRequestSent(event); });
  domainEvents.on("MatchRequestAccepted", (event) => { void handleMatchRequestAccepted(event); });
  domainEvents.on("MatchRequestDeclined", (event) => { void handleMatchRequestDeclined(event); });
  domainEvents.on("MeetupProposed", (event) => { void handleMeetupProposed(event); });
  domainEvents.on("MeetupConfirmed", (event) => { void handleMeetupConfirmed(event); });
  domainEvents.on("MeetupCounterProposed", (event) => { void handleMeetupCounterProposed(event); });
  domainEvents.on("MeetupDeclined", (event) => { void handleMeetupDeclined(event); });
  domainEvents.on("MeetupCancelled", (event) => { void handleMeetupCancelled(event); });
  domainEvents.on("MeetupRescheduleProposed", (event) => { void handleMeetupRescheduleProposed(event); });
  domainEvents.on("MeetupRescheduled", (event) => { void handleMeetupRescheduled(event); });
  domainEvents.on("MeetupRescheduleDeclined", (event) => { void handleMeetupRescheduleDeclined(event); });
  domainEvents.on("SipAndSpeakMomentCompleted", (event) => { void handleSipAndSpeakMomentCompleted(event); });
  domainEvents.on("MeetupNotAttended", (event) => { void handleMeetupNotAttended(event); });
  domainEvents.on("MessagingOptInPrompted", (event) => { void handleMessagingOptInPrompted(event); });
  domainEvents.on("MessagingNudgeNeeded", (event) => { void handleMessagingNudge(event); });
  domainEvents.on("ConversationOpened", (event) => { void handleConversationOpened(event); });
  domainEvents.on("MessagingDeclineOutcome", (event) => { void handleMessagingDeclineOutcome(event); });
  domainEvents.on("MessageSent", (event) => { void handleMessageSent(event); });
  domainEvents.on("StudentWarned", (event) => { void handleStudentWarned(event); });
  domainEvents.on("StudentSuspended", (event) => {
    void handleStudentSuspendedNotify(event);
    void handleProposalCancelledOnSuspended(event);
  });
  domainEvents.on("SuspensionLifted", (event) => {
    void handleSuspensionLifted(event);
  });
  domainEvents.on("StudentRemoved", (event) => {
    void handleStudentRemovedNotify(event);
    void handleProposalCancelledOnRemoved(event);
  });
}
