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
 * Derives the partner's ID from a meetup's proposer/receiver pair.
 */
export function getPartnerId(
  proposerId: string,
  receiverId: string,
  studentId: string,
): string {
  return proposerId === studentId ? receiverId : proposerId;
}
