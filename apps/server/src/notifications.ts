/**
 * Push notification service — Expo Push Notifications
 *
 * Wires domain events to Expo Push API calls.
 * Fire-and-forget: errors are logged but never thrown to callers.
 */
import { and, eq, inArray, or } from "drizzle-orm";
import { db } from "@sip-and-speak/db";
import { userDeviceToken, userLanguage, conversationPresence, meetup, conversation } from "@sip-and-speak/db/schema/sip-and-speak";
import { user } from "@sip-and-speak/db/schema/auth";
import { domainEvents, type MatchRequestSentEvent, type MatchRequestAcceptedEvent, type MatchRequestDeclinedEvent, type MeetupProposedEvent, type MeetupConfirmedEvent, type MeetupCounterProposedEvent, type MeetupDeclinedEvent, type MeetupCancelledEvent, type MeetupRescheduleProposedEvent, type MeetupRescheduledEvent, type MeetupRescheduleDeclinedEvent, type SipAndSpeakMomentCompletedEvent, type MeetupNotAttendedEvent, type MessagingOptInPromptedEvent, type MessagingNudgeNeededEvent, type ConversationOpenedEvent, type MessagingDeclineOutcomeEvent, type MessageSentEvent, type StudentWarnedEvent, type StudentSuspendedEvent, type SuspensionLiftedEvent, type StudentRemovedEvent } from "@sip-and-speak/api/domain-events";
import { buildMatchRequestNotificationBody } from "@sip-and-speak/api/routers/matching-utils";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

interface ExpoPushMessage {
  to: string;
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
  categoryIdentifier?: string;
}

interface ExpoPushTicket {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
}

async function sendExpoPushNotification(
  messages: ExpoPushMessage[],
): Promise<ExpoPushTicket[]> {
  const response = await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip, deflate",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(messages),
  });

  const json = await response.json() as { data: ExpoPushTicket[] };
  return json.data ?? [];
}

async function handleMatchRequestSent(event: MatchRequestSentEvent): Promise<void> {
  const { matchRequestId, requesterId, receiverId } = event;

  // Fetch requester's name and primary languages in parallel with device token lookup
  const [requesterResult, requesterLanguages, tokens] = await Promise.all([
    db
      .select({ name: user.name })
      .from(user)
      .where(eq(user.id, requesterId))
      .limit(1),
    db
      .select({ language: userLanguage.language, type: userLanguage.type })
      .from(userLanguage)
      .where(eq(userLanguage.userId, requesterId)),
    db
      .select({ id: userDeviceToken.id, token: userDeviceToken.token })
      .from(userDeviceToken)
      .where(eq(userDeviceToken.userId, receiverId)),
  ]);

  if (tokens.length === 0) {
    console.info("[push] No device token for receiver — skipping", { matchRequestId, receiverId });
    return;
  }

  const requesterName = requesterResult[0]?.name ?? "Someone";
  const offeredLanguage = requesterLanguages.find((l) => l.type === "spoken")?.language ?? null;
  const targetedLanguage = requesterLanguages.find((l) => l.type === "learning")?.language ?? null;
  const notificationBody = buildMatchRequestNotificationBody(requesterName, offeredLanguage, targetedLanguage);

  const messages: ExpoPushMessage[] = tokens.map(({ token }) => ({
    to: token,
    title: "New match request",
    body: notificationBody,
    data: { matchRequestId, requesterId },
  }));

  console.info("[push] Sending MatchRequestSent notification", {
    matchRequestId,
    receiverId,
    tokenCount: messages.length,
  });

  try {
    const tickets = await sendExpoPushNotification(messages);

    // Handle DeviceNotRegistered errors — remove stale tokens
    const staleTokenIds: string[] = [];
    for (let i = 0; i < tickets.length; i++) {
      const ticket = tickets[i];
      if (ticket?.status === "error" && ticket.details?.error === "DeviceNotRegistered") {
        const staleId = tokens[i]?.id;
        if (staleId) staleTokenIds.push(staleId);
      }
    }

    if (staleTokenIds.length > 0) {
      await Promise.all(
        staleTokenIds.map((id) =>
          db.delete(userDeviceToken).where(eq(userDeviceToken.id, id)),
        ),
      );
      console.info("[push] Removed stale device tokens", { staleTokenIds });
    }

    console.info("[push] Notification delivery complete", {
      matchRequestId,
      tickets: tickets.map((t) => ({ status: t.status, id: t.id })),
    });
  } catch (err) {
    console.error("[push] Failed to send notification", { matchRequestId, err });
  }
}

