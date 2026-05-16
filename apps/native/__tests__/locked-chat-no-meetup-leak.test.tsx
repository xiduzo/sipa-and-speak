/**
 * Regression test for bug #361 — Locked chat detail must not leak meetup
 * location / weekday / countdown / time, and the header subtitle must NOT
 * claim a time-based unlock for the `scheduled` phase.
 *
 * Real unlock rule: both partners rate and opt in via "Keep in touch."
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react-native";
import React from "react";

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ meetupId: "m-1" }),
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
}));

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

const mockListEntries = jest.fn();

jest.mock("@/utils/trpc", () => ({
  trpc: {
    chat: {
      listEntries: {
        queryOptions: () => ({
          queryKey: ["chat.listEntries"],
          queryFn: mockListEntries,
        }),
      },
    },
    messaging: {
      respondToOptIn: {
        mutationOptions: () => ({ mutationFn: jest.fn() }),
      },
    },
    meetup: {
      getConfirmed: {
        queryOptions: () => ({ queryKey: ["meetup.getConfirmed"] }),
      },
    },
  },
  queryClient: { invalidateQueries: jest.fn() },
}));

import LockedChatScreen from "../app/chat/locked/[meetupId]";

function renderScreen() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <LockedChatScreen />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mockListEntries.mockReset();
});

describe("#361 — locked chat detail does not leak meetup info", () => {
  it("does not render meetup-strip in scheduled phase", async () => {
    const future = new Date(Date.now() + 1000 * 60 * 60 * 26).toISOString();
    mockListEntries.mockResolvedValue([
      {
        kind: "locked",
        id: "m-1",
        meetupId: "m-1",
        partner: { id: "p", name: "Anna", image: null },
        venue: { id: "v", name: "Café Foo", photoUrl: null },
        meetupAt: future,
        phase: "scheduled",
      },
    ]);

    renderScreen();

    await screen.findByTestId("locked-card");
    expect(screen.queryByTestId("meetup-strip")).toBeNull();
    expect(screen.queryByText(/Café Foo/i)).toBeNull();
    expect(screen.queryByText(/CAFÉ FOO/i)).toBeNull();
  });

  it("header subtitle stays neutral — no unlocks-today / time / weekday leak", async () => {
    const future = new Date(Date.now() + 1000 * 60 * 60 * 3).toISOString();
    mockListEntries.mockResolvedValue([
      {
        kind: "locked",
        id: "m-1",
        meetupId: "m-1",
        partner: { id: "p", name: "Anna", image: null },
        venue: { id: "v", name: "Café Foo", photoUrl: null },
        meetupAt: future,
        phase: "scheduled",
      },
    ]);

    renderScreen();

    const status = await screen.findByTestId("locked-status");
    expect(status.props.children).toBe("locked · meet first");
  });

  it("body copy matches real unlock rule (no check-in claim)", async () => {
    const future = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString();
    mockListEntries.mockResolvedValue([
      {
        kind: "locked",
        id: "m-1",
        meetupId: "m-1",
        partner: { id: "p", name: "Anna", image: null },
        venue: { id: "v", name: "Café Foo", photoUrl: null },
        meetupAt: future,
        phase: "scheduled",
      },
    ]);

    renderScreen();

    await waitFor(() => {
      expect(
        screen.queryByText(/check in at the café/i),
      ).toBeNull();
      expect(
        screen.getByText(/meet and choose to keep in touch/i),
      ).toBeTruthy();
    });
  });
});
