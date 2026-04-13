/**
 * Tests for task #161 — Navigate to conversation view on inbox entry tap
 *
 * Covers:
 *   - Tapping a conversation entry navigates to /chat/:conversationId
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
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
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  mockPush.mockClear();
  mockListConversations.mockReset();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("#161 — Navigate to conversation on inbox tap", () => {
  it("tapping a conversation entry navigates to /chat/:conversationId", async () => {
    mockListConversations.mockResolvedValue([
      { id: "conv-abc", partner: { id: "u1", name: "Alice", image: null }, lastMessage: null, hasUnread: false, createdAt: new Date() },
    ]);

    renderWithClient(<ChatsScreen />);

    await waitFor(() => {
      expect(screen.getByTestId("conversation-entry-conv-abc")).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId("conversation-entry-conv-abc"));

    expect(mockPush).toHaveBeenCalledWith("/chat/conv-abc");
  });
});
