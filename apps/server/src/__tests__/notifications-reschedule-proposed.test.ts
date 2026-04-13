/**
 * Tests for task #89 — Push notification on MeetupRescheduleProposed
 */
import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";

const mockFetch = mock(async () =>
  Response.json({ data: [{ status: "ok", id: "ticket-1" }] }),
);
global.fetch = mockFetch as unknown as typeof fetch;

const mockDb = {
  select: mock(() => mockDb),
  from: mock(() => mockDb),
  where: mock(() => Promise.resolve([])),
};

mock.module("@sip-and-speak/db", () => ({ db: mockDb }));
mock.module("@sip-and-speak/db/schema/sip-and-speak", () => ({
  userDeviceToken: { id: "id", token: "token", userId: "user_id" },
  userLanguage: {},
}));
mock.module("@sip-and-speak/db/schema/auth", () => ({ user: { id: "id", name: "name" } }));
mock.module("@sip-and-speak/api/routers/matching-utils", () => ({
  buildMatchRequestNotificationBody: () => "body",
}));

import { domainEvents } from "@sip-and-speak/api/domain-events";
import { registerNotificationHandlers } from "../notifications";

describe("#89 — MeetupRescheduleProposed push notification", () => {
  beforeEach(() => {
    registerNotificationHandlers();
    mockFetch.mockClear();
  });

  afterEach(() => {
    domainEvents.removeAllListeners("MeetupRescheduleProposed");
  });

  it("sends a push notification to the receiver when a reschedule is proposed", async () => {
    mockDb.where.mockResolvedValueOnce([{ id: "dt-1", token: "ExponentPushToken[abc]" }]);

    domainEvents.emit("MeetupRescheduleProposed", {
      meetupId: "m-1",
      proposerId: "proposer-1",
      receiverId: "receiver-1",
      venueId: "v-1",
      venueName: "Atlas Building",
      date: "2026-06-01",
      time: "14:00",
      proposedAt: new Date(),
    });

    await new Promise((r) => setTimeout(r, 10));

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse((mockFetch.mock.calls[0] as [string, RequestInit])[1].body as string) as unknown[];
    const msg = (body as Array<{ title: string; body: string; data: Record<string, unknown> }>)[0];
    expect(msg?.title).toBe("Reschedule request");
    expect(msg?.body).toContain("Atlas Building");
    expect(msg?.data?.type).toBe("meetup_reschedule_proposed");
  });

  it("skips notification when receiver has no device token", async () => {
    mockDb.where.mockResolvedValueOnce([]);

    domainEvents.emit("MeetupRescheduleProposed", {
      meetupId: "m-2",
      proposerId: "proposer-1",
      receiverId: "receiver-no-token",
      venueId: "v-1",
      venueName: "Atlas Building",
      date: "2026-06-01",
      time: "14:00",
      proposedAt: new Date(),
    });

    await new Promise((r) => setTimeout(r, 10));
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
