import { describe, it, expect } from "bun:test";
import {
  buildMatchRequestSentRecipes,
  buildMatchRequestAcceptedRecipes,
  buildMeetupConfirmedRecipes,
  buildMessageSentRecipes,
  buildProposalCancelledRecipes,
} from "../builders";

describe("buildMatchRequestSentRecipes", () => {
  function makeEvent(overrides: { offered: string | null; targeted: string | null }) {
    return {
      matchRequestId: "mr-1",
      requesterId: "u1",
      requesterName: "Ana",
      offeredLanguage: overrides.offered,
      targetedLanguage: overrides.targeted,
      receiverId: "u2",
      sentAt: new Date(),
    };
  }

  it("returns one recipe targeting the receiver", () => {
    const recipes = buildMatchRequestSentRecipes(makeEvent({ offered: "Dutch", targeted: "English" }));
    expect(recipes).toHaveLength(1);
    expect(recipes[0]?.recipientId).toBe("u2");
    expect(recipes[0]?.title).toBe("New match request");
    expect(recipes[0]?.data).toEqual({ matchRequestId: "mr-1", requesterId: "u1" });
  });

  it("body includes language summary when both offered and targeted are known", () => {
    const recipes = buildMatchRequestSentRecipes(makeEvent({ offered: "Portuguese", targeted: "Dutch" }));
    expect(recipes[0]?.body).toBe("Ana wants to meet you — speaks Portuguese, learning Dutch");
  });

  it("body omits language summary when both languages are missing", () => {
    const recipes = buildMatchRequestSentRecipes(makeEvent({ offered: null, targeted: null }));
    expect(recipes[0]?.body).toBe("Ana wants to meet you");
  });

  it("body omits language summary when only offered is known", () => {
    const recipes = buildMatchRequestSentRecipes(makeEvent({ offered: "Portuguese", targeted: null }));
    expect(recipes[0]?.body).toBe("Ana wants to meet you");
  });

  it("body omits language summary when only targeted is known", () => {
    const recipes = buildMatchRequestSentRecipes(makeEvent({ offered: null, targeted: "Dutch" }));
    expect(recipes[0]?.body).toBe("Ana wants to meet you");
  });
});

describe("buildMatchRequestAcceptedRecipes", () => {
  it("returns one recipe targeting the requester with category", () => {
    const recipes = buildMatchRequestAcceptedRecipes({
      matchRequestId: "mr-1",
      requesterId: "u1",
      receiverId: "u2",
      receiverName: "Bob",
      acceptedAt: new Date(),
    });
    expect(recipes).toHaveLength(1);
    expect(recipes[0]?.recipientId).toBe("u1");
    expect(recipes[0]?.body).toBe("Bob accepted your request");
    expect(recipes[0]?.category).toBe("match_accepted");
  });
});

describe("buildMeetupConfirmedRecipes", () => {
  it("returns recipes for both Students with identical body", () => {
    const recipes = buildMeetupConfirmedRecipes({
      meetupId: "m-1",
      proposerId: "u1",
      receiverId: "u2",
      venueName: "Atlas",
      date: "2026-05-10",
      time: "14:00",
      confirmedAt: new Date(),
    });
    expect(recipes).toHaveLength(2);
    expect(recipes.map((r) => r.recipientId).sort()).toEqual(["u1", "u2"]);
    expect(recipes[0]?.body).toBe("Atlas · 2026-05-10 at 14:00");
    expect(recipes[1]?.body).toBe(recipes[0]?.body);
  });
});

describe("buildMessageSentRecipes", () => {
  it("returns one recipe with sender identity but no message content", () => {
    const recipes = buildMessageSentRecipes({
      conversationId: "c-1",
      senderId: "u1",
      senderName: "Alice",
      recipientId: "u2",
    });
    expect(recipes).toHaveLength(1);
    expect(recipes[0]?.recipientId).toBe("u2");
    expect(recipes[0]?.title).toBe("Alice");
    expect(recipes[0]?.body).toBe("sent you a message");
  });
});

describe("buildProposalCancelledRecipes", () => {
  it("returns one recipe per peer", () => {
    const recipes = buildProposalCancelledRecipes(["p1", "p2", "p3"]);
    expect(recipes).toHaveLength(3);
    expect(recipes.map((r) => r.recipientId)).toEqual(["p1", "p2", "p3"]);
    expect(recipes.every((r) => r.title === "Meetup proposal cancelled")).toBe(true);
  });

  it("handles empty peer list", () => {
    expect(buildProposalCancelledRecipes([])).toEqual([]);
  });
});
