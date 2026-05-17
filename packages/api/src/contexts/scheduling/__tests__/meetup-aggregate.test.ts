import { describe, it, expect } from "bun:test";

import {
  Meetup,
  MeetupRuleError,
  type MeetupSnapshot,
  type VenueSnapshot,
} from "../meetup-aggregate";

const NOW = new Date("2030-06-01T10:00:00Z");
const FUTURE_AT = new Date("2030-12-01T18:00:00Z");
const FUTURE_AT_ALT = new Date("2030-12-01T19:00:00Z");
const FUTURE_AT_ALT2 = new Date("2030-12-01T20:00:00Z");
const FUTURE_AT_ALT3 = new Date("2030-12-01T21:00:00Z");
const PAST_AT = new Date("2020-01-01T10:00:00Z");

const activeVenue: VenueSnapshot = { id: "v-1", name: "Cafe One", isActive: true };
const inactiveVenue: VenueSnapshot = { id: "v-2", name: "Closed Cafe", isActive: false };

function pending(overrides: Partial<MeetupSnapshot> = {}): MeetupSnapshot {
  return {
    id: "m-1",
    proposerId: "u-A",
    receiverId: "u-B",
    venueId: "v-1",
    scheduledAt: FUTURE_AT,
    status: "pending",
    round: 1,
    rescheduleProposerId: null,
    rescheduleVenueId: null,
    rescheduleScheduledAt: null,
    ...overrides,
  };
}
function confirmed(overrides: Partial<MeetupSnapshot> = {}): MeetupSnapshot {
  return pending({ status: "confirmed", ...overrides });
}

describe("Meetup.propose", () => {
  const baseArgs = {
    proposerId: "u-A",
    proposerSuspended: false,
    receiverId: "u-B",
    isMatched: true,
    hasDuplicatePending: false,
    venue: activeVenue,
    scheduledAt: FUTURE_AT,
    now: NOW,
  };

  it("emits MeetupProposed with round=1 and status=pending", () => {
    const { row, events } = Meetup.propose(baseArgs);
    expect(row.status).toBe("pending");
    expect(row.round).toBe(1);
    expect(events).toHaveLength(1);
    expect(events[0]!.name).toBe("MeetupProposed");
  });

  it("rejects self-proposal", () => {
    expect(() =>
      Meetup.propose({ ...baseArgs, receiverId: "u-A" }),
    ).toThrow(MeetupRuleError);
  });

  it("rejects suspended proposer", () => {
    expect(() => Meetup.propose({ ...baseArgs, proposerSuspended: true })).toThrow(
      /Suspended Students/,
    );
  });

  it("rejects when not matched", () => {
    expect(() => Meetup.propose({ ...baseArgs, isMatched: false })).toThrow(
      /matched partner/,
    );
  });

  it("rejects duplicate pending", () => {
    expect(() =>
      Meetup.propose({ ...baseArgs, hasDuplicatePending: true }),
    ).toThrow(/already awaiting/);
  });

  it("rejects unknown venue", () => {
    expect(() => Meetup.propose({ ...baseArgs, venue: null })).toThrow(
      /Location not found/,
    );
  });

  it("rejects inactive venue", () => {
    expect(() => Meetup.propose({ ...baseArgs, venue: inactiveVenue })).toThrow(
      /no longer available/,
    );
  });

  it("rejects past date/time", () => {
    expect(() =>
      Meetup.propose({ ...baseArgs, scheduledAt: PAST_AT }),
    ).toThrow(/future/);
  });
});

describe("Meetup.confirm", () => {
  it("transitions pending → confirmed for receiver", () => {
    const { state, events } = Meetup.confirm(pending(), {
      actorId: "u-B",
      venueName: "Cafe One",
      conflictsCount: 0,
      now: NOW,
    });
    expect(state.status).toBe("confirmed");
    expect(events[0]!.name).toBe("MeetupConfirmed");
  });

  it("rejects when actor is not the receiver", () => {
    expect(() =>
      Meetup.confirm(pending(), {
        actorId: "u-A",
        venueName: "Cafe One",
        conflictsCount: 0,
        now: NOW,
      }),
    ).toThrow(/responder/);
  });

  it("rejects when meetup is not pending", () => {
    expect(() =>
      Meetup.confirm(confirmed(), {
        actorId: "u-B",
        venueName: "Cafe One",
        conflictsCount: 0,
        now: NOW,
      }),
    ).toThrow(/already been responded/);
  });

  it("rejects on scheduling conflict", () => {
    expect(() =>
      Meetup.confirm(pending(), {
        actorId: "u-B",
        venueName: "Cafe One",
        conflictsCount: 1,
        now: NOW,
      }),
    ).toThrow(/Scheduling conflict/);
  });
});

