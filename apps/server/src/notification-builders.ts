import type {
  MatchRequestSentEvent,
  MatchRequestAcceptedEvent,
  MatchRequestDeclinedEvent,
  MeetupProposedEvent,
  MeetupConfirmedEvent,
  MeetupCounterProposedEvent,
  MeetupDeclinedEvent,
  MeetupCancelledEvent,
  MeetupRescheduleProposedEvent,
  MeetupRescheduledEvent,
  MeetupRescheduleDeclinedEvent,
  SipAndSpeakMomentCompletedEvent,
  MeetupNotAttendedEvent,
  MessagingOptInPromptedEvent,
  MessagingNudgeNeededEvent,
  ConversationOpenedEvent,
  MessagingDeclineOutcomeEvent,
  MessageSentEvent,
  StudentWarnedEvent,
  StudentSuspendedEvent,
  SuspensionLiftedEvent,
  StudentRemovedEvent,
} from "@sip-and-speak/api/domain-events";
import { buildMatchRequestNotificationBody } from "@sip-and-speak/api/routers/matching-utils";
import type { Recipe } from "./notification-recipe";

export function buildMatchRequestSentRecipes(
  event: MatchRequestSentEvent,
  ctx: { requesterName: string; offeredLanguage: string | null; targetedLanguage: string | null },
): Recipe[] {
  return [
    {
      recipientId: event.receiverId,
      title: "New match request",
      body: buildMatchRequestNotificationBody(ctx.requesterName, ctx.offeredLanguage, ctx.targetedLanguage),
      data: { matchRequestId: event.matchRequestId, requesterId: event.requesterId },
    },
  ];
}

export function buildMatchRequestAcceptedRecipes(
  event: MatchRequestAcceptedEvent,
  ctx: { receiverName: string },
): Recipe[] {
  return [
    {
      recipientId: event.requesterId,
      title: "Your match request was accepted!",
      body: `${ctx.receiverName} accepted your request`,
      data: { matchRequestId: event.matchRequestId, matchedWithUserId: event.receiverId, type: "match_accepted" },
      category: "match_accepted",
    },
  ];
}

export function buildMatchRequestDeclinedRecipes(event: MatchRequestDeclinedEvent): Recipe[] {
  return [
    {
      recipientId: event.requesterId,
      title: "Your match request was not accepted",
      body: "Keep exploring — there are more compatible Students waiting",
      data: { matchRequestId: event.matchRequestId, type: "match_declined" },
    },
  ];
}

export function buildMeetupProposedRecipes(event: MeetupProposedEvent): Recipe[] {
  return [
    {
      recipientId: event.receiverId,
      title: "New meetup proposal",
      body: `${event.venueName} · ${event.date} at ${event.time}`,
      data: { meetupId: event.meetupId, type: "meetup_proposed" },
    },
  ];
}

export function buildMeetupConfirmedRecipes(event: MeetupConfirmedEvent): Recipe[] {
  const body = `${event.venueName} · ${event.date} at ${event.time}`;
  const data = { meetupId: event.meetupId, type: "meetup_confirmed", venueName: event.venueName, date: event.date, time: event.time };
  return [
    { recipientId: event.proposerId, title: "Meetup confirmed! 🎉", body, data },
    { recipientId: event.receiverId, title: "Meetup confirmed! 🎉", body, data },
  ];
}

export function buildMeetupCounterProposedRecipes(event: MeetupCounterProposedEvent): Recipe[] {
  return [
    {
      recipientId: event.newReceiverId,
      title: `Counter-proposal received (round ${event.round})`,
      body: `${event.venueName} · ${event.date} at ${event.time}`,
      data: { meetupId: event.meetupId, type: "meetup_counter_proposed", round: event.round },
    },
  ];
}

export function buildMeetupDeclinedRecipes(event: MeetupDeclinedEvent): Recipe[] {
  const body = "The proposal was declined — you can start a fresh proposal";
  const data = { meetupId: event.meetupId, type: "meetup_declined" };
  return [
    { recipientId: event.proposerId, title: "Meetup proposal declined", body, data },
    { recipientId: event.receiverId, title: "Meetup proposal declined", body, data },
  ];
}

export function buildMeetupCancelledRecipes(event: MeetupCancelledEvent): Recipe[] {
  return [
    {
      recipientId: event.otherStudentId,
      title: "Meetup cancelled",
      body: "Your partner cancelled the meetup — you can start a fresh proposal",
      data: { meetupId: event.meetupId, type: "meetup_cancelled" },
    },
  ];
}

export function buildMeetupRescheduleProposedRecipes(event: MeetupRescheduleProposedEvent): Recipe[] {
  return [
    {
      recipientId: event.receiverId,
      title: "Reschedule request",
      body: `Your partner wants to move your meetup to ${event.venueName} · ${event.date} at ${event.time}`,
      data: { meetupId: event.meetupId, type: "meetup_reschedule_proposed" },
    },
  ];
}

export function buildMeetupRescheduledRecipes(event: MeetupRescheduledEvent): Recipe[] {
  const body = `New details: ${event.venueName} · ${event.newDate} at ${event.newTime}`;
  const data = { meetupId: event.meetupId, type: "meetup_rescheduled" };
  return [
    { recipientId: event.proposerId, title: "Meetup rescheduled", body, data },
    { recipientId: event.receiverId, title: "Meetup rescheduled", body, data },
  ];
}

