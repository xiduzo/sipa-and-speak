// Pure projections for the Chats inbox: the ChatEntry discriminated union
// (as served by `chat.listEntries`), the locked-conversation subtitle copy,
// and the open/locked counts. No React — mirrors
// `components/home/home-state.ts`.

export type ConversationPhase =
  | "scheduled"
  | "awaiting_attendance"
  | "awaiting_partner_attendance"
  | "awaiting_my_optin"
  | "awaiting_partner_optin"
  | "declined";

export type OpenChatEntry = {
  kind: "open";
  id: string;
  conversationId: string;
  meetupId: string | null;
  partner: { id: string; name: string; image: string | null } | null;
  lastMessage: { content: string; createdAt: string | Date } | null;
  hasUnread: boolean;
};

export type LockedChatEntry = {
  kind: "locked";
  id: string;
  meetupId: string;
  partner: { id: string; name: string; image: string | null };
  venue: { id: string; name: string; photoUrl: string | null };
  meetupAt: string;
  phase: ConversationPhase;
};

export type ChatEntry = OpenChatEntry | LockedChatEntry;

/** Subtitle shown under a locked conversation, per phase. */
export function conversationSubtitle(
  phase: ConversationPhase,
  partnerName: string,
): string {
  const firstName = partnerName.split(" ")[0];
  switch (phase) {
    case "scheduled":
      return "unlocks after you first meet up";
    case "awaiting_attendance":
      return "did you meet?";
    case "awaiting_partner_attendance":
      return `waiting for ${firstName} to confirm you met`;
    case "awaiting_my_optin":
      return "tap to keep in touch";
    case "awaiting_partner_optin":
      return `waiting for ${firstName} to enable chatting`;
    case "declined":
      return "chat won't open";
  }
}

export function chatListCounts(entries: ChatEntry[]): {
  openCount: number;
  lockedCount: number;
} {
  return {
    openCount: entries.filter((e) => e.kind === "open").length,
    lockedCount: entries.filter((e) => e.kind === "locked").length,
  };
}
