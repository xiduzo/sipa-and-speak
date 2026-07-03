// Pure projection: a confirmed-meetup row → the status pill + reschedule
// affordances its card shows. No React — mirrors
// `components/home/home-state.ts`.

export type PillTone = "gold" | "mint" | "muted" | "rose";

export type MeetupCardStatusInput = {
  isPast: boolean;
  hasReported: boolean;
  myAttendance: boolean | null;
  reschedulePending: boolean;
  rescheduleIsFromMe: boolean;
};

export type MeetupCardStatus = {
  pillLabel: string;
  pillTone: PillTone;
  /** Label of the reschedule button (future meetups only). */
  rescheduleLabel: string;
  /** My own reschedule is still unanswered — button disabled. */
  rescheduleDisabled: boolean;
  /** Partner proposed a new time — I need to answer. */
  partnerProposedReschedule: boolean;
};

export function meetupCardStatus(m: MeetupCardStatusInput): MeetupCardStatus {
  const partnerProposedReschedule = m.reschedulePending && !m.rescheduleIsFromMe;

  let pillLabel: string;
  let pillTone: PillTone;
  if (m.isPast && m.hasReported) {
    pillLabel = m.myAttendance ? "Met up" : "Missed";
    pillTone = m.myAttendance ? "mint" : "muted";
  } else if (m.isPast) {
    pillLabel = "Just now";
    pillTone = "mint";
  } else if (partnerProposedReschedule) {
    pillLabel = "New time";
    pillTone = "mint";
  } else if (m.reschedulePending) {
    pillLabel = "Pending";
    pillTone = "muted";
  } else {
    pillLabel = "Confirmed";
    pillTone = "gold";
  }

  const rescheduleLabel = m.reschedulePending
    ? m.rescheduleIsFromMe
      ? "Reschedule pending…"
      : "Answer"
    : "Reschedule";

  return {
    pillLabel,
    pillTone,
    rescheduleLabel,
    rescheduleDisabled: m.rescheduleIsFromMe && m.reschedulePending,
    partnerProposedReschedule,
  };
}
