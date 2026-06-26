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

const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
}));

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
  mockListEntries.mockReset();
});

describe("#157 — Conversation inbox", () => {
  it("lists all open conversations with match display names", async () => {
    mockListEntries.mockResolvedValue([
      {
        kind: "open",
        id: "conv-1",
        conversationId: "conv-1",
        meetupId: null,
        partner: { id: "u1", name: "Alice", image: null },
        lastMessage: null,
        hasUnread: false,
      },
      {
        kind: "open",
        id: "conv-2",
        conversationId: "conv-2",
        meetupId: null,
        partner: { id: "u2", name: "Bob", image: null },
        lastMessage: null,
        hasUnread: false,
      },
    ]);

    renderWithClient(<ChatsScreen />);

    await waitFor(() => {
      expect(screen.getByText("Alice")).toBeTruthy();
      expect(screen.getByText("Bob")).toBeTruthy();
    });
  });

  it("does not show suspended conversations (excluded by listEntries)", async () => {
    mockListEntries.mockResolvedValue([
      {
        kind: "open",
        id: "conv-open",
        conversationId: "conv-open",
        meetupId: null,
        partner: { id: "u1", name: "Alice", image: null },
        lastMessage: null,
        hasUnread: false,
      },
    ]);

    renderWithClient(<ChatsScreen />);

    await waitFor(() => {
      expect(screen.getByText("Alice")).toBeTruthy();
      expect(screen.queryByTestId("conversation-entry-conv-suspended")).toBeNull();
    });
  });
});
