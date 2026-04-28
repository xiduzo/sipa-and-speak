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

const PRIORITY: HomeState["kind"][] = ["post", "confirmed", "waiting", "matchfound", "nomeetup"];

function pickPost(confirmed: ConfirmedMeetup[]): ConfirmedMeetup | null {
  const candidates = confirmed.filter((m) => m.isPast && !m.hasReported);
  if (candidates.length === 0) return null;
  return [...candidates].sort((a, b) => `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`))[0]!;
}

function pickConfirmed(confirmed: ConfirmedMeetup[]): ConfirmedMeetup | null {
  const candidates = confirmed.filter((m) => !m.isPast && m.status === "confirmed");
  if (candidates.length === 0) return null;
  return [...candidates].sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`))[0]!;
}

function pickWaiting(pending: PendingProposal[]): PendingProposal | null {
  if (pending.length === 0) return null;
  return [...pending].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  )[0]!;
}

function pickMatchfound(matches: MyMatch[]): MyMatch | null {
  if (matches.length === 0) return null;
  return [...matches].sort(
    (a, b) => new Date(b.matchedAt).getTime() - new Date(a.matchedAt).getTime(),
  )[0]!;
}

function buildState(kind: HomeState["kind"], inputs: Inputs): HomeState | null {
  switch (kind) {
    case "post": {
      const m = pickPost(inputs.confirmed);
      return m ? { kind: "post", meetup: m } : null;
    }
    case "confirmed": {
      const m = pickConfirmed(inputs.confirmed);
      return m ? { kind: "confirmed", meetup: m } : null;
    }
    case "waiting": {
      const p = pickWaiting(inputs.pending);
      return p ? { kind: "waiting", proposal: p } : null;
    }
    case "matchfound": {
      const m = pickMatchfound(inputs.matches);
      return m ? { kind: "matchfound", match: m } : null;
    }
    case "nomeetup":
      return { kind: "nomeetup", matchCount: inputs.discover.length, partners: inputs.discover };
  }
}

export function resolveHomeState(inputs: Inputs): { hero: HomeState; secondaries: HomeState[] } {
  const states = PRIORITY.map((k) => buildState(k, inputs)).filter((s): s is HomeState => s !== null);
  const [hero, ...rest] = states;
  return {
    hero: hero ?? { kind: "nomeetup", matchCount: 0, partners: [] },
    secondaries: rest.slice(0, 2),
  };
}
