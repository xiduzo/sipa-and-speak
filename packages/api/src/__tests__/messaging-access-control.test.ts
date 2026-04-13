/**
 * Tests for task #146 — Block message sending in non-open conversations
 *
 * Covers:
 *   - Non-participant is rejected with NOT_A_PARTICIPANT
 *   - Participant in a suspended conversation is rejected with CONVERSATION_NOT_OPEN
 *   - Participant in an open conversation is allowed
 *   - Non-existent conversation returns CONVERSATION_NOT_FOUND
 */
import { describe, it, expect } from "bun:test";

import { checkConversationAccess } from "../routers/messaging-utils";

const openConv = { user1Id: "alice", user2Id: "bob", status: "open" as const };
const suspendedConv = { user1Id: "alice", user2Id: "bob", status: "suspended" as const };

describe("#146 — checkConversationAccess", () => {
  it("rejects a non-participant with NOT_A_PARTICIPANT", () => {
    const result = checkConversationAccess(openConv, "charlie");
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.error).toBe("NOT_A_PARTICIPANT");
  });

  it("rejects a participant in a suspended conversation with CONVERSATION_NOT_OPEN", () => {
    const result = checkConversationAccess(suspendedConv, "alice");
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.error).toBe("CONVERSATION_NOT_OPEN");
  });

  it("allows user1 to send in an open conversation", () => {
    const result = checkConversationAccess(openConv, "alice");
    expect(result.allowed).toBe(true);
  });

  it("allows user2 to send in an open conversation", () => {
    const result = checkConversationAccess(openConv, "bob");
    expect(result.allowed).toBe(true);
  });

  it("returns CONVERSATION_NOT_FOUND when conversation does not exist", () => {
    const result = checkConversationAccess(undefined, "alice");
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.error).toBe("CONVERSATION_NOT_FOUND");
  });
});
