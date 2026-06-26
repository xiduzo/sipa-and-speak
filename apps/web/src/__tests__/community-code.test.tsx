/**
 * Tests for task #461 — Finalise Community Code content aligned with Moderation policy
 *
 * Covers the Gherkin scenarios for Feature #439:
 *   - Member reads the expected conduct (respect, authenticity, keeping safe)
 *   - Member learns how to report a violation (in-app tools + support email only)
 *   - Member learns the consequences (warning, suspension, permanent removal)
 *     aligned with the removal / re-registration-prevention policy
 *   - Reporting section avoids channels that do not exist
 */
import { render, screen, within } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

// Capture the path passed to createFileRoute so we can assert the route is
// registered at the public `/community-code` address (task #463, AC1).
const { createFileRouteMock } = vi.hoisted(() => ({
  createFileRouteMock: vi.fn((_path: string) => () => null),
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: createFileRouteMock,
}));

import { CommunityCodePage } from "@/routes/community-code";
import { TermsPage } from "@/routes/terms";

describe("#461 — Community Code conduct", () => {
  it("renders without authentication with a single top-level heading", () => {
    render(<CommunityCodePage />);

    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent(/community code/i);
  });

  it("describes being respectful, being genuine, and keeping each other safe", () => {
    render(<CommunityCodePage />);

    // Be respectful
    expect(screen.getByText(/be respectful/i)).toBeInTheDocument();
    expect(
      screen.getByText(/no harassment,\s*hate speech, discrimination, or bullying/i),
    ).toBeInTheDocument();

    // Be genuine / authenticity
    expect(screen.getByText(/be genuine/i)).toBeInTheDocument();
    expect(
      screen.getByText(/use a real name and real details/i),
    ).toBeInTheDocument();

    // Keep each other safe
    expect(screen.getByText(/keep each other safe/i)).toBeInTheDocument();
    expect(screen.getByText(/meet in public places/i)).toBeInTheDocument();
  });
});

describe("#461 — reporting a violation", () => {
  it("points members to the in-app reporting tools and the support email", () => {
    render(<CommunityCodePage />);

    const section = within(screen.getByTestId("report-section"));
    expect(section.getByText(/in-app\s+reporting tools/i)).toBeInTheDocument();

    const link = section.getByRole("link", {
      name: /hello@sipandspeak\.nl/i,
    });
    expect(link).toHaveAttribute("href", "mailto:hello@sipandspeak.nl");
  });

  it("names no reporting channel that does not exist", () => {
    render(<CommunityCodePage />);

    const section = screen.getByTestId("report-section");
    // Only the in-app tools and the support email are live channels — no phone
    // line, hotline, WhatsApp, Discord, social handles, or postal address.
    expect(section.textContent).not.toMatch(
      /phone|hotline|call us|whatsapp|telegram|discord|twitter|instagram|facebook|postal|hotline/i,
    );
  });
});

describe("#461 — consequences aligned with Moderation policy", () => {
  it("describes a warning, suspension, or permanent removal", () => {
    render(<CommunityCodePage />);

    const text = screen.getByText(
      /warning, suspension, or permanent\s+removal/i,
    );
    expect(text).toBeInTheDocument();
  });

  it("frames consequences at moderator discretion depending on severity", () => {
    render(<CommunityCodePage />);

    expect(
      screen.getByText(/at our discretion and depending on\s+severity/i),
    ).toBeInTheDocument();
  });
});

describe("#463 — /community-code route is published and discoverable", () => {
  // Scenario: Member opens the Community Code page (route registration / AC1)
  it("registers a file route at the public /community-code address", () => {
    expect(createFileRouteMock).toHaveBeenCalledWith("/community-code");
  });

  // Scenario: Member reaches the Community Code from the Terms page
  it("is linked from the Terms page", () => {
    render(<TermsPage />);

    const link = screen.getByRole("link", { name: /community code/i });
    expect(link).toHaveAttribute("href", "/community-code");
  });
});
