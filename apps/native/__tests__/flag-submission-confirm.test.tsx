/**
 * Tests for task #74 — Confirm flag submission to the flagging Student
 *
 * Covers:
 *   - Successful submission → confirmation screen shown (not the form)
 *   - Confirmation screen contains "Moderator will review" message
 *   - Done button on confirmation screen calls router.back()
 *   - Backend error → inline error message shown (not confirmation)
 *   - Backend error → confirmation screen NOT shown
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import React from "react";

// ── Router mock ───────────────────────────────────────────────────────────────

const mockBack = jest.fn();
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ targetId: "user-2", targetName: "Alice" }),
  useRouter: () => ({ back: mockBack }),
}));

// ── tRPC / query mock ─────────────────────────────────────────────────────────

const mockFlagStudent = jest.fn();
let flagStudentCallbacks: { onSuccess?: () => void; onError?: (e: Error) => void } = {};

jest.mock("@/utils/trpc", () => ({
  trpc: {
    moderation: {
      flagStudent: {
        mutationOptions: (opts: { onSuccess?: () => void; onError?: (e: Error) => void }) => {
          flagStudentCallbacks = opts ?? {};
          return {
            mutationFn: mockFlagStudent,
            onSuccess: opts?.onSuccess,
            onError: opts?.onError,
          };
        },
      },
    },
  },
  queryClient: { invalidateQueries: jest.fn() },
}));

import FlagUserScreen from "../app/flag-user";

function renderWithQuery(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  mockFlagStudent.mockReset();
  mockBack.mockReset();
  flagStudentCallbacks = {};
});

// ── #74: Confirmation screen scenarios ────────────────────────────────────────

describe("#74 — Flag submission confirmation", () => {
  it("shows confirmation screen after successful submission", async () => {
    mockFlagStudent.mockResolvedValue({ ok: true });
    renderWithQuery(<FlagUserScreen />);

    fireEvent.press(screen.getByTestId("reason-HARASSMENT"));
    fireEvent.press(screen.getByTestId("flag-submit-btn"));

    await waitFor(() => {
      expect(flagStudentCallbacks.onSuccess).toBeDefined();
    });
    flagStudentCallbacks.onSuccess?.();

    await waitFor(() => {
      expect(screen.getByTestId("flag-confirmation")).toBeTruthy();
    });
  });

  it("confirmation message informs Student that Moderator will review", async () => {
    mockFlagStudent.mockResolvedValue({ ok: true });
    renderWithQuery(<FlagUserScreen />);

    fireEvent.press(screen.getByTestId("reason-SPAM"));
    fireEvent.press(screen.getByTestId("flag-submit-btn"));

    flagStudentCallbacks.onSuccess?.();

    await waitFor(() => {
      expect(screen.getByText(/Moderator will review/i)).toBeTruthy();
    });
  });

  it("Done button on confirmation screen calls router.back()", async () => {
    mockFlagStudent.mockResolvedValue({ ok: true });
    renderWithQuery(<FlagUserScreen />);

    fireEvent.press(screen.getByTestId("reason-OTHER"));
    fireEvent.press(screen.getByTestId("flag-submit-btn"));

    flagStudentCallbacks.onSuccess?.();

    await waitFor(() => {
      expect(screen.getByTestId("flag-confirmation-done")).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId("flag-confirmation-done"));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it("shows inline error when backend returns an error", async () => {
    mockFlagStudent.mockRejectedValue(new Error("Something went wrong"));
    renderWithQuery(<FlagUserScreen />);

    fireEvent.press(screen.getByTestId("reason-SPAM"));
    fireEvent.press(screen.getByTestId("flag-submit-btn"));

    flagStudentCallbacks.onError?.(new Error("Something went wrong"));

    await waitFor(() => {
      expect(screen.getByTestId("flag-submit-error")).toBeTruthy();
    });
  });

  it("does not show confirmation when backend returns an error", async () => {
    mockFlagStudent.mockRejectedValue(new Error("Network error"));
    renderWithQuery(<FlagUserScreen />);

    fireEvent.press(screen.getByTestId("reason-HARASSMENT"));
    fireEvent.press(screen.getByTestId("flag-submit-btn"));

    flagStudentCallbacks.onError?.(new Error("Network error"));

    await waitFor(() => {
      expect(screen.queryByTestId("flag-confirmation")).toBeNull();
    });
  });
});
