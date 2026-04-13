/**
 * Tests for task #148 — Render read/unread status indicators on messages
 *
 * Covers:
 *   - Unread partner message shows unread indicator
 *   - Own messages never show unread indicator
 *   - Read partner message (isUnread: false) shows no indicator
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react-native";
import React from "react";

// ── FlatList mock ─────────────────────────────────────────────────────────────

jest.mock("react-native", () => {
  const RN = jest.requireActual("react-native");
  RN.FlatList = ({ data, renderItem, testID }: {
    data: unknown[];
    renderItem: ({ item, index }: { item: unknown; index: number }) => React.ReactNode;
    testID?: string;
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

// ── tRPC mock — mixed unread/read messages ────────────────────────────────────

jest.mock("@/utils/trpc", () => ({
  trpc: {
    chat: {
      getMessages: {
        queryOptions: (_input: unknown, _opts: unknown) => ({
          queryKey: ["chat.getMessages", "conv-1"],
          queryFn: async () => ({
            messages: [
              { id: "m1", senderId: "alice", content: "Hi Bob",  createdAt: new Date("2024-01-01T10:00:00Z"), isUnread: false }, // own
              { id: "m2", senderId: "bob",   content: "Hey!",    createdAt: new Date("2024-01-01T10:01:00Z"), isUnread: false }, // read partner
              { id: "m3", senderId: "bob",   content: "New msg", createdAt: new Date("2024-01-01T10:02:00Z"), isUnread: true  }, // unread partner
            ],
          }),
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

describe("#148 — Read/unread status indicators", () => {
  it("shows unread indicator only on the unread partner message", async () => {
    render(<ChatScreen />, { wrapper: Wrapper });
    await waitFor(() => {
      const indicators = screen.getAllByTestId("unread-indicator");
      expect(indicators).toHaveLength(1); // only m3 (isUnread: true)
    });
  });

  it("own messages do not show an unread indicator", async () => {
    render(<ChatScreen />, { wrapper: Wrapper });
    await waitFor(() => {
      const bubbles = screen.getAllByTestId("message-bubble");
      expect(bubbles).toHaveLength(3);
    });
    // Alice's own message (m1) has no unread indicator
    const indicators = screen.queryAllByTestId("unread-indicator");
    expect(indicators).toHaveLength(1); // only m3, not m1
  });

  it("read partner messages do not show an unread indicator", async () => {
    render(<ChatScreen />, { wrapper: Wrapper });
    await waitFor(() => {
      const bubbles = screen.getAllByTestId("message-bubble");
      expect(bubbles).toHaveLength(3);
    });
    // m2 is bob's but isUnread: false → no indicator for it
    const indicators = screen.queryAllByTestId("unread-indicator");
    expect(indicators).toHaveLength(1); // only m3
  });
});
