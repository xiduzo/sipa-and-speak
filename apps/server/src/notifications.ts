/**
 * Push notification service — Expo Push Notifications
 *
 * Wires domain events to Expo Push API calls.
 * Fire-and-forget: errors are logged but never thrown to callers.
 */
import { eq } from "drizzle-orm";
import { db } from "@sip-and-speak/db";
import { userDeviceToken } from "@sip-and-speak/db/schema/sip-and-speak";
import { domainEvents, type MatchRequestSentEvent } from "@sip-and-speak/api/domain-events";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

interface ExpoPushMessage {
  to: string;
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
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
  const { matchRequestId, receiverId } = event;

  // Look up receiver's device tokens
  const tokens = await db
    .select({ id: userDeviceToken.id, token: userDeviceToken.token })
    .from(userDeviceToken)
    .where(eq(userDeviceToken.userId, receiverId));

  if (tokens.length === 0) {
    console.info("[push] No device token for receiver — skipping", { matchRequestId, receiverId });
    return;
  }

  const messages: ExpoPushMessage[] = tokens.map(({ token }) => ({
    to: token,
    title: "Someone wants to meet you!",
    body: "Open the app to see who sent you a match request.",
    data: { matchRequestId },
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

export function registerNotificationHandlers(): void {
  domainEvents.on("MatchRequestSent", (event) => {
    // Fire and forget — do not await, must not block the mutation response
    void handleMatchRequestSent(event);
  });
}
