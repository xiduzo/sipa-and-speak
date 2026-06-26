/**
 * Tests for task #160 — Handle empty inbox state
 *
 * Covers:
 *   - Empty state shown when no chat entries
 *   - Empty state explains the meet-first-message-after gate
 *   - Empty state disappears once an entry exists (open or locked)
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

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn() }),
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
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  mockListEntries.mockReset();
});

describe("#160 — Empty inbox state", () => {
  it("shows empty state when Student has no chat entries", async () => {
    mockListEntries.mockResolvedValue([]);

    renderWithClient(<ChatsScreen />);

    await waitFor(() => {
      expect(screen.getByTestId("empty-inbox")).toBeTruthy();
    });
  });

  it("empty state explains the meet-first-message-after gate", async () => {
    mockListEntries.mockResolvedValue([]);

    renderWithClient(<ChatsScreen />);

    await waitFor(() => {
      expect(screen.getByText(/locked until you both meet and opt in/i)).toBeTruthy();
    });
  });

  it("empty state is replaced once an open conversation exists", async () => {
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
    ]);

    renderWithClient(<ChatsScreen />);

    await waitFor(() => {
      expect(screen.queryByTestId("empty-inbox")).toBeNull();
      expect(screen.getByText("Alice")).toBeTruthy();
    });
  });

  it("empty state is replaced once a locked teaser exists", async () => {
    const future = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    mockListEntries.mockResolvedValue([
      {
        kind: "locked",
        id: "meet-1",
        meetupId: "meet-1",
        partner: { id: "u1", name: "Marta", image: null },
        venue: { id: "v1", name: "Stationsplein", photoUrl: null },
        meetupAt: future,
        phase: "scheduled",
      },
    ]);

    renderWithClient(<ChatsScreen />);

    await waitFor(() => {
      expect(screen.queryByTestId("empty-inbox")).toBeNull();
      expect(screen.getByText("Marta")).toBeTruthy();
      expect(screen.getByTestId("locked-entry-meet-1")).toBeTruthy();
    });
  });
});