export async function handleMatchRequestAccepted(event: MatchRequestAcceptedEvent): Promise<void> {
  const { matchRequestId, requesterId, receiverId } = event;

  const [receiverResult, tokens] = await Promise.all([
    db.select({ name: user.name }).from(user).where(eq(user.id, receiverId)).limit(1),
    db
      .select({ id: userDeviceToken.id, token: userDeviceToken.token })
      .from(userDeviceToken)
      .where(eq(userDeviceToken.userId, requesterId)),
  ]);

  if (tokens.length === 0) {
    console.info("[push] No device token for requester — skipping", { matchRequestId, requesterId });
    return;
  }

  const receiverName = receiverResult[0]?.name ?? "Someone";

  const messages: ExpoPushMessage[] = tokens.map(({ token }) => ({
    to: token,
    title: "Your match request was accepted!",
    body: `${receiverName} accepted your request`,
    data: { matchRequestId, matchedWithUserId: receiverId, type: "match_accepted" },
    categoryIdentifier: "match_accepted",
  }));

  console.info("[push] Sending MatchRequestAccepted notification", {
    matchRequestId,
    requesterId,
    tokenCount: messages.length,
  });

  try {
    const tickets = await sendExpoPushNotification(messages);

    const staleTokenIds: string[] = [];
    for (let i = 0; i < tickets.length; i++) {
      const ticket = tickets[i];
      if (ticket?.status === "error" && ticket.details?.error === "DeviceNotRegistered") {
        const staleId = tokens[i]?.id;
        if (staleId) staleTokenIds.push(staleId);
      }
    }

    if (staleTokenIds.length > 0) {
      await Promise.all(
        staleTokenIds.map((id) =>
          db.delete(userDeviceToken).where(eq(userDeviceToken.id, id)),
        ),
      );
      console.info("[push] Removed stale device tokens", { staleTokenIds });
    }

    console.info("[push] MatchRequestAccepted notification delivery complete", {
      matchRequestId,
      tickets: tickets.map((t) => ({ status: t.status, id: t.id })),
    });
  } catch (err) {
    console.error("[push] Failed to send MatchRequestAccepted notification", { matchRequestId, err });
  }
}

export async function handleMatchRequestDeclined(event: MatchRequestDeclinedEvent): Promise<void> {
  const { matchRequestId, requesterId } = event;

  const tokens = await db
    .select({ id: userDeviceToken.id, token: userDeviceToken.token })
    .from(userDeviceToken)
    .where(eq(userDeviceToken.userId, requesterId));

  if (tokens.length === 0) {
    console.info("[push] No device token for requester — skipping", { matchRequestId, requesterId });
    return;
  }

  const messages: ExpoPushMessage[] = tokens.map(({ token }) => ({
    to: token,
    title: "Your match request was not accepted",
    body: "Keep exploring — there are more compatible Students waiting",
    data: { matchRequestId, type: "match_declined" },
  }));

  console.info("[push] Sending MatchRequestDeclined notification", {
    matchRequestId,
    requesterId,
    tokenCount: messages.length,
  });

  try {
    const tickets = await sendExpoPushNotification(messages);

    const staleTokenIds: string[] = [];
    for (let i = 0; i < tickets.length; i++) {
      const ticket = tickets[i];
      if (ticket?.status === "error" && ticket.details?.error === "DeviceNotRegistered") {
        const staleId = tokens[i]?.id;
        if (staleId) staleTokenIds.push(staleId);
      }
    }

    if (staleTokenIds.length > 0) {
      await Promise.all(
        staleTokenIds.map((id) =>
          db.delete(userDeviceToken).where(eq(userDeviceToken.id, id)),
        ),
      );
      console.info("[push] Removed stale device tokens", { staleTokenIds });
    }

    console.info("[push] MatchRequestDeclined notification delivery complete", {
      matchRequestId,
      tickets: tickets.map((t) => ({ status: t.status, id: t.id })),
    });
  } catch (err) {
    console.error("[push] Failed to send MatchRequestDeclined notification", { matchRequestId, err });
  }
}

async function handleMeetupProposed(event: MeetupProposedEvent): Promise<void> {
  const { meetupId, receiverId, venueName, date, time } = event;
  const tokens = await db
    .select({ id: userDeviceToken.id, token: userDeviceToken.token })
    .from(userDeviceToken)
    .where(eq(userDeviceToken.userId, receiverId));
  if (tokens.length === 0) return;

  const messages: ExpoPushMessage[] = tokens.map(({ token }) => ({
    to: token,
    title: "New meetup proposal",
    body: `${venueName} · ${date} at ${time}`,
    data: { meetupId, type: "meetup_proposed" },
  }));

  try {
    await sendExpoPushNotification(messages);
  } catch (err) {
    console.error("[push] Failed to send MeetupProposed notification", { meetupId, err });
  }
}

