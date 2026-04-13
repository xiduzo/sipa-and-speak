/**
 * Tests for task #155 — Deep-link notification tap to the relevant conversation view
 *
 * Covers:
 *   - Background/foreground tap with message_received navigates to /chat/:conversationId
 *   - Cold-start tap navigates to /chat/:conversationId
 *   - Malformed payload (missing conversationId) is silently ignored
 */
import { act, renderHook } from "@testing-library/react-native";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
}));

let tapListener: ((response: unknown) => void) | null = null;
const mockRemove = jest.fn();
const mockGetLastNotificationResponseAsync = jest.fn();

jest.mock("expo-notifications", () => ({
  addNotificationResponseReceivedListener: jest.fn((cb) => {
    tapListener = cb;
    return { remove: mockRemove };
  }),
  getLastNotificationResponseAsync: (...args: unknown[]) =>
    mockGetLastNotificationResponseAsync(...args),
}));

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeNotificationResponse(data: Record<string, unknown>) {
  return {
    notification: {
      request: {
        content: { data },
      },
    },
  };
}

// ── Import after mocks ─────────────────────────────────────────────────────────
// eslint-disable-next-line import/first
import { useNotificationTapHandler } from "../hooks/use-notification-tap-handler";

beforeEach(() => {
  tapListener = null;
  mockPush.mockClear();
  mockRemove.mockClear();
  mockGetLastNotificationResponseAsync.mockResolvedValue(null);
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("#155 — Notification tap deep-links to conversation view", () => {
  it("navigates to /chat/:conversationId when message_received notification is tapped (background/foreground)", async () => {
    renderHook(() => useNotificationTapHandler());

    await act(async () => {
      tapListener?.(
        makeNotificationResponse({ type: "message_received", conversationId: "conv-123" }),
      );
    });

    expect(mockPush).toHaveBeenCalledWith("/chat/conv-123");
  });

  it("navigates to /chat/:conversationId on cold-start tap", async () => {
    mockGetLastNotificationResponseAsync.mockResolvedValue(
      makeNotificationResponse({ type: "message_received", conversationId: "conv-cold" }),
    );

    renderHook(() => useNotificationTapHandler());

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockPush).toHaveBeenCalledWith("/chat/conv-cold");
  });

  it("does not navigate when conversationId is missing from message_received payload", async () => {
    renderHook(() => useNotificationTapHandler());

    await act(async () => {
      tapListener?.(makeNotificationResponse({ type: "message_received" }));
    });

    expect(mockPush).not.toHaveBeenCalled();
  });
});
