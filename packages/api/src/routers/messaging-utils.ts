/**
 * Pure helpers for the messaging opt-in router.
 * Extracted for unit testing without a DB connection.
 */

/**
 * Returns true if the student has already responded to the opt-in for this meetup.
 * Used to enforce the "one response per (meetupId, studentId)" invariant.
 */
export function hasAlreadyResponded(
  existingResponse: { response: "accept" | "decline" } | undefined,
): boolean {
  return existingResponse !== undefined;
}

/**
 * Returns true if a nudge push should be sent to the pending partner.
 * Conditions: the current student just accepted, AND the partner has not yet responded.
 */
export function shouldSendNudge(
  myResponse: "accept" | "decline",
  partnerResponse: { response: "accept" | "decline" } | undefined,
): boolean {
  return myResponse === "accept" && partnerResponse === undefined;
}

/**
 * Returns true when both Students have responded with "accept".
 * Used to determine whether a conversation channel should be opened.
 */
export function bothAccepted(
  responses: Array<{ response: "accept" | "decline" }>,
): boolean {
  return responses.length === 2 && responses.every((r) => r.response === "accept");
}

/**
 * Returns true when both Students have responded and at least one declined.
 * Used to determine whether to send the decline-outcome notifications.
 * Note: does NOT reveal which Student declined — callers must not expose that.
 */
export function isDeclineOutcome(
  responses: Array<{ response: "accept" | "decline" }>,
): boolean {
  return responses.length === 2 && !responses.every((r) => r.response === "accept");
}

/**
 * #146 — Checks whether a sender is allowed to post in a conversation.
 * Returns `{ allowed: true }` or `{ allowed: false, error }`.
 */
export function checkConversationAccess(
  conv: { user1Id: string; user2Id: string; status: "open" | "suspended" } | undefined,
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
  conv: { user1Id: string; user2Id: string; status: "open" | "suspended" } | undefined,
  readerId: string,
): { allowed: true } | { allowed: false; error: "NOT_A_PARTICIPANT" } {
  if (!conv) return { allowed: false, error: "NOT_A_PARTICIPANT" };
  const isParticipant = conv.user1Id === readerId || conv.user2Id === readerId;
  if (!isParticipant) return { allowed: false, error: "NOT_A_PARTICIPANT" };
  if (conv.status !== "open") return { allowed: false, error: "NOT_A_PARTICIPANT" };
  return { allowed: true };
}

/**
 * Derives the partner's ID from a meetup's proposer/receiver pair.
 */
export function getPartnerId(
  proposerId: string,
  receiverId: string,
  studentId: string,
): string {
  return proposerId === studentId ? receiverId : proposerId;
}