// #75 — Notify both Students when a meetup is confirmed
async function handleMeetupConfirmed(event: MeetupConfirmedEvent): Promise<void> {
  const { meetupId, proposerId, receiverId, venueName, date, time } = event;

  const [proposerTokens, receiverTokens] = await Promise.all([
    db.select({ id: userDeviceToken.id, token: userDeviceToken.token }).from(userDeviceToken).where(eq(userDeviceToken.userId, proposerId)),
    db.select({ id: userDeviceToken.id, token: userDeviceToken.token }).from(userDeviceToken).where(eq(userDeviceToken.userId, receiverId)),
  ]);

  const allTokens = [...proposerTokens, ...receiverTokens];
  if (allTokens.length === 0) return;

  const messages: ExpoPushMessage[] = allTokens.map(({ token }) => ({
    to: token,
    title: "Meetup confirmed! 🎉",
    body: `${venueName} · ${date} at ${time}`,
    data: { meetupId, type: "meetup_confirmed" },
  }));

  try {
    await sendExpoPushNotification(messages);
  } catch (err) {
    console.error("[push] Failed to send MeetupConfirmed notification", { meetupId, err });
  }
}

// #76 — Notify the original proposer that a counter-proposal has been made
async function handleMeetupCounterProposed(event: MeetupCounterProposedEvent): Promise<void> {
  const { meetupId, newReceiverId, venueName, date, time, round } = event;

  const tokens = await db
    .select({ id: userDeviceToken.id, token: userDeviceToken.token })
    .from(userDeviceToken)
    .where(eq(userDeviceToken.userId, newReceiverId));
  if (tokens.length === 0) return;

  const messages: ExpoPushMessage[] = tokens.map(({ token }) => ({
    to: token,
    title: `Counter-proposal received (round ${round})`,
    body: `${venueName} · ${date} at ${time}`,
    data: { meetupId, type: "meetup_counter_proposed", round },
  }));

  try {
    await sendExpoPushNotification(messages);
  } catch (err) {
    console.error("[push] Failed to send MeetupCounterProposed notification", { meetupId, err });
  }
}

// #77 — Notify both Students when a proposal is declined
async function handleMeetupDeclined(event: MeetupDeclinedEvent): Promise<void> {
  const { meetupId, proposerId, receiverId } = event;

  const [proposerTokens, receiverTokens] = await Promise.all([
    db.select({ id: userDeviceToken.id, token: userDeviceToken.token }).from(userDeviceToken).where(eq(userDeviceToken.userId, proposerId)),
    db.select({ id: userDeviceToken.id, token: userDeviceToken.token }).from(userDeviceToken).where(eq(userDeviceToken.userId, receiverId)),
  ]);

  const allTokens = [...proposerTokens, ...receiverTokens];
  if (allTokens.length === 0) return;

  const messages: ExpoPushMessage[] = allTokens.map(({ token }) => ({
    to: token,
    title: "Meetup proposal declined",
    body: "The proposal was declined — you can start a fresh proposal",
    data: { meetupId, type: "meetup_declined" },
  }));

  try {
    await sendExpoPushNotification(messages);
  } catch (err) {
    console.error("[push] Failed to send MeetupDeclined notification", { meetupId, err });
  }
}

