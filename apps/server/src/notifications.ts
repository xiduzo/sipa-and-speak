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
import { domainEvents, type MatchRequestSentEvent, type MatchRequestAcceptedEvent, type MatchRequestDeclinedEvent, type MeetupProposedEvent } from "@sip-and-speak/api/domain-events";
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
}
