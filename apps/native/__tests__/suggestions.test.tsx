/**
 * Tests for tasks:
 *   #126 — Display incoming match requests on home page
 *   #127 — Allow receiver to open requester's profile before deciding
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import React from "react";

const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockDiscoverFn = jest.fn();
const mockIncomingRequestsFn = jest.fn();
const mockSendMatchRequest = jest.fn();

jest.mock("@/utils/trpc", () => ({
  trpc: {
    matching: {
      discover: {
        queryOptions: () => ({
          queryKey: ["matching.discover"],
          queryFn: () => mockDiscoverFn(),
        }),
      },
      getIncomingRequests: {
        queryOptions: () => ({
          queryKey: ["matching.getIncomingRequests"],
          queryFn: () => mockIncomingRequestsFn(),
        }),
      },
      sendMatchRequest: {
        mutationOptions: () => ({ mutationFn: mockSendMatchRequest }),
      },
      getMatchRequestStatus: {
        queryOptions: () => ({
          queryKey: ["matching.getMatchRequestStatus"],
          queryFn: () => Promise.resolve({ matchRequestStatus: "none" }),
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

const defaultIncomingRequest = {
  matchRequestId: "req-1",
  requesterId: "requester-1",
  requesterName: "Bob",
  requesterPhotoUrl: null,
  requesterOfferedLanguages: ["English"],
  requesterTargetedLanguages: ["Dutch"],
  createdAt: "2026-04-13T10:00:00.000Z",
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
  mockPush.mockClear();
  mockDiscoverFn.mockReset().mockResolvedValue({ partners: [defaultPartner], nextCursor: undefined });
  mockIncomingRequestsFn.mockReset().mockResolvedValue([]);
  mockSendMatchRequest.mockReset().mockResolvedValue({ matchRequestId: "r", status: "pending" });
});

// ─── #126: Incoming match requests on home page ─────────────────────────────

describe("#126 — Incoming match requests on home page", () => {
  it("shows incoming request with requester name and language summary", async () => {
    mockIncomingRequestsFn.mockResolvedValue([defaultIncomingRequest]);

    renderScreen();

    await waitFor(() => {
      expect(screen.getByTestId("incoming-requests-section")).toBeTruthy();
    });
    expect(screen.getByTestId("incoming-request-item")).toBeTruthy();
    expect(screen.getByTestId("requester-name")).toBeTruthy();
    expect(screen.getByText("Bob")).toBeTruthy();
  });

  it("shows incoming request in the notifications area (same section)", async () => {
    mockIncomingRequestsFn.mockResolvedValue([defaultIncomingRequest]);

    renderScreen();

    await waitFor(() => {
      expect(screen.getByText("People who want to meet you")).toBeTruthy();
    });
    expect(screen.getByTestId("incoming-request-item")).toBeTruthy();
  });

  it("hides incoming requests section when there are no pending requests", async () => {
    mockIncomingRequestsFn.mockResolvedValue([]);

    renderScreen();

    await waitFor(() => {
      expect(screen.getByText("Suggestions")).toBeTruthy();
    });
    expect(screen.queryByTestId("incoming-requests-section")).toBeNull();
  });

  it("shows multiple incoming requests when there are several", async () => {
    mockIncomingRequestsFn.mockResolvedValue([
      defaultIncomingRequest,
      { ...defaultIncomingRequest, matchRequestId: "req-2", requesterId: "requester-2", requesterName: "Carol" },
    ]);

    renderScreen();

    await waitFor(() => {
      expect(screen.getAllByTestId("incoming-request-item")).toHaveLength(2);
    });
    expect(screen.getByText("Bob")).toBeTruthy();
    expect(screen.getByText("Carol")).toBeTruthy();
  });
});

// ─── #127: Open requester's profile from incoming request ───────────────────

describe("#127 — Open requester's profile from incoming request", () => {
  it("navigates to requester's full profile when tapping a request item from home page", async () => {
    mockIncomingRequestsFn.mockResolvedValue([defaultIncomingRequest]);

    renderScreen();

    await waitFor(() => {
      expect(screen.getByTestId("incoming-request-item")).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId("incoming-request-item"));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/partner/[id]",
      params: {
        id: defaultIncomingRequest.requesterId,
        matchRequestId: defaultIncomingRequest.matchRequestId,
      },
    });
  });

  it("navigates with correct matchRequestId when tapping from notifications area", async () => {
    mockDiscoverFn.mockResolvedValue({ partners: [], nextCursor: undefined });
    mockIncomingRequestsFn.mockResolvedValue([defaultIncomingRequest]);

    renderScreen();

    await waitFor(() => {
      expect(screen.getByTestId("incoming-request-item")).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId("incoming-request-item"));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/partner/[id]",
      params: {
        id: defaultIncomingRequest.requesterId,
        matchRequestId: defaultIncomingRequest.matchRequestId,
      },
    });
  });
});