export function registerNotificationHandlers(): void {
  domainEvents.on("MatchRequestSent", (event) => {
    // Fire and forget — do not await, must not block the mutation response
    void handleMatchRequestSent(event);
  });
  domainEvents.on("MatchRequestAccepted", (event) => {
    void handleMatchRequestAccepted(event);
  });
  domainEvents.on("MatchRequestDeclined", (event) => {
    void handleMatchRequestDeclined(event);
  });
  domainEvents.on("MeetupProposed", (event) => {
    void handleMeetupProposed(event);
  });
  domainEvents.on("MeetupConfirmed", (event) => {
    void handleMeetupConfirmed(event);
  });
  domainEvents.on("MeetupCounterProposed", (event) => {
    void handleMeetupCounterProposed(event);
  });
  domainEvents.on("MeetupDeclined", (event) => {
    void handleMeetupDeclined(event);
  });
  domainEvents.on("MeetupCancelled", (event) => {
    void handleMeetupCancelled(event);
  });
  domainEvents.on("MeetupRescheduleProposed", (event) => {
    void handleMeetupRescheduleProposed(event);
  });
  domainEvents.on("MeetupRescheduled", (event) => {
    void handleMeetupRescheduled(event);
  });
  domainEvents.on("MeetupRescheduleDeclined", (event) => {
    void handleMeetupRescheduleDeclined(event);
  });
  domainEvents.on("SipAndSpeakMomentCompleted", (event) => {
    void handleSipAndSpeakMomentCompleted(event);
  });
  domainEvents.on("MeetupNotAttended", (event) => {
    void handleMeetupNotAttended(event);
  });
  domainEvents.on("MessagingOptInPrompted", (event) => {
    void handleMessagingOptInPrompted(event);
  });
  domainEvents.on("MessagingNudgeNeeded", (event) => {
    void handleMessagingNudge(event);
  });
  domainEvents.on("ConversationOpened", (event) => {
    void handleConversationOpened(event);
  });
  domainEvents.on("MessagingDeclineOutcome", (event) => {
    void handleMessagingDeclineOutcome(event);
  });
  domainEvents.on("MessageSent", (event) => {
    void handleMessageSent(event);
  });
  domainEvents.on("StudentWarned", (event) => {
    void handleStudentWarned(event);
  });
  domainEvents.on("StudentSuspended", (event) => {
    void handleStudentSuspended(event);        // #102 — cancel proposals + notify peers
    void handleStudentSuspendedNotify(event);  // #104 — notify the suspended Student
  });
  domainEvents.on("SuspensionLifted", (event) => {
    void handleSuspensionLifted(event);
  });
  domainEvents.on("StudentRemoved", (event) => {
    void handleStudentRemovedCancelProposals(event); // #110 — cancel proposals + notify peers
    void handleStudentRemovedCloseConversations(event); // #111 — close open conversations
  });
}

// #91 — Notify both Students when a reschedule is accepted and meetup details are updated
async function handleMeetupRescheduled(event: MeetupRescheduledEvent): Promise<void> {
  const { meetupId, proposerId, receiverId, venueName, newDate, newTime } = event;

  const [proposerTokens, receiverTokens] = await Promise.all([
    db.select({ id: userDeviceToken.id, token: userDeviceToken.token }).from(userDeviceToken).where(eq(userDeviceToken.userId, proposerId)),
    db.select({ id: userDeviceToken.id, token: userDeviceToken.token }).from(userDeviceToken).where(eq(userDeviceToken.userId, receiverId)),
  ]);

  const allTokens = [...proposerTokens, ...receiverTokens];
  if (allTokens.length === 0) return;

  const messages: ExpoPushMessage[] = allTokens.map(({ token }) => ({
    to: token,
    title: "Meetup rescheduled",
    body: `New details: ${venueName} · ${newDate} at ${newTime}`,
    data: { meetupId, type: "meetup_rescheduled" },
  }));

  try {
    await sendExpoPushNotification(messages);
  } catch (err) {
    console.error("[push] Failed to send MeetupRescheduled notification", { meetupId, err });
  }
}

// #93 — Notify both Students when a reschedule is declined; confirm original details still in effect
async function handleMeetupRescheduleDeclined(event: MeetupRescheduleDeclinedEvent): Promise<void> {
  const { meetupId, proposerId, receiverId, venueName, originalDate, originalTime } = event;

  const [proposerTokens, receiverTokens] = await Promise.all([
    db.select({ id: userDeviceToken.id, token: userDeviceToken.token }).from(userDeviceToken).where(eq(userDeviceToken.userId, proposerId)),
    db.select({ id: userDeviceToken.id, token: userDeviceToken.token }).from(userDeviceToken).where(eq(userDeviceToken.userId, receiverId)),
  ]);

  const allTokens = [...proposerTokens, ...receiverTokens];
  if (allTokens.length === 0) return;

  const messages: ExpoPushMessage[] = allTokens.map(({ token }) => ({
    to: token,
    title: "Reschedule declined",
    body: `Original meetup stands: ${venueName} · ${originalDate} at ${originalTime}`,
    data: { meetupId, type: "meetup_reschedule_declined" },
  }));

  try {
    await sendExpoPushNotification(messages);
  } catch (err) {
    console.error("[push] Failed to send MeetupRescheduleDeclined notification", { meetupId, err });
  }
}

// #89 — Notify the other Student of a reschedule proposal
async function handleMeetupRescheduleProposed(event: MeetupRescheduleProposedEvent): Promise<void> {
  const { meetupId, receiverId, venueName, date, time } = event;
  const tokens = await db
    .select({ id: userDeviceToken.id, token: userDeviceToken.token })
    .from(userDeviceToken)
    .where(eq(userDeviceToken.userId, receiverId));
  if (tokens.length === 0) {
    console.info("[push] No device token for receiver — skipping reschedule notification", { meetupId, receiverId });
    return;
  }
  const messages: ExpoPushMessage[] = tokens.map(({ token }) => ({
    to: token,
    title: "Reschedule request",
    body: `Your partner wants to move your meetup to ${venueName} · ${date} at ${time}`,
    data: { meetupId, type: "meetup_reschedule_proposed" },
  }));
  try {
    await sendExpoPushNotification(messages);
  } catch (err) {
    console.error("[push] Failed to send MeetupRescheduleProposed notification", { meetupId, err });
  }
}

