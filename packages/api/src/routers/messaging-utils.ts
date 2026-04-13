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
 * Derives the partner's ID from a meetup's proposer/receiver pair.
 */
export function getPartnerId(
  proposerId: string,
  receiverId: string,
  studentId: string,
): string {
  return proposerId === studentId ? receiverId : proposerId;
}
