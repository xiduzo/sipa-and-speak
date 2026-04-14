// #67 — Pure validation functions for flag submission

export type FlagValidationError =
  | { valid: false; error: "SELF_FLAG" }
  | { valid: false; error: "DUPLICATE_OPEN_FLAG" }
  | { valid: true };

/**
 * Rejects a flag where the reporter and target are the same user.
 */
export function checkSelfFlag(
  reporterId: string,
  targetId: string,
): FlagValidationError {
  if (reporterId === targetId) {
    return { valid: false, error: "SELF_FLAG" };
  }
  return { valid: true };
}

/**
 * Rejects a flag when an open flag already exists for the same
 * reporter–target pair. The caller supplies the open-flag count from the DB.
 */
export function checkDuplicateOpenFlag(
  openFlagCount: number,
): FlagValidationError {
  if (openFlagCount > 0) {
    return { valid: false, error: "DUPLICATE_OPEN_FLAG" };
  }
  return { valid: true };
}

export const FLAG_VALIDATION_MESSAGES: Record<"SELF_FLAG" | "DUPLICATE_OPEN_FLAG", string> = {
  SELF_FLAG: "You cannot flag yourself.",
  DUPLICATE_OPEN_FLAG: "A report against this Student is already under review.",
};
