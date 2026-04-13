/**
 * Push notification service — Expo Push Notifications
 *
 * Wires domain events to Expo Push API calls.
 * Fire-and-forget: errors are logged but never thrown to callers.
 */
import { eq } from "drizzle-orm";
import { db } from "@sip-and-speak/db";
import { userDeviceToken, userLanguage } from "@sip-and-speak/db/schema/sip-and-speak";
import { user } from "@sip-and-speak/db/schema/auth";
import { domainEvents, type MatchRequestSentEvent, type MatchRequestAcceptedEvent, type MatchRequestDeclinedEvent, type MeetupProposedEvent, type MeetupConfirmedEvent, type MeetupCounterProposedEvent, type MeetupDeclinedEvent, type MeetupCancelledEvent, type MeetupRescheduleProposedEvent, type MeetupRescheduledEvent, type MeetupRescheduleDeclinedEvent, type SipAndSpeakMomentCompletedEvent, type MeetupNotAttendedEvent, type MessagingOptInPromptedEvent } from "@sip-and-speak/api/domain-events";
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
