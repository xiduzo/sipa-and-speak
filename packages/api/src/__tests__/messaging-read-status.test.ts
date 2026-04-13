/**
 * Tests for task #148 — Read/unread status indicators on messages
 *
 * Covers:
 *   - Unread messages (partner, no read record) → isUnread: true
 *   - Read messages (partner, createdAt ≤ lastReadAt) → isUnread: false
 *   - Own messages always read → isUnread: false
 *   - Indicators update after lastReadAt advances
 */
import { describe, it, expect } from "bun:test";

import { computeIsUnread } from "../routers/messaging-utils";

const T0 = new Date("2024-01-01T10:00:00Z");
const T1 = new Date("2024-01-01T10:01:00Z");
const T2 = new Date("2024-01-01T10:02:00Z");

describe("#148 — computeIsUnread", () => {
  it("partner message with no read record is unread", () => {
    expect(computeIsUnread({ senderId: "bob", createdAt: T1 }, "alice", null)).toBe(true);
  });

  it("partner message sent after lastReadAt is unread", () => {
    expect(computeIsUnread({ senderId: "bob", createdAt: T2 }, "alice", T1)).toBe(true);
  });

  it("partner message sent before lastReadAt is read", () => {
    expect(computeIsUnread({ senderId: "bob", createdAt: T0 }, "alice", T1)).toBe(false);
  });

  it("partner message sent exactly at lastReadAt is read", () => {
    expect(computeIsUnread({ senderId: "bob", createdAt: T1 }, "alice", T1)).toBe(false);
  });

  it("own message is always read regardless of lastReadAt", () => {
    expect(computeIsUnread({ senderId: "alice", createdAt: T2 }, "alice", null)).toBe(false);
    expect(computeIsUnread({ senderId: "alice", createdAt: T2 }, "alice", T0)).toBe(false);
  });
});