describe("Meetup.decline", () => {
  it("transitions pending → declined for receiver", () => {
    const { state, events } = Meetup.decline(pending(), { actorId: "u-B", now: NOW });
    expect(state.status).toBe("declined");
    expect(events[0]!.name).toBe("MeetupDeclined");
  });

  it("rejects when actor is the proposer", () => {
    expect(() =>
      Meetup.decline(pending(), { actorId: "u-A", now: NOW }),
    ).toThrow(/responder/);
  });
});

describe("Meetup.counterPropose", () => {
  it("swaps proposer/receiver and increments round", () => {
    const { state, events } = Meetup.counterPropose(pending(), {
      actorId: "u-B",
      venue: { id: "v-3", name: "Cafe Three", isActive: true },
      scheduledAt: FUTURE_AT_ALT,
      now: NOW,
    });
    expect(state.proposerId).toBe("u-B");
    expect(state.receiverId).toBe("u-A");
    expect(state.round).toBe(2);
    expect(events[0]!.name).toBe("MeetupCounterProposed");
  });

  it("rejects when round is already at the max", () => {
    expect(() =>
      Meetup.counterPropose(pending({ round: 5 }), {
        actorId: "u-B",
        venue: activeVenue,
        scheduledAt: FUTURE_AT_ALT,
        now: NOW,
      }),
    ).toThrow(/Maximum counter-proposal rounds/);
  });

  it("rejects no-op counter-proposal", () => {
    expect(() =>
      Meetup.counterPropose(pending(), {
        actorId: "u-B",
        venue: activeVenue,
        scheduledAt: FUTURE_AT,
        now: NOW,
      }),
    ).toThrow(/at least one detail/);
  });
});

describe("Meetup.cancel", () => {
  it("transitions confirmed → cancelled for either participant", () => {
    const { state, events } = Meetup.cancel(confirmed(), { actorId: "u-A", now: NOW });
    expect(state.status).toBe("cancelled");
    expect(events[0]!.name).toBe("MeetupCancelled");
    expect(events[0]!.payload.otherStudentId).toBe("u-B");
  });

  it("rejects when meetup is not confirmed", () => {
    expect(() =>
      Meetup.cancel(pending(), { actorId: "u-A", now: NOW }),
    ).toThrow(/confirmed meetups/);
  });

  it("rejects when meetup is in the past", () => {
    expect(() =>
      Meetup.cancel(confirmed({ scheduledAt: PAST_AT }), {
        actorId: "u-A",
        now: NOW,
      }),
    ).toThrow(/already taken place/);
  });
});

