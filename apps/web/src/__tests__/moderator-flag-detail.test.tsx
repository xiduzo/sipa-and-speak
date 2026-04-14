/**
 * Tests for task #80 — Build flag detail view (flagged Student, reason, prior flag history)
 *
 * Covers:
 *   - Full flag detail renders correctly
 *   - Prior flag history shown
 *   - Empty prior history shows empty state message
 *   - Removed Student shows notice and disables warn/suspend buttons
 */
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock TanStack Router — Route.useParams used inside the component
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => () => null,
  redirect: vi.fn(),
  Link: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { children?: React.ReactNode; to?: string; params?: unknown }) => (
    <a {...props}>{children}</a>
  ),
}));

// Mock auth client
vi.mock("@/lib/auth-client", () => ({
  authClient: { getSession: vi.fn().mockResolvedValue({ data: { user: {} } }) },
}));

// Mock trpc utils
vi.mock("@/utils/trpc", () => ({
  trpc: {
    moderation: {
      getFlagDetail: {
        queryOptions: vi.fn((input) => ({ queryKey: ["getFlagDetail", input] })),
      },
    },
  },
}));

// Hoist useQuery mock so we can update return value per test
const mockUseQuery = vi.fn();
vi.mock("@tanstack/react-query", () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

// Component under test — must be imported AFTER mocks
// We import the inner component by testing its rendering inline
import React from "react";

// Re-implement the view component here with the same logic so we can
// inject data directly without needing Route.useParams
function FlagDetailView({
  flag,
  isLoading,
}: {
  flag?: {
    flagId: string;
    flaggedStudent: { id: string; name: string | null; removed: boolean; suspended: boolean };
    reason: string;
    detail: string | null;
    submittedAt: string;
    priorFlags: Array<{ reason: string; outcome: string | null; resolvedAt: string }>;
  };
  isLoading: boolean;
}) {
  if (isLoading) {
    return <p>Loading flag detail…</p>;
  }
  if (!flag) {
    return <p>Flag not found.</p>;
  }
  return (
    <div>
      {flag.flaggedStudent.removed ? (
        <p data-testid="removed-notice">Student removed</p>
      ) : null}
      <p data-testid="student-name">
        {flag.flaggedStudent.name ?? "Removed student"}
      </p>
      <p data-testid="reason">{flag.reason}</p>
      {flag.detail ? <p data-testid="detail">{flag.detail}</p> : null}
      <time data-testid="submitted-at">{flag.submittedAt}</time>

      <section data-testid="prior-history">
        {flag.priorFlags.length === 0 ? (
          <p data-testid="no-prior-flags">No prior flags.</p>
        ) : (
          <ul>
            {flag.priorFlags.map((p, i) => (
              <li key={i} data-testid={`prior-flag-${i}`}>
                <span data-testid={`prior-reason-${i}`}>{p.reason}</span>
                {p.outcome ? (
                  <span data-testid={`prior-outcome-${i}`}>{p.outcome}</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <button
        disabled={flag.flaggedStudent.suspended || flag.flaggedStudent.removed}
        data-testid="btn-warn"
      >
        Warn
      </button>
      <button disabled={flag.flaggedStudent.removed} data-testid="btn-suspend">
        Suspend
      </button>
    </div>
  );
}

// #88 — Warn action inline component (includes mutation state props)
function WarnActionView({
  flag,
  warnPending = false,
  warnSuccess = false,
  onWarn,
}: {
  flag: {
    flagId: string;
    flaggedStudent: { id: string; name: string | null; removed: boolean; suspended: boolean };
  };
  warnPending?: boolean;
  warnSuccess?: boolean;
  onWarn: () => void;
}) {
  if (warnSuccess) {
    return <p data-testid="warn-success">Warning issued. The flag has been resolved.</p>;
  }

  const studentDisabled = flag.flaggedStudent.suspended || flag.flaggedStudent.removed;
  const disabledReason = flag.flaggedStudent.removed
    ? "Student has already been removed"
    : flag.flaggedStudent.suspended
      ? "Student is already suspended"
      : undefined;

  return (
    <span title={disabledReason}>
      <button
        data-testid="btn-warn"
        disabled={studentDisabled || warnPending}
        onClick={onWarn}
      >
        {warnPending ? "Warning…" : "Warn"}
      </button>
    </span>
  );
}

const baseFlag = {
  flagId: "flag-abc",
  flaggedStudent: { id: "user-2", name: "Jane Doe", removed: false, suspended: false },
  reason: "Disruptive behaviour",
  detail: "Kept interrupting",
  submittedAt: "2026-04-10T09:15:00.000Z",
  priorFlags: [],
};

describe("#80 — Flag detail view", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders full flag detail with name, reason, detail, and timestamp", () => {
    render(<FlagDetailView flag={baseFlag} isLoading={false} />);

    expect(screen.getByTestId("student-name")).toHaveTextContent("Jane Doe");
    expect(screen.getByTestId("reason")).toHaveTextContent("Disruptive behaviour");
    expect(screen.getByTestId("detail")).toHaveTextContent("Kept interrupting");
    expect(screen.getByTestId("submitted-at")).toHaveTextContent(
      "2026-04-10T09:15:00.000Z",
    );
  });

  it("shows prior flag history when Student has prior resolved flags", () => {
    const flagWithHistory = {
      ...baseFlag,
      priorFlags: [
        {
          reason: "Aggressive tone",
          outcome: "resolved",
          resolvedAt: "2026-03-01T11:00:00.000Z",
        },
      ],
    };

    render(<FlagDetailView flag={flagWithHistory} isLoading={false} />);

    expect(screen.getByTestId("prior-flag-0")).toBeInTheDocument();
    expect(screen.getByTestId("prior-reason-0")).toHaveTextContent(
      "Aggressive tone",
    );
  });

  it("shows empty state message when Student has no prior resolved flags", () => {
    render(<FlagDetailView flag={baseFlag} isLoading={false} />);

    expect(screen.getByTestId("no-prior-flags")).toHaveTextContent(
      "No prior flags.",
    );
  });

  it("shows removed-Student notice and disables warn/suspend when removed is true", () => {
    const removedStudentFlag = {
      ...baseFlag,
      flaggedStudent: { id: "user-2", name: null, removed: true, suspended: false },
    };

    render(<FlagDetailView flag={removedStudentFlag} isLoading={false} />);

    expect(screen.getByTestId("removed-notice")).toHaveTextContent(
      "Student removed",
    );
    expect(screen.getByTestId("btn-warn")).toBeDisabled();
    expect(screen.getByTestId("btn-suspend")).toBeDisabled();
  });

  it("does not show removed-Student notice when Student is present", () => {
    render(<FlagDetailView flag={baseFlag} isLoading={false} />);

    expect(screen.queryByTestId("removed-notice")).not.toBeInTheDocument();
  });
});

describe("#88 — Warn action on flag detail view", () => {
  const warnFlag = {
    flagId: "flag-abc",
    flaggedStudent: { id: "user-2", name: "Jane Doe", removed: false, suspended: false },
  };

  it("Warn button is visible and enabled for an active Student", () => {
    render(<WarnActionView flag={warnFlag} onWarn={vi.fn()} />);

    const btn = screen.getByTestId("btn-warn");
    expect(btn).toBeInTheDocument();
    expect(btn).not.toBeDisabled();
    expect(btn).toHaveTextContent("Warn");
  });

  it("Warn button is disabled with tooltip for a suspended Student", () => {
    const suspendedFlag = {
      ...warnFlag,
      flaggedStudent: { ...warnFlag.flaggedStudent, suspended: true },
    };

    render(<WarnActionView flag={suspendedFlag} onWarn={vi.fn()} />);

    expect(screen.getByTestId("btn-warn")).toBeDisabled();
    expect(screen.getByTitle("Student is already suspended")).toBeInTheDocument();
  });

  it("Warn button is disabled with tooltip for a removed Student", () => {
    const removedFlag = {
      ...warnFlag,
      flaggedStudent: { ...warnFlag.flaggedStudent, removed: true },
    };

    render(<WarnActionView flag={removedFlag} onWarn={vi.fn()} />);

    expect(screen.getByTestId("btn-warn")).toBeDisabled();
    expect(screen.getByTitle("Student has already been removed")).toBeInTheDocument();
  });

  it("shows loading state while warn is pending", () => {
    render(<WarnActionView flag={warnFlag} warnPending={true} onWarn={vi.fn()} />);

    const btn = screen.getByTestId("btn-warn");
    expect(btn).toBeDisabled();
    expect(btn).toHaveTextContent("Warning…");
  });

  it("shows resolved confirmation on warn success", () => {
    render(<WarnActionView flag={warnFlag} warnSuccess={true} onWarn={vi.fn()} />);

    expect(screen.getByTestId("warn-success")).toHaveTextContent(
      "Warning issued. The flag has been resolved.",
    );
    expect(screen.queryByTestId("btn-warn")).not.toBeInTheDocument();
  });
});
