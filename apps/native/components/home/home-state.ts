export type ConfirmedMeetup = {
  meetupId: string;
  date: string;
  time: string;
  status: string;
  isPast: boolean;
  venue: { id: string; name: string; description: string | null; photoUrl: string | null };
  partner: { id: string; name: string; image: string | null };
  reschedulePending: boolean;
  rescheduleIsFromMe: boolean;
  hasReported: boolean;
  myAttendance: boolean | null;
  myRating: number | null;
  optIn: {
    mine: "accept" | "decline" | null;
    partner: "accept" | "decline" | null;
    conversationId: string | null;
  };
};

export type PendingProposal = {
  id: string;
  isProposer: boolean;
  partner: { id: string; name: string; image: string | null };
  venue: { id: string; name: string; photoUrl: string | null };
  date: string;
  time: string;
  createdAt: Date | string;
};

export type MyMatch = {
  matchId: string;
  partnerId: string;
  partnerName: string;
  partnerPhotoUrl: string | null;
  matchedAt: string;
};

export type DiscoverPartner = {
  spokenLanguages: { language: string; proficiency: string | null }[];
};

export type HomeState =
  | { kind: "post"; meetup: ConfirmedMeetup }
  | { kind: "confirmed"; meetup: ConfirmedMeetup }
  | { kind: "waiting"; proposal: PendingProposal }
  | { kind: "matchfound"; match: MyMatch }
  | { kind: "nomeetup"; matchCount: number; partners: DiscoverPartner[] };

type Inputs = {
  confirmed: ConfirmedMeetup[];
  pending: PendingProposal[];
  matches: MyMatch[];
  discover: DiscoverPartner[];
};

function needsAction(state: HomeState): boolean {
  switch (state.kind) {
    case "post":
      return true;
    case "confirmed":
      return state.meetup.reschedulePending && !state.meetup.rescheduleIsFromMe;
    case "waiting":
      return !state.proposal.isProposer;
    case "matchfound":
      return true;
    case "nomeetup":
      return false;
  }
}

function buildPostList(confirmed: ConfirmedMeetup[]): HomeState[] {
  return confirmed
    .filter((m) => m.isPast && !m.hasReported)
    .sort((a, b) => `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`))
    .map((m) => ({ kind: "post", meetup: m }));
}

function buildConfirmedList(confirmed: ConfirmedMeetup[]): HomeState[] {
  return confirmed
    .filter((m) => !m.isPast && m.status === "confirmed")
    .sort((a, b) => {
      const aAction = a.reschedulePending && !a.rescheduleIsFromMe ? 1 : 0;
      const bAction = b.reschedulePending && !b.rescheduleIsFromMe ? 1 : 0;
      if (aAction !== bAction) return bAction - aAction;
      return `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`);
    })
    .map((m) => ({ kind: "confirmed", meetup: m }));
}

function buildWaitingList(pending: PendingProposal[]): HomeState[] {
  return [...pending]
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .map((p) => ({ kind: "waiting", proposal: p }));
}

function pickMatchfound(matches: MyMatch[]): MyMatch | null {
  if (matches.length === 0) return null;
  return [...matches].sort(
    (a, b) => new Date(b.matchedAt).getTime() - new Date(a.matchedAt).getTime(),
  )[0]!;
}

export function resolveHomeState(inputs: Inputs): { heros: HomeState[]; secondaries: HomeState[] } {
  const posts = buildPostList(inputs.confirmed);
  const upcomings = buildConfirmedList(inputs.confirmed);
  const meetupHeros = [...posts, ...upcomings];

  if (meetupHeros.length > 0) {
    const secondaries: HomeState[] = [];
    const waiting = buildWaitingList(inputs.pending)[0];
    if (waiting) secondaries.push(waiting);
    const top = pickMatchfound(inputs.matches);
    if (top) secondaries.push({ kind: "matchfound", match: top });
    return { heros: meetupHeros, secondaries: secondaries.slice(0, 2) };
  }

  const waitingList = buildWaitingList(inputs.pending);
  if (waitingList.length > 0) {
    const top = pickMatchfound(inputs.matches);
    return {
      heros: waitingList,
      secondaries: top ? [{ kind: "matchfound", match: top }] : [],
    };
  }

  const top = pickMatchfound(inputs.matches);
  if (top) return { heros: [{ kind: "matchfound", match: top }], secondaries: [] };

  return {
    heros: [{ kind: "nomeetup", matchCount: inputs.discover.length, partners: inputs.discover }],
    secondaries: [],
  };
}

export { needsAction };
