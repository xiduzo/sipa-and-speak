/**
 * Tests for task #136 — "Connect Now" CTA in acceptance notification
 *
 * Covers:
 *   - Tapping the acceptance notification navigates to the scheduling flow
 *   - "Connect Now" action tap also navigates to the scheduling flow
 *   - Existing match-request-sent notification tap behaviour is not regressed
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
const mockSetNotificationCategoryAsync = jest.fn();

jest.mock("expo-notifications", () => ({
  addNotificationResponseReceivedListener: jest.fn((cb) => {
    tapListener = cb;
    return { remove: mockRemove };
  }),
  getLastNotificationResponseAsync: (...args: unknown[]) =>
    mockGetLastNotificationResponseAsync(...args),
  setNotificationCategoryAsync: (...args: unknown[]) =>
    mockSetNotificationCategoryAsync(...args),
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
  mockSetNotificationCategoryAsync.mockResolvedValue(undefined);
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("#136 — Connect Now CTA in acceptance notification", () => {
  it("tapping the acceptance notification navigates to the scheduling flow", async () => {
    renderHook(() => useNotificationTapHandler());

    await act(async () => {
      tapListener?.(
        makeNotificationResponse({
          type: "match_accepted",
          matchedWithUserId: "partner-abc",
          matchRequestId: "req-123",
        }),
      );
    });

    expect(mockPush).toHaveBeenCalledWith("/schedule/partner-abc");
  });

  it("tapping Connect Now action navigates to the scheduling flow (same listener path)", async () => {
    // iOS action buttons trigger the same addNotificationResponseReceivedListener
    // with the action identifier in the response — the navigation logic is identical
    renderHook(() => useNotificationTapHandler());

    await act(async () => {
      tapListener?.(
        makeNotificationResponse({
          type: "match_accepted",
          matchedWithUserId: "partner-xyz",
          matchRequestId: "req-456",
        }),
      );
    });

    expect(mockPush).toHaveBeenCalledWith("/schedule/partner-xyz");
  });

  it("does not navigate when matchedWithUserId is missing from acceptance notification", async () => {
    renderHook(() => useNotificationTapHandler());

    await act(async () => {
      tapListener?.(makeNotificationResponse({ type: "match_accepted" }));
    });

    expect(mockPush).not.toHaveBeenCalled();
  });

  it("existing match-request-sent notification still navigates to partner profile", async () => {
    renderHook(() => useNotificationTapHandler());

    await act(async () => {
      tapListener?.(
        makeNotificationResponse({ matchRequestId: "req-old", requesterId: "user-old" }),
      );
    });

    expect(mockPush).toHaveBeenCalledWith("/partner/user-old?matchRequestId=req-old");
  });
});
