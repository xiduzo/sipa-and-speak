/**
 * Tests for task #159 — Sort conversations by most recent message activity
 *
 * Covers:
 *   - Inbox renders entries in API-provided order (sort is API-side)
 *   - Locked teasers appear above open conversations
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

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
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

describe("#159 — Inbox sort order", () => {
  it("renders entries in API-provided order", async () => {
    mockListEntries.mockResolvedValue([
      {
        kind: "open",
        id: "conv-recent",
        conversationId: "conv-recent",
        meetupId: null,
        partner: { id: "u1", name: "Alice (recent)", image: null },
        lastMessage: { id: "m1", content: "hi", createdAt: new Date("2024-01-10T10:00:00Z") },
        hasUnread: false,
      },
      {
        kind: "open",
        id: "conv-older",
        conversationId: "conv-older",
        meetupId: null,
        partner: { id: "u2", name: "Bob (older)", image: null },
        lastMessage: { id: "m2", content: "hi", createdAt: new Date("2024-01-01T10:00:00Z") },
        hasUnread: false,
      },
    ]);

    renderWithClient(<ChatsScreen />);

    await waitFor(() => {
      const texts = screen.getAllByText(/^(Alice|Bob)/).map((n) => String(n.props.children));
      expect(texts.indexOf("Alice (recent)")).toBeLessThan(
        texts.indexOf("Bob (older)"),
      );
    });
  });

  it("locked teaser appears above open conversation when API returns locked first", async () => {
    const future = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    mockListEntries.mockResolvedValue([
      {
        kind: "locked",
        id: "meet-1",
        meetupId: "meet-1",
        partner: { id: "u1", name: "Marta (locked)", image: null },
        venue: { id: "v1", name: "Stationsplein", photoUrl: null },
        meetupAt: future,
        phase: "scheduled",
      },
      {
        kind: "open",
        id: "conv-old",
        conversationId: "conv-old",
        meetupId: null,
        partner: { id: "u2", name: "Bob (open)", image: null },
        lastMessage: null,
        hasUnread: false,
      },
    ]);

    renderWithClient(<ChatsScreen />);

    await waitFor(() => {
      const texts = screen.getAllByText(/^(Marta|Bob)/).map((n) => String(n.props.children));
      expect(texts.indexOf("Marta (locked)")).toBeLessThan(
        texts.indexOf("Bob (open)"),
      );
    });
  });
});
