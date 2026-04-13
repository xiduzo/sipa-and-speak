/**
 * Tests for task #125 — Exclude requested candidates from future suggestion lists
 *
 * Tests cover the pure buildExcludedUserIds helper used by the discover procedure.
 */
import { describe, expect, it } from "bun:test";

import { buildExcludedUserIds } from "../routers/matching-utils";

const ME = "user-me";

describe("#125 — buildExcludedUserIds", () => {
  it("excludes receiver when student has sent a pending request", () => {
    const requests = [{ requesterId: ME, receiverId: "candidate-a" }];
    expect(buildExcludedUserIds(ME, requests)).toEqual(["candidate-a"]);
  });

  it("excludes requester when a candidate has sent a request to the student", () => {
    const requests = [{ requesterId: "candidate-b", receiverId: ME }];
    expect(buildExcludedUserIds(ME, requests)).toEqual(["candidate-b"]);
  });

  it("handles bidirectional exclusion (both directions in the same list)", () => {
    const requests = [
      { requesterId: ME, receiverId: "candidate-c" },
      { requesterId: "candidate-d", receiverId: ME },
    ];
    expect(buildExcludedUserIds(ME, requests)).toEqual(["candidate-c", "candidate-d"]);
  });

  it("returns empty array when there are no active requests", () => {
    expect(buildExcludedUserIds(ME, [])).toEqual([]);
  });

  it("declined request records are not passed in (caller filters by status)", () => {
    // Declined requests are excluded from activeRequests by the SQL filter —
    // this test confirms that if no requests are passed, no one is excluded.
    expect(buildExcludedUserIds(ME, [])).toEqual([]);
  });
});
