import { eq } from "drizzle-orm";
import { db } from "@sip-and-speak/db";
import { userDeviceToken } from "@sip-and-speak/db/schema/sip-and-speak";
import { getDelivery, type DeliveryMessage } from "./delivery";

export interface Recipe {
  recipientId: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  category?: string;
}

interface TokenRow {
  id: string;
  token: string;
}

async function loadTokensFor(recipientIds: string[]): Promise<Map<string, TokenRow[]>> {
  const map = new Map<string, TokenRow[]>();
  if (recipientIds.length === 0) return map;
  const results = await Promise.all(
    recipientIds.map(async (uid) => {
      const rows = await db
        .select({ id: userDeviceToken.id, token: userDeviceToken.token })
        .from(userDeviceToken)
        .where(eq(userDeviceToken.userId, uid));
      return [uid, rows] as const;
    }),
  );
  for (const [uid, rows] of results) {
    map.set(uid, rows);
  }
  return map;
}

export async function dispatch(recipes: Recipe[]): Promise<void> {
  if (recipes.length === 0) return;
  const recipientIds = [...new Set(recipes.map((r) => r.recipientId))];
  const tokensByRecipient = await loadTokensFor(recipientIds);

  const messages: DeliveryMessage[] = [];
  const tokenIdByIndex: string[] = [];
  for (const recipe of recipes) {
    for (const t of tokensByRecipient.get(recipe.recipientId) ?? []) {
      messages.push({
        to: t.token,
        title: recipe.title,
        body: recipe.body,
        data: recipe.data,
        categoryIdentifier: recipe.category,
      });
      tokenIdByIndex.push(t.id);
    }
  }

  if (messages.length === 0) return;

  try {
    const tickets = await getDelivery().send(messages);
    const staleTokenIds: string[] = [];
    for (let i = 0; i < tickets.length; i++) {
      const ticket = tickets[i];
      if (ticket?.status === "error" && ticket.details?.error === "DeviceNotRegistered") {
        const id = tokenIdByIndex[i];
        if (id) staleTokenIds.push(id);
      }
    }
    if (staleTokenIds.length > 0) {
      await Promise.all(
        staleTokenIds.map((id) =>
          db.delete(userDeviceToken).where(eq(userDeviceToken.id, id)),
        ),
      );
    }
  } catch (err) {
    console.error("[push] delivery failed", err);
  }
}
