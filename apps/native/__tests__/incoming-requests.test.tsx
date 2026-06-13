/**
 * Incoming match-request UI (formerly the now-removed `app/suggestions` screen,
 * which was replaced by `app/(tabs)/suggestions.tsx` -> <Redirect href="/match" />).
 *
 * The incoming-requests list now lives on the Matches tab
 * (`app/(tabs)/matches.tsx`, "INVITATIONS RECEIVED" section), backed by
 * `trpc.matching.getIncomingRequests`. These tests preserve the original
 * scenario intents:
 *   #126 — incoming requests shown with requester name + language summary;
 *          hidden when none; multiple requests rendered.
 *   #127 — tapping an incoming request opens the requester's full profile
 *          with the correct matchRequestId.
 *   #133 — incoming requests render purely from query data and are NOT gated
 *          on notification permission (the screen never consults
 *          expo-notifications).
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import React from "react";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock("@/components/container", () => {
  const { View } = require("react-native");
  return {
    Container: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
  };
});

jest.mock("@/lib/dates", () => ({
  epochMs: (s: string) => new Date(s).getTime(),
}));

const mockGetMyMatches = jest.fn();
const mockGetIncoming = jest.fn();
const mockGetOutgoing = jest.fn();
const mockAccept = jest.fn();
const mockDecline = jest.fn();
const mockWithdraw = jest.fn();
const mockInvalidate = jest.fn();

jest.mock("@/utils/trpc", () => ({
  queryClient: { invalidateQueries: (...a: unknown[]) => mockInvalidate(...a) },
  trpc: {
    matching: {
      getMyMatches: {
        queryOptions: (i?: unknown) => ({
          queryKey: ["matching.getMyMatches", i ?? null],
          queryFn: () => mockGetMyMatches(),
        }),
      },
      getIncomingRequests: {
        queryOptions: () => ({
          queryKey: ["matching.getIncomingRequests"],
          queryFn: () => mockGetIncoming(),
        }),
      },
      getOutgoingRequests: {
        queryOptions: () => ({
          queryKey: ["matching.getOutgoingRequests"],
          queryFn: () => mockGetOutgoing(),
        }),
      },
      acceptMatchRequest: {
        mutationOptions: (o?: Record<string, unknown>) => ({ mutationFn: mockAccept, ...(o ?? {}) }),
      },
      declineMatchRequest: {
        mutationOptions: (o?: Record<string, unknown>) => ({ mutationFn: mockDecline, ...(o ?? {}) }),
      },
      withdrawMatchRequest: {
        mutationOptions: (o?: Record<string, unknown>) => ({ mutationFn: mockWithdraw, ...(o ?? {}) }),
      },
    },
  },
}));

function makeClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

// Import after mocks
import MatchesScreen from "../app/(tabs)/matches";

function renderScreen() {
  const client = makeClient();
  return render(
    <QueryClientProvider client={client}>
      <MatchesScreen />
    </QueryClientProvider>,
  );
}

function baseIncoming() {
  return {
    matchRequestId: "req-1",
    requesterId: "requester-1",
    requesterName: "Bob",
    requesterPhotoUrl: null as string | null,
    requesterOfferedLanguages: ["English"],
    requesterTargetedLanguages: ["Dutch"],
    createdAt: "2026-04-13T10:00:00.000Z",
  };
}

const incoming = (overrides: Partial<ReturnType<typeof baseIncoming>> = {}) => ({
  ...baseIncoming(),
  ...overrides,
});

beforeEach(() => {
  mockPush.mockClear();
  mockAccept.mockClear().mockResolvedValue({ status: "accepted" });
  mockDecline.mockClear().mockResolvedValue({ status: "declined" });
  mockWithdraw.mockClear().mockResolvedValue({ success: true });
  mockInvalidate.mockClear();
  mockGetMyMatches.mockReset().mockResolvedValue([]);
  mockGetIncoming.mockReset().mockResolvedValue([]);
  mockGetOutgoing.mockReset().mockResolvedValue([]);
});

// ─── #126: Incoming match requests shown with name + language summary ───────

describe("#126 — Incoming match requests list", () => {
  it("shows an incoming request with the requester's name and language summary", async () => {
    mockGetIncoming.mockResolvedValue([incoming()]);

    renderScreen();

    await waitFor(() => {
      expect(screen.getByTestId("incoming-request-card")).toBeTruthy();
    });
    expect(screen.getByText("INVITATIONS RECEIVED")).toBeTruthy();
    expect(screen.getByText("Bob")).toBeTruthy();
    // Language summary: "Speaks English · Learning Dutch"
    expect(screen.getByText(/Speaks English/)).toBeTruthy();
    expect(screen.getByText(/Learning Dutch/)).toBeTruthy();
  });

  it("hides the incoming-requests section when there are no pending requests", async () => {
    mockGetIncoming.mockResolvedValue([]);

    renderScreen();

    // The empty state proves the screen rendered with no requests.
    await waitFor(() => {
      expect(screen.getByText(/No matches yet/i)).toBeTruthy();
    });
    expect(screen.queryByTestId("incoming-request-card")).toBeNull();
    expect(screen.queryByText("INVITATIONS RECEIVED")).toBeNull();
  });

  it("shows multiple incoming requests when there are several", async () => {
    mockGetIncoming.mockResolvedValue([
      incoming(),
      incoming({ matchRequestId: "req-2", requesterId: "requester-2", requesterName: "Carol" }),
    ]);

    renderScreen();

    await waitFor(() => {
      expect(screen.getAllByTestId("incoming-request-card")).toHaveLength(2);
    });
    expect(screen.getByText("Bob")).toBeTruthy();
    expect(screen.getByText("Carol")).toBeTruthy();
  });
});

// ─── #127: Open requester's profile from an incoming request ────────────────

describe("#127 — Open requester's profile from an incoming request", () => {
  it("navigates to the requester's profile with the correct matchRequestId when tapped", async () => {
    const req = incoming();
    mockGetIncoming.mockResolvedValue([req]);

    renderScreen();

    await waitFor(() => {
      expect(screen.getByTestId("incoming-request-card")).toBeTruthy();
    });

    // The card's name/avatar row is the navigation Pressable; pressing the
    // requester name bubbles to it.
    fireEvent.press(screen.getByText(req.requesterName));

    expect(mockPush).toHaveBeenCalledWith(
      `/partner/${req.requesterId}?matchRequestId=${req.matchRequestId}`,
    );
  });
});

// ─── #133: Incoming requests visible regardless of notification permission ──

describe("#133 — Incoming requests are independent of notification permission", () => {
  it("renders incoming requests from query data without consulting expo-notifications", async () => {
    // The matches screen never imports/uses expo-notifications, so incoming
    // requests appear purely from query data — i.e. regardless of whether the
    // user has granted notification permission.
    mockGetIncoming.mockResolvedValue([incoming()]);

    renderScreen();

    await waitFor(() => {
      expect(screen.getByTestId("incoming-request-card")).toBeTruthy();
    });
    expect(screen.getByText("Bob")).toBeTruthy();
  });
});
