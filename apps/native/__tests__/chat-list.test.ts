import {
  type ChatEntry,
  chatListCounts,
  conversationSubtitle,
} from "@/utils/chat-list";

describe("conversationSubtitle", () => {
  it("covers all six phases", () => {
    expect(conversationSubtitle("scheduled", "Bob de Boer")).toBe(
      "unlocks after you first meet up",
    );
    expect(conversationSubtitle("awaiting_attendance", "Bob de Boer")).toBe(
      "did you meet?",
    );
    expect(
      conversationSubtitle("awaiting_partner_attendance", "Bob de Boer"),
    ).toBe("waiting for Bob to confirm you met");
    expect(conversationSubtitle("awaiting_my_optin", "Bob de Boer")).toBe(
      "tap to keep in touch",
    );
    expect(conversationSubtitle("awaiting_partner_optin", "Bob de Boer")).toBe(
      "waiting for Bob to enable chatting",
    );
    expect(conversationSubtitle("declined", "Bob de Boer")).toBe(
      "chat won't open",
    );
  });

  it("uses the partner's first name only", () => {
    expect(
      conversationSubtitle("awaiting_partner_optin", "Anna Maria van Dijk"),
    ).toBe("waiting for Anna to enable chatting");
  });
});

describe("chatListCounts", () => {
  const open = (id: string): ChatEntry => ({
    kind: "open",
    id,
    conversationId: id,
    meetupId: null,
    partner: { id: "p", name: "Anna", image: null },
    lastMessage: null,
    hasUnread: false,
  });
  const locked = (id: string): ChatEntry => ({
    kind: "locked",
    id,
    meetupId: `m-${id}`,
    partner: { id: "p", name: "Anna", image: null },
    venue: { id: "v", name: "Café", photoUrl: null },
    meetupAt: "2026-07-01T10:00:00Z",
    phase: "scheduled",
  });

  it("counts open and locked entries", () => {
    const counts = chatListCounts([open("1"), locked("2"), open("3")]);
    expect(counts).toEqual({ openCount: 2, lockedCount: 1 });
  });

  it("handles an empty inbox", () => {
    expect(chatListCounts([])).toEqual({ openCount: 0, lockedCount: 0 });
  });
});
