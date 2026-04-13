/**
 * Tests for task #143 — Build message compose UI
 *
 * Covers:
 *   - Student types a message and taps Send → submitted + input cleared
 *   - Student taps Send with empty input → blocked, inline hint shown
 *   - Send button disabled while submission is in-flight
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import React from "react";

// ── Router mock ───────────────────────────────────────────────────────────────

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ conversationId: "conv-1" }),
  useRouter: () => ({ back: jest.fn() }),
}));

// ── tRPC / query mock ─────────────────────────────────────────────────────────

const mockSendMessage = jest.fn();
let sendMessageCallbacks: { onSuccess?: () => void; onError?: (e: Error) => void } = {};

jest.mock("@/utils/trpc", () => ({
  trpc: {
    chat: {
      getMessages: {
        queryOptions: (_input: unknown, _opts: unknown) => ({
          queryKey: ["chat.getMessages"],
          queryFn: async () => ({ messages: [] }),
        }),
      },
      markRead: {
        mutationOptions: () => ({ mutationFn: jest.fn().mockResolvedValue({}) }),
      },
    },
    messaging: {
      sendMessage: {
        mutationOptions: (opts: { onSuccess?: () => void; onError?: (e: Error) => void }) => {
          sendMessageCallbacks = opts;
          return {
            mutationFn: mockSendMessage,
            onSuccess: opts?.onSuccess,
            onError: opts?.onError,
          };
        },
      },
      setPresence: {
        mutationOptions: () => ({ mutationFn: jest.fn().mockResolvedValue({ ok: true }) }),
      },
    },
  },
  queryClient: { invalidateQueries: jest.fn() },
}));

import ChatScreen from "../app/chat/[conversationId]";

function renderWithQuery(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  mockSendMessage.mockReset();
  sendMessageCallbacks = {};
});

// ── #143: Compose UI scenarios ────────────────────────────────────────────────

describe("#143 — Message compose UI", () => {
  it("submits message and clears input on success", async () => {
    mockSendMessage.mockResolvedValue({ id: "msg-1" });
    renderWithQuery(<ChatScreen />);

    const input = screen.getByTestId("message-input");
    fireEvent.changeText(input, "Hello!");
    fireEvent.press(screen.getByTestId("send-btn"));

    await waitFor(() => {
      expect(mockSendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ conversationId: "conv-1", content: "Hello!" }),
        expect.anything(),
      );
    });

    // Input cleared after success
    await waitFor(() => {
      expect(input.props.value).toBe("");
    });
  });

  it("blocks submission and shows hint when input is empty", () => {
    renderWithQuery(<ChatScreen />);

    fireEvent.press(screen.getByTestId("send-btn"));

    expect(mockSendMessage).not.toHaveBeenCalled();
    expect(screen.getByTestId("empty-hint")).toBeTruthy();
  });

  it("disables Send button while submission is in-flight", async () => {
    // Never resolves — keeps mutation pending
    mockSendMessage.mockReturnValue(new Promise(() => {}));
    renderWithQuery(<ChatScreen />);

    const input = screen.getByTestId("message-input");
    fireEvent.changeText(input, "Hi");
    fireEvent.press(screen.getByTestId("send-btn"));

    await waitFor(() => {
      const btn = screen.getByTestId("send-btn");
      expect(btn.props.accessibilityState?.disabled).toBe(true);
    });
  });
});
