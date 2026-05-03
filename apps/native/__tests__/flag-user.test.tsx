/**
 * Tests for task #65 — Build flag submission UI (peer selection + reason)
 *
 * Covers:
 *   - Student selects a predefined reason and submits → mutation called with correct args
 *   - Student adds free-text detail alongside reason → mutation called with detail
 *   - Student taps Submit with no reason → blocked + inline validation error shown
 *   - Free-text detail exceeds 450 chars → character count warning + Submit disabled
 *   - Submission is in-flight → Submit button disabled
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import React from "react";

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

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

import { Alert } from "react-native";
import { FlagUserModal } from "../components/flag-user-modal";

jest.spyOn(Alert, "alert").mockImplementation(() => {});

const mockDismiss = jest.fn();

function renderWithQuery(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

function renderModal() {
  return renderWithQuery(
    <FlagUserModal visible targetId="user-2" targetName="Alice" onDismiss={mockDismiss} />,
  );
}

beforeEach(() => {
  mockFlagStudent.mockReset();
  mockDismiss.mockReset();
  flagStudentCallbacks = {};
});

// ── #65: Flag submission UI scenarios ─────────────────────────────────────────

describe("#65 — Flag submission UI", () => {
  it("calls mutation with targetId and selected reason on submit", async () => {
    mockFlagStudent.mockResolvedValue({ ok: true });
    renderModal();

    fireEvent.press(screen.getByTestId("reason-HARASSMENT"));
    fireEvent.press(screen.getByTestId("flag-submit-btn"));

    await waitFor(() => {
      expect(mockFlagStudent).toHaveBeenCalledWith(
        expect.objectContaining({ targetId: "user-2", reason: "HARASSMENT" }),
        expect.anything(),
      );
    });
  });

  it("includes free-text detail in mutation when provided", async () => {
    mockFlagStudent.mockResolvedValue({ ok: true });
    renderModal();

    fireEvent.press(screen.getByTestId("reason-SPAM"));
    fireEvent.changeText(screen.getByTestId("flag-detail-input"), "They kept sending irrelevant links.");
    fireEvent.press(screen.getByTestId("flag-submit-btn"));

    await waitFor(() => {
      expect(mockFlagStudent).toHaveBeenCalledWith(
        expect.objectContaining({
          targetId: "user-2",
          reason: "SPAM",
          detail: "They kept sending irrelevant links.",
        }),
        expect.anything(),
      );
    });
  });

  it("blocks submission and shows validation error when no reason is selected", () => {
    renderModal();

    fireEvent.press(screen.getByTestId("flag-submit-btn"));

    expect(mockFlagStudent).not.toHaveBeenCalled();
    expect(screen.getByTestId("no-reason-error")).toBeTruthy();
  });

  it("shows character count warning and disables Submit when detail exceeds 450 chars", () => {
    renderModal();

    fireEvent.changeText(screen.getByTestId("flag-detail-input"), "a".repeat(451));

    expect(screen.getByTestId("char-count-warning")).toBeTruthy();
    const btn = screen.getByTestId("flag-submit-btn");
    expect(btn.props.accessibilityState?.disabled).toBe(true);
  });

  it("disables Submit button while mutation is in-flight", async () => {
    mockFlagStudent.mockReturnValue(new Promise(() => {}));
    renderModal();

    fireEvent.press(screen.getByTestId("reason-OFFENSIVE_LANGUAGE"));
    fireEvent.press(screen.getByTestId("flag-submit-btn"));

    await waitFor(() => {
      const btn = screen.getByTestId("flag-submit-btn");
      expect(btn.props.accessibilityState?.disabled).toBe(true);
    });
  });
});
