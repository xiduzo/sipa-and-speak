/**
 * Tests for the partner profile screen (`app/partner/[id].tsx`):
 *   #119 — Display comments section on candidate profile
 *   #121 — Handle removed/unavailable candidate profile gracefully
 *   #10  — Matched buddy actions (Propose a meet-up + Unmatch)
 *
 * The match-request send / accept / decline flow that USED to live on this
 * screen (scenarios #120, #122, #123, #124, #127, #128, #129) has been
 * refactored into the suggestion card and the Matches tab. That coverage now
 * lives in `match-request-actions.test.tsx`.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";
import React from "react";

// Mock expo-router (must be before any imports that use it)
const mockBack = jest.fn();
const mockPush = jest.fn();
let mockSearchParams: { id: string; matchRequestId?: string } = { id: "candidate-123" };
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => mockSearchParams,
  useRouter: () => ({ back: mockBack, push: mockPush }),
}));

// The safety/report modal isn't under test here and pulls in heavy deps that
// throw in jsdom — stub it so the profile screen renders.
jest.mock("@/components/flag-user-modal", () => ({
  FlagUserModal: () => null,
}));

// Use mock-prefixed functions so jest.mock() factory can reference them
const mockProfileFn = jest.fn();
const mockCommentsFn = jest.fn();
const mockGetMatchRequestStatusFn = jest.fn();
const mockUnmatch = jest.fn();
const mockInvalidateQueries = jest.fn();

jest.mock("@/utils/trpc", () => ({
  queryClient: { invalidateQueries: (...args: unknown[]) => mockInvalidateQueries(...args) },
  trpc: {
    matching: {
      getPartnerProfile: {
        queryOptions: () => ({
          queryKey: ["matching.getPartnerProfile"],
          queryFn: () => mockProfileFn(),
        }),
      },
      getMatchRequestStatus: {
        queryOptions: () => ({
          queryKey: ["matching.getMatchRequestStatus"],
          queryFn: () => mockGetMatchRequestStatusFn(),
        }),
      },
      getMyMatches: {
        queryOptions: () => ({ queryKey: ["matching.getMyMatches"] }),
      },
      unmatch: {
        mutationOptions: (opts?: Record<string, unknown>) => ({
          mutationFn: mockUnmatch,
          ...(opts ?? {}),
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
  mockSearchParams = { id: "candidate-123" };
  mockBack.mockClear();
  mockPush.mockClear();
  mockUnmatch.mockClear().mockResolvedValue({ success: true });
  mockInvalidateQueries.mockClear();
  mockProfileFn.mockReset().mockResolvedValue(defaultProfile);
  mockCommentsFn.mockReset().mockResolvedValue([]);
  mockGetMatchRequestStatusFn.mockReset().mockResolvedValue({ matchRequestStatus: "none", isMatched: false });
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

// ─── #10: Matched buddy — Propose meet-up + Unmatch ────────────────────────

describe("#10 — Matched buddy actions on profile", () => {
  it("shows Propose + Unmatch when matched (status accepted)", async () => {
    mockGetMatchRequestStatusFn.mockResolvedValue({ matchRequestStatus: "accepted", isMatched: true });

    renderScreen();

    await waitFor(() => {
      expect(screen.getByTestId("propose-meetup-button")).toBeTruthy();
    });
    expect(screen.getByTestId("unmatch-button")).toBeTruthy();
  });

  it("shows matched actions even when the request came from the other buddy", async () => {
    // Regression: the match is bidirectional (studentMatch). The buddy who
    // *received* the original request has matchRequestStatus "none", yet is
    // matched — the server reports isMatched:true and the actions must show.
    mockGetMatchRequestStatusFn.mockResolvedValue({
      matchRequestStatus: "none",
      isMatched: true,
    });

    renderScreen();

    await waitFor(() => {
      expect(screen.getByTestId("propose-meetup-button")).toBeTruthy();
    });
    expect(screen.getByTestId("unmatch-button")).toBeTruthy();
  });

  it("does not show matched actions when not matched", async () => {
    mockGetMatchRequestStatusFn.mockResolvedValue({ matchRequestStatus: "none", isMatched: false });

    renderScreen();

    await waitFor(() => screen.getByTestId("comments-section"));
    expect(screen.queryByTestId("propose-meetup-button")).toBeNull();
    expect(screen.queryByTestId("unmatch-button")).toBeNull();
  });

  it("hides matched actions in the incoming-request context", async () => {
    mockSearchParams = { id: "candidate-123", matchRequestId: "req-abc" };
    mockGetMatchRequestStatusFn.mockResolvedValue({ matchRequestStatus: "accepted", isMatched: true });

    renderScreen();

    await waitFor(() => screen.getByTestId("comments-section"));
    expect(screen.queryByTestId("propose-meetup-button")).toBeNull();
  });

  it("Propose opens the propose-meetup screen with partner params", async () => {
    mockGetMatchRequestStatusFn.mockResolvedValue({ matchRequestStatus: "accepted", isMatched: true });

    renderScreen();

    await waitFor(() => screen.getByTestId("propose-meetup-button"));
    fireEvent.press(screen.getByTestId("propose-meetup-button"));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/propose-meetup",
      params: { partnerId: "candidate-123", partnerName: "Alice" },
    });
  });

  it("Unmatch confirms then calls the unmatch mutation", async () => {
    mockGetMatchRequestStatusFn.mockResolvedValue({ matchRequestStatus: "accepted", isMatched: true });
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});

    renderScreen();

    await waitFor(() => screen.getByTestId("unmatch-button"));
    fireEvent.press(screen.getByTestId("unmatch-button"));

    // Grab the destructive confirm handler from the Alert and invoke it.
    const buttons = (alertSpy.mock.calls[0]?.[2] ?? []) as Array<{
      text?: string;
      onPress?: () => void;
    }>;
    const confirm = buttons.find((b) => b.text === "Unmatch");
    confirm?.onPress?.();

    await waitFor(() => expect(mockUnmatch).toHaveBeenCalled());
    // TanStack Query v5 calls mutationFn(variables, context) — assert variables only.
    expect(mockUnmatch.mock.calls[0]?.[0]).toEqual({ partnerId: "candidate-123" });

    alertSpy.mockRestore();
  });
});
