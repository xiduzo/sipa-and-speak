import {
  needsAction,
  resolveHomeState,
  type ConfirmedMeetup,
  type PendingProposal,
  type MyMatch,
} from "@/components/home/home-state";

function confirmed(partial: Partial<ConfirmedMeetup>): ConfirmedMeetup {
  return {
    meetupId: "m-1",
    date: "2099-01-01",
    time: "10:00",
    status: "confirmed",
    isPast: false,
    venue: { id: "v-1", name: "V", description: null, photoUrl: null },
    partner: { id: "p-1", name: "P", image: null },
    reschedulePending: false,
    rescheduleIsFromMe: false,
    hasReported: false,
    myAttendance: null,
    myRating: null,
    optIn: { mine: null, partner: null, conversationId: null },
    ...partial,
  };
}

function pending(partial: Partial<PendingProposal>): PendingProposal {
  return {
    id: "p-1",
    isProposer: true,
    partner: { id: "u-1", name: "Marta", image: null },
    venue: { id: "v-1", name: "V", photoUrl: null },
    date: "2099-01-01",
    time: "10:00",
    createdAt: "2026-04-28T10:00:00Z",
    ...partial,
  };
}

function match(partial: Partial<MyMatch>): MyMatch {
  return {
    matchId: "mr-1",
    partnerId: "u-1",
    partnerName: "Marta",
    partnerPhotoUrl: null,
    matchedAt: "2026-04-28T10:00:00Z",
    ...partial,
  };
}

const empty = { confirmed: [], pending: [], matches: [], discover: [] };

