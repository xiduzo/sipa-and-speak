import {
  meetupCardStatus,
  type MeetupCardStatusInput,
} from "@/utils/meetup-card-status";

function input(overrides: Partial<MeetupCardStatusInput> = {}): MeetupCardStatusInput {
  return {
    isPast: false,
    hasReported: false,
    myAttendance: null,
    reschedulePending: false,
    rescheduleIsFromMe: false,
    ...overrides,
  };
}

describe("meetupCardStatus — pill", () => {
  it("past + reported + attended → Met up (mint)", () => {
    const s = meetupCardStatus(input({ isPast: true, hasReported: true, myAttendance: true }));
    expect(s.pillLabel).toBe("Met up");
    expect(s.pillTone).toBe("mint");
  });

  it("past + reported + not attended → Missed (muted)", () => {
    const s = meetupCardStatus(input({ isPast: true, hasReported: true, myAttendance: false }));
    expect(s.pillLabel).toBe("Missed");
    expect(s.pillTone).toBe("muted");
  });

  it("past + unreported → Just now (mint)", () => {
    const s = meetupCardStatus(input({ isPast: true }));
    expect(s.pillLabel).toBe("Just now");
    expect(s.pillTone).toBe("mint");
  });

  it("partner proposed a reschedule → New time (mint)", () => {
    const s = meetupCardStatus(input({ reschedulePending: true, rescheduleIsFromMe: false }));
    expect(s.pillLabel).toBe("New time");
    expect(s.pillTone).toBe("mint");
  });

  it("my reschedule pending → Pending (muted)", () => {
    const s = meetupCardStatus(input({ reschedulePending: true, rescheduleIsFromMe: true }));
    expect(s.pillLabel).toBe("Pending");
    expect(s.pillTone).toBe("muted");
  });

  it("plain upcoming meetup → Confirmed (gold)", () => {
    const s = meetupCardStatus(input());
    expect(s.pillLabel).toBe("Confirmed");
    expect(s.pillTone).toBe("gold");
  });

  it("past wins over a pending reschedule", () => {
    const s = meetupCardStatus(
      input({ isPast: true, reschedulePending: true, rescheduleIsFromMe: false }),
    );
    expect(s.pillLabel).toBe("Just now");
  });
});

describe("meetupCardStatus — reschedule affordances", () => {
  it("no reschedule pending → Reschedule, enabled", () => {
    const s = meetupCardStatus(input());
    expect(s.rescheduleLabel).toBe("Reschedule");
    expect(s.rescheduleDisabled).toBe(false);
    expect(s.partnerProposedReschedule).toBe(false);
  });

  it("my reschedule pending → Reschedule pending…, disabled", () => {
    const s = meetupCardStatus(input({ reschedulePending: true, rescheduleIsFromMe: true }));
    expect(s.rescheduleLabel).toBe("Reschedule pending…");
    expect(s.rescheduleDisabled).toBe(true);
    expect(s.partnerProposedReschedule).toBe(false);
  });

  it("partner reschedule pending → Answer, enabled, flagged", () => {
    const s = meetupCardStatus(input({ reschedulePending: true, rescheduleIsFromMe: false }));
    expect(s.rescheduleLabel).toBe("Answer");
    expect(s.rescheduleDisabled).toBe(false);
    expect(s.partnerProposedReschedule).toBe(true);
  });

  it("rescheduleIsFromMe without a pending reschedule is inert", () => {
    const s = meetupCardStatus(input({ rescheduleIsFromMe: true }));
    expect(s.rescheduleLabel).toBe("Reschedule");
    expect(s.rescheduleDisabled).toBe(false);
    expect(s.partnerProposedReschedule).toBe(false);
  });
});
