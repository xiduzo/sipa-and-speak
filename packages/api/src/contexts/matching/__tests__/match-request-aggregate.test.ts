import { describe, it, expect } from "bun:test";

import {
  MatchRequest,
  MatchRuleError,
  type MatchRequestSnapshot,
} from "../match-request-aggregate";

const NOW = new Date("2030-06-01T10:00:00Z");

function pending(overrides: Partial<MatchRequestSnapshot> = {}): MatchRequestSnapshot {
  return {
    id: "mr-1",
    requesterId: "u-A",
    receiverId: "u-B",
    status: "pending",
    ...overrides,
  };
}

describe("MatchRequest.send", () => {
  const baseArgs = {
    requesterId: "u-A",
    requesterName: "Alice",
    receiverId: "u-B",
    receiverExists: true,
    offeredLanguage: "en" as string | null,
    targetedLanguage: "nl" as string | null,
    hasActiveRequest: false,
    now: NOW,
  };

  it("produces a pending row and a MatchRequestSent event", () => {
    const { row, events } = MatchRequest.send(baseArgs);
    expect(row).toEqual({ requesterId: "u-A", receiverId: "u-B", status: "pending" });
    expect(events).toHaveLength(1);
    expect(events[0]!.name).toBe("MatchRequestSent");
    expect(events[0]!.payload).toMatchObject({
      requesterId: "u-A",
      requesterName: "Alice",
      offeredLanguage: "en",
      targetedLanguage: "nl",
      receiverId: "u-B",
      sentAt: NOW,
    });
  });

  it("omits matchRequestId — the router grafts it on after insert", () => {
    const { events } = MatchRequest.send(baseArgs);
    expect(events[0]!.payload.matchRequestId).toBeUndefined();
  });

  it("rejects self-requests with BAD_REQUEST", () => {
    expect(() => MatchRequest.send({ ...baseArgs, receiverId: "u-A" })).toThrow(MatchRuleError);
    try {
      MatchRequest.send({ ...baseArgs, receiverId: "u-A" });
    } catch (e) {
      expect((e as MatchRuleError).code).toBe("BAD_REQUEST");
    }
  });

  it("rejects a missing receiver with NOT_FOUND", () => {
    try {
      MatchRequest.send({ ...baseArgs, receiverExists: false });
      throw new Error("expected throw");
    } catch (e) {
      expect((e as MatchRuleError).code).toBe("NOT_FOUND");
    }
  });

  it("rejects a duplicate active request with CONFLICT", () => {
    try {
      MatchRequest.send({ ...baseArgs, hasActiveRequest: true });
      throw new Error("expected throw");
    } catch (e) {
      expect((e as MatchRuleError).code).toBe("CONFLICT");
    }
  });
});

describe("MatchRequest.accept", () => {
  it("transitions to accepted and creates a match between requester and receiver", () => {
    const { state, createMatch, events } = MatchRequest.accept(pending(), {
      actorId: "u-B",
      receiverName: "Bob",
      now: NOW,
    });
    expect(state.status).toBe("accepted");
    expect(createMatch).toEqual({ studentAId: "u-A", studentBId: "u-B" });
    expect(events[0]!.name).toBe("MatchRequestAccepted");
    expect(events[0]!.payload).toMatchObject({
      matchRequestId: "mr-1",
      requesterId: "u-A",
      receiverId: "u-B",
      receiverName: "Bob",
      acceptedAt: NOW,
    });
  });

  it("only the designated receiver may accept (FORBIDDEN)", () => {
    try {
      MatchRequest.accept(pending(), { actorId: "u-A", receiverName: "x", now: NOW });
      throw new Error("expected throw");
    } catch (e) {
      expect((e as MatchRuleError).code).toBe("FORBIDDEN");
    }
  });

  it("only pending requests can be accepted (BAD_REQUEST)", () => {
    try {
      MatchRequest.accept(pending({ status: "declined" }), {
        actorId: "u-B",
        receiverName: "x",
        now: NOW,
      });
      throw new Error("expected throw");
    } catch (e) {
      expect((e as MatchRuleError).code).toBe("BAD_REQUEST");
    }
  });
});

describe("MatchRequest.decline", () => {
  it("transitions to declined and emits MatchRequestDeclined", () => {
    const { state, events } = MatchRequest.decline(pending(), { actorId: "u-B", now: NOW });
    expect(state.status).toBe("declined");
    expect(events[0]!.name).toBe("MatchRequestDeclined");
    expect(events[0]!.payload).toMatchObject({
      matchRequestId: "mr-1",
      requesterId: "u-A",
      receiverId: "u-B",
      declinedAt: NOW,
    });
  });

  it("only the receiver may decline (FORBIDDEN)", () => {
    try {
      MatchRequest.decline(pending(), { actorId: "u-A", now: NOW });
      throw new Error("expected throw");
    } catch (e) {
      expect((e as MatchRuleError).code).toBe("FORBIDDEN");
    }
  });
});

describe("MatchRequest.withdraw", () => {
  it("allows the sender to withdraw a pending request, with no events", () => {
    const { delete: del, events } = MatchRequest.withdraw(pending(), { actorId: "u-A" });
    expect(del).toBe(true);
    expect(events).toEqual([]);
  });

  it("only the sender may withdraw (FORBIDDEN)", () => {
    try {
      MatchRequest.withdraw(pending(), { actorId: "u-B" });
      throw new Error("expected throw");
    } catch (e) {
      expect((e as MatchRuleError).code).toBe("FORBIDDEN");
    }
  });

  it("only pending invitations can be withdrawn (BAD_REQUEST)", () => {
    try {
      MatchRequest.withdraw(pending({ status: "accepted" }), { actorId: "u-A" });
      throw new Error("expected throw");
    } catch (e) {
      expect((e as MatchRuleError).code).toBe("BAD_REQUEST");
    }
  });
});

describe("MatchRequest.unmatch", () => {
  it("permits unmatching when a match exists", () => {
    const { voidRequest, events } = MatchRequest.unmatch({
      actorId: "u-A",
      partnerId: "u-B",
      matchExists: true,
    });
    expect(voidRequest).toBe(true);
    expect(events).toEqual([]);
  });

  it("rejects unmatching yourself (BAD_REQUEST)", () => {
    try {
      MatchRequest.unmatch({ actorId: "u-A", partnerId: "u-A", matchExists: false });
      throw new Error("expected throw");
    } catch (e) {
      expect((e as MatchRuleError).code).toBe("BAD_REQUEST");
    }
  });

  it("rejects unmatching a non-partner (NOT_FOUND)", () => {
    try {
      MatchRequest.unmatch({ actorId: "u-A", partnerId: "u-B", matchExists: false });
      throw new Error("expected throw");
    } catch (e) {
      expect((e as MatchRuleError).code).toBe("NOT_FOUND");
    }
  });
});
