import {
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

describe("resolveHomeState cascade", () => {
  it("falls back to nomeetup when nothing else applies", () => {
    const { hero, secondaries } = resolveHomeState(empty);
    expect(hero.kind).toBe("nomeetup");
    expect(secondaries).toEqual([]);
  });

  it("nomeetup carries discover count + partners", () => {
    const partners = [{ spokenLanguages: [{ language: "Italian", proficiency: "native" }] }];
    const { hero } = resolveHomeState({ ...empty, discover: partners });
    expect(hero).toMatchObject({ kind: "nomeetup", matchCount: 1 });
  });

  it("matchfound wins over nomeetup", () => {
    const { hero } = resolveHomeState({ ...empty, matches: [match({})] });
    expect(hero.kind).toBe("matchfound");
  });

  it("waiting wins over matchfound", () => {
    const { hero } = resolveHomeState({
      ...empty,
      pending: [pending({})],
      matches: [match({})],
    });
    expect(hero.kind).toBe("waiting");
  });

  it("confirmed wins over waiting", () => {
    const { hero } = resolveHomeState({
      ...empty,
      confirmed: [confirmed({})],
      pending: [pending({})],
    });
    expect(hero.kind).toBe("confirmed");
  });

  it("post wins over confirmed", () => {
    const past = confirmed({ meetupId: "past", isPast: true, hasReported: false });
    const future = confirmed({ meetupId: "future", isPast: false });
    const { hero } = resolveHomeState({ ...empty, confirmed: [past, future] });
    expect(hero.kind).toBe("post");
    if (hero.kind === "post") expect(hero.meetup.meetupId).toBe("past");
  });

  it("filters out reported past meetups from post", () => {
    const reported = confirmed({ isPast: true, hasReported: true });
    const { hero } = resolveHomeState({ ...empty, confirmed: [reported] });
    expect(hero.kind).toBe("nomeetup");
  });

  it("confirmed picks soonest future", () => {
    const a = confirmed({ meetupId: "a", date: "2099-06-01", time: "10:00" });
    const b = confirmed({ meetupId: "b", date: "2099-01-01", time: "10:00" });
    const { hero } = resolveHomeState({ ...empty, confirmed: [a, b] });
    if (hero.kind === "confirmed") expect(hero.meetup.meetupId).toBe("b");
  });

  it("waiting picks oldest pending", () => {
    const a = pending({ id: "newer", createdAt: "2026-04-28T12:00:00Z" });
    const b = pending({ id: "older", createdAt: "2026-04-28T08:00:00Z" });
    const { hero } = resolveHomeState({ ...empty, pending: [a, b] });
    if (hero.kind === "waiting") expect(hero.proposal.id).toBe("older");
  });

  it("matchfound picks newest match", () => {
    const a = match({ matchId: "older", matchedAt: "2026-04-20T10:00:00Z" });
    const b = match({ matchId: "newer", matchedAt: "2026-04-28T10:00:00Z" });
    const { hero } = resolveHomeState({ ...empty, matches: [a, b] });
    if (hero.kind === "matchfound") expect(hero.match.matchId).toBe("newer");
  });

  it("returns up to 2 secondaries below the hero", () => {
    const { hero, secondaries } = resolveHomeState({
      confirmed: [confirmed({ isPast: true, hasReported: false })], // post
      pending: [pending({})], // waiting
      matches: [match({})], // matchfound
      discover: [{ spokenLanguages: [] }], // nomeetup
    });
    expect(hero.kind).toBe("post");
    expect(secondaries.map((s) => s.kind)).toEqual(["waiting", "matchfound"]);
  });

  it("includes confirmed as secondary when post is hero", () => {
    const past = confirmed({ meetupId: "past", isPast: true, hasReported: false });
    const future = confirmed({ meetupId: "future", isPast: false, status: "confirmed" });
    const { hero, secondaries } = resolveHomeState({ ...empty, confirmed: [past, future] });
    expect(hero.kind).toBe("post");
    expect(secondaries[0]?.kind).toBe("confirmed");
  });
});
