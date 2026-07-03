import { describe, it, expect } from "bun:test";

import {
  StudentAccount,
  ModerationRuleError,
  type FlagSnapshot,
  type StudentAccountSnapshot,
} from "../student-account-aggregate";

const NOW = new Date("2030-06-01T10:00:00Z");
const MOD = "mod-1";

function student(
  overrides: Partial<StudentAccountSnapshot> = {},
): StudentAccountSnapshot {
  return { id: "u-1", studentStatus: "active", ...overrides };
}

function openFlag(overrides: Partial<FlagSnapshot> = {}): FlagSnapshot {
  return { id: "f-1", status: "open", targetId: "u-1", ...overrides };
}

function codeOf(fn: () => unknown): string {
  try {
    fn();
  } catch (err) {
    if (err instanceof ModerationRuleError) return err.code;
    throw err;
  }
  throw new Error("expected ModerationRuleError");
}

describe("StudentAccount.suspend", () => {
  it("transitions active → suspended and emits StudentSuspended (flag path)", () => {
    const { status, resolveFlag, events } = StudentAccount.suspend({
      student: student(),
      flag: openFlag(),
      moderatorId: MOD,
      now: NOW,
    });
    expect(status).toBe("suspended");
    expect(resolveFlag).toEqual({ flagId: "f-1", outcome: "suspended" });
    expect(events).toHaveLength(1);
    expect(events[0]!.name).toBe("StudentSuspended");
    expect(events[0]!.payload).toEqual({
      flagId: "f-1",
      targetId: "u-1",
      moderatorId: MOD,
      suspendedAt: NOW,
    });
  });

  it("direct admin path: no flag resolution, StudentSuspended has flagId null", () => {
    const { resolveFlag, events } = StudentAccount.suspend({
      student: student(),
      moderatorId: MOD,
      now: NOW,
    });
    expect(resolveFlag).toBeNull();
    expect(events[0]!.payload.flagId).toBeNull();
  });

  it("rejects a missing flag with NOT_FOUND", () => {
    expect(
      codeOf(() =>
        StudentAccount.suspend({ student: student(), flag: null, moderatorId: MOD, now: NOW }),
      ),
    ).toBe("NOT_FOUND");
  });

  it("rejects an already-resolved flag with CONFLICT", () => {
    expect(
      codeOf(() =>
        StudentAccount.suspend({
          student: student(),
          flag: openFlag({ status: "resolved" }),
          moderatorId: MOD,
          now: NOW,
        }),
      ),
    ).toBe("CONFLICT");
  });

  it("rejects a missing student with NOT_FOUND", () => {
    expect(
      codeOf(() =>
        StudentAccount.suspend({ student: null, flag: openFlag(), moderatorId: MOD, now: NOW }),
      ),
    ).toBe("NOT_FOUND");
  });

  // Drifted-guard cases — unified to the precise suspendUser semantics:
  // removed and already-suspended are distinct codes, on BOTH paths.
  it("rejects a removed student with BAD_REQUEST (flag path and direct path)", () => {
    const removed = student({ studentStatus: "removed" });
    expect(
      codeOf(() =>
        StudentAccount.suspend({ student: removed, flag: openFlag(), moderatorId: MOD, now: NOW }),
      ),
    ).toBe("BAD_REQUEST");
    expect(
      codeOf(() => StudentAccount.suspend({ student: removed, moderatorId: MOD, now: NOW })),
    ).toBe("BAD_REQUEST");
  });

  it("rejects an already-suspended student with CONFLICT (flag path and direct path)", () => {
    const suspended = student({ studentStatus: "suspended" });
    expect(
      codeOf(() =>
        StudentAccount.suspend({
          student: suspended,
          flag: openFlag(),
          moderatorId: MOD,
          now: NOW,
        }),
      ),
    ).toBe("CONFLICT");
    expect(
      codeOf(() => StudentAccount.suspend({ student: suspended, moderatorId: MOD, now: NOW })),
    ).toBe("CONFLICT");
  });

  it("checks the flag before the student (resolved flag wins over suspended student)", () => {
    expect(() =>
      StudentAccount.suspend({
        student: student({ studentStatus: "suspended" }),
        flag: openFlag({ status: "resolved" }),
        moderatorId: MOD,
        now: NOW,
      }),
    ).toThrow(/Flag already resolved/);
  });
});

