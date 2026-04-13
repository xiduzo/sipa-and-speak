/**
 * Tests for task #159 — Sort conversations by most recent message activity
 *
 * Covers:
 *   - Conversation with most recent message appears first
 *   - Conversations with no messages appear below those with activity
 *   - Inbox renders in the order returned by listConversations (sort is API-side)
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react-native";
import React from "react";

// ── FlatList mock (preserves order) ──────────────────────────────────────────

jest.mock("react-native", () => {
  const RN = jest.requireActual("react-native");
  RN.FlatList = (props) => {
    const React = require("react");
    const { data, renderItem, testID, ListEmptyComponent } = props;
    if (!data || data.length === 0) {
      return React.createElement(RN.View, { testID }, ListEmptyComponent);
    }
    return React.createElement(
      RN.View,
      { testID },
      data.map((item, index) => renderItem({ item, index })),
    );
  };
  return RN;
});

// ── Router mock ───────────────────────────────────────────────────────────────

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

// ── tRPC mock ─────────────────────────────────────────────────────────────────

const mockListConversations = jest.fn();

jest.mock("@/utils/trpc", () => ({
  queryClient: new (require("@tanstack/react-query").QueryClient)(),
  trpc: {
    chat: {
      listConversations: {
        queryOptions: () => ({
          queryKey: ["chat.listConversations"],
          queryFn: mockListConversations,
        }),
      },
    },
  },
}));

// ── Import after mocks ─────────────────────────────────────────────────────────
// eslint-disable-next-line import/first
import ChatsScreen from "../app/(tabs)/chats";

function renderWithClient(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  mockListConversations.mockReset();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("#159 — Inbox sort order", () => {
  it("renders conversations in API-provided order (most recent first)", async () => {
    // API already sorts by lastMessage.createdAt desc — screen renders in that order
    mockListConversations.mockResolvedValue([
      {
        id: "conv-recent",
        partner: { id: "u1", name: "Alice (recent)", image: null },
        lastMessage: { id: "m1", createdAt: new Date("2024-01-10T10:00:00Z") },
        hasUnread: false,
        createdAt: new Date("2024-01-01"),
      },
      {
        id: "conv-older",
        partner: { id: "u2", name: "Bob (older)", image: null },
        lastMessage: { id: "m2", createdAt: new Date("2024-01-01T10:00:00Z") },
        hasUnread: false,
        createdAt: new Date("2024-01-01"),
      },
    ]);

    renderWithClient(<ChatsScreen />);

    await waitFor(() => {
      const allText = screen.toJSON();
      const json = JSON.stringify(allText);
      const aliceIdx = json.indexOf("Alice (recent)");
      const bobIdx = json.indexOf("Bob (older)");
      expect(aliceIdx).toBeLessThan(bobIdx);
    });
  });

  it("conversation with no messages appears after those with activity", async () => {
    mockListConversations.mockResolvedValue([
      {
        id: "conv-with-msg",
        partner: { id: "u1", name: "Alice", image: null },
        lastMessage: { id: "m1", createdAt: new Date("2024-01-10") },
        hasUnread: false,
        createdAt: new Date("2024-01-01"),
      },
      {
        id: "conv-silent",
        partner: { id: "u2", name: "Bob (silent)", image: null },
        lastMessage: null,
        hasUnread: false,
        createdAt: new Date("2024-01-09"),
      },
    ]);

    renderWithClient(<ChatsScreen />);

    await waitFor(() => {
      const json = JSON.stringify(screen.toJSON());
      expect(json.indexOf("Alice")).toBeLessThan(json.indexOf("Bob (silent)"));
    });
  });
});
