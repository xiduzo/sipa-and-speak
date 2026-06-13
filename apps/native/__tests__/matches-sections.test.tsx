/**
 * Tests for the restructured Matches tab (#9):
 *   - "Invitations sent" section with a Withdraw action (#8)
 *   - "Invitations received" section (relabelled)
 *   - "Schedule a new moment" action in the matches section
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

import MatchesScreen from "../app/(tabs)/matches";

function renderScreen() {
  const client = makeClient();
  return render(
    <QueryClientProvider client={client}>
      <MatchesScreen />
    </QueryClientProvider>,
  );
}

const outgoing = (id: string, name: string) => ({
  matchRequestId: id,
  receiverId: `recv-${id}`,
  receiverName: name,
  receiverPhotoUrl: null,
  receiverOfferedLanguages: ["Dutch"],
  receiverTargetedLanguages: ["English"],
  createdAt: "2026-06-01T00:00:00.000Z",
});

const incoming = (id: string, name: string) => ({
  matchRequestId: id,
  requesterId: `req-${id}`,
  requesterName: name,
  requesterPhotoUrl: null,
  requesterOfferedLanguages: ["Spanish"],
  requesterTargetedLanguages: ["English"],
  createdAt: "2026-06-01T00:00:00.000Z",
});

const match = (id: string, name: string) => ({
  matchId: id,
  partnerId: `p-${id}`,
  partnerName: name,
  partnerPhotoUrl: null,
  matchedAt: new Date().toISOString(),
});

beforeEach(() => {
  mockPush.mockClear();
  mockWithdraw.mockClear().mockResolvedValue({ success: true });
  mockAccept.mockClear().mockResolvedValue({ status: "accepted" });
  mockDecline.mockClear().mockResolvedValue({ status: "declined" });
  mockInvalidate.mockClear();
  mockGetMyMatches.mockReset().mockResolvedValue([]);
  mockGetIncoming.mockReset().mockResolvedValue([]);
  mockGetOutgoing.mockReset().mockResolvedValue([]);
});

describe("#9 — Invitations sent section", () => {
  it("renders sent invitations and withdraws one", async () => {
    mockGetOutgoing.mockResolvedValue([outgoing("o1", "Bob")]);

    renderScreen();

    await waitFor(() => expect(screen.getByText("INVITATIONS SENT")).toBeTruthy());
    expect(screen.getByTestId("outgoing-request-card")).toBeTruthy();
    expect(screen.getByText("Bob")).toBeTruthy();

    fireEvent.press(screen.getByTestId("withdraw-match-request"));

    await waitFor(() => expect(mockWithdraw).toHaveBeenCalled());
    // TanStack Query v5 calls mutationFn(variables, context) — assert variables only.
    expect(mockWithdraw.mock.calls[0]?.[0]).toEqual({ matchRequestId: "o1" });
  });
});

describe("#9 — Invitations received section", () => {
  it("uses the 'INVITATIONS RECEIVED' label", async () => {
    mockGetIncoming.mockResolvedValue([incoming("i1", "Cara")]);

    renderScreen();

    await waitFor(() => expect(screen.getByText("INVITATIONS RECEIVED")).toBeTruthy());
    expect(screen.getByText("Cara")).toBeTruthy();
  });
});

describe("#9 — Schedule a new moment", () => {
  it("surfaces the existing matches list instead of routing to discover (#373)", async () => {
    mockGetMyMatches.mockResolvedValue([match("m1", "Dee")]);

    renderScreen();

    await waitFor(() => expect(screen.getByTestId("schedule-new-moment")).toBeTruthy());

    // The existing matches listing is rendered on the same screen.
    expect(screen.getByTestId("matched-partner-card")).toBeTruthy();

    fireEvent.press(screen.getByTestId("schedule-new-moment"));

    // It must NOT route to the discover deck — scheduling is done with an
    // existing match, opened from the listing below the button.
    expect(mockPush).not.toHaveBeenCalledWith("/match");
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("opens an existing match's profile to start the propose-meetup flow", async () => {
    mockGetMyMatches.mockResolvedValue([match("m1", "Dee")]);

    renderScreen();

    await waitFor(() => expect(screen.getByTestId("matched-partner-card")).toBeTruthy());

    fireEvent.press(screen.getByTestId("matched-partner-card"));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/partner/[id]",
      params: { id: "p-m1" },
    });
  });

  it("hides the action when there are no matches", async () => {
    mockGetOutgoing.mockResolvedValue([outgoing("o1", "Bob")]);

    renderScreen();

    await waitFor(() => expect(screen.getByText("INVITATIONS SENT")).toBeTruthy());
    expect(screen.queryByTestId("schedule-new-moment")).toBeNull();
  });
});

describe("#9 — empty state", () => {
  it("shows the empty state when nothing is present", async () => {
    renderScreen();

    await waitFor(() => expect(screen.getByText(/No matches yet/i)).toBeTruthy());
  });
});
