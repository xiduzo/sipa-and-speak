/**
 * Wires domain events to push notifications.
 * Fire-and-forget: errors are logged in the dispatcher, never thrown to callers.
 */
import { and, eq, inArray, or } from "drizzle-orm";
import { db } from "@sip-and-speak/db";
import { userLanguage, conversationPresence, meetup, conversation } from "@sip-and-speak/db/schema/sip-and-speak";
import { user } from "@sip-and-speak/db/schema/auth";
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
} from "./notification-builders";
import { dispatch } from "./notification-recipe";

async function handleMatchRequestSent(event: MatchRequestSentEvent): Promise<void> {
  const [requesterResult, requesterLanguages] = await Promise.all([
    db.select({ name: user.name }).from(user).where(eq(user.id, event.requesterId)).limit(1),
    db.select({ language: userLanguage.language, type: userLanguage.type }).from(userLanguage).where(eq(userLanguage.userId, event.requesterId)),
  ]);
  const requesterName = requesterResult[0]?.name ?? "Someone";
  const offeredLanguage = requesterLanguages.find((l) => l.type === "spoken")?.language ?? null;
  const targetedLanguage = requesterLanguages.find((l) => l.type === "learning")?.language ?? null;
  await dispatch(buildMatchRequestSentRecipes(event, { requesterName, offeredLanguage, targetedLanguage }));
}

export async function handleMatchRequestAccepted(event: MatchRequestAcceptedEvent): Promise<void> {
  const [receiverResult] = await Promise.all([
    db.select({ name: user.name }).from(user).where(eq(user.id, event.receiverId)).limit(1),
  ]);
  const receiverName = receiverResult[0]?.name ?? "Someone";
  await dispatch(buildMatchRequestAcceptedRecipes(event, { receiverName }));
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
  const [studentAResult, studentBResult] = await Promise.all([
    db.select({ name: user.name }).from(user).where(eq(user.id, event.studentAId)).limit(1),
    db.select({ name: user.name }).from(user).where(eq(user.id, event.studentBId)).limit(1),
  ]);
  const studentAName = studentAResult[0]?.name ?? "Your match";
  const studentBName = studentBResult[0]?.name ?? "Your match";
  await dispatch(buildMessagingOptInPromptedRecipes(event, { studentAName, studentBName }));
}

export async function handleMessagingNudge(event: MessagingNudgeNeededEvent): Promise<void> {
  const [acceptingResult] = await Promise.all([
    db.select({ name: user.name }).from(user).where(eq(user.id, event.acceptingStudentId)).limit(1),
  ]);
  const acceptingStudentName = acceptingResult[0]?.name ?? "Your match";
  await dispatch(buildMessagingNudgeRecipes(event, { acceptingStudentName }));
}

export async function handleConversationOpened(event: ConversationOpenedEvent): Promise<void> {
  const [studentAResult, studentBResult] = await Promise.all([
    db.select({ name: user.name }).from(user).where(eq(user.id, event.studentAId)).limit(1),
    db.select({ name: user.name }).from(user).where(eq(user.id, event.studentBId)).limit(1),
  ]);
  const studentAName = studentAResult[0]?.name ?? "Your match";
  const studentBName = studentBResult[0]?.name ?? "Your match";
  await dispatch(buildConversationOpenedRecipes(event, { studentAName, studentBName }));
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

async function handleStudentSuspended(event: StudentSuspendedEvent): Promise<void> {
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

  const peerIds = [...new Set(
    activeProposals.map((p) => (p.proposerId === event.targetId ? p.receiverId : p.proposerId)),
  )];

  await dispatch(buildProposalCancelledRecipes(peerIds));
}

async function handleStudentSuspendedNotify(event: StudentSuspendedEvent): Promise<void> {
  await dispatch(buildStudentSuspendedNotifyRecipes(event));
}

async function handleSuspensionLifted(event: SuspensionLiftedEvent): Promise<void> {
  await dispatch(buildSuspensionLiftedRecipes(event));
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

  const peerIds = [...new Set(
    activeProposals.map((p) => (p.proposerId === event.targetId ? p.receiverId : p.proposerId)),
  )];

  await dispatch(buildProposalCancelledRecipes(peerIds));
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

async function handleStudentRemovedNotify(event: StudentRemovedEvent): Promise<void> {
  await dispatch(buildStudentRemovedNotifyRecipes(event));
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
    void handleStudentSuspended(event);
    void handleStudentSuspendedNotify(event);
  });
  domainEvents.on("SuspensionLifted", (event) => { void handleSuspensionLifted(event); });
  domainEvents.on("StudentRemoved", (event) => {
    void handleStudentRemovedCancelProposals(event);
    void handleStudentRemovedCloseConversations(event);
    void handleStudentRemovedNotify(event);
  });
}