// #101 — Notify both Students when meetup not attended; pair returns to Matched
async function handleMeetupNotAttended(event: MeetupNotAttendedEvent): Promise<void> {
  const { meetupId, studentAId, studentBId } = event;
  const [tokensA, tokensB] = await Promise.all([
    db.select({ id: userDeviceToken.id, token: userDeviceToken.token }).from(userDeviceToken).where(eq(userDeviceToken.userId, studentAId)),
    db.select({ id: userDeviceToken.id, token: userDeviceToken.token }).from(userDeviceToken).where(eq(userDeviceToken.userId, studentBId)),
  ]);
  const allTokens = [...tokensA, ...tokensB];
  if (allTokens.length === 0) return;
  const messages: ExpoPushMessage[] = allTokens.map(({ token }) => ({
    to: token,
    title: "Meetup not attended",
    body: "The meetup was marked as not attended — you can schedule a new one",
    data: { meetupId, type: "meetup_not_attended" },
  }));
  try {
    await sendExpoPushNotification(messages);
  } catch (err) {
    console.error("[push] Failed to send MeetupNotAttended notification", { meetupId, err });
  }
}

// #99 — Notify both Students when their S&S moment is completed (both attended)
async function handleSipAndSpeakMomentCompleted(event: SipAndSpeakMomentCompletedEvent): Promise<void> {
  const { meetupId, studentAId, studentBId } = event;
  const [tokensA, tokensB] = await Promise.all([
    db.select({ id: userDeviceToken.id, token: userDeviceToken.token }).from(userDeviceToken).where(eq(userDeviceToken.userId, studentAId)),
    db.select({ id: userDeviceToken.id, token: userDeviceToken.token }).from(userDeviceToken).where(eq(userDeviceToken.userId, studentBId)),
  ]);
  const allTokens = [...tokensA, ...tokensB];
  if (allTokens.length === 0) return;
  const messages: ExpoPushMessage[] = allTokens.map(({ token }) => ({
    to: token,
    title: "Your S&S moment is complete! 🎉",
    body: "You both attended — congratulations on your connection!",
    data: { meetupId, type: "sip_and_speak_moment_completed" },
  }));
  try {
    await sendExpoPushNotification(messages);
  } catch (err) {
    console.error("[push] Failed to send SipAndSpeakMomentCompleted notification", { meetupId, err });
  }
}

// #138 — Prompt both Students to opt in to messaging after a completed meetup
export async function handleMessagingOptInPrompted(event: MessagingOptInPromptedEvent): Promise<void> {
  const { meetupId, studentAId, studentBId } = event;

  const [studentAResult, studentBResult, tokensA, tokensB] = await Promise.all([
    db.select({ name: user.name }).from(user).where(eq(user.id, studentAId)).limit(1),
    db.select({ name: user.name }).from(user).where(eq(user.id, studentBId)).limit(1),
    db
      .select({ id: userDeviceToken.id, token: userDeviceToken.token })
      .from(userDeviceToken)
      .where(eq(userDeviceToken.userId, studentAId)),
    db
      .select({ id: userDeviceToken.id, token: userDeviceToken.token })
      .from(userDeviceToken)
      .where(eq(userDeviceToken.userId, studentBId)),
  ]);

  const studentAName = studentAResult[0]?.name ?? "Your match";
  const studentBName = studentBResult[0]?.name ?? "Your match";

  const messages: ExpoPushMessage[] = [];

  for (const { token } of tokensA) {
    messages.push({
      to: token,
      title: "Want to keep in touch?",
      body: `${studentBName} completed a S&S moment with you — would you like to message them?`,
      data: { meetupId, type: "messaging_opt_in", deepLink: `/messaging/opt-in/${meetupId}` },
    });
  }

  for (const { token } of tokensB) {
    messages.push({
      to: token,
      title: "Want to keep in touch?",
      body: `${studentAName} completed a S&S moment with you — would you like to message them?`,
      data: { meetupId, type: "messaging_opt_in", deepLink: `/messaging/opt-in/${meetupId}` },
    });
  }

  if (messages.length === 0) {
    console.info("[push] No device tokens for either student — skipping opt-in notification", { meetupId });
    return;
  }

  console.info("[push] Sending MessagingOptInPrompted notification", { meetupId, tokenCount: messages.length });

  try {
    await sendExpoPushNotification(messages);
  } catch (err) {
    console.error("[push] Failed to send MessagingOptInPrompted notification", { meetupId, err });
  }
}