describe("resolveHomeState carousel", () => {
  it("falls back to nomeetup when nothing else applies", () => {
    const { heros, secondaries } = resolveHomeState(empty);
    expect(heros).toHaveLength(1);
    expect(heros[0]?.kind).toBe("nomeetup");
    expect(secondaries).toEqual([]);
  });

  it("nomeetup carries discover count + partners", () => {
    const partners = [{ spokenLanguages: [{ language: "Italian", proficiency: "native" }] }];
    const { heros } = resolveHomeState({ ...empty, discover: partners });
    expect(heros[0]).toMatchObject({ kind: "nomeetup", matchCount: 1 });
  });

  it("matchfound beats nomeetup", () => {
    const { heros } = resolveHomeState({ ...empty, matches: [match({})] });
    expect(heros[0]?.kind).toBe("matchfound");
  });

  it("waiting beats matchfound", () => {
    const { heros, secondaries } = resolveHomeState({
      ...empty,
      pending: [pending({})],
      matches: [match({})],
    });
    expect(heros[0]?.kind).toBe("waiting");
    expect(secondaries[0]?.kind).toBe("matchfound");
  });

  it("confirmed meetup becomes hero; waiting demoted to secondary", () => {
    const { heros, secondaries } = resolveHomeState({
      ...empty,
      confirmed: [confirmed({})],
      pending: [pending({})],
    });
    expect(heros).toHaveLength(1);
    expect(heros[0]?.kind).toBe("confirmed");
    expect(secondaries[0]?.kind).toBe("waiting");
  });

  it("post entries lead heros before upcoming confirmed", () => {
    const past = confirmed({ meetupId: "past", isPast: true, hasReported: false });
    const future = confirmed({ meetupId: "future", isPast: false });
    const { heros } = resolveHomeState({ ...empty, confirmed: [past, future] });
    expect(heros.map((h) => h.kind)).toEqual(["post", "confirmed"]);
  });

  it("filters out reported past meetups", () => {
    const reported = confirmed({ isPast: true, hasReported: true });
    const { heros } = resolveHomeState({ ...empty, confirmed: [reported] });
    expect(heros[0]?.kind).toBe("nomeetup");
  });

  it("upcoming confirmed are ordered chronologically", () => {
    const a = confirmed({ meetupId: "later", date: "2099-06-01", time: "10:00" });
    const b = confirmed({ meetupId: "sooner", date: "2099-01-01", time: "10:00" });
    const { heros } = resolveHomeState({ ...empty, confirmed: [a, b] });
    const ids = heros.map((h) => (h.kind === "confirmed" ? h.meetup.meetupId : null));
    expect(ids).toEqual(["sooner", "later"]);
  });

  it("partner-proposed reschedule jumps to front of upcoming carousel", () => {
    const earlier = confirmed({
      meetupId: "earlier",
      date: "2099-01-01",
      time: "09:00",
    });
    const laterWithAction = confirmed({
      meetupId: "later",
      date: "2099-01-01",
      time: "10:00",
      reschedulePending: true,
      rescheduleIsFromMe: false,
    });
    const { heros } = resolveHomeState({
      ...empty,
      confirmed: [earlier, laterWithAction],
    });
    const ids = heros.map((h) => (h.kind === "confirmed" ? h.meetup.meetupId : null));
    expect(ids).toEqual(["later", "earlier"]);
  });

  it("self-initiated reschedule does not jump the queue", () => {
    const earlier = confirmed({ meetupId: "earlier", date: "2099-01-01", time: "09:00" });
    const laterMine = confirmed({
      meetupId: "later",
      date: "2099-01-01",
      time: "10:00",
      reschedulePending: true,
      rescheduleIsFromMe: true,
    });
    const { heros } = resolveHomeState({
      ...empty,
      confirmed: [earlier, laterMine],
    });
    const ids = heros.map((h) => (h.kind === "confirmed" ? h.meetup.meetupId : null));
    expect(ids).toEqual(["earlier", "later"]);
  });

  it("waiting heros are ordered oldest pending first", () => {
    const a = pending({ id: "newer", createdAt: "2026-04-28T12:00:00Z" });
    const b = pending({ id: "older", createdAt: "2026-04-28T08:00:00Z" });
    const { heros } = resolveHomeState({ ...empty, pending: [a, b] });
    const ids = heros.map((h) => (h.kind === "waiting" ? h.proposal.id : null));
    expect(ids).toEqual(["older", "newer"]);
  });

  it("matchfound picks newest match", () => {
    const a = match({ matchId: "older", matchedAt: "2026-04-20T10:00:00Z" });
    const b = match({ matchId: "newer", matchedAt: "2026-04-28T10:00:00Z" });
    const { heros } = resolveHomeState({ ...empty, matches: [a, b] });
    expect(heros[0]).toMatchObject({ kind: "matchfound" });
    if (heros[0]?.kind === "matchfound") expect(heros[0].match.matchId).toBe("newer");
  });

  it("returns up to 2 secondaries below the meetup carousel", () => {
    const { heros, secondaries } = resolveHomeState({
      confirmed: [confirmed({ isPast: true, hasReported: false })],
      pending: [pending({})],
      matches: [match({})],
      discover: [{ spokenLanguages: [] }],
    });
    expect(heros[0]?.kind).toBe("post");
    expect(secondaries.map((s) => s.kind)).toEqual(["waiting", "matchfound"]);
  });
});

describe("needsAction", () => {
  it("flags post (rating needed)", () => {
    expect(
      needsAction({ kind: "post", meetup: confirmed({ isPast: true }) }),
    ).toBe(true);
  });

  it("flags confirmed with partner-proposed reschedule", () => {
    const state = {
      kind: "confirmed" as const,
      meetup: confirmed({ reschedulePending: true, rescheduleIsFromMe: false }),
    };
    expect(needsAction(state)).toBe(true);
  });

  it("does not flag confirmed without reschedule", () => {
    const state = { kind: "confirmed" as const, meetup: confirmed({}) };
    expect(needsAction(state)).toBe(false);
  });

  it("flags waiting that needs my reply", () => {
    const state = { kind: "waiting" as const, proposal: pending({ isProposer: false }) };
    expect(needsAction(state)).toBe(true);
  });

  it("does not flag waiting where I am the proposer", () => {
    const state = { kind: "waiting" as const, proposal: pending({ isProposer: true }) };
    expect(needsAction(state)).toBe(false);
  });

  it("does not flag nomeetup", () => {
    expect(needsAction({ kind: "nomeetup", matchCount: 0, partners: [] })).toBe(false);
  });
});
