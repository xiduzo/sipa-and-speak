/**
 * Tests for task #158 — Show unread message indicator per conversation entry in the inbox
 *
 * Covers:
 *   - Conversation with unread messages shows an indicator dot
 *   - Conversation with no unread messages shows no indicator
 *   - After reading, indicator is absent (data returns hasUnread=false)
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react-native";
import React from "react";

// ── FlatList mock ─────────────────────────────────────────────────────────────

jest.mock("react-native", () => {
  const RN = jest.requireActual("react-native");
  RN.FlatList = (props: any) => {
    const React = require("react");
    const { data, renderItem, testID, ListEmptyComponent } = props;
    if (!data || data.length === 0) {
      return React.createElement(RN.View, { testID }, ListEmptyComponent);
    }
    return React.createElement(
      RN.View,
      { testID },
      data.map((item: any, index: number) => renderItem({ item, index })),
    );
  };
  return RN;
});

// ── Router mock ───────────────────────────────────────────────────────────────

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

// ── tRPC mock ─────────────────────────────────────────────────────────────────

const mockListEntries = jest.fn();

jest.mock("@/utils/trpc", () => ({
  queryClient: new (require("@tanstack/react-query").QueryClient)(),
  trpc: {
    chat: {
      listEntries: {
        queryOptions: () => ({
          queryKey: ["chat.listEntries"],
          queryFn: mockListEntries,
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
  mockListEntries.mockReset();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("#158 — Unread indicator in inbox", () => {
  it("shows unread indicator when conversation has unread messages", async () => {
    mockListEntries.mockResolvedValue([
      { kind: "open", id: "conv-1", conversationId: "conv-1", meetupId: null, partner: { id: "u1", name: "Alice", image: null }, lastMessage: null, hasUnread: true },
    ]);

    renderWithClient(<ChatsScreen />);

    await waitFor(() => {
      expect(screen.getByTestId("unread-indicator-conv-1")).toBeTruthy();
    });
  });

  it("does not show unread indicator when all messages are read", async () => {
    mockListEntries.mockResolvedValue([
      { kind: "open", id: "conv-1", conversationId: "conv-1", meetupId: null, partner: { id: "u1", name: "Alice", image: null }, lastMessage: null, hasUnread: false },
    ]);

    renderWithClient(<ChatsScreen />);

    await waitFor(() => {
      expect(screen.queryByTestId("unread-indicator-conv-1")).toBeNull();
    });
  });

  it("no indicator after Student reads conversation (hasUnread becomes false on refetch)", async () => {
    mockListEntries.mockResolvedValue([
      { kind: "open", id: "conv-read", conversationId: "conv-read", meetupId: null, partner: { id: "u2", name: "Bob", image: null }, lastMessage: null, hasUnread: false },
    ]);

    renderWithClient(<ChatsScreen />);

    await waitFor(() => {
      expect(screen.getByText("Bob")).toBeTruthy();
      expect(screen.queryByTestId("unread-indicator-conv-read")).toBeNull();
    });
  });
});
