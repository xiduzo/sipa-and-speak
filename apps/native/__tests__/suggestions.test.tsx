/**
 * Tests for task #133 — Ensure incoming request appears on home page regardless of notification permission status
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react-native";
import React from "react";

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("../components/candidate-card", () => ({
  CandidateCard: () => null,
}));

const mockGetPermissionsAsync = jest.fn();

jest.mock("expo-notifications", () => ({
  getPermissionsAsync: () => mockGetPermissionsAsync(),
}));

const mockDiscoverFn = jest.fn();

jest.mock("@/utils/trpc", () => ({
  trpc: {
    matching: {
      discover: {
        queryOptions: () => ({
          queryKey: ["matching.discover"],
          queryFn: () => mockDiscoverFn(),
        }),
      },
    },
  },
}));

const defaultPartner = {
  userId: "partner-1",
  name: "Alice",
  image: null,
  spokenLanguages: [{ language: "Dutch", proficiency: "native" }],
  learningLanguages: ["English"],
  interests: ["tech_coding"],
  bio: null,
  university: null,
  age: null,
  distance: null,
  score: 0.8,
};

function makeClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

// Import after mocks
import SuggestionsScreen from "../app/suggestions";

function renderScreen() {
  const client = makeClient();
  return render(
    <QueryClientProvider client={client}>
      <SuggestionsScreen />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mockDiscoverFn.mockReset().mockResolvedValue({ partners: [defaultPartner], nextCursor: undefined });
  mockGetPermissionsAsync.mockReset().mockResolvedValue({ granted: true, status: "granted" });
});

// ─── #133: Incoming requests visible regardless of notification permission ──

describe("#133 — Incoming requests visible regardless of notification permission", () => {
  it("shows suggestions list when notifications are disabled", async () => {
    mockGetPermissionsAsync.mockResolvedValue({ granted: false, status: "denied" });

    renderScreen();

    await waitFor(() => {
      expect(screen.getByText("Suggestions")).toBeTruthy();
    });
  });

  it("shows a non-blocking enable-notifications banner when permissions are denied", async () => {
    mockGetPermissionsAsync.mockResolvedValue({ granted: false, status: "denied" });

    renderScreen();

    await waitFor(() => {
      expect(screen.getByTestId("enable-notifications-banner")).toBeTruthy();
    });
  });

  it("banner does not block the suggestions list", async () => {
    mockGetPermissionsAsync.mockResolvedValue({ granted: false, status: "denied" });

    renderScreen();

    await waitFor(() => {
      expect(screen.getByTestId("enable-notifications-banner")).toBeTruthy();
    });
    // Suggestions list is still rendered alongside the banner
    expect(screen.getByText("Suggestions")).toBeTruthy();
  });

  it("does not show the banner when notifications are enabled", async () => {
    mockGetPermissionsAsync.mockResolvedValue({ granted: true, status: "granted" });

    renderScreen();

    await waitFor(() => {
      expect(screen.getByText("Suggestions")).toBeTruthy();
    });
    expect(screen.queryByTestId("enable-notifications-banner")).toBeNull();
  });
});
