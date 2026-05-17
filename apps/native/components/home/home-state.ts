import { epochMs as instant } from "@/lib/dates";

export type ConfirmedMeetup = {
  meetupId: string;
  scheduledAt: Date | string;
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
  scheduledAt: Date | string;
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
    .sort((a, b) => instant(b.scheduledAt) - instant(a.scheduledAt))
    .map((m) => ({ kind: "post", meetup: m }));
}

function buildConfirmedList(confirmed: ConfirmedMeetup[]): HomeState[] {
  return confirmed
    .filter((m) => !m.isPast && m.status === "confirmed")
    .sort((a, b) => {
      const aAction = a.reschedulePending && !a.rescheduleIsFromMe ? 1 : 0;
      const bAction = b.reschedulePending && !b.rescheduleIsFromMe ? 1 : 0;
      if (aAction !== bAction) return bAction - aAction;
      return instant(a.scheduledAt) - instant(b.scheduledAt);
    })
    .map((m) => ({ kind: "confirmed", meetup: m }));
}

function buildWaitingList(pending: PendingProposal[]): HomeState[] {
  return [...pending]
    .sort((a, b) => instant(a.createdAt) - instant(b.createdAt))
    .map((p) => ({ kind: "waiting", proposal: p }));
}

function pickMatchfound(matches: MyMatch[]): MyMatch | null {
  if (matches.length === 0) return null;
  return [...matches].sort((a, b) => instant(b.matchedAt) - instant(a.matchedAt))[0]!;
}

export function resolveHomeState(inputs: Inputs): { heros: HomeState[]; secondaries: HomeState[] } {
  const posts = buildPostList(inputs.confirmed);
  const upcomings = buildConfirmedList(inputs.confirmed);
  const meetupHeros = [...posts, ...upcomings];

  const discoverCard: HomeState = {
    kind: "nomeetup",
    matchCount: inputs.discover.length,
    partners: inputs.discover,
  };

  if (meetupHeros.length > 0) {
    const secondaries: HomeState[] = [];
    const waiting = buildWaitingList(inputs.pending)[0];
    if (waiting) secondaries.push(waiting);
    const top = pickMatchfound(inputs.matches);
    if (top) secondaries.push({ kind: "matchfound", match: top });
    secondaries.push(discoverCard);
    return { heros: meetupHeros, secondaries };
  }

  const waitingList = buildWaitingList(inputs.pending);
  if (waitingList.length > 0) {
    const secondaries: HomeState[] = [];
    const top = pickMatchfound(inputs.matches);
    if (top) secondaries.push({ kind: "matchfound", match: top });
    secondaries.push(discoverCard);
    return { heros: waitingList, secondaries };
  }

  const top = pickMatchfound(inputs.matches);
  if (top) {
    return {
      heros: [{ kind: "matchfound", match: top }],
      secondaries: [discoverCard],
    };
  }

  return {
    heros: [discoverCard],
    secondaries: [],
  };
}

export { needsAction };