describe("StudentAccount.liftSuspension", () => {
  it("transitions suspended → active and emits SuspensionLifted", () => {
    const { status, events } = StudentAccount.liftSuspension({
      student: student({ studentStatus: "suspended" }),
      moderatorId: MOD,
      now: NOW,
    });
    expect(status).toBe("active");
    expect(events).toHaveLength(1);
    expect(events[0]!.name).toBe("SuspensionLifted");
    expect(events[0]!.payload).toEqual({ targetId: "u-1", moderatorId: MOD, liftedAt: NOW });
  });

  it("rejects a missing student with NOT_FOUND", () => {
    expect(
      codeOf(() => StudentAccount.liftSuspension({ student: null, moderatorId: MOD, now: NOW })),
    ).toBe("NOT_FOUND");
  });

  it("rejects an active student with BAD_REQUEST", () => {
    expect(
      codeOf(() =>
        StudentAccount.liftSuspension({ student: student(), moderatorId: MOD, now: NOW }),
      ),
    ).toBe("BAD_REQUEST");
  });

  it("rejects a removed student with BAD_REQUEST (removal is terminal)", () => {
    expect(
      codeOf(() =>
        StudentAccount.liftSuspension({
          student: student({ studentStatus: "removed" }),
          moderatorId: MOD,
          now: NOW,
        }),
      ),
    ).toBe("BAD_REQUEST");
  });
});

describe("StudentAccount.remove", () => {
  it("transitions active → removed and emits StudentRemoved (flag path)", () => {
    const transition = StudentAccount.remove({
      student: student(),
      flag: openFlag(),
      moderatorId: MOD,
      now: NOW,
    });
    expect(transition.noop).toBe(false);
    expect(transition.status).toBe("removed");
    expect(transition.resolveFlag).toEqual({ flagId: "f-1", outcome: "removed" });
    expect(transition.events).toHaveLength(1);
    expect(transition.events[0]!.name).toBe("StudentRemoved");
    expect(transition.events[0]!.payload).toEqual({
      flagId: "f-1",
      targetId: "u-1",
      moderatorId: MOD,
      removedAt: NOW,
    });
  });

  it("removes a suspended student too (suspended → removed)", () => {
    const transition = StudentAccount.remove({
      student: student({ studentStatus: "suspended" }),
      moderatorId: MOD,
      now: NOW,
    });
    expect(transition.noop).toBe(false);
    expect(transition.status).toBe("removed");
  });

  it("direct admin path: no flag resolution, StudentRemoved has flagId null", () => {
    const transition = StudentAccount.remove({
      student: student(),
      moderatorId: MOD,
      now: NOW,
    });
    expect(transition.noop).toBe(false);
    if (!transition.noop) {
      expect(transition.resolveFlag).toBeNull();
      expect(transition.events[0]!.payload.flagId).toBeNull();
    }
  });

  // Drifted-guard case — canonical idempotency for both remove paths:
  // re-removing is a no-op success with no writes and no events.
  it("is idempotent: removed student → noop with no events and no flag resolution", () => {
    const transition = StudentAccount.remove({
      student: student({ studentStatus: "removed" }),
      flag: openFlag(),
      moderatorId: MOD,
      now: NOW,
    });
    expect(transition.noop).toBe(true);
    expect(transition.resolveFlag).toBeNull();
    expect(transition.events).toHaveLength(0);
  });

  it("rejects a missing flag with NOT_FOUND", () => {
    expect(
      codeOf(() =>
        StudentAccount.remove({ student: student(), flag: null, moderatorId: MOD, now: NOW }),
      ),
    ).toBe("NOT_FOUND");
  });

  it("rejects an already-resolved flag with CONFLICT even for a removed student", () => {
    expect(
      codeOf(() =>
        StudentAccount.remove({
          student: student({ studentStatus: "removed" }),
          flag: openFlag({ status: "resolved" }),
          moderatorId: MOD,
          now: NOW,
        }),
      ),
    ).toBe("CONFLICT");
  });

  it("rejects a missing student with NOT_FOUND", () => {
    expect(
      codeOf(() =>
        StudentAccount.remove({ student: null, flag: openFlag(), moderatorId: MOD, now: NOW }),
      ),
    ).toBe("NOT_FOUND");
  });
});
