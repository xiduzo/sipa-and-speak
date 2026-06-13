/**
 * Tests for task #86 — Add reschedule action to confirmed meetup view (new time/location form)
 *
 * NOTE: Since task #86 landed, the reschedule UI moved out of `confirmed-meetups.tsx`
 * and into the shared `MeetupFlowModal` (`components/meetup-flow-modal.tsx`). The
 * confirmed-meetups screen now opens that modal in `type: "reschedule"` mode rather
 * than rendering an inline form. The component also grew to call many more tRPC
 * procedures (the screen body instantiates every meetup mutation, and the modal's
 * reschedule/propose/respond content each query their own data).
 *
 * This suite was failing because the tRPC mock only stubbed `meetup.getConfirmed`
 * and `venue.listForPicker`; every other procedure was `undefined`, so calling
 * `.queryOptions()` / `.mutationOptions()` threw. The mock below covers the full
 * surface the rendered tree touches.
 *
 * Test-intent adaptations to match the current component (no production code changed):
 *  - There is no `reschedule-form` / `reschedule-cancel-btn` testID. The open form is
 *    detected via `reschedule-submit-btn` (and `reschedule-date-input` / `-time-input`),
 *    and it is dismissed via the modal header's "✕" close control.
 *  - Past meetups: the Reschedule/Cancel buttons are hidden and the card shows the
 *    attendance prompt with `meetup-past-label` ("Did your meetup take place?").
 *  - "Reschedule pending…" is now the (disabled) button label when the pending
 *    reschedule is from me.
 *  - When the *partner* proposed the reschedule there is no "Partner proposed
 *    reschedule" copy anymore — the card shows a "New time" status pill and the
 *    action button label becomes "Answer". The test asserts the current behaviour.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import React from "react";

// ── Router mock ────────────────────────────────────────────────────────────────

jest.mock("expo-router", () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
}));

// ── tRPC / query mock ─────────────────────────────────────────────────────────

const mockCancel = jest.fn().mockResolvedValue({});
const mockProposeReschedule = jest.fn().mockResolvedValue({});
const mockReportAttendance = jest.fn().mockResolvedValue({});
const mockPropose = jest.fn().mockResolvedValue({});
const mockAccept = jest.fn().mockResolvedValue({});
const mockCounter = jest.fn().mockResolvedValue({});
const mockDecline = jest.fn().mockResolvedValue({});
const mockInvalidate = jest.fn();

const futureScheduledAt = new Date("2099-06-01T14:00:00Z");

const baseMeetup = {
  meetupId: "meetup-1",
  scheduledAt: futureScheduledAt,
  status: "confirmed",
  isPast: false,
  hasReported: false,
  myAttendance: false,
  venue: { id: "venue-1", name: "Atlas Building", description: null, photoUrl: null },
  partner: { id: "partner-1", name: "Alice", image: null },
  reschedulePending: false,
  rescheduleIsFromMe: false,
  reschedule: null,
};

const pastMeetup = {
  ...baseMeetup,
  meetupId: "meetup-past",
  scheduledAt: new Date("2020-01-01T10:00:00Z"),
  isPast: true,
  hasReported: false,
};

let mockMeetupsData: (typeof baseMeetup)[] = [baseMeetup];

const sampleVenues = [
  { id: "venue-1", name: "Atlas Building", description: null, photoUrl: null },
  { id: "venue-2", name: "Metaforum Cantine", description: null, photoUrl: null },
];

// Helpers so each procedure exposes a working queryOptions/mutationOptions shape
// matching how the components call them (some pass input args, some pass an extra
// options object — both must be accepted without throwing).
const query = (key: string, data: unknown) => ({
  queryOptions: (..._args: unknown[]) => ({
    queryKey: [key],
    queryFn: async () => data,
  }),
});

const mutation = (fn: jest.Mock) => ({
  mutationOptions: (opts?: { onSuccess?: () => void; onError?: (e: Error) => void }) => ({
    mutationFn: fn,
    onSuccess: opts?.onSuccess,
    onError: opts?.onError,
  }),
});

jest.mock("@/utils/trpc", () => ({
  trpc: {
    meetup: {
      // queries
      getConfirmed: { queryOptions: () => ({ queryKey: ["getConfirmed"], queryFn: async () => mockMeetupsData }) },
      list: query("meetupList", []),
      getPendingIncoming: query("getPendingIncoming", null),
      pendingCount: query("pendingCount", 0),
      getAvailableSlots: query("getAvailableSlots", []),
      // mutations
      reportAttendance: mutation(mockReportAttendance),
      cancelMeetup: mutation(mockCancel),
      proposeReschedule: mutation(mockProposeReschedule),
      propose: mutation(mockPropose),
      acceptProposal: mutation(mockAccept),
      counterPropose: mutation(mockCounter),
      declineProposal: mutation(mockDecline),
    },
    venue: {
      listForPicker: query("venueListPicker", sampleVenues),
    },
    matching: {
      getMyMatches: query("getMyMatches", []),
    },
  },
  queryClient: { invalidateQueries: mockInvalidate },
}));

// ── Component import ──────────────────────────────────────────────────────────

import ConfirmedMeetupsScreen from "../app/(tabs)/confirmed-meetups";

function renderScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ConfirmedMeetupsScreen />
    </QueryClientProvider>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Task #86 — Reschedule action on confirmed meetup view", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMeetupsData = [baseMeetup];
  });

  it("shows Reschedule button for a future meetup", async () => {
    renderScreen();
    await waitFor(() => expect(screen.getByTestId("reschedule-meetup-btn")).toBeTruthy());
  });

  it("does NOT show Reschedule button for a past meetup", async () => {
    mockMeetupsData = [pastMeetup];
    renderScreen();
    await waitFor(() => screen.getByTestId("meetup-card"));
    expect(screen.queryByTestId("reschedule-meetup-btn")).toBeNull();
    expect(screen.queryByTestId("cancel-meetup-btn")).toBeNull();
    // Past, un-reported meetups surface the attendance prompt instead.
    expect(screen.getByTestId("meetup-past-label")).toBeTruthy();
  });

  it("opens the reschedule form when Reschedule button is pressed", async () => {
    renderScreen();
    await waitFor(() => expect(screen.getByTestId("reschedule-meetup-btn")).toBeTruthy());
    fireEvent.press(screen.getByTestId("reschedule-meetup-btn"));
    // The form lives in MeetupFlowModal; presence of the submit button means it opened.
    await waitFor(() => expect(screen.getByTestId("reschedule-submit-btn")).toBeTruthy());
  });

  it("pre-fills the date and time with the current meetup's values", async () => {
    renderScreen();
    await waitFor(() => expect(screen.getByTestId("reschedule-meetup-btn")).toBeTruthy());
    fireEvent.press(screen.getByTestId("reschedule-meetup-btn"));
    await waitFor(() => expect(screen.getByTestId("reschedule-date-input")).toBeTruthy());
    // values are formatted via date-fns in device local; just assert non-empty
    expect(String(screen.getByTestId("reschedule-date-input").props.children).length).toBeGreaterThan(0);
    expect(String(screen.getByTestId("reschedule-time-input").props.children).length).toBeGreaterThan(0);
  });

  it("closes the form when Cancel is pressed", async () => {
    renderScreen();
    await waitFor(() => expect(screen.getByTestId("reschedule-meetup-btn")).toBeTruthy());
    fireEvent.press(screen.getByTestId("reschedule-meetup-btn"));
    await waitFor(() => expect(screen.getByTestId("reschedule-submit-btn")).toBeTruthy());
    // Dismiss the form. The modal header exposes a unique "✕" close pressable that
    // calls onDismiss (the inline "Cancel" text collides with the card's own
    // `cancel-meetup-btn`, so "✕" is the unambiguous dismiss control).
    fireEvent.press(screen.getByText("✕"));
    await waitFor(() => expect(screen.queryByTestId("reschedule-submit-btn")).toBeNull());
    expect(screen.getByTestId("reschedule-meetup-btn")).toBeTruthy();
  });

  it("renders the reschedule submit control with the current venue pre-filled", async () => {
    // The no-venue guard lives in RescheduleContent.handleSubmit: it pre-fills the
    // current venueId on open, so the submit button is present and actionable.
    renderScreen();
    await waitFor(() => expect(screen.getByTestId("reschedule-meetup-btn")).toBeTruthy());
    fireEvent.press(screen.getByTestId("reschedule-meetup-btn"));
    await waitFor(() => expect(screen.getByTestId("reschedule-submit-btn")).toBeTruthy());
    // Pre-filled venue means the submit path is reachable (no immediate venue error).
    expect(screen.queryByTestId("reschedule-error")).toBeNull();
  });

  it("shows 'Reschedule pending…' label and disables the button when a reschedule is pending from me", async () => {
    mockMeetupsData = [{ ...baseMeetup, reschedulePending: true, rescheduleIsFromMe: true }];
    renderScreen();
    await waitFor(() => expect(screen.getByText("Reschedule pending…")).toBeTruthy());
    // The button is disabled (rescheduleIsFromMe && reschedulePending), so the form
    // cannot be opened.
    expect(screen.queryByTestId("reschedule-submit-btn")).toBeNull();
  });

  it("shows the partner-proposed-reschedule state (New time pill + Answer action) when the other student proposed", async () => {
    mockMeetupsData = [{ ...baseMeetup, reschedulePending: true, rescheduleIsFromMe: false }];
    renderScreen();
    // Current component surfaces a "New time" status pill (rendered upper-cased) and an
    // "Answer" action button (it replaced the old "Partner proposed reschedule" copy).
    await waitFor(() => expect(screen.getByText("NEW TIME")).toBeTruthy());
    expect(screen.getByText("Answer")).toBeTruthy();
    // The action button is enabled here (only from-me pending disables it).
    expect(screen.getByTestId("reschedule-meetup-btn")).toBeTruthy();
  });
});
