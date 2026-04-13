/**
 * Tests for task #160 — Handle empty inbox state
 *
 * Covers:
 *   - Empty state shown when no open conversations
 *   - Empty state mentions S&S moment (messaging unlock context)
 *   - Empty state disappears once conversations exist
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

describe("#160 — Empty inbox state", () => {
  it("shows empty state when Student has no open conversations", async () => {
    mockListConversations.mockResolvedValue([]);

    renderWithClient(<ChatsScreen />);

    await waitFor(() => {
      expect(screen.getByTestId("empty-inbox")).toBeTruthy();
    });
  });

  it("empty state explains that messaging unlocks after a Sip & Speak moment", async () => {
    mockListConversations.mockResolvedValue([]);

    renderWithClient(<ChatsScreen />);

    await waitFor(() => {
      expect(screen.getByText(/Messaging unlocks after completing a Sip & Speak moment/i)).toBeTruthy();
    });
  });

  it("empty state is replaced once a conversation exists", async () => {
    mockListConversations.mockResolvedValue([
      { id: "conv-1", partner: { id: "u1", name: "Alice", image: null }, lastMessage: null, hasUnread: false, createdAt: new Date() },
    ]);

    renderWithClient(<ChatsScreen />);

    await waitFor(() => {
      expect(screen.queryByTestId("empty-inbox")).toBeNull();
      expect(screen.getByText("Alice")).toBeTruthy();
    });
  });
});
