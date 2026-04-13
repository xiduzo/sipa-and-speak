/**
 * Tests for task #149 — Mark messages as read when Student views the conversation
 *
 * Covers:
 *   - lastReadAt advances when now > existing
 *   - lastReadAt never moves backwards (monotone invariant)
 *   - First read (no existing record) uses now
 */
import { describe, it, expect } from "bun:test";

import { computeMarkReadAt } from "../routers/messaging-utils";

const T0 = new Date("2024-01-01T10:00:00Z");
const T1 = new Date("2024-01-01T10:01:00Z");
const T2 = new Date("2024-01-01T10:02:00Z");

describe("#149 — computeMarkReadAt", () => {
  it("advances lastReadAt when now is later", () => {
    const result = computeMarkReadAt(T0, T1);
    expect(result).toEqual(T1);
  });

  it("keeps existing lastReadAt when now is earlier (monotone invariant)", () => {
    const result = computeMarkReadAt(T2, T0);
    expect(result).toEqual(T2);
  });

  it("keeps existing lastReadAt when now equals existing", () => {
    const result = computeMarkReadAt(T1, T1);
    expect(result).toEqual(T1);
  });

  it("uses now when there is no existing lastReadAt", () => {
    const result = computeMarkReadAt(null, T1);
    expect(result).toEqual(T1);
  });
});
