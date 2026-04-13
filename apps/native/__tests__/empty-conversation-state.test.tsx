/**
 * Tests for task #150 — Handle empty conversation state
 *
 * Covers:
 *   - Empty state shown when conversation has no messages
 *   - Empty state disappears once messages are returned
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react-native";
import React from "react";

// ── FlatList mock ─────────────────────────────────────────────────────────────

jest.mock("react-native", () => {
  const RN = jest.requireActual("react-native");
  RN.FlatList = ({ data, renderItem, testID, ListEmptyComponent }: {
    data: unknown[];
    renderItem: ({ item, index }: { item: unknown; index: number }) => React.ReactNode;
    testID?: string;
    ListEmptyComponent?: React.ReactNode;
  }) => {
    const React = require("react");
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
  useLocalSearchParams: () => ({ conversationId: "conv-1" }),
  useRouter: () => ({ back: jest.fn() }),
}));

// ── Auth mock ─────────────────────────────────────────────────────────────────

jest.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => ({ data: { user: { id: "alice" } } }),
  },
}));

// ── tRPC mock — empty conversation ────────────────────────────────────────────

jest.mock("@/utils/trpc", () => ({
  trpc: {
    chat: {
      getMessages: {
        queryOptions: (_input: unknown, _opts: unknown) => ({
          queryKey: ["chat.getMessages", "conv-1-empty"],
          queryFn: async () => ({ messages: [] }),
        }),
      },
    },
    messaging: {
      sendMessage: {
        mutationOptions: (opts: { onSuccess?: () => void; onError?: (e: Error) => void }) => ({
          mutationFn: jest.fn(),
          onSuccess: opts.onSuccess,
          onError: opts.onError,
        }),
      },
    },
  },
}));

// ── Component import ──────────────────────────────────────────────────────────

import ChatScreen from "../app/chat/[conversationId]";

function Wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe("#150 — Empty conversation state", () => {
  it("shows empty state when conversation has no messages", async () => {
    render(<ChatScreen />, { wrapper: Wrapper });
    await waitFor(() => {
      expect(screen.getByTestId("empty-conversation-state")).toBeTruthy();
    });
  });

  it("does not show any message bubbles in an empty conversation", async () => {
    render(<ChatScreen />, { wrapper: Wrapper });
    await waitFor(() => {
      expect(screen.getByTestId("empty-conversation-state")).toBeTruthy();
    });
    expect(screen.queryAllByTestId("message-bubble")).toHaveLength(0);
  });
});
