/**
 * Tests for task #149 — Mark messages as read when Student views the conversation
 *
 * Covers:
 *   - chat.markRead is called when the conversation screen mounts (focus)
 *   - Re-visiting the conversation calls markRead again
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

let capturedFocusEffect: (() => void) | null = null;

jest.mock("expo-router", () => {
  const { useEffect } = require("react");
  return {
    useLocalSearchParams: () => ({ conversationId: "conv-1" }),
    useRouter: () => ({ back: jest.fn() }),
    useFocusEffect: (cb: () => void) => {
      capturedFocusEffect = cb;
      // Only fire once on mount (simulates initial screen focus)
      useEffect(() => { cb(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
    },
  };
});

// ── Auth mock ─────────────────────────────────────────────────────────────────

jest.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => ({ data: { user: { id: "alice" } } }),
  },
}));

// ── tRPC mock ─────────────────────────────────────────────────────────────────

const mockMarkRead = jest.fn().mockResolvedValue({ lastReadAt: new Date() });

jest.mock("@/utils/trpc", () => ({
  trpc: {
    chat: {
      getMessages: {
        queryOptions: (_input: unknown, _opts: unknown) => ({
          queryKey: ["chat.getMessages", "conv-1"],
          queryFn: async () => ({ messages: [] }),
        }),
      },
      markRead: {
        mutationOptions: () => ({
          mutationFn: mockMarkRead,
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

beforeEach(() => {
  mockMarkRead.mockClear();
  capturedFocusEffect = null;
});

describe("#149 — Mark messages as read on view", () => {
  it("calls markRead when the conversation screen gets focus", async () => {
    render(<ChatScreen />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(mockMarkRead).toHaveBeenCalledWith(
        { conversationId: "conv-1" },
        expect.anything(),
      );
    });
  });

  it("calls markRead again when the Student re-focuses the screen", async () => {
    render(<ChatScreen />, { wrapper: Wrapper });

    // Initial focus
    await waitFor(() => expect(mockMarkRead).toHaveBeenCalledTimes(1));

    // Simulate re-focus
    if (capturedFocusEffect) capturedFocusEffect();

    await waitFor(() => expect(mockMarkRead).toHaveBeenCalledTimes(2));
  });
});
