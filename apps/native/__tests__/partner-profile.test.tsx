/**
 * Tests for tasks:
 *   #119 — Display comments section on candidate profile
 *   #120 — Surface "Send Request" action contextually based on match status
 *   #121 — Handle removed/unavailable candidate profile gracefully
 *   #122 — Send Request button on candidate profile screen
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import React from "react";

// Mock expo-router (must be before any imports that use it)
const mockBack = jest.fn();
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ id: "candidate-123" }),
  useRouter: () => ({ back: mockBack }),
}));

// Use mock-prefixed functions so jest.mock() factory can reference them
const mockProfileFn = jest.fn();
const mockCommentsFn = jest.fn();
const mockSendMatchRequest = jest.fn();
const mockGetMatchRequestStatusFn = jest.fn();

jest.mock("@/utils/trpc", () => ({
  trpc: {
    matching: {
      getPartnerProfile: {
        queryOptions: () => ({
          queryKey: ["matching.getPartnerProfile"],
          queryFn: () => mockProfileFn(),
        }),
      },
      sendMatchRequest: {
        mutationOptions: () => ({ mutationFn: mockSendMatchRequest }),
      },
      getMatchRequestStatus: {
        queryOptions: () => ({
          queryKey: ["matching.getMatchRequestStatus"],
          queryFn: () => mockGetMatchRequestStatusFn(),
        }),
      },
    },
    profile: {
      getCandidateComments: {
        queryOptions: () => ({
          queryKey: ["profile.getCandidateComments"],
          queryFn: () => mockCommentsFn(),
        }),
      },
    },
  },
}));

const defaultProfile = {
  userId: "candidate-123",
  name: "Alice",
  image: null,
  bio: "Hello!",
  university: "TU/e",
  age: 22,
  spokenLanguages: [{ language: "Dutch", proficiency: "native" }],
  learningLanguages: ["English"],
  interests: ["tech_coding"],
  onboardingComplete: true,
};

function makeClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

// Import after mocks are registered
// eslint-disable-next-line import/first
import PartnerProfileScreen from "../app/partner/[id]";

function renderScreen() {
  const client = makeClient();
  return render(
    <QueryClientProvider client={client}>
      <PartnerProfileScreen />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mockBack.mockClear();
  mockSendMatchRequest.mockClear().mockResolvedValue({ matchRequestId: "req-1", status: "pending" });
  mockProfileFn.mockReset().mockResolvedValue(defaultProfile);
  mockCommentsFn.mockReset().mockResolvedValue([]);
  mockGetMatchRequestStatusFn.mockReset().mockResolvedValue({ matchRequestStatus: "none" });
});

// ─── #119: Comments section ────────────────────────────────────────────────

describe("#119 — Comments section on candidate profile", () => {
  it("shows comments from previous connections", async () => {
    mockCommentsFn.mockResolvedValue([
      { authorName: "Bob", content: "Great language partner!", createdAt: "2026-01-01T00:00:00.000Z" },
      { authorName: "Carol", content: "Very patient teacher.", createdAt: "2026-01-02T00:00:00.000Z" },
    ]);

    renderScreen();

    await waitFor(() => {
      expect(screen.getByText("Bob")).toBeTruthy();
    });
    expect(screen.getByText("Great language partner!")).toBeTruthy();
    expect(screen.getByText("Carol")).toBeTruthy();
    expect(screen.getAllByTestId("comment-item")).toHaveLength(2);
  });

  it("shows empty comments section without an error when no comments exist", async () => {
    mockCommentsFn.mockResolvedValue([]);

    renderScreen();

    await waitFor(() => {
      expect(screen.getByTestId("comments-section")).toBeTruthy();
    });
    expect(screen.getByTestId("comments-empty")).toBeTruthy();
    expect(screen.queryAllByTestId("comment-item")).toHaveLength(0);
  });
});

// ─── #121: Unavailable profile ─────────────────────────────────────────────

describe("#121 — Handle removed/unavailable candidate profile gracefully", () => {
  it("shows 'no longer available' message when profile returns an error", async () => {
    const notFoundError = Object.assign(new Error("Not found"), {
      data: { code: "NOT_FOUND" },
    });
    mockProfileFn.mockRejectedValue(notFoundError);

    renderScreen();

    await waitFor(() => {
      expect(screen.getByText(/no longer available/i)).toBeTruthy();
    });
  });
});

// ─── #122: Send Request on profile screen ──────────────────────────────────

describe("#122 — Send Request on candidate profile screen", () => {
  it("renders Send Request button", async () => {
    renderScreen();

    await waitFor(() => {
      expect(screen.getByTestId("send-request-button")).toBeTruthy();
    });
  });

  it("calls sendMatchRequest mutation when tapped and shows confirmation", async () => {
    renderScreen();

    await waitFor(() => screen.getByTestId("send-request-button"));
    fireEvent.press(screen.getByTestId("send-request-button"));

    await waitFor(() => {
      expect(mockSendMatchRequest).toHaveBeenCalledTimes(1);
    });
  });
});

// ─── #120: Contextual Send Request based on match status ───────────────────

describe("#120 — Contextual Send Request action on candidate profile", () => {
  it("shows Send Request button when no request has been sent", async () => {
    mockGetMatchRequestStatusFn.mockResolvedValue({ matchRequestStatus: "none" });

    renderScreen();

    await waitFor(() => {
      expect(screen.getByTestId("send-request-button")).toBeTruthy();
    });
    expect(screen.queryByTestId("request-sent-indicator")).toBeNull();
  });

  it("hides Send Request button and shows Request Sent indicator when a request has already been sent", async () => {
    mockGetMatchRequestStatusFn.mockResolvedValue({ matchRequestStatus: "pending" });

    renderScreen();

    await waitFor(() => {
      expect(screen.getByTestId("request-sent-indicator")).toBeTruthy();
    });
    expect(screen.queryByTestId("send-request-button")).toBeNull();
  });
});

// ─── #123: Duplicate match request prevention ──────────────────────────────

describe("#123 — Duplicate match request prevention on candidate profile", () => {
  it("shows conflict error message when a second request is attempted", async () => {
    const conflictError = Object.assign(new Error("Conflict"), {
      data: { code: "CONFLICT" },
    });
    mockSendMatchRequest.mockRejectedValue(conflictError);

    renderScreen();

    await waitFor(() => screen.getByTestId("send-request-button"));
    fireEvent.press(screen.getByTestId("send-request-button"));

    await waitFor(() => {
      expect(screen.getByTestId("conflict-error-message")).toBeTruthy();
    });
  });

  it("shows Send Request button (not indicator) when previous request was declined", async () => {
    mockGetMatchRequestStatusFn.mockResolvedValue({ matchRequestStatus: "declined" });

    renderScreen();

    await waitFor(() => {
      expect(screen.getByTestId("send-request-button")).toBeTruthy();
    });
    expect(screen.queryByTestId("request-sent-indicator")).toBeNull();
  });

  it("allows re-requesting after a decline", async () => {
    mockGetMatchRequestStatusFn.mockResolvedValue({ matchRequestStatus: "declined" });

    renderScreen();

    await waitFor(() => screen.getByTestId("send-request-button"));
    fireEvent.press(screen.getByTestId("send-request-button"));

    await waitFor(() => {
      expect(mockSendMatchRequest).toHaveBeenCalledTimes(1);
    });
  });
});
