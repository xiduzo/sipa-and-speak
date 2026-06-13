/**
 * Retargeted match-request coverage.
 *
 * The send / accept / decline flow used to live on the partner profile screen
 * (`app/partner/[id].tsx`) and was exercised by `partner-profile.test.tsx`.
 * It has since been refactored OUT of that screen into:
 *
 *   - `components/candidate-card.tsx` — the "Send Request" quick action on a
 *     suggestion card, with success + conflict feedback.
 *   - `app/(tabs)/matches.tsx` — the "Invitations received" section where a
 *     receiver accepts or declines an incoming request inline.
 *
 * These tests preserve the ORIGINAL product intent of scenarios
 * #120 / #122 / #123 / #124 (send) and #127 / #128 / #129 (accept / decline),
 * asserting against the components that now own each behavior.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import React from "react";

// ───────────────────────────────────────────────────────────────────────────
// Shared mocks
// ───────────────────────────────────────────────────────────────────────────

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

jest.mock("@/utils/language-flags", () => ({
  getLanguageFlag: () => "🏳",
  getLanguageCode: (l: string) => l,
  getNativeName: (l: string) => l,
}));

jest.mock("@/utils/interest-labels", () => ({
  interestLabel: (t: string) => t,
}));

const mockSendMatchRequest = jest.fn();
const mockAccept = jest.fn();
const mockDecline = jest.fn();
const mockGetMyMatches = jest.fn();
const mockGetIncoming = jest.fn();
const mockGetOutgoing = jest.fn();
const mockInvalidate = jest.fn();

jest.mock("@/utils/trpc", () => ({
  queryClient: { invalidateQueries: (...a: unknown[]) => mockInvalidate(...a) },
  trpc: {
    matching: {
      sendMatchRequest: {
        mutationOptions: () => ({ mutationFn: mockSendMatchRequest }),
      },
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
        mutationOptions: (o?: Record<string, unknown>) => ({ mutationFn: jest.fn(), ...(o ?? {}) }),
      },
    },
  },
}));

function makeClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

// Import components after the mocks are registered.
// eslint-disable-next-line import/first
import { CandidateCard } from "../components/candidate-card";
// eslint-disable-next-line import/first
import MatchesScreen from "../app/(tabs)/matches";

const candidateProps = {
  userId: "candidate-123",
  name: "Alice",
  image: null,
  spokenLanguages: [{ language: "Dutch", proficiency: "native" as const }],
  learningLanguages: ["English"],
  interests: ["tech_coding"],
};

function renderCard() {
  const client = makeClient();
  return render(
    <QueryClientProvider client={client}>
      <CandidateCard {...candidateProps} />
    </QueryClientProvider>,
  );
}

function renderMatches() {
  const client = makeClient();
  return render(
    <QueryClientProvider client={client}>
      <MatchesScreen />
    </QueryClientProvider>,
  );
}

const incoming = (id: string, name: string) => ({
  matchRequestId: id,
  requesterId: `req-${id}`,
  requesterName: name,
  requesterPhotoUrl: null,
  requesterOfferedLanguages: ["Spanish"],
  requesterTargetedLanguages: ["English"],
  createdAt: "2026-06-01T00:00:00.000Z",
});

beforeEach(() => {
  mockPush.mockClear();
  mockSendMatchRequest.mockReset().mockResolvedValue({ matchRequestId: "req-1", status: "pending" });
  mockAccept.mockClear().mockResolvedValue({ status: "accepted", matchedWithUserId: "requester-1" });
  mockDecline.mockClear().mockResolvedValue({ status: "declined" });
  mockInvalidate.mockClear();
  mockGetMyMatches.mockReset().mockResolvedValue([]);
  mockGetIncoming.mockReset().mockResolvedValue([]);
  mockGetOutgoing.mockReset().mockResolvedValue([]);
});

// ─── #122 / #120: Send Request action (relocated to CandidateCard) ──────────
//
// The "Send Request" action and its contextual states now live on the
// suggestion card. There is no per-candidate status query on the card any
// more — the button is always rendered initially and flips to a "Request Sent"
// confirmation state from the mutation result, which is the surviving form of
// scenario #120's "contextual based on match status".

describe("#122 / #120 — Send Request action (CandidateCard)", () => {
  it("renders a Send Request button when no request has been sent yet", () => {
    renderCard();
    expect(screen.getByTestId("send-request-button")).toBeTruthy();
    expect(screen.queryByText("Request Sent")).toBeNull();
  });

  it("calls sendMatchRequest with the candidate's userId when tapped", async () => {
    renderCard();

    fireEvent.press(screen.getByTestId("send-request-button"));

    await waitFor(() => {
      expect(mockSendMatchRequest).toHaveBeenCalledTimes(1);
    });
    expect(mockSendMatchRequest.mock.calls[0][0]).toEqual({ receiverId: "candidate-123" });
  });

  it("flips to a 'Request Sent' state after the request succeeds", async () => {
    renderCard();

    fireEvent.press(screen.getByTestId("send-request-button"));

    await waitFor(() => {
      expect(screen.getByText("Request Sent")).toBeTruthy();
    });
  });
});

// ─── #124: Confirmation feedback after sending (relocated to CandidateCard) ──

describe("#124 — Confirmation feedback after sending (CandidateCard)", () => {
  it("shows a confirmation message after successfully sending a request", async () => {
    renderCard();

    fireEvent.press(screen.getByTestId("send-request-button"));

    await waitFor(() => {
      expect(screen.getByTestId("confirmation-message")).toBeTruthy();
    });
  });

  it("disables the Send Request button after a successful send (no double-send)", async () => {
    renderCard();

    fireEvent.press(screen.getByTestId("send-request-button"));

    await waitFor(() => {
      expect(screen.getByTestId("confirmation-message")).toBeTruthy();
    });

    // A second tap must not fire another mutation.
    fireEvent.press(screen.getByTestId("send-request-button"));
    expect(mockSendMatchRequest).toHaveBeenCalledTimes(1);
  });
});

// ─── #123: Duplicate-request prevention (relocated to CandidateCard) ────────
//
// Server-side CONFLICT (a request already exists) surfaces an inline error on
// the card. The original "show Send Request again after a decline" sub-case
// relied on a per-candidate status query that no longer exists on the card,
// so that specific assertion is dropped (see report).

describe("#123 — Duplicate match-request prevention (CandidateCard)", () => {
  it("shows a conflict error message when the server reports CONFLICT", async () => {
    const conflictError = Object.assign(new Error("Conflict"), {
      data: { code: "CONFLICT" },
    });
    mockSendMatchRequest.mockRejectedValue(conflictError);

    renderCard();

    fireEvent.press(screen.getByTestId("send-request-button"));

    await waitFor(() => {
      expect(screen.getByTestId("conflict-error-message")).toBeTruthy();
    });
  });
});

// ─── #127: Receiver sees Accept/Decline on the incoming request ─────────────
//
// The accept/decline action bar now lives in the "Invitations received"
// section of the Matches tab, per incoming request. The receiver can still
// open the requester's profile from there before deciding.

describe("#127 — Accept/Decline actions on an incoming request (Matches tab)", () => {
  it("renders Accept and Decline actions for an incoming request", async () => {
    mockGetIncoming.mockResolvedValue([incoming("req-abc", "Cara")]);

    renderMatches();

    await waitFor(() => expect(screen.getByTestId("incoming-request-card")).toBeTruthy());
    expect(screen.getByTestId("accept-match-request")).toBeTruthy();
    expect(screen.getByTestId("decline-match-request")).toBeTruthy();
  });

  it("lets the receiver open the requester's profile before deciding", async () => {
    mockGetIncoming.mockResolvedValue([incoming("req-abc", "Cara")]);

    renderMatches();

    await waitFor(() => expect(screen.getByText("Cara")).toBeTruthy());

    fireEvent.press(screen.getByText("Cara"));

    expect(mockPush).toHaveBeenCalledWith(
      "/partner/req-req-abc?matchRequestId=req-abc",
    );
  });

  it("does not render Accept/Decline actions when there are no incoming requests", async () => {
    mockGetIncoming.mockResolvedValue([]);

    renderMatches();

    await waitFor(() => expect(screen.getByText(/No matches yet/i)).toBeTruthy());
    expect(screen.queryByTestId("incoming-request-card")).toBeNull();
    expect(screen.queryByTestId("accept-match-request")).toBeNull();
  });
});

// ─── #128: Accept action transitions both Students to Matched ───────────────

describe("#128 — Accept action transitioning both Students to Matched (Matches tab)", () => {
  it("calls acceptMatchRequest with the request id when Accept is tapped", async () => {
    mockGetIncoming.mockResolvedValue([incoming("req-abc", "Cara")]);

    renderMatches();

    await waitFor(() => expect(screen.getByTestId("accept-match-request")).toBeTruthy());
    fireEvent.press(screen.getByTestId("accept-match-request"));

    await waitFor(() => {
      expect(mockAccept).toHaveBeenCalledTimes(1);
    });
    // TanStack Query v5 calls mutationFn(variables, context) — assert variables only.
    expect(mockAccept.mock.calls[0]?.[0]).toEqual({ matchRequestId: "req-abc" });
  });

  it("invalidates the incoming requests query after accepting", async () => {
    mockGetIncoming.mockResolvedValue([incoming("req-abc", "Cara")]);

    renderMatches();

    await waitFor(() => expect(screen.getByTestId("accept-match-request")).toBeTruthy());
    fireEvent.press(screen.getByTestId("accept-match-request"));

    await waitFor(() => {
      expect(mockInvalidate).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ["matching.getIncomingRequests"] }),
      );
    });
  });
});

// ─── #129: Decline action removes the request ───────────────────────────────
//
// Decline no longer "navigates back" (that was the partner-screen flow); the
// action happens inline on the Matches tab and the declined request is removed
// from the list via query invalidation.

describe("#129 — Decline action removing the request (Matches tab)", () => {
  it("calls declineMatchRequest with the request id when Decline is tapped", async () => {
    mockGetIncoming.mockResolvedValue([incoming("req-abc", "Cara")]);

    renderMatches();

    await waitFor(() => expect(screen.getByTestId("decline-match-request")).toBeTruthy());
    fireEvent.press(screen.getByTestId("decline-match-request"));

    await waitFor(() => {
      expect(mockDecline).toHaveBeenCalledTimes(1);
    });
    expect(mockDecline.mock.calls[0]?.[0]).toEqual({ matchRequestId: "req-abc" });
  });

  it("invalidates the incoming requests query after declining (removes the request)", async () => {
    mockGetIncoming.mockResolvedValue([incoming("req-abc", "Cara")]);

    renderMatches();

    await waitFor(() => expect(screen.getByTestId("decline-match-request")).toBeTruthy());
    fireEvent.press(screen.getByTestId("decline-match-request"));

    await waitFor(() => {
      expect(mockInvalidate).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ["matching.getIncomingRequests"] }),
      );
    });
  });
});