export function buildMeetupRescheduleDeclinedRecipes(event: MeetupRescheduleDeclinedEvent): Recipe[] {
  const body = `Original meetup stands: ${event.venueName} · ${event.originalDate} at ${event.originalTime}`;
  const data = { meetupId: event.meetupId, type: "meetup_reschedule_declined" };
  return [
    { recipientId: event.proposerId, title: "Reschedule declined", body, data },
    { recipientId: event.receiverId, title: "Reschedule declined", body, data },
  ];
}

export function buildSipAndSpeakMomentCompletedRecipes(event: SipAndSpeakMomentCompletedEvent): Recipe[] {
  const body = "You both attended — congratulations on your connection!";
  const data = { meetupId: event.meetupId, type: "sip_and_speak_moment_completed" };
  return [
    { recipientId: event.studentAId, title: "Your S&S moment is complete! 🎉", body, data },
    { recipientId: event.studentBId, title: "Your S&S moment is complete! 🎉", body, data },
  ];
}

export function buildMeetupNotAttendedRecipes(event: MeetupNotAttendedEvent): Recipe[] {
  const body = "The meetup was marked as not attended — you can schedule a new one";
  const data = { meetupId: event.meetupId, type: "meetup_not_attended" };
  return [
    { recipientId: event.studentAId, title: "Meetup not attended", body, data },
    { recipientId: event.studentBId, title: "Meetup not attended", body, data },
  ];
}

export function buildMessagingOptInPromptedRecipes(
  event: MessagingOptInPromptedEvent,
  ctx: { studentAName: string; studentBName: string },
): Recipe[] {
  const data = { meetupId: event.meetupId, type: "messaging_opt_in", deepLink: `/messaging/opt-in/${event.meetupId}` };
  return [
    {
      recipientId: event.studentAId,
      title: "Want to keep in touch?",
      body: `${ctx.studentBName} completed a S&S moment with you — would you like to message them?`,
      data,
    },
    {
      recipientId: event.studentBId,
      title: "Want to keep in touch?",
      body: `${ctx.studentAName} completed a S&S moment with you — would you like to message them?`,
      data,
    },
  ];
}

export function buildMessagingNudgeRecipes(
  event: MessagingNudgeNeededEvent,
  ctx: { acceptingStudentName: string },
): Recipe[] {
  return [
    {
      recipientId: event.pendingStudentId,
      title: "Your match wants to message you!",
      body: `${ctx.acceptingStudentName} accepted messaging — let them know if you're in!`,
      data: { meetupId: event.meetupId, type: "messaging_nudge", deepLink: `/messaging/opt-in/${event.meetupId}` },
    },
  ];
}

export function buildConversationOpenedRecipes(
  event: ConversationOpenedEvent,
  ctx: { studentAName: string; studentBName: string },
): Recipe[] {
  const data = {
    conversationId: event.conversationId,
    meetupId: event.meetupId,
    type: "conversation_opened",
    deepLink: `/conversations/${event.conversationId}`,
  };
  return [
    {
      recipientId: event.studentAId,
      title: "Your messaging channel is open!",
      body: `${ctx.studentBName} also accepted — you can now message each other.`,
      data,
    },
    {
      recipientId: event.studentBId,
      title: "Your messaging channel is open!",
      body: `${ctx.studentAName} also accepted — you can now message each other.`,
      data,
    },
  ];
}

export function buildMessagingDeclineOutcomeRecipes(event: MessagingDeclineOutcomeEvent): Recipe[] {
  const body = "One of you decided not to connect via messages — that's OK!";
  const data = { meetupId: event.meetupId, type: "messaging_decline_outcome" };
  return [
    { recipientId: event.studentAId, title: "Messaging not available", body, data },
    { recipientId: event.studentBId, title: "Messaging not available", body, data },
  ];
}

export function buildMessageSentRecipes(event: MessageSentEvent): Recipe[] {
  return [
    {
      recipientId: event.recipientId,
      title: event.senderName,
      body: "sent you a message",
      data: { conversationId: event.conversationId, senderId: event.senderId, type: "message_received" },
    },
  ];
}

export function buildStudentWarnedRecipes(event: StudentWarnedEvent): Recipe[] {
  return [
    {
      recipientId: event.targetId,
      title: "Moderation notice",
      body: "A formal warning has been recorded on your account. Please review the community guidelines.",
      data: { flagId: event.flagId, type: "student_warned" },
    },
  ];
}

export function buildStudentSuspendedNotifyRecipes(event: StudentSuspendedEvent): Recipe[] {
  return [
    {
      recipientId: event.targetId,
      title: "Account suspended",
      body: "Your account has been temporarily suspended. You will not be able to participate until the suspension is lifted.",
      data: { flagId: event.flagId, type: "student_suspended" },
    },
  ];
}

export function buildSuspensionLiftedRecipes(event: SuspensionLiftedEvent): Recipe[] {
  return [
    {
      recipientId: event.targetId,
      title: "Suspension lifted",
      body: "Your suspension has been lifted. You can now participate in Sip & Speak again.",
      data: { type: "suspension_lifted" },
    },
  ];
}

export function buildStudentRemovedNotifyRecipes(event: StudentRemovedEvent): Recipe[] {
  return [
    {
      recipientId: event.targetId,
      title: "Your account has been removed",
      body: "Your Sip & Speak account has been permanently removed. You can no longer access the platform.",
      data: { type: "student_removed" },
    },
  ];
}

export function buildProposalCancelledRecipes(peerIds: string[]): Recipe[] {
  return peerIds.map((peerId) => ({
    recipientId: peerId,
    title: "Meetup proposal cancelled",
    body: "Your meetup proposal has been cancelled.",
    data: { type: "proposal_cancelled" },
  }));
}
