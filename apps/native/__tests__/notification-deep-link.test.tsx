/**
 * Tests for task #132 — Deep-link notification tap to requester's full profile
 *
 * Covers:
 *   - Background/foreground tap listener navigates to requester profile
 *   - Cold-start tap handler navigates to requester profile
 *   - Malformed payload (missing matchRequestId) is silently ignored
 *   - Listener is cleaned up on unmount
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

describe("#132 — Notification tap deep-links to requester profile", () => {
  it("navigates to requester profile when notification with matchRequestId is tapped (background/foreground)", async () => {
    renderHook(() => useNotificationTapHandler());

    await act(async () => {
      tapListener?.(
        makeNotificationResponse({ matchRequestId: "req-xyz", requesterId: "user-abc" }),
      );
    });

    expect(mockPush).toHaveBeenCalledWith("/partner/user-abc?matchRequestId=req-xyz");
  });

  it("navigates to requester profile on cold-start tap", async () => {
    mockGetLastNotificationResponseAsync.mockResolvedValue(
      makeNotificationResponse({ matchRequestId: "req-cold", requesterId: "user-cold" }),
    );

    renderHook(() => useNotificationTapHandler());

    // Wait for getLastNotificationResponseAsync promise to resolve
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockPush).toHaveBeenCalledWith("/partner/user-cold?matchRequestId=req-cold");
  });

  it("does not navigate when matchRequestId is missing from payload", async () => {
    renderHook(() => useNotificationTapHandler());

    await act(async () => {
      tapListener?.(makeNotificationResponse({ requesterId: "user-abc" }));
    });

    expect(mockPush).not.toHaveBeenCalled();
  });

  it("does not navigate when requesterId is missing from payload", async () => {
    renderHook(() => useNotificationTapHandler());

    await act(async () => {
      tapListener?.(makeNotificationResponse({ matchRequestId: "req-xyz" }));
    });

    expect(mockPush).not.toHaveBeenCalled();
  });

  it("removes the listener on unmount", () => {
    const { unmount } = renderHook(() => useNotificationTapHandler());
    unmount();
    expect(mockRemove).toHaveBeenCalled();
  });
});
