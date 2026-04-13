/**
 * Tests for task #151 — Block read access to conversations that are not mutually accepted
 *
 * Covers:
 *   - Non-participant cannot fetch conversation messages
 *   - Participant can read their own conversation
 *   - Suspended conversation returns NOT_A_PARTICIPANT (no info leak)
 *   - Non-existent conversation returns NOT_A_PARTICIPANT (no info leak)
 */
import { describe, it, expect } from "bun:test";

import { checkReadAccess } from "../routers/messaging-utils";

const openConv = { user1Id: "alice", user2Id: "bob", status: "open" as const };
const suspendedConv = { user1Id: "alice", user2Id: "bob", status: "suspended" as const };

describe("#151 — checkReadAccess", () => {
  it("rejects a non-participant with NOT_A_PARTICIPANT", () => {
    const result = checkReadAccess(openConv, "charlie");
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.error).toBe("NOT_A_PARTICIPANT");
  });

  it("rejects access to a suspended conversation with NOT_A_PARTICIPANT", () => {
    const result = checkReadAccess(suspendedConv, "alice");
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.error).toBe("NOT_A_PARTICIPANT");
  });

  it("rejects a non-existent conversation with NOT_A_PARTICIPANT", () => {
    const result = checkReadAccess(undefined, "alice");
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.error).toBe("NOT_A_PARTICIPANT");
  });

  it("allows user1 to read an open conversation", () => {
    const result = checkReadAccess(openConv, "alice");
    expect(result.allowed).toBe(true);
  });

  it("allows user2 to read an open conversation", () => {
    const result = checkReadAccess(openConv, "bob");
    expect(result.allowed).toBe(true);
  });
});
