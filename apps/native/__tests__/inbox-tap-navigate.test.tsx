/**
 * Tests for task #161 — Navigate to conversation view on inbox entry tap
 *
 * Covers:
 *   - Tapping an open entry navigates to /chat/:conversationId
 *   - Tapping a locked teaser navigates to /chat/locked/:meetupId
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
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
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  mockPush.mockClear();
  mockListEntries.mockReset();
});

describe("#161 — Navigate on inbox tap", () => {
  it("tapping an open conversation navigates to /chat/:conversationId", async () => {
    mockListEntries.mockResolvedValue([
      {
        kind: "open",
        id: "conv-abc",
        conversationId: "conv-abc",
        meetupId: null,
        partner: { id: "u1", name: "Alice", image: null },
        lastMessage: null,
        hasUnread: false,
      },
    ]);

    renderWithClient(<ChatsScreen />);

    await waitFor(() => {
      expect(screen.getByTestId("conversation-entry-conv-abc")).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId("conversation-entry-conv-abc"));

    expect(mockPush).toHaveBeenCalledWith("/chat/conv-abc");
  });

  it("tapping a locked teaser navigates to /chat/locked/:meetupId", async () => {
    const future = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    mockListEntries.mockResolvedValue([
      {
        kind: "locked",
        id: "meet-xyz",
        meetupId: "meet-xyz",
        partner: { id: "u1", name: "Marta", image: null },
        venue: { id: "v1", name: "Stationsplein", photoUrl: null },
        meetupAt: future,
        phase: "scheduled",
      },
    ]);

    renderWithClient(<ChatsScreen />);

    await waitFor(() => {
      expect(screen.getByTestId("locked-entry-meet-xyz")).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId("locked-entry-meet-xyz"));

    expect(mockPush).toHaveBeenCalledWith("/chat/locked/meet-xyz");
  });
});
