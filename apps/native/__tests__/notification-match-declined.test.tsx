/**
 * Tests for task #137 — Suggestion list deep-link in decline notification
 *
 * Covers:
 *   - Tapping the decline notification navigates to the suggestion list screen
 *   - Decline notification tap on cold-start navigates to suggestion list
 *   - Existing notification types are not affected (no regression)
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

describe("#137 — Suggestion list deep-link in decline notification", () => {
  it("tapping the decline notification navigates to the suggestion list screen", async () => {
    renderHook(() => useNotificationTapHandler());

    await act(async () => {
      tapListener?.(
        makeNotificationResponse({
          type: "match_declined",
          matchRequestId: "req-789",
        }),
      );
    });

    expect(mockPush).toHaveBeenCalledWith("/suggestions");
  });

  it("cold-start tap on decline notification navigates to suggestion list", async () => {
    mockGetLastNotificationResponseAsync.mockResolvedValue(
      makeNotificationResponse({ type: "match_declined", matchRequestId: "req-cold" }),
    );

    renderHook(() => useNotificationTapHandler());

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockPush).toHaveBeenCalledWith("/suggestions");
  });

  it("acceptance notification tap still navigates to scheduling screen (no regression)", async () => {
    renderHook(() => useNotificationTapHandler());

    await act(async () => {
      tapListener?.(
        makeNotificationResponse({ type: "match_accepted", matchedWithUserId: "partner-abc" }),
      );
    });

    expect(mockPush).toHaveBeenCalledWith("/schedule/partner-abc");
  });
});