// #140 — Nudge the pending Student when their match accepts the messaging opt-in
export async function handleMessagingNudge(event: MessagingNudgeNeededEvent): Promise<void> {
  const { meetupId, acceptingStudentId, pendingStudentId } = event;

  const [acceptingStudentResult, tokens] = await Promise.all([
    db.select({ name: user.name }).from(user).where(eq(user.id, acceptingStudentId)).limit(1),
    db
      .select({ id: userDeviceToken.id, token: userDeviceToken.token })
      .from(userDeviceToken)
      .where(eq(userDeviceToken.userId, pendingStudentId)),
  ]);

  if (tokens.length === 0) {
    console.info("[push] No device token for pending student — skipping messaging nudge", {
      meetupId,
      pendingStudentId,
    });
    return;
  }

  const acceptingStudentName = acceptingStudentResult[0]?.name ?? "Your match";

  const messages: ExpoPushMessage[] = tokens.map(({ token }) => ({
    to: token,
    title: "Your match wants to message you!",
    body: `${acceptingStudentName} accepted messaging — let them know if you're in!`,
    data: { meetupId, type: "messaging_nudge", deepLink: `/messaging/opt-in/${meetupId}` },
  }));

  console.info("[push] Sending MessagingNudge notification", { meetupId, pendingStudentId, tokenCount: messages.length });

  try {
    await sendExpoPushNotification(messages);
  } catch (err) {
    console.error("[push] Failed to send MessagingNudge notification", { meetupId, pendingStudentId, err });
  }
}

// #141 — Notify both Students when their conversation channel is opened
export async function handleConversationOpened(event: ConversationOpenedEvent): Promise<void> {
  const { conversationId, meetupId, studentAId, studentBId } = event;

  const [studentAResult, studentBResult, tokensA, tokensB] = await Promise.all([
    db.select({ name: user.name }).from(user).where(eq(user.id, studentAId)).limit(1),
    db.select({ name: user.name }).from(user).where(eq(user.id, studentBId)).limit(1),
    db
      .select({ id: userDeviceToken.id, token: userDeviceToken.token })
      .from(userDeviceToken)
      .where(eq(userDeviceToken.userId, studentAId)),
    db
      .select({ id: userDeviceToken.id, token: userDeviceToken.token })
      .from(userDeviceToken)
      .where(eq(userDeviceToken.userId, studentBId)),
  ]);

  const studentAName = studentAResult[0]?.name ?? "Your match";
  const studentBName = studentBResult[0]?.name ?? "Your match";

  const messages: ExpoPushMessage[] = [];

  for (const { token } of tokensA) {
    messages.push({
      to: token,
      title: "Your messaging channel is open!",
      body: `${studentBName} also accepted — you can now message each other.`,
      data: { conversationId, meetupId, type: "conversation_opened", deepLink: `/conversations/${conversationId}` },
    });
  }

  for (const { token } of tokensB) {
    messages.push({
      to: token,
      title: "Your messaging channel is open!",
      body: `${studentAName} also accepted — you can now message each other.`,
      data: { conversationId, meetupId, type: "conversation_opened", deepLink: `/conversations/${conversationId}` },
    });
  }

  if (messages.length === 0) {
    console.info("[push] No device tokens for either student — skipping conversation-opened notification", {
      conversationId,
      meetupId,
    });
    return;
  }

  console.info("[push] Sending ConversationOpened notification", { conversationId, meetupId, tokenCount: messages.length });

  try {
    await sendExpoPushNotification(messages);
  } catch (err) {
    console.error("[push] Failed to send ConversationOpened notification", { conversationId, meetupId, err });
  }
}

// #142 — Notify both Students when messaging won't be available (decline outcome)
export async function handleMessagingDeclineOutcome(event: MessagingDeclineOutcomeEvent): Promise<void> {
  const { meetupId, studentAId, studentBId } = event;

  const [tokensA, tokensB] = await Promise.all([
    db.select({ id: userDeviceToken.id, token: userDeviceToken.token }).from(userDeviceToken).where(eq(userDeviceToken.userId, studentAId)),
    db.select({ id: userDeviceToken.id, token: userDeviceToken.token }).from(userDeviceToken).where(eq(userDeviceToken.userId, studentBId)),
  ]);

  const messages: ExpoPushMessage[] = [
    ...tokensA.map(({ token }) => ({ to: token, title: "Messaging not available", body: "One of you decided not to connect via messages — that's OK!", data: { meetupId, type: "messaging_decline_outcome" } })),
    ...tokensB.map(({ token }) => ({ to: token, title: "Messaging not available", body: "One of you decided not to connect via messages — that's OK!", data: { meetupId, type: "messaging_decline_outcome" } })),
  ];

  if (messages.length === 0) {
    console.info("[push] No tokens — skipping decline-outcome notification", { meetupId });
    return;
  }

  console.info("[push] Sending MessagingDeclineOutcome notification", { meetupId, tokenCount: messages.length });
  try {
    await sendExpoPushNotification(messages);
  } catch (err) {
    console.error("[push] Failed to send MessagingDeclineOutcome notification", { meetupId, err });
  }
}

