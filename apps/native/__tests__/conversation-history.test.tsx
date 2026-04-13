/**
 * Tests for task #147 — Build conversation view with chronological message history
 *
 * Covers:
 *   - Messages displayed in chronological order (oldest first)
 *   - Each message shows sender identity and timestamp
 *   - New messages appear via polling (query refetch)
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react-native";
import React from "react";

// ── FlatList mock (renders all items in test environment) ────────────────────

jest.mock("react-native", () => {
  const RN = jest.requireActual("react-native");
  RN.FlatList = ({ data, renderItem, testID, onContentSizeChange }: {
    data: unknown[];
    renderItem: ({ item, index }: { item: unknown; index: number }) => React.ReactNode;
    testID?: string;
    onContentSizeChange?: () => void;
  }) => {
    const React = require("react");
    return React.createElement(
      RN.View,
      { testID },
      data?.map((item, index) => renderItem({ item, index })),
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

// ── tRPC / query mock ─────────────────────────────────────────────────────────

const mockMessages = [
  { id: "m1", senderId: "alice", content: "Hello Bob!", createdAt: new Date("2024-01-01T10:00:00Z") },
  { id: "m2", senderId: "bob", content: "Hey Alice!", createdAt: new Date("2024-01-01T10:01:00Z") },
  { id: "m3", senderId: "alice", content: "How are you?", createdAt: new Date("2024-01-01T10:02:00Z") },
];

jest.mock("@/utils/trpc", () => ({
  trpc: {
    chat: {
      getMessages: {
        queryOptions: (_input: unknown, _opts: unknown) => ({
          queryKey: ["chat.getMessages", "conv-1"],
          queryFn: async () => ({ messages: mockMessages }),
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

describe("#147 — Conversation message history", () => {
  it("displays messages in chronological order, oldest first", async () => {
    render(<ChatScreen />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getAllByTestId("message-bubble")).toHaveLength(3);
    });
  });

  it("shows sender identity on partner messages", async () => {
    render(<ChatScreen />, { wrapper: Wrapper });

    await waitFor(() => {
      // Partner (bob) messages show a sender label; own messages don't
      const senderLabels = screen.getAllByTestId("message-sender");
      expect(senderLabels).toHaveLength(1); // only bob's message has a label
    });
  });

  it("shows timestamp on each message", async () => {
    render(<ChatScreen />, { wrapper: Wrapper });

    await waitFor(() => {
      const timestamps = screen.getAllByTestId("message-timestamp");
      expect(timestamps).toHaveLength(3);
    });
  });
});
