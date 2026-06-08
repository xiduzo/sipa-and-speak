/**
 * Pure helpers for the messaging routers — only deep helpers worth extracting live here.
 * Shallow predicates have been inlined at their callsites.
 */

/**
 * #149 — Computes the new lastReadAt timestamp for a mark-as-read operation.
 * lastReadAt can only move forward — returns the later of existing and now.
 */
export function computeMarkReadAt(existingLastReadAt: Date | null, now: Date): Date {
  if (existingLastReadAt === null) return now;
  return now > existingLastReadAt ? now : existingLastReadAt;
}

/**
 * #146 — Checks whether a sender is allowed to post in a conversation.
 * Returns `{ allowed: true }` or `{ allowed: false, error }`.
 */
export function checkConversationAccess(
  conv: { user1Id: string; user2Id: string; status: "open" | "suspended" | "closed" } | undefined,
  senderId: string,
): { allowed: true } | { allowed: false; error: "CONVERSATION_NOT_FOUND" | "NOT_A_PARTICIPANT" | "CONVERSATION_NOT_OPEN" } {
  if (!conv) return { allowed: false, error: "CONVERSATION_NOT_FOUND" };
  const isParticipant = conv.user1Id === senderId || conv.user2Id === senderId;
  if (!isParticipant) return { allowed: false, error: "NOT_A_PARTICIPANT" };
  if (conv.status !== "open") return { allowed: false, error: "CONVERSATION_NOT_OPEN" };
  return { allowed: true };
}

/**
 * #144 — Validates message content before persistence.
 * Returns `{ valid: true, trimmed }` on success or `{ valid: false, error }` on failure.
 */
export function validateMessageContent(
  content: string,
): { valid: true; trimmed: string } | { valid: false; error: "EMPTY_CONTENT" | "TOO_LONG" } {
  const trimmed = content.trim();
  if (!trimmed) return { valid: false, error: "EMPTY_CONTENT" };
  if (trimmed.length > 2000) return { valid: false, error: "TOO_LONG" };
  return { valid: true, trimmed };
}

/**
 * #148 — Determines whether a message is unread by the viewing student.
 * Own messages are always treated as read.
 * Partner messages are unread if their createdAt is after the viewer's lastReadAt.
 */
export function computeIsUnread(
  message: { senderId: string; createdAt: Date },
  viewerId: string,
  lastReadAt: Date | null,
): boolean {
  if (message.senderId === viewerId) return false; // own messages always read
  if (lastReadAt === null) return true; // no read record → all partner messages unread
  return message.createdAt > lastReadAt;
}

/**
 * #151 — Checks whether a reader is allowed to fetch messages from a conversation.
 * Non-participants and suspended conversations both return NOT_A_PARTICIPANT to
 * avoid leaking whether the conversation exists.
 */
export function checkReadAccess(
  conv: { user1Id: string; user2Id: string; status: "open" | "suspended" | "closed" } | undefined,
  readerId: string,
): { allowed: true } | { allowed: false; error: "NOT_A_PARTICIPANT" } {
  if (!conv) return { allowed: false, error: "NOT_A_PARTICIPANT" };
  const isParticipant = conv.user1Id === readerId || conv.user2Id === readerId;
  if (!isParticipant) return { allowed: false, error: "NOT_A_PARTICIPANT" };
  if (conv.status !== "open") return { allowed: false, error: "NOT_A_PARTICIPANT" };
  return { allowed: true };
}

/**
 * Collapses chat-list entries to one row per partner. A user met more than once would otherwise
 * surface once per meetup/conversation; the most recently active entry (highest `sortAt`) wins,
 * comparing open chats and locked meetup cards together. Entries with an unknown partner
 * (`partner === null`) are always kept — there is nothing to dedupe them against.
 *
 * Returns the set of kept entry keys, where a key is `${kind}-${id}` (matching the frontend's
 * list key). Callers filter their entries with `keptKeys.has(`${kind}-${id}`)`.
 */
export function keptEntryKeysByPartner(
  entries: Array<{
    kind: "open" | "locked";
    id: string;
    partner: { id: string } | null;
    sortAt: Date;
  }>,
): Set<string> {
  const bestByPartner = new Map<string, { key: string; sortAt: Date }>();
  const keptKeys = new Set<string>();
  for (const entry of entries) {
    const key = `${entry.kind}-${entry.id}`;
    const partnerId = entry.partner?.id;
    if (!partnerId) {
      keptKeys.add(key); // unknown partner — nothing to dedupe against, always kept
      continue;
    }
    const current = bestByPartner.get(partnerId);
    if (!current || entry.sortAt.getTime() > current.sortAt.getTime()) {
      bestByPartner.set(partnerId, { key, sortAt: entry.sortAt });
    }
  }
  for (const { key } of bestByPartner.values()) keptKeys.add(key);
  return keptKeys;
}

/**
 * Phase a locked chat teaser is in. Drives copy + CTA on the chat list and locked detail screen.
 * - `scheduled`            — meetup confirmed, datetime in the future ("unlocks Friday at 10:30")
 * - `awaiting_attendance`  — meetup datetime passed, current student hasn't filed an attendance report
 * - `awaiting_my_optin`    — meetup completed, current student hasn't responded to messaging opt-in
 * - `awaiting_partner_optin` — current student opted in, partner hasn't responded yet
 * - `declined`             — outcome already decided against opening (one declined, or `not_attended`)
 */
export type LockedPhase =
  | "scheduled"
  | "awaiting_attendance"
  | "awaiting_my_optin"
  | "awaiting_partner_optin"
  | "declined";

export function deriveLockedPhase(args: {
  meetupStatus: "confirmed" | "completed" | "not_attended";
  meetupAt: Date;
  now: Date;
  hasMyAttendanceReport: boolean;
  myOptIn: "accept" | "decline" | null;
  partnerOptIn: "accept" | "decline" | null;
}): LockedPhase {
  if (args.meetupStatus === "not_attended") return "declined";
  if (args.meetupStatus === "confirmed") {
    if (args.meetupAt > args.now) return "scheduled";
    if (!args.hasMyAttendanceReport) return "awaiting_attendance";
    return "awaiting_attendance";
  }
  // completed
  if (args.myOptIn === "decline" || args.partnerOptIn === "decline") return "declined";
  if (args.myOptIn !== "accept") return "awaiting_my_optin";
  if (args.partnerOptIn !== "accept") return "awaiting_partner_optin";
  // edge: both accepted but conversation row not yet visible — surface as awaiting_partner so UI doesn't dead-end
  return "awaiting_partner_optin";
}
