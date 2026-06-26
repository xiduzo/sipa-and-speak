/**
 * Tests for the headless meetup-flow view-models (`hooks/use-meetup-flow.ts`).
 *
 * These drive the orchestration that used to be buried in `MeetupFlowModal` —
 * the submit guards, the mutation cascades (which queries invalidate, which
 * alert fires, dismiss vs. confirm), the decline branch on `canCounterPropose`,
 * and the counter pre-fill — through `renderHook`, with NO component rendered.
 * tRPC + `Alert` are mocked; React Query runs for real so the `onSuccess`
 * cascades actually execute.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import React from "react";
import { Alert } from "react-native";

import { toIsoDate } from "@/lib/dates";
import { timeFromDate } from "@/utils/meetup-flow";

// ── tRPC / query mock ───────────────────────────────────────────────────────

const mockPropose = jest.fn().mockResolvedValue({});
const mockAccept = jest.fn().mockResolvedValue({});
const mockCounter = jest.fn().mockResolvedValue({});
const mockDecline = jest.fn().mockResolvedValue({});
const mockReschedule = jest.fn().mockResolvedValue({});
const mockInvalidate = jest.fn();

const futureScheduledAt = new Date("2099-06-01T14:00:00Z");

// Mutated per-test to control what the pending-incoming query returns.
let mockProposal: Record<string, unknown> | null = null;

const sampleVenues = [
  { id: "venue-1", name: "Atlas", description: null },
  { id: "venue-2", name: "Metaforum", description: null },
];

// NOTE: jest hoists this factory above the `const mock* = jest.fn()` declarations,
// so every mock value MUST be read *lazily* — inside the returned arrows, which run
// at query/mutate time once the consts exist. Capturing a const eagerly (e.g.
// `mutationFn: mockAccept`) would freeze it at its still-`undefined` hoist-time value.
type MutOpts = { onSuccess?: () => void; onError?: (e: Error) => void };
const mut = (fn: () => jest.Mock) => ({
  mutationOptions: (opts?: MutOpts) => ({
    mutationFn: (vars: unknown) => fn()(vars),
    onSuccess: opts?.onSuccess,
    onError: opts?.onError,
  }),
});
const q = (key: string, get: () => unknown) => ({
  queryOptions: (..._args: unknown[]) => ({ queryKey: [key], queryFn: async () => get() }),
});

jest.mock("@/utils/trpc", () => ({
  trpc: {
    meetup: {
      getPendingIncoming: q("getPendingIncoming", () => mockProposal),
      getAvailableSlots: {
        queryOptions: (input?: { startIso?: string }) => ({
          queryKey: ["getAvailableSlots", input?.startIso ?? ""],
          queryFn: async () => [],
        }),
      },
      list: q("meetupList", () => []),
      pendingCount: q("pendingCount", () => 0),
      getConfirmed: q("getConfirmed", () => []),
      propose: mut(() => mockPropose),
      acceptProposal: mut(() => mockAccept),
      counterPropose: mut(() => mockCounter),
      declineProposal: mut(() => mockDecline),
      proposeReschedule: mut(() => mockReschedule),
    },
    venue: { listForPicker: q("venueListPicker", () => sampleVenues) },
    matching: { getMyMatches: q("getMyMatches", () => []) },
  },
  queryClient: { invalidateQueries: (...a: unknown[]) => mockInvalidate(...a) },
}));

// ── Import after mocks ──────────────────────────────────────────────────────
// eslint-disable-next-line import/first
import { useProposeFlow, useRespondFlow, useRescheduleFlow } from "@/hooks/use-meetup-flow";

const mockAlert = jest.fn();

function createWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

const defaultProposal = {
  meetupId: "meetup-1",
  round: 1,
  canCounterPropose: true,
  scheduledAt: futureScheduledAt,
  proposer: { id: "partner-1", name: "Alice" },
  venue: { id: "venue-1", name: "Atlas" },
};

type AlertButton = { text?: string; onPress?: () => void };

beforeEach(() => {
  jest.clearAllMocks();
  mockProposal = null;
  (Alert as unknown as { alert: jest.Mock }).alert = mockAlert;
});

// ── propose flow ────────────────────────────────────────────────────────────

describe("useProposeFlow", () => {
  const baseArgs = { partnerId: "partner-1", partnerName: "Alice", onDismiss: () => {} };

  it("blocks submit and surfaces an error when no venue is picked", () => {
    const { result } = renderHook(() => useProposeFlow(baseArgs), { wrapper: createWrapper() });
    act(() => result.current.submit());
    expect(result.current.error).toBe("Please pick a venue");
    expect(mockPropose).not.toHaveBeenCalled();
  });

  it("submits the default suggested time and runs the success cascade", async () => {
    const onDismiss = jest.fn();
    const { result } = renderHook(
      () => useProposeFlow({ ...baseArgs, onDismiss }),
      { wrapper: createWrapper() },
    );
    act(() => result.current.selectVenue("venue-1"));
    await act(async () => {
      result.current.submit();
    });

    await waitFor(() => expect(mockPropose).toHaveBeenCalledTimes(1));
    const arg = mockPropose.mock.calls[0][0] as {
      partnerId: string;
      venueId: string;
      scheduledAt: string;
    };
    expect(arg.partnerId).toBe("partner-1");
    expect(arg.venueId).toBe("venue-1");
    expect(new Date(arg.scheduledAt).getTime()).toBeGreaterThan(Date.now());

    await waitFor(() => expect(mockAlert).toHaveBeenCalled());
    expect(mockAlert.mock.calls[0][0]).toBe("Proposal sent!");
    expect(mockInvalidate).toHaveBeenCalled();
  });

  it("errors in custom mode when no date/time is entered", () => {
    const { result } = renderHook(() => useProposeFlow(baseArgs), { wrapper: createWrapper() });
    act(() => result.current.toggleCustomMode());
    act(() => result.current.selectVenue("venue-1"));
    act(() => result.current.submit());
    expect(result.current.error).toBe("Please pick a date and time (HH:MM)");
    expect(mockPropose).not.toHaveBeenCalled();
  });
});

// ── respond / counter flow ──────────────────────────────────────────────────

describe("useRespondFlow", () => {
  async function renderRespond(onDismiss = jest.fn()) {
    const utils = renderHook(() => useRespondFlow({ onDismiss }), { wrapper: createWrapper() });
    await waitFor(() => expect(utils.result.current.hasProposal).toBe(true));
    return utils;
  }

  it("exposes the loaded proposal", async () => {
    mockProposal = { ...defaultProposal };
    const { result } = await renderRespond();
    expect(result.current.proposal?.proposer.name).toBe("Alice");
    expect(result.current.proposal?.round).toBe(1);
  });

  it("startCounter pre-fills venue, date and time from the proposal", async () => {
    mockProposal = { ...defaultProposal };
    const { result } = await renderRespond();
    act(() => result.current.startCounter());
    expect(result.current.counterMode).toBe(true);
    expect(result.current.selectedVenueId).toBe("venue-1");
    expect(result.current.date).toBe(toIsoDate(futureScheduledAt));
    expect(result.current.time).toBe(timeFromDate(futureScheduledAt));
  });

  it("accept stores the confirmation and does not dismiss", async () => {
    mockProposal = { ...defaultProposal };
    const onDismiss = jest.fn();
    const { result } = await renderRespond(onDismiss);
    await act(async () => {
      result.current.accept();
    });
    await waitFor(() => expect(mockAccept).toHaveBeenCalledWith({ meetupId: "meetup-1" }));
    await waitFor(() => expect(result.current.confirmed).not.toBeNull());
    expect(result.current.confirmed?.venueName).toBe("Atlas");
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("decline with no counter option fires the 'No match found' alert", async () => {
    mockProposal = { ...defaultProposal, canCounterPropose: false };
    const onDismiss = jest.fn();
    const { result } = await renderRespond(onDismiss);

    act(() => result.current.decline());
    const buttons = mockAlert.mock.calls[0][2] as AlertButton[];
    const declineBtn = buttons.find((b) => b.text === "Decline");
    await act(async () => {
      declineBtn?.onPress?.();
    });

    await waitFor(() => expect(mockDecline).toHaveBeenCalledWith({ meetupId: "meetup-1" }));
    await waitFor(() => expect(mockAlert.mock.calls.length).toBeGreaterThanOrEqual(2));
    expect(mockAlert.mock.calls[1][0]).toBe("No match found");
    // Here onDismiss is wired to the alert's OK button (not called directly).
    const okBtn = (mockAlert.mock.calls[1][2] as AlertButton[]).find((b) => b.text === "OK");
    act(() => okBtn?.onPress?.());
    expect(onDismiss).toHaveBeenCalled();
  });

  it("decline with a counter option fires the 'Proposal declined' alert and dismisses", async () => {
    mockProposal = { ...defaultProposal, canCounterPropose: true };
    const onDismiss = jest.fn();
    const { result } = await renderRespond(onDismiss);

    act(() => result.current.decline());
    const buttons = mockAlert.mock.calls[0][2] as AlertButton[];
    const declineBtn = buttons.find((b) => b.text === "Decline");
    await act(async () => {
      declineBtn?.onPress?.();
    });

    await waitFor(() => expect(mockDecline).toHaveBeenCalled());
    await waitFor(() =>
      expect(mockAlert.mock.calls.some((c) => c[0] === "Proposal declined")).toBe(true),
    );
    expect(onDismiss).toHaveBeenCalled();
  });
});

// ── reschedule flow ──────────────────────────────────────────────────────────

describe("useRescheduleFlow", () => {
  it("submits the reschedule and runs the success cascade", async () => {
    const onDismiss = jest.fn();
    const { result } = renderHook(
      () =>
        useRescheduleFlow({
          meetupId: "m1",
          currentVenueId: "venue-1",
          currentScheduledAt: futureScheduledAt,
          onDismiss,
        }),
      { wrapper: createWrapper() },
    );

    await act(async () => {
      result.current.submit();
    });

    await waitFor(() => expect(mockReschedule).toHaveBeenCalledTimes(1));
    const arg = mockReschedule.mock.calls[0][0] as { meetupId: string; venueId: string };
    expect(arg.meetupId).toBe("m1");
    expect(arg.venueId).toBe("venue-1");
    await waitFor(() =>
      expect(mockAlert.mock.calls.some((c) => c[0] === "Reschedule proposed")).toBe(true),
    );
    expect(mockInvalidate).toHaveBeenCalled();
  });

  it("blocks submit when no venue is set", () => {
    const { result } = renderHook(
      () =>
        useRescheduleFlow({
          meetupId: "m1",
          currentVenueId: "",
          currentScheduledAt: futureScheduledAt,
          onDismiss: () => {},
        }),
      { wrapper: createWrapper() },
    );
    act(() => result.current.submit());
    expect(result.current.error).toBe("Please select a location");
    expect(mockReschedule).not.toHaveBeenCalled();
  });
});
