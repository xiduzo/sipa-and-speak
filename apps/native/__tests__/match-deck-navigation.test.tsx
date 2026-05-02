/**
 * Tests for task #316 — backwards navigation in the candidate deck
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import React from "react";

const mockBack = jest.fn();
const mockReplace = jest.fn();
const mockCanGoBack = jest.fn(() => true);

jest.mock("expo-router", () => ({
  useRouter: () => ({
    back: mockBack,
    replace: mockReplace,
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

beforeEach(() => {
  mockBack.mockClear();
  mockReplace.mockClear();
  mockSendMatchRequest.mockReset().mockResolvedValue({ matchRequestId: "r", status: "pending" });
  mockGetMyProfile.mockReset().mockResolvedValue({
    languages: [{ language: "English", type: "spoken", proficiency: "native" }],
  });
});

describe("#316 — Back affordance hidden on first card", () => {
  it("does not show the back button when viewing the first card (index 0)", async () => {
    mockDiscoverFn.mockResolvedValue({
      partners: [makePartner("u1", "Alice"), makePartner("u2", "Bob")],
    });

    renderScreen();

    await waitFor(() => expect(screen.getByTestId("match-card")).toBeTruthy());

    expect(screen.queryByTestId("back-button")).toBeNull();
  });
});

describe("#316 — Navigate back to previously seen candidate", () => {
  it("shows the back button after advancing to the second card", async () => {
    mockDiscoverFn.mockResolvedValue({
      partners: [makePartner("u1", "Alice"), makePartner("u2", "Bob")],
    });

    renderScreen();

    await waitFor(() => expect(screen.getByTestId("match-card")).toBeTruthy());
    expect(screen.queryByTestId("back-button")).toBeNull();

    fireEvent.press(screen.getByTestId("decline-button"));

    await waitFor(() => expect(screen.getByTestId("back-button")).toBeTruthy());
  });

  it("tapping back returns to the previous card", async () => {
    mockDiscoverFn.mockResolvedValue({
      partners: [makePartner("u1", "Alice"), makePartner("u2", "Bob")],
    });

    renderScreen();

    await waitFor(() => expect(screen.getByText("Alice")).toBeTruthy());

    fireEvent.press(screen.getByTestId("decline-button"));

    await waitFor(() => expect(screen.getByText("Bob")).toBeTruthy());

    fireEvent.press(screen.getByTestId("back-button"));

    await waitFor(() => expect(screen.getByText("Alice")).toBeTruthy());
  });
});

describe("#316 — Forward navigation still works after going back", () => {
  it("accept after going back advances the deck forward", async () => {
    mockDiscoverFn.mockResolvedValue({
      partners: [makePartner("u1", "Alice"), makePartner("u2", "Bob"), makePartner("u3", "Carol")],
    });

    renderScreen();

    await waitFor(() => expect(screen.getByText("Alice")).toBeTruthy());

    fireEvent.press(screen.getByTestId("decline-button"));
    await waitFor(() => expect(screen.getByText("Bob")).toBeTruthy());

    fireEvent.press(screen.getByTestId("back-button"));
    await waitFor(() => expect(screen.getByText("Alice")).toBeTruthy());

    fireEvent.press(screen.getByTestId("decline-button"));
    await waitFor(() => expect(screen.getByText("Bob")).toBeTruthy());
  });
});
