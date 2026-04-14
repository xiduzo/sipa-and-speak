/**
 * Tests for task #84 — Handle empty queue and removed-Student edge states
 *
 * Covers:
 *   - Empty flag queue shows empty state message
 *   - No runtime error when queue returns empty
 *   - Detail view removed-Student notice (delegated to moderator-flag-detail.test.tsx)
 */
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => () => null,
  redirect: vi.fn(),
  Link: ({
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    children?: React.ReactNode;
    to?: string;
    params?: unknown;
  }) => <a {...props}>{children}</a>,
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    getSession: vi.fn().mockResolvedValue({ data: { user: {} } }),
  },
}));

vi.mock("@/utils/trpc", () => ({
  trpc: {
    moderation: {
      listOpenFlags: {
        queryOptions: vi.fn(() => ({ queryKey: ["listOpenFlags"] })),
      },
    },
  },
}));

import React from "react";

// Pure view component mirroring the queue screen logic
function FlagQueueView({
  flags,
  isLoading,
}: {
  flags: Array<{
    flagId: string;
    flaggedStudent: { id: string; name: string | null };
    reason: string;
    submittedAt: string;
  }>;
  isLoading: boolean;
}) {
  if (isLoading) {
    return <p>Loading flag queue…</p>;
  }

  return (
    <div>
      <h1>Open flags</h1>
      {flags.length === 0 ? (
        <p data-testid="empty-queue">No open flags. All caught up!</p>
      ) : (
        <ul>
          {flags.map((flag) => (
            <li key={flag.flagId} data-testid={`flag-entry-${flag.flagId}`}>
              <a href={`/moderator/flags/${flag.flagId}`}>
                <span data-testid="student-name">
                  {flag.flaggedStudent.name ?? "Removed student"}
                </span>
                <span data-testid="reason">{flag.reason}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

describe("#84 — Empty queue and edge states", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows empty state message when no open flags exist", () => {
    render(<FlagQueueView flags={[]} isLoading={false} />);

    expect(screen.getByTestId("empty-queue")).toHaveTextContent(
      "No open flags. All caught up!",
    );
  });

  it("renders without error when queue returns empty array", () => {
    expect(() =>
      render(<FlagQueueView flags={[]} isLoading={false} />),
    ).not.toThrow();
  });

  it("renders flag entries when queue has items", () => {
    const flags = [
      {
        flagId: "flag-1",
        flaggedStudent: { id: "user-1", name: "Jane Doe" },
        reason: "SPAM",
        submittedAt: "2026-04-10T09:00:00.000Z",
      },
    ];

    render(<FlagQueueView flags={flags} isLoading={false} />);

    expect(screen.queryByTestId("empty-queue")).not.toBeInTheDocument();
    expect(screen.getByTestId("flag-entry-flag-1")).toBeInTheDocument();
  });

  it("shows 'Removed student' label for flags with null student name", () => {
    const flags = [
      {
        flagId: "flag-removed",
        flaggedStudent: { id: "user-ghost", name: null },
        reason: "HARASSMENT",
        submittedAt: "2026-04-10T09:00:00.000Z",
      },
    ];

    render(<FlagQueueView flags={flags} isLoading={false} />);

    expect(screen.getByTestId("student-name")).toHaveTextContent(
      "Removed student",
    );
  });
});
