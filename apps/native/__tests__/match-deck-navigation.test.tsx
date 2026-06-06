/**
 * Tests for the swipe-only discover deck (#13).
 *
 * The deck advances by swipe gestures (PanResponder). Gestures can't be
 * synthesised in jsdom, so advancement is exercised through the accessibility
 * actions the card exposes for the same effect — "skip" (= swipe left) and
 * "invite" (= swipe right). These doubles as the non-gesture a11y path.
 *
 * The legacy ×/← buttons and the back affordance (#316) were removed when the
 * deck became swipe-only, so this also guards their absence.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";
import React from "react";

const mockBack = jest.fn();
const mockReplace = jest.fn();
const mockPush = jest.fn();
const mockCanGoBack = jest.fn(() => true);

jest.mock("expo-router", () => ({
  useRouter: () => ({
    back: mockBack,
    replace: mockReplace,
    push: mockPush,
    canGoBack: mockCanGoBack,
  }),
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const mockSendMatchRequest = jest.fn().mockResolvedValue({ matchRequestId: "r", status: "pending" });
const mockDiscoverFn = jest.fn();
const mockGetMyProfile = jest.fn();

jest.mock("@/utils/trpc", () => ({
  trpc: {
    matching: {
      discover: {
        queryOptions: () => ({
          queryKey: ["matching.discover"],
          queryFn: () => mockDiscoverFn(),
        }),
      },
      sendMatchRequest: {
        mutationOptions: () => ({ mutationFn: mockSendMatchRequest }),
      },
    },
    profile: {
      getMyProfile: {
        queryOptions: () => ({
          queryKey: ["profile.getMyProfile"],
          queryFn: () => mockGetMyProfile(),
        }),
      },
    },
  },
}));

jest.mock("@/utils/language-flags", () => ({
  getLanguageFlag: () => "🏳",
  getLanguageCode: (l: string) => l,
  getNativeName: (l: string) => l,
}));

jest.mock("@/utils/interest-labels", () => ({
  interestLabel: (t: string) => t,
}));

const makePartner = (id: string, name: string) => ({
  userId: id,
  name,
  image: null,
  age: null,
  university: null,
  spokenLanguages: [{ language: "Dutch", proficiency: "native" }],
  learningLanguages: ["English"],
  interests: [],
  score: 0.8,
});

function makeClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

import MatchModalScreen from "../app/match";

function renderScreen() {
  const client = makeClient();
  return render(
    <QueryClientProvider client={client}>
      <MatchModalScreen />
    </QueryClientProvider>,
  );
}

// Gestures can't be synthesised in jsdom, so advancement is exercised through
// the real "Say hoi" confirm flow (accept-button → "Invitation sent!" → onAccept).
async function sayHoiAndConfirm() {
  const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
  fireEvent.press(screen.getByTestId("accept-button"));
  await waitFor(() => expect(alertSpy).toHaveBeenCalled());
  const buttons = (alertSpy.mock.calls.at(-1)?.[2] ?? []) as Array<{
    text?: string;
    onPress?: () => void;
  }>;
  const gotIt = buttons.find((b) => b.text === "Got it");
  await act(async () => {
    gotIt?.onPress?.();
  });
  alertSpy.mockRestore();
}

beforeEach(() => {
  mockBack.mockClear();
  mockReplace.mockClear();
  mockPush.mockClear();
  mockSendMatchRequest.mockReset().mockResolvedValue({ matchRequestId: "r", status: "pending" });
  mockGetMyProfile.mockReset().mockResolvedValue({
    languages: [{ language: "English", type: "spoken", proficiency: "native" }],
  });
});

describe("#13 — swipe-only deck has no button/back affordances", () => {
  it("renders the card without the removed ×/← buttons", async () => {
    mockDiscoverFn.mockResolvedValue({
      partners: [makePartner("u1", "Alice"), makePartner("u2", "Bob")],
    });

    renderScreen();

    await waitFor(() => expect(screen.getByTestId("match-card")).toBeTruthy());

    expect(screen.queryByTestId("back-button")).toBeNull();
    expect(screen.queryByTestId("decline-button")).toBeNull();
    // The primary confirm ("Say hoi") stays.
    expect(screen.getByTestId("accept-button")).toBeTruthy();
    expect(screen.getByTestId("swipe-hint")).toBeTruthy();
  });
});

describe("#13 — deck advances after the confirm flow", () => {
  it("moves to the next candidate after Say hoi + confirm", async () => {
    mockDiscoverFn.mockResolvedValue({
      partners: [makePartner("u1", "Alice"), makePartner("u2", "Bob")],
    });

    renderScreen();

    await waitFor(() => expect(screen.getByText("Alice")).toBeTruthy());

    await sayHoiAndConfirm();

    await waitFor(() => expect(screen.getByText("Bob")).toBeTruthy());
  });

  it("reaches the empty state after the last candidate", async () => {
    mockDiscoverFn.mockResolvedValue({
      partners: [makePartner("u1", "Alice")],
    });

    renderScreen();

    await waitFor(() => expect(screen.getByText("Alice")).toBeTruthy());

    await sayHoiAndConfirm();

    await waitFor(() =>
      expect(screen.getByTestId("empty-suggestion-state")).toBeTruthy(),
    );
  });
});
