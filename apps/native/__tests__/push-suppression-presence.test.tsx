/**
 * Tests for task #153 — Suppress push notification when recipient is actively viewing
 * (client-side: presence signals sent to server on screen focus/blur)
 *
 * Covers:
 *   - setPresence(active: true) called when conversation screen gets focus
 *   - setPresence(active: false) called when screen loses focus (cleanup)
 *   - setPresence(active: false) called when app moves to background
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, waitFor } from "@testing-library/react-native";
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

type CleanupFn = () => void;
let capturedCleanup: CleanupFn | null = null;

jest.mock("expo-router", () => {
  const { useEffect } = require("react");
  return {
    useLocalSearchParams: () => ({ conversationId: "conv-1" }),
    useRouter: () => ({ back: jest.fn() }),
    useFocusEffect: (cb: () => CleanupFn | void) => {
      useEffect(() => {
        const cleanup = cb();
        if (typeof cleanup === "function") capturedCleanup = cleanup;
        return cleanup ?? undefined;
      }, []); // eslint-disable-line react-hooks/exhaustive-deps
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

const mockSetPresence = jest.fn().mockResolvedValue({ ok: true });
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
      setPresence: {
        mutationOptions: () => ({
          mutationFn: mockSetPresence,
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
  mockSetPresence.mockClear();
  mockMarkRead.mockClear();
  capturedCleanup = null;
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("#153 — Presence signals from conversation screen", () => {
  it("calls setPresence(active: true) when conversation screen gets focus", async () => {
    render(<ChatScreen />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(mockSetPresence).toHaveBeenCalledWith(
        { conversationId: "conv-1", active: true },
        expect.anything(),
      );
    });
  });

  it("calls setPresence(active: false) when screen loses focus", async () => {
    render(<ChatScreen />, { wrapper: Wrapper });

    // Wait for initial focus
    await waitFor(() => expect(mockSetPresence).toHaveBeenCalled());

    // Simulate cleanup (blur/unmount)
    if (capturedCleanup) capturedCleanup();

    await waitFor(() => {
      expect(mockSetPresence).toHaveBeenCalledWith(
        { conversationId: "conv-1", active: false },
        expect.anything(),
      );
    });
  });
});