// #152 — Notify recipient when a new message arrives
export async function handleMessageSent(event: MessageSentEvent): Promise<void> {
  const { conversationId, senderId, recipientId, senderName } = event;

  // #153 — Suppress push if recipient is actively viewing this conversation
  const [presence] = await db
    .select({ activeUntil: conversationPresence.activeUntil })
    .from(conversationPresence)
    .where(
      and(
        eq(conversationPresence.studentId, recipientId),
        eq(conversationPresence.conversationId, conversationId),
      ),
    )
    .limit(1);

  if (presence && presence.activeUntil > new Date()) {
    console.info("[push] Recipient is actively viewing — suppressing push", {
      conversationId,
      recipientId,
    });
    return;
  }

  const tokens = await db
    .select({ id: userDeviceToken.id, token: userDeviceToken.token })
    .from(userDeviceToken)
    .where(eq(userDeviceToken.userId, recipientId));

  if (tokens.length === 0) {
    console.info("[push] No device token for recipient — skipping new message notification", {
      conversationId,
      recipientId,
    });
    return;
  }

  const messages: ExpoPushMessage[] = tokens.map(({ token }) => ({
    to: token,
    title: senderName,
    body: "sent you a message",
    data: { conversationId, senderId, type: "message_received" },
  }));

  console.info("[push] Sending MessageSent notification", {
    conversationId,
    recipientId,
    tokenCount: messages.length,
  });

  try {
    const tickets = await sendExpoPushNotification(messages);

    const staleTokenIds: string[] = [];
    for (let i = 0; i < tickets.length; i++) {
      const ticket = tickets[i];
      if (ticket?.status === "error" && ticket.details?.error === "DeviceNotRegistered") {
        const staleId = tokens[i]?.id;
        if (staleId) staleTokenIds.push(staleId);
      }
    }

    if (staleTokenIds.length > 0) {
      await Promise.all(
        staleTokenIds.map((id) => db.delete(userDeviceToken).where(eq(userDeviceToken.id, id))),
      );
      console.info("[push] Removed stale device tokens", { staleTokenIds });
    }

    console.info("[push] MessageSent notification delivery complete", {
      conversationId,
      tickets: tickets.map((t) => ({ status: t.status, id: t.id })),
    });
  } catch (err) {
    console.error("[push] Failed to send MessageSent notification", { conversationId, err });
  }
}

// #83 — Notify the other Student of the cancellation
async function handleMeetupCancelled(event: MeetupCancelledEvent): Promise<void> {
  const { meetupId, otherStudentId } = event;
  const tokens = await db
    .select({ id: userDeviceToken.id, token: userDeviceToken.token })
    .from(userDeviceToken)
    .where(eq(userDeviceToken.userId, otherStudentId));
  if (tokens.length === 0) return;
  const messages: ExpoPushMessage[] = tokens.map(({ token }) => ({
    to: token,
    title: "Meetup cancelled",
    body: "Your partner cancelled the meetup — you can start a fresh proposal",
    data: { meetupId, type: "meetup_cancelled" },
  }));
  try {
    await sendExpoPushNotification(messages);
  } catch (err) {
    console.error("[push] Failed to send MeetupCancelled notification", { meetupId, err });
  }
}

// #94 — Notify warned Student of the moderation decision
async function handleStudentWarned(event: StudentWarnedEvent): Promise<void> {
  const { flagId, targetId } = event;
  const tokens = await db
    .select({ id: userDeviceToken.id, token: userDeviceToken.token })
    .from(userDeviceToken)
    .where(eq(userDeviceToken.userId, targetId));
  if (tokens.length === 0) return;
  const messages: ExpoPushMessage[] = tokens.map(({ token }) => ({
    to: token,
    title: "Moderation notice",
    body: "A formal warning has been recorded on your account. Please review the community guidelines.",
    data: { flagId, type: "student_warned" },
  }));
  try {
    await sendExpoPushNotification(messages);
  } catch (err) {
    console.error("[push] Failed to send StudentWarned notification", { flagId, err });
  }
}

