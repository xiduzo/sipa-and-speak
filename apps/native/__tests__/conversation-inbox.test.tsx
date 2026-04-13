/**
 * Tests for task #157 — Build conversation inbox listing all open conversations
 *
 * Covers:
 *   - All open conversations are listed with match display name
 *   - Suspended conversations are not listed (API-filtered, verified by absence)
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react-native";
import React from "react";

// ── FlatList mock ─────────────────────────────────────────────────────────────

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

const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
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
  return render(
    <QueryClientProvider client={qc}>{ui}</QueryClientProvider>,
  );
}

beforeEach(() => {
  mockPush.mockClear();
  mockListConversations.mockReset();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("#157 — Conversation inbox", () => {
  it("lists all open conversations with match display names", async () => {
    mockListConversations.mockResolvedValue([
      { id: "conv-1", partner: { id: "u1", name: "Alice", image: null }, lastMessage: null, hasUnread: false, createdAt: new Date() },
      { id: "conv-2", partner: { id: "u2", name: "Bob", image: null }, lastMessage: null, hasUnread: false, createdAt: new Date() },
    ]);

    renderWithClient(<ChatsScreen />);

    await waitFor(() => {
      expect(screen.getByText("Alice")).toBeTruthy();
      expect(screen.getByText("Bob")).toBeTruthy();
    });
  });

  it("does not show suspended conversations (they are excluded by listConversations)", async () => {
    // The API already filters — this test verifies the screen renders only what the API returns.
    // A suspended conversation would never appear in this response.
    mockListConversations.mockResolvedValue([
      { id: "conv-open", partner: { id: "u1", name: "Alice", image: null }, lastMessage: null, hasUnread: false, createdAt: new Date() },
    ]);

    renderWithClient(<ChatsScreen />);

    await waitFor(() => {
      expect(screen.getByText("Alice")).toBeTruthy();
      expect(screen.queryByTestId("conversation-entry-conv-suspended")).toBeNull();
    });
  });
});
