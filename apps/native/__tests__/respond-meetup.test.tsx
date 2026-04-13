/**
 * Tests for task #71 — Build proposal response UI (accept / counter-propose / decline)
 * Tests for task #73 — Enforce max 3 counter-proposal rounds — remove counter option at round 3
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import React from "react";

// ── Router mock ───────────────────────────────────────────────────────────────

const mockBack = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ back: mockBack }),
  useLocalSearchParams: () => ({}),
}));

// ── tRPC / query mock ─────────────────────────────────────────────────────────

const mockAccept = jest.fn().mockResolvedValue({ id: "m-1", status: "confirmed" });
const mockCounter = jest.fn().mockResolvedValue({ id: "m-1" });
const mockDecline = jest.fn().mockResolvedValue({ id: "m-1", status: "declined" });
const mockInvalidate = jest.fn();

const baseProposal = {
  meetupId: "meetup-1",
  round: 1,
  canCounterPropose: true,
  venue: { id: "v-1", name: "Atlas Building", description: null, photoUrl: null },
  date: "2026-06-01",
  time: "14:00",
  proposer: { id: "proposer-1", name: "Alice", image: null },
};

let mockProposalData: typeof baseProposal | null = baseProposal;

jest.mock("@/utils/trpc", () => ({
  trpc: {
    meetup: {
      getPendingIncoming: {
        queryOptions: () => ({ queryKey: ["getPendingIncoming"], queryFn: async () => mockProposalData }),
      },
      acceptProposal: {
        mutationOptions: (opts: { onSuccess?: () => void; onError?: (e: Error) => void }) => ({
          mutationFn: mockAccept,
          onSuccess: opts.onSuccess,
          onError: opts.onError,
        }),
      },
      counterPropose: {
        mutationOptions: (opts: { onSuccess?: () => void; onError?: (e: Error) => void }) => ({
          mutationFn: mockCounter,
          onSuccess: opts.onSuccess,
          onError: opts.onError,
        }),
      },
      declineProposal: {
        mutationOptions: (opts: { onSuccess?: () => void; onError?: (e: Error) => void }) => ({
          mutationFn: mockDecline,
          onSuccess: opts.onSuccess,
          onError: opts.onError,
        }),
      },
      list: { queryOptions: () => ({ queryKey: ["list"] }) },
      pendingCount: { queryOptions: () => ({ queryKey: ["pendingCount"] }) },
      getAvailableSlots: {
        queryOptions: () => ({ queryKey: ["slots"], queryFn: async () => [] }),
      },
    },
    venue: {
      listForPicker: {
        queryOptions: () => ({
          queryKey: ["venues"],
          queryFn: async () => [{ id: "v-1", name: "Atlas Building", description: null }],
        }),
      },
    },
  },
  queryClient: { invalidateQueries: mockInvalidate },
}));

import RespondMeetupScreen from "../app/respond-meetup";

function renderWithQuery(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  mockBack.mockClear();
  mockAccept.mockClear();
  mockCounter.mockClear();
  mockDecline.mockClear();
  mockInvalidate.mockClear();
  mockProposalData = { ...baseProposal, round: 1, canCounterPropose: true };
});

// ─── Task #71: proposal details displayed ─────────────────────────────────────

describe("#71 — Proposal response UI", () => {
  it("displays the proposed location, date/time, and round number", async () => {
    renderWithQuery(<RespondMeetupScreen />);

    await waitFor(() => {
      expect(screen.getByTestId("round-label")).toBeTruthy();
      expect(screen.getByTestId("proposal-venue")).toBeTruthy();
      expect(screen.getByTestId("proposal-date")).toBeTruthy();
      expect(screen.getByTestId("proposal-time")).toBeTruthy();
    });

    const roundChildren = screen.getByTestId("round-label").props.children;
    const roundText = Array.isArray(roundChildren) ? roundChildren.join("") : String(roundChildren);
    expect(roundText).toContain("Round 1");
    expect(screen.getByTestId("proposal-venue").props.children).toBe("Atlas Building");
    expect(screen.getByTestId("proposal-date").props.children).toBe("2026-06-01");
    expect(screen.getByTestId("proposal-time").props.children).toBe("14:00");
  });

  it("shows Accept, Counter-propose, and Decline actions at round 1", async () => {
    renderWithQuery(<RespondMeetupScreen />);

    await waitFor(() => {
      expect(screen.getByTestId("accept-btn")).toBeTruthy();
      expect(screen.getByTestId("counter-propose-btn")).toBeTruthy();
      expect(screen.getByTestId("decline-btn")).toBeTruthy();
    });
  });

  it("shows empty state when there is no incoming proposal", async () => {
    mockProposalData = null;
    renderWithQuery(<RespondMeetupScreen />);

    await waitFor(() => {
      expect(screen.getByTestId("no-proposal-state")).toBeTruthy();
    });
  });
});

// ─── Task #73: round 3 hides counter-propose ──────────────────────────────────

describe("#73 — Round enforcement in UI", () => {
  it("hides Counter-propose action at round 3", async () => {
    mockProposalData = { ...baseProposal, round: 3, canCounterPropose: false };

    renderWithQuery(<RespondMeetupScreen />);

    await waitFor(() => {
      expect(screen.getByTestId("accept-btn")).toBeTruthy();
    });

    expect(screen.queryByTestId("counter-propose-btn")).toBeNull();
    expect(screen.getByTestId("decline-btn")).toBeTruthy();
  });

  it("shows Counter-propose action at round 2", async () => {
    mockProposalData = { ...baseProposal, round: 2, canCounterPropose: true };

    renderWithQuery(<RespondMeetupScreen />);

    await waitFor(() => {
      expect(screen.getByTestId("counter-propose-btn")).toBeTruthy();
    });
  });
});
