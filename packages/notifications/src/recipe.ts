import { getDelivery, type DeliveryMessage, type DeliveryTicket } from "./delivery";

export interface Recipe {
  recipientId: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  category?: string;
}

export interface TokenRow {
  id: string;
  token: string;
}

// ── Pure transforms ────────────────────────────────────────────────────────────

/**
 * Flattens recipes against their recipients' device tokens into the list of
 * delivery messages to send, alongside the token id backing each message
 * (positionally aligned with the returned messages, so delivery tickets can be
 * mapped back to the token that produced them).
 */
export function toDeliveryMessages(
  recipes: Recipe[],
  tokensByRecipient: Map<string, TokenRow[]>,
): { messages: DeliveryMessage[]; tokenIds: string[] } {
  const messages: DeliveryMessage[] = [];
  const tokenIds: string[] = [];
  for (const recipe of recipes) {
    for (const t of tokensByRecipient.get(recipe.recipientId) ?? []) {
      messages.push({
        to: t.token,
        title: recipe.title,
        body: recipe.body,
        data: recipe.data,
        categoryIdentifier: recipe.category,
      });
      tokenIds.push(t.id);
    }
  }
  return { messages, tokenIds };
}

/**
 * Given delivery tickets (positionally aligned with `tokenIds`), returns the ids
 * of tokens Expo reported as `DeviceNotRegistered` so they can be pruned.
 */
export function staleTokenIds(tickets: DeliveryTicket[], tokenIds: string[]): string[] {
  const stale: string[] = [];
  for (let i = 0; i < tickets.length; i++) {
    const ticket = tickets[i];
    if (ticket?.status === "error" && ticket.details?.error === "DeviceNotRegistered") {
      const id = tokenIds[i];
      if (id) stale.push(id);
    }
  }
  return stale;
}

// ── TokenStore seam ─────────────────────────────────────────────────────────────

export interface TokenStore {
  load(recipientIds: string[]): Promise<Map<string, TokenRow[]>>;
  removeStale(tokenIds: string[]): Promise<void>;
}

/**
 * Default DB-backed token store. The `@sip-and-speak/db` (and drizzle) imports
 * are deferred to call time so that merely importing this module does not pull
 * in the env-validated DB client — letting tests inject a fake store without
 * mocking `@sip-and-speak/db`.
 */
export class DbTokenStore implements TokenStore {
  async load(recipientIds: string[]): Promise<Map<string, TokenRow[]>> {
    const map = new Map<string, TokenRow[]>();
    if (recipientIds.length === 0) return map;
    const { eq } = await import("drizzle-orm");
    const { db } = await import("@sip-and-speak/db");
    const { userDeviceToken } = await import("@sip-and-speak/db/schema/identity");
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

  async removeStale(tokenIds: string[]): Promise<void> {
    if (tokenIds.length === 0) return;
    const { eq } = await import("drizzle-orm");
    const { db } = await import("@sip-and-speak/db");
    const { userDeviceToken } = await import("@sip-and-speak/db/schema/identity");
    await Promise.all(
      tokenIds.map((id) => db.delete(userDeviceToken).where(eq(userDeviceToken.id, id))),
    );
  }
}

/**
 * In-memory token store for tests. Mirrors `InMemoryDelivery`: seed tokens with
 * `set()`, inspect pruned ids via `removed`, and `reset()` between tests.
 */
export class InMemoryTokenStore implements TokenStore {
  private readonly tokens = new Map<string, TokenRow[]>();
  readonly removed: string[] = [];

  set(recipientId: string, tokens: TokenRow[]): void {
    this.tokens.set(recipientId, tokens);
  }

  async load(recipientIds: string[]): Promise<Map<string, TokenRow[]>> {
    const map = new Map<string, TokenRow[]>();
    for (const id of recipientIds) {
      map.set(id, this.tokens.get(id) ?? []);
    }
    return map;
  }

  async removeStale(tokenIds: string[]): Promise<void> {
    this.removed.push(...tokenIds);
  }

  reset(): void {
    this.tokens.clear();
    this.removed.length = 0;
  }
}

let currentTokenStore: TokenStore | undefined;

export function getTokenStore(): TokenStore {
  if (!currentTokenStore) currentTokenStore = new DbTokenStore();
  return currentTokenStore;
}

export function setTokenStore(store: TokenStore): void {
  currentTokenStore = store;
}

// ── Orchestrator ────────────────────────────────────────────────────────────────

export async function dispatch(recipes: Recipe[]): Promise<void> {
  if (recipes.length === 0) return;
  const recipientIds = [...new Set(recipes.map((r) => r.recipientId))];
  const tokensByRecipient = await getTokenStore().load(recipientIds);

  const { messages, tokenIds } = toDeliveryMessages(recipes, tokensByRecipient);
  if (messages.length === 0) return;

  try {
    const tickets = await getDelivery().send(messages);
    const stale = staleTokenIds(tickets, tokenIds);
    if (stale.length > 0) await getTokenStore().removeStale(stale);
  } catch (err) {
    console.error("[push] delivery failed", err);
  }
}
