/**
 * Tests for deriveLockedPhase — drives copy + CTA on the locked chat teaser.
 * Inputs are denormalised (status + datetime + opt-in state) so callers can build it
 * from any data source without re-deriving.
 */
import { describe, it, expect } from "bun:test";

import { deriveLockedPhase } from "../routers/messaging-utils";

const now = new Date("2026-04-28T12:00:00.000Z");
const future = new Date("2026-05-02T10:30:00.000Z");
const past = new Date("2026-04-26T10:30:00.000Z");

describe("deriveLockedPhase", () => {
  it("returns 'scheduled' for confirmed meetups in the future", () => {
    expect(
      deriveLockedPhase({
        meetupStatus: "confirmed",
        meetupAt: future,
        now,
        hasMyAttendanceReport: false,
        myOptIn: null,
        partnerOptIn: null,
      }),
    ).toBe("scheduled");
  });

  it("returns 'awaiting_attendance' for confirmed meetups whose datetime has passed", () => {
    expect(
      deriveLockedPhase({
        meetupStatus: "confirmed",
        meetupAt: past,
        now,
        hasMyAttendanceReport: false,
        myOptIn: null,
        partnerOptIn: null,
      }),
    ).toBe("awaiting_attendance");
  });

  it("returns 'awaiting_my_optin' for completed meetups when current student has not responded", () => {
    expect(
      deriveLockedPhase({
        meetupStatus: "completed",
        meetupAt: past,
        now,
        hasMyAttendanceReport: true,
        myOptIn: null,
        partnerOptIn: null,
      }),
    ).toBe("awaiting_my_optin");
  });

  it("returns 'awaiting_my_optin' even if partner already accepted", () => {
    expect(
      deriveLockedPhase({
        meetupStatus: "completed",
        meetupAt: past,
        now,
        hasMyAttendanceReport: true,
        myOptIn: null,
        partnerOptIn: "accept",
      }),
    ).toBe("awaiting_my_optin");
  });

  it("returns 'awaiting_partner_optin' when current student accepted and partner is pending", () => {
    expect(
      deriveLockedPhase({
        meetupStatus: "completed",
        meetupAt: past,
        now,
        hasMyAttendanceReport: true,
        myOptIn: "accept",
        partnerOptIn: null,
      }),
    ).toBe("awaiting_partner_optin");
  });

  it("returns 'declined' when current student declined", () => {
    expect(
      deriveLockedPhase({
        meetupStatus: "completed",
        meetupAt: past,
        now,
        hasMyAttendanceReport: true,
        myOptIn: "decline",
        partnerOptIn: null,
      }),
    ).toBe("declined");
  });

  it("returns 'declined' when partner declined", () => {
    expect(
      deriveLockedPhase({
        meetupStatus: "completed",
        meetupAt: past,
        now,
        hasMyAttendanceReport: true,
        myOptIn: "accept",
        partnerOptIn: "decline",
      }),
    ).toBe("declined");
  });

  it("returns 'declined' for not_attended meetups regardless of opt-in state", () => {
    expect(
      deriveLockedPhase({
        meetupStatus: "not_attended",
        meetupAt: past,
        now,
        hasMyAttendanceReport: true,
        myOptIn: null,
        partnerOptIn: null,
      }),
    ).toBe("declined");
  });
});
