/**
 * Tests for:
 *   #125 — Exclude requested candidates from future suggestion lists
 *   #131 — Include requester name and language summary in notification payload
 */
import { describe, expect, it } from "bun:test";

import { buildExcludedUserIds, buildMatchRequestNotificationBody } from "../routers/matching-utils";

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

// ─── #131: Notification payload composition ─────────────────────────────────

describe("#131 — buildMatchRequestNotificationBody", () => {
  it("includes requester name and language summary when profile is complete", () => {
    const body = buildMatchRequestNotificationBody("Ana", "Portuguese", "Dutch");
    expect(body).toBe("Ana wants to meet you — speaks Portuguese, learning Dutch");
  });

  it("omits language summary when requester profile is incomplete (no languages)", () => {
    const body = buildMatchRequestNotificationBody("Ana", null, null);
    expect(body).toBe("Ana wants to meet you");
  });

  it("omits language summary when only offered language is present", () => {
    const body = buildMatchRequestNotificationBody("Ana", "Portuguese", null);
    expect(body).toBe("Ana wants to meet you");
  });

  it("omits language summary when only targeted language is present", () => {
    const body = buildMatchRequestNotificationBody("Ana", null, "Dutch");
    expect(body).toBe("Ana wants to meet you");
  });
});
