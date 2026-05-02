/**
 * Wires domain events to push notifications.
 * Fire-and-forget: errors are logged in the dispatcher, never thrown to callers.
 *
 * NOTE: moderation cascades live in @sip-and-speak/api/contexts/moderation/handlers.ts.
 * That handler emits ProposalsCancelledByCascade with peer IDs after cancelling proposals;
 * this dispatcher subscribes to that event rather than re-querying the DB.
 */
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
  type ProposalsCancelledByCascadeEvent,
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

export async function handleMessageSent(event: MessageSentEvent): Promise<void> {
  if (event.recipientIsPresent) return;
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

async function handleProposalsCancelledByCascade(event: ProposalsCancelledByCascadeEvent): Promise<void> {
  if (event.peerIds.length === 0) return;
  await dispatch(buildProposalCancelledRecipes(event.peerIds));
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
  domainEvents.on("StudentSuspended", (event) => { void handleStudentSuspendedNotify(event); });
  domainEvents.on("SuspensionLifted", (event) => { void handleSuspensionLifted(event); });
  domainEvents.on("StudentRemoved", (event) => { void handleStudentRemovedNotify(event); });
  domainEvents.on("ProposalsCancelledByCascade", (event) => { void handleProposalsCancelledByCascade(event); });
}