// #102 — Cancel active meetup proposals when a Student is suspended; notify affected peers
async function handleStudentSuspended(event: StudentSuspendedEvent): Promise<void> {
  const { flagId, targetId } = event;

  const activeProposals = await db
    .select({ id: meetup.id, proposerId: meetup.proposerId, receiverId: meetup.receiverId })
    .from(meetup)
    .where(
      and(
        or(eq(meetup.proposerId, targetId), eq(meetup.receiverId, targetId)),
        inArray(meetup.status, ["pending", "confirmed"]),
      ),
    );

  if (activeProposals.length > 0) {
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
      activeProposals.map((p) => p.proposerId === targetId ? p.receiverId : p.proposerId),
    )];

    const tokens = await db
      .select({ token: userDeviceToken.token })
      .from(userDeviceToken)
      .where(inArray(userDeviceToken.userId, peerIds));

    if (tokens.length > 0) {
      const messages: ExpoPushMessage[] = tokens.map(({ token }) => ({
        to: token,
        title: "Meetup proposal cancelled",
        body: "Your meetup proposal has been cancelled.",
        data: { type: "proposal_cancelled" },
      }));
      try {
        await sendExpoPushNotification(messages);
      } catch (err) {
        console.error("[push] Failed to send proposal cancellation notification", { flagId, err });
      }
    }
  }
}

// #104 — Notify suspended Student of the moderation decision
async function handleStudentSuspendedNotify(event: StudentSuspendedEvent): Promise<void> {
  const { flagId, targetId } = event;
  const tokens = await db
    .select({ token: userDeviceToken.token })
    .from(userDeviceToken)
    .where(eq(userDeviceToken.userId, targetId));
  if (tokens.length === 0) return;
  const messages: ExpoPushMessage[] = tokens.map(({ token }) => ({
    to: token,
    title: "Account suspended",
    body: "Your account has been temporarily suspended. You will not be able to participate until the suspension is lifted.",
    data: { flagId, type: "student_suspended" },
  }));
  try {
    await sendExpoPushNotification(messages);
  } catch (err) {
    console.error("[push] Failed to send StudentSuspended notification", { flagId, err });
  }
}

// #110 — Cancel active meetup proposals when a Student is permanently removed
async function handleStudentRemovedCancelProposals(event: StudentRemovedEvent): Promise<void> {
  const { targetId } = event;

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
    activeProposals.map((p) => p.proposerId === targetId ? p.receiverId : p.proposerId),
  )];

  const tokens = await db
    .select({ token: userDeviceToken.token })
    .from(userDeviceToken)
    .where(inArray(userDeviceToken.userId, peerIds));

  if (tokens.length > 0) {
    const messages: ExpoPushMessage[] = tokens.map(({ token }) => ({
      to: token,
      title: "Meetup proposal cancelled",
      body: "Your meetup proposal has been cancelled.",
      data: { type: "proposal_cancelled" },
    }));
    try {
      await sendExpoPushNotification(messages);
    } catch (err) {
      console.error("[push] Failed to send removal proposal cancellation notification", { targetId, err });
    }
  }
}

// #111 — Close all open conversations involving a permanently removed Student
async function handleStudentRemovedCloseConversations(event: StudentRemovedEvent): Promise<void> {
  const { targetId } = event;

  const openConversations = await db
    .select({ id: conversation.id })
    .from(conversation)
    .where(
      and(
        or(eq(conversation.user1Id, targetId), eq(conversation.user2Id, targetId)),
        eq(conversation.status, "open"),
      ),
    );

  if (openConversations.length === 0) return;

  await db
    .update(conversation)
    .set({ status: "closed" })
    .where(
      and(
        or(eq(conversation.user1Id, targetId), eq(conversation.user2Id, targetId)),
        eq(conversation.status, "open"),
      ),
    );

  console.info("[moderation] Closed conversations on removal", { targetId, count: openConversations.length });
}

// #106 — Notify Student when their suspension is lifted
async function handleSuspensionLifted(event: SuspensionLiftedEvent): Promise<void> {
  const { targetId } = event;
  const tokens = await db
    .select({ token: userDeviceToken.token })
    .from(userDeviceToken)
    .where(eq(userDeviceToken.userId, targetId));
  if (tokens.length === 0) return;
  const messages: ExpoPushMessage[] = tokens.map(({ token }) => ({
    to: token,
    title: "Suspension lifted",
    body: "Your suspension has been lifted. You can now participate in Sip & Speak again.",
    data: { type: "suspension_lifted" },
  }));
  try {
    await sendExpoPushNotification(messages);
  } catch (err) {
    console.error("[push] Failed to send SuspensionLifted notification", { targetId, err });
  }
}