describe("Meetup.proposeReschedule + accept + decline", () => {
  it("proposeReschedule stores reschedule fields and emits event", () => {
    const { state, events } = Meetup.proposeReschedule(confirmed(), {
      actorId: "u-A",
      venue: { id: "v-9", name: "Other Cafe", isActive: true },
      scheduledAt: FUTURE_AT_ALT2,
      now: NOW,
    });
    expect(state.rescheduleProposerId).toBe("u-A");
    expect(state.rescheduleVenueId).toBe("v-9");
    expect(state.scheduledAt).toEqual(FUTURE_AT); // original scheduledAt preserved
    expect(events[0]!.name).toBe("MeetupRescheduleProposed");
  });

  it("rejects a second concurrent reschedule proposal", () => {
    const stateWithReschedule = confirmed({
      rescheduleProposerId: "u-A",
      rescheduleVenueId: "v-9",
      rescheduleScheduledAt: FUTURE_AT_ALT2,
    });
    expect(() =>
      Meetup.proposeReschedule(stateWithReschedule, {
        actorId: "u-B",
        venue: activeVenue,
        scheduledAt: FUTURE_AT_ALT3,
        now: NOW,
      }),
    ).toThrow(/already pending/);
  });

  it("acceptReschedule promotes reschedule fields to canonical and clears them", () => {
    const stateWithReschedule = confirmed({
      rescheduleProposerId: "u-A",
      rescheduleVenueId: "v-9",
      rescheduleScheduledAt: FUTURE_AT_ALT2,
    });
    const { state, events } = Meetup.acceptReschedule(stateWithReschedule, {
      actorId: "u-B",
      rescheduleVenueName: "Other Cafe",
      now: NOW,
    });
    expect(state.venueId).toBe("v-9");
    expect(state.scheduledAt).toEqual(FUTURE_AT_ALT2);
    expect(state.rescheduleProposerId).toBeNull();
    expect(events[0]!.name).toBe("MeetupRescheduled");
  });

  it("rejects accepting one's own reschedule proposal", () => {
    const stateWithReschedule = confirmed({
      rescheduleProposerId: "u-A",
      rescheduleVenueId: "v-9",
      rescheduleScheduledAt: FUTURE_AT_ALT2,
    });
    expect(() =>
      Meetup.acceptReschedule(stateWithReschedule, {
        actorId: "u-A",
        rescheduleVenueName: "Other Cafe",
        now: NOW,
      }),
    ).toThrow(/your own reschedule/);
  });

  it("declineReschedule clears reschedule fields and keeps canonical details", () => {
    const stateWithReschedule = confirmed({
      rescheduleProposerId: "u-A",
      rescheduleVenueId: "v-9",
      rescheduleScheduledAt: FUTURE_AT_ALT2,
    });
    const { state, events } = Meetup.declineReschedule(stateWithReschedule, {
      actorId: "u-B",
      venueName: "Cafe One",
      now: NOW,
    });
    expect(state.rescheduleProposerId).toBeNull();
    expect(state.venueId).toBe("v-1"); // original retained
    expect(events[0]!.name).toBe("MeetupRescheduleDeclined");
  });
});

describe("Meetup.reportAttendance", () => {
  const pastConfirmed = confirmed({ scheduledAt: PAST_AT });

  it("first report stays pending — no outcome yet", () => {
    const result = Meetup.reportAttendance(pastConfirmed, {
      actorId: "u-A",
      attended: true,
      rating: 5,
      existingReports: [],
      now: NOW,
    });
    expect(result.outcome).toBe("pending");
    expect(result.state.status).toBe("confirmed");
    expect(result.events).toHaveLength(1);
    expect(result.events[0]!.name).toBe("AttendanceReported");
  });

  it("both attended → outcome=completed, status=completed, +SipAndSpeakMomentCompleted", () => {
    const result = Meetup.reportAttendance(pastConfirmed, {
      actorId: "u-B",
      attended: true,
      rating: 4,
      existingReports: [{ studentId: "u-A", attended: true }],
      now: NOW,
    });
    expect(result.outcome).toBe("completed");
    expect(result.state.status).toBe("completed");
    expect(result.events.map((e) => e.name)).toEqual([
      "AttendanceReported",
      "SipAndSpeakMomentCompleted",
    ]);
  });

  it("any no-show → outcome=not_attended, status=not_attended, +MeetupNotAttended", () => {
    const result = Meetup.reportAttendance(pastConfirmed, {
      actorId: "u-B",
      attended: false,
      rating: null,
      existingReports: [{ studentId: "u-A", attended: true }],
      now: NOW,
    });
    expect(result.outcome).toBe("not_attended");
    expect(result.state.status).toBe("not_attended");
    expect(result.events.map((e) => e.name)).toEqual([
      "AttendanceReported",
      "MeetupNotAttended",
    ]);
  });

  it("rejects duplicate report from the same student", () => {
    expect(() =>
      Meetup.reportAttendance(pastConfirmed, {
        actorId: "u-A",
        attended: true,
        rating: null,
        existingReports: [{ studentId: "u-A", attended: true }],
        now: NOW,
      }),
    ).toThrow(/already reported/);
  });

  it("rejects rating-with-non-attendance", () => {
    expect(() =>
      Meetup.reportAttendance(pastConfirmed, {
        actorId: "u-A",
        attended: false,
        rating: 5,
        existingReports: [],
        now: NOW,
      }),
    ).toThrow(/Rating can only be provided/);
  });

  it("rejects reporting before the meetup time has passed", () => {
    expect(() =>
      Meetup.reportAttendance(confirmed(), {
        actorId: "u-A",
        attended: true,
        rating: null,
        existingReports: [],
        now: NOW,
      }),
    ).toThrow(/after the meetup's scheduled time/);
  });
});
